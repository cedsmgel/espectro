import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError, canViewAuthorContent } from "../../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  MEDIA_BUCKET?: R2Bucket;
  BUCKET?: R2Bucket;
}

// GET /api/posts/:id - Retorna um post específico
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { params, env } = context;
    const postId = params.id as string;
    if (!postId || isNaN(Number(postId))) {
      return errorResponse("ID da publicação inválido.", 400);
    }

    const numericPostId = Number(postId);

    const post = await env.DB.prepare(
      `SELECT 
        p.id,
        p.title,
        p.content,
        p.media_url,
        p.media_type,
        p.upvotes,
        p.downvotes,
        p.post_type,
        p.created_at,
        p.author_id,
        u.username AS author_name,
        u.avatar_url AS author_avatar,
        p.community_id,
        c.name AS community_name,
        c.slug AS community_slug,
        c.icon_color AS community_icon_color,
        (SELECT COUNT(1) FROM comments WHERE comments.post_id = p.id) AS comments_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN communities c ON p.community_id = c.id
      WHERE p.id = ?`
    )
      .bind(numericPostId)
      .first();

    if (!post) {
      return errorResponse("Publicação não encontrada.", 404);
    }

    const viewer = await getAuthUser(context.request, getJwtSecret(env));
    const allowed = await canViewAuthorContent(
      env.DB,
      (post as { author_id: number }).author_id,
      viewer ? viewer.id : null
    );
    if (!allowed) {
      return errorResponse("Publicação não encontrada.", 404);
    }

    return jsonResponse(post);
  } catch (err: unknown) {
    return serverError(err, "posts/[id]");
  }
};

// PUT /api/posts/:id - Edição do post pelo autor
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const { params, request, env } = context;
    const postId = params.id as string;
    if (!postId || isNaN(Number(postId))) {
      return errorResponse("ID da publicação inválido.", 400);
    }
    const numericPostId = Number(postId);

    const secret = getJwtSecret(env);
    const user = await getAuthUser(request, secret);
    if (!user) {
      return errorResponse("Não autorizado. Faça login para editar esta publicação.", 401);
    }

    // 1. Busca post existente e valida autoria
    const post = await env.DB.prepare(
      "SELECT id, author_id, content, title FROM posts WHERE id = ?"
    )
      .bind(numericPostId)
      .first<{ id: number; author_id: number; content: string; title: string | null }>();

    if (!post) {
      return errorResponse("Publicação não encontrada.", 404);
    }

    if (post.author_id !== user.id) {
      return errorResponse("Você não tem permissão para editar esta publicação.", 403);
    }

    // 2. Extrai novos dados do corpo
    const body: any = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    const cleanContent = body.content ? String(body.content).trim() : "";
    if (!cleanContent) {
      return errorResponse("O conteúdo da publicação não pode ser vazio.", 400);
    }

    if (cleanContent.length > 10000) {
      return errorResponse("O conteúdo da publicação excede 10.000 caracteres.", 400);
    }
    if (body.title && String(body.title).trim().length > 200) {
      return errorResponse("O título excede 200 caracteres.", 400);
    }

    const cleanTitle = body.title !== undefined ? (body.title ? String(body.title).trim() : null) : post.title;

    // 3. Atualiza no D1
    await env.DB.prepare(
      "UPDATE posts SET content = ?, title = ? WHERE id = ?"
    )
      .bind(cleanContent, cleanTitle, numericPostId)
      .run();

    // 4. Retorna a publicação atualizada com os dados do autor e comunidade
    const updatedPost = await env.DB.prepare(
      `SELECT 
        p.id,
        p.title,
        p.content,
        p.media_url,
        p.media_type,
        p.upvotes,
        p.downvotes,
        p.post_type,
        p.created_at,
        p.author_id,
        u.username AS author_name,
        u.avatar_url AS author_avatar,
        p.community_id,
        c.name AS community_name,
        c.slug AS community_slug,
        c.icon_color AS community_icon_color,
        (SELECT COUNT(1) FROM comments WHERE comments.post_id = p.id) AS comments_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN communities c ON p.community_id = c.id
      WHERE p.id = ?`
    )
      .bind(numericPostId)
      .first();

    return jsonResponse({
      success: true,
      message: "Publicação atualizada com sucesso.",
      post: updatedPost,
    });
  } catch (err: unknown) {
    return serverError(err, "posts/[id]");
  }
};

// DELETE /api/posts/:id - Exclusão do post e remoção do arquivo de mídia no Cloudflare R2
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const { params, request, env } = context;
    const postId = params.id as string;
    if (!postId || isNaN(Number(postId))) {
      return errorResponse("ID da publicação inválido.", 400);
    }
    const numericPostId = Number(postId);

    const secret = getJwtSecret(env);
    const user = await getAuthUser(request, secret);
    if (!user) {
      return errorResponse("Não autorizado. Faça login para excluir.", 401);
    }

    // 1. Busca o post para verificar autoria e mídia associada
    const post = await env.DB.prepare(
      "SELECT id, author_id, media_url, media_type FROM posts WHERE id = ?"
    )
      .bind(numericPostId)
      .first<{ id: number; author_id: number; media_url: string | null; media_type: string | null }>();

    if (!post) {
      return errorResponse("Publicação não encontrada.", 404);
    }

    if (post.author_id !== user.id) {
      return errorResponse("Você não tem permissão para excluir esta publicação.", 403);
    }

    // 2. Se possuir mídia (vídeo ou imagem), remove do Cloudflare R2 para evitar arquivos órfãos
    if (post.media_url) {
      let r2Key: string | null = null;
      if (post.media_url.includes("/api/media/")) {
        const parts = post.media_url.split("/api/media/");
        r2Key = parts[1] ? decodeURIComponent(parts[1].split("?")[0]) : null;
      } else if (post.media_url.startsWith("videos/") || post.media_url.startsWith("images/")) {
        r2Key = post.media_url.split("?")[0];
      }

      if (r2Key) {
        const bucket = env.MEDIA_BUCKET || env.BUCKET;
        if (bucket) {
          try {
            await bucket.delete(r2Key);
          } catch (r2Err) {
            console.error("Erro ao deletar arquivo de mídia do Cloudflare R2:", r2Err);
          }
        }
      }
    }

    // 3. Remove os comentários relacionados no D1
    try {
      await env.DB.prepare("DELETE FROM comments WHERE post_id = ?").bind(numericPostId).run();
    } catch {}

    // 4. Remove a publicação do D1
    await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(numericPostId).run();

    return jsonResponse({
      success: true,
      message: "Publicação e arquivos de mídia associados foram excluídos com sucesso.",
      deleted_id: numericPostId,
    });
  } catch (err: unknown) {
    return serverError(err, "posts/[id]");
  }
};

