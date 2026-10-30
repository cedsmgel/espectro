import { getAuthUser, jsonResponse, errorResponse } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  MEDIA_BUCKET?: R2Bucket;
  BUCKET?: R2Bucket;
}

// Garante que a tabela posts e todas as suas colunas existam (self-healing no D1)
async function ensurePostsTable(db: D1Database) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author_id INTEGER NOT NULL REFERENCES users(id),
        community_id INTEGER REFERENCES communities(id),
        content TEXT NOT NULL,
        title TEXT,
        media_url TEXT,
        media_type TEXT,
        post_type TEXT DEFAULT 'scrap',
        upvotes INTEGER DEFAULT 0,
        downvotes INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch {
    // ignore
  }
}

// GET: lista os posts com filtros opcionais (community_id, community_slug, post_type, feed)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    await ensurePostsTable(env.DB);
    const url = new URL(request.url);
    const communityId = url.searchParams.get("community_id");
    const communitySlug = url.searchParams.get("community_slug");
    const postType = url.searchParams.get("post_type");
    const feed = url.searchParams.get("feed"); // 'home' | 'all'
    const secret = env.JWT_SECRET || "troque-este-segredo";
    const authUser = await getAuthUser(request, secret);

    let query = `
      SELECT 
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
      WHERE 1=1
    `;

    const params: unknown[] = [];

    if (communityId) {
      query += ` AND p.community_id = ?`;
      params.push(Number(communityId));
    } else if (communitySlug) {
      query += ` AND (c.slug = ? OR CAST(c.id AS TEXT) = ?)`;
      params.push(communitySlug, communitySlug);
    } else if (feed === "home" && authUser) {
      // Feed Principal: exibe posts gerais (sem comunidade) E posts das comunidades em que o usuário participa
      query += ` AND (p.community_id IS NULL OR p.community_id IN (SELECT community_id FROM community_members WHERE user_id = ?))`;
      params.push(authUser.id);
    }

    if (postType) {
      query += ` AND p.post_type = ?`;
      params.push(postType);
    }

    query += ` ORDER BY p.id DESC LIMIT 50`;

    const stmt = env.DB.prepare(query);
    const { results } = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

    return jsonResponse(results || []);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao carregar posts.";
    return errorResponse(message, 500);
  }
};

// POST: cria um novo post autenticado ou computa voto (upvote / downvote)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    await ensurePostsTable(env.DB);
    const secret = env.JWT_SECRET || "troque-este-segredo";

    // Validação do JWT
    const user = await getAuthUser(request, secret);
    if (!user) {
      return errorResponse("Não autorizado. Token inválido ou ausente.", 401);
    }

    let body: {
      action?: "create" | "vote";
      post_id?: number;
      vote_type?: "up" | "down";
      content?: string;
      title?: string;
      community_id?: number | null;
      community_slug?: string | null;
      media_url?: string;
      media_type?: "image" | "video" | "gif" | null;
      post_type?: "discussion" | "scrap";
    };

    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    // Ação de Voto (Upvote / Downvote)
    if (body.action === "vote" && body.post_id) {
      const postId = Number(body.post_id);
      const isUp = body.vote_type === "up";
      const column = isUp ? "upvotes" : "downvotes";

      await env.DB.prepare(`UPDATE posts SET ${column} = ${column} + 1 WHERE id = ?`)
        .bind(postId)
        .run();

      const updated = await env.DB.prepare(
        "SELECT id, upvotes, downvotes FROM posts WHERE id = ?"
      )
        .bind(postId)
        .first();

      return jsonResponse(updated || { id: postId });
    }

    // Criação de Post
    const { content, title, community_id, community_slug, media_url, media_type, post_type } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return errorResponse("O conteúdo da postagem não pode ser vazio.", 400);
    }

    const cleanContent = content.trim();
    const cleanTitle = title ? title.trim() : null;
    const cleanMediaUrl = media_url ? media_url.trim() : null;
    const cleanMediaType = media_type && ["image", "video", "gif"].includes(media_type) ? media_type : null;
    const cleanPostType = post_type === "discussion" ? "discussion" : "scrap";

    let commId = community_id ? Number(community_id) : null;

    // Se forneceu slug em vez de ID, resolve o community_id
    if (!commId && community_slug) {
      const commBySlug = await env.DB.prepare("SELECT id FROM communities WHERE slug = ?")
        .bind(community_slug)
        .first<{ id: number }>();
      if (commBySlug) {
        commId = commBySlug.id;
      }
    }

    // Se informou comunidade, valida se ela existe
    if (commId) {
      const comm = await env.DB.prepare("SELECT id FROM communities WHERE id = ?")
        .bind(commId)
        .first();
      if (!comm) {
        return errorResponse("Comunidade especificada não encontrada.", 404);
      }
    }

    const insertResult = await env.DB.prepare(
      `INSERT INTO posts (
        author_id, 
        community_id, 
        content, 
        title, 
        media_url, 
        media_type, 
        post_type, 
        upvotes, 
        downvotes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`
    )
      .bind(
        user.id,
        commId,
        cleanContent,
        cleanTitle,
        cleanMediaUrl,
        cleanMediaType,
        cleanPostType
      )
      .run();

    const newId = insertResult.meta.last_row_id;

    // Busca o post salvo no D1 com os dados completos do autor e comunidade
    const createdPost = await env.DB.prepare(
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
        0 AS comments_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN communities c ON p.community_id = c.id
      WHERE p.id = ?`
    )
      .bind(newId)
      .first();

    return jsonResponse(
      createdPost || {
        id: newId,
        author_id: user.id,
        author_name: user.username,
        community_id: commId,
        title: cleanTitle,
        content: cleanContent,
        media_url: cleanMediaUrl,
        media_type: cleanMediaType,
        post_type: cleanPostType,
        upvotes: 0,
        downvotes: 0,
        comments_count: 0,
        created_at: new Date().toISOString(),
      },
      201
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao processar post.";
    return errorResponse(message, 500);
  }
};

// DELETE: remove o post e primeiro deleta o arquivo físico no Cloudflare R2
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = env.JWT_SECRET || "troque-este-segredo";
    const user = await getAuthUser(request, secret);

    if (!user) {
      return errorResponse("Não autorizado. Faça login para excluir.", 401);
    }

    const url = new URL(request.url);
    const postId = url.searchParams.get("id");

    if (!postId || isNaN(Number(postId))) {
      return errorResponse("ID do post é obrigatório.", 400);
    }

    const numericPostId = Number(postId);

    // 1. Busca o post para verificar a autoria e se possui mídia no R2
    const post = await env.DB.prepare(
      "SELECT id, author_id, media_url, media_type FROM posts WHERE id = ?"
    )
      .bind(numericPostId)
      .first<{ id: number; author_id: number; media_url: string | null; media_type: string | null }>();

    if (!post) {
      return errorResponse("Publicação não encontrada.", 404);
    }

    // Apenas o autor do post tem permissão de exclusão
    if (post.author_id !== user.id) {
      return errorResponse("Você não tem permissão para excluir esta publicação.", 403);
    }

    // 2. Se tiver mídia associada, chama env.MEDIA_BUCKET.delete(key) PRIMEIRO
    if (post.media_url) {
      let r2Key: string | null = null;

      // Extrai a chave do arquivo (ex: videos/... ou images/...)
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
            console.error("Erro ao deletar arquivo do Cloudflare R2:", r2Err);
            // Continua para não travar a deleção no banco caso já tenha sido removido
          }
        }
      }
    }

    // 3. Remove comentários do post no D1 para manter integridade
    try {
      await env.DB.prepare("DELETE FROM comments WHERE post_id = ?").bind(numericPostId).run();
    } catch {
      // ignore
    }

    // 4. Remove o registro do post do banco D1
    await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(numericPostId).run();

    return jsonResponse({
      success: true,
      message: "Publicação e arquivos de mídia associados foram excluídos com sucesso.",
      deleted_id: numericPostId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao deletar publicação.";
    return errorResponse(message, 500);
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
};
