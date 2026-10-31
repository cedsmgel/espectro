import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError, rateLimit } from "../_shared/auth";
import { notify } from "../_shared/notifications";
import type { PushEnv } from "../_shared/push";

export interface Env extends PushEnv {
  JWT_SECRET: string;
}

// GET: lista comentários de um post específico (com suporte a threads aninhadas)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const postId = url.searchParams.get("post_id");

    if (!postId) {
      return errorResponse("O parâmetro 'post_id' é obrigatório.", 400);
    }

    const query = `
      SELECT 
        c.id,
        c.post_id,
        c.author_id,
        c.parent_id,
        c.content,
        c.created_at,
        u.username AS author_name,
        u.avatar_url AS author_avatar
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.id ASC
    `;

    const { results } = await env.DB.prepare(query).bind(Number(postId)).all();

    return jsonResponse(results || []);
  } catch (err: unknown) {
    return serverError(err, "comments");
  }
};

// POST: cria um novo comentário ou resposta em thread (parent_id)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = getJwtSecret(env);

    // Validação JWT
    const user = await getAuthUser(request, secret);
    if (!user) {
      return errorResponse("Não autorizado. Faça login para comentar.", 401);
    }

    let body: {
      post_id?: number;
      parent_id?: number | null;
      content?: string;
    };

    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    const { post_id, parent_id, content } = body;

    if (!post_id) {
      return errorResponse("post_id é obrigatório.", 400);
    }

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return errorResponse("O comentário não pode ser vazio.", 400);
    }

    const cleanContent = content.trim();
    if (cleanContent.length > 2000) {
      return errorResponse("O comentário excede 2.000 caracteres.", 400);
    }

    const limited = await rateLimit(env.DB, request, "comment-create", 60, 600, user.id);
    if (limited) return limited;

    const parentId = parent_id ? Number(parent_id) : null;

    // Valida se o post existe
    const post = await env.DB.prepare("SELECT id, author_id FROM posts WHERE id = ?")
      .bind(Number(post_id))
      .first<{ id: number; author_id: number }>();

    if (!post) {
      return errorResponse("Postagem não encontrada.", 404);
    }

    // Se informou parent_id, valida se o comentário pai existe
    let parentAuthorId: number | null = null;
    if (parentId) {
      const parentComment = await env.DB.prepare(
        "SELECT id, author_id FROM comments WHERE id = ? AND post_id = ?"
      )
        .bind(parentId, Number(post_id))
        .first<{ id: number; author_id: number }>();

      if (!parentComment) {
        return errorResponse("Comentário pai não encontrado neste post.", 404);
      }
      parentAuthorId = parentComment.author_id;
    }

    const insertResult = await env.DB.prepare(
      "INSERT INTO comments (post_id, author_id, parent_id, content) VALUES (?, ?, ?, ?)"
    )
      .bind(Number(post_id), user.id, parentId, cleanContent)
      .run();

    const newId = insertResult.meta.last_row_id;

    // Avisa o autor da publicação e, se for uma resposta, o autor do comentário respondido
    const common = {
      actor: user,
      postId: post.id,
      commentId: Number(newId),
      content: cleanContent,
    };
    const notifications = [
      notify(env, { ...common, userId: post.author_id, type: "post_comment", dedupeKey: `c:${newId}` }),
    ];
    if (parentAuthorId !== null && parentAuthorId !== post.author_id) {
      notifications.push(
        notify(env, { ...common, userId: parentAuthorId, type: "comment_reply", dedupeKey: `r:${newId}` })
      );
    }
    context.waitUntil(Promise.all(notifications));

    return jsonResponse(
      {
        id: newId,
        post_id: Number(post_id),
        author_id: user.id,
        author_name: user.username,
        parent_id: parentId,
        content: cleanContent,
        created_at: new Date().toISOString(),
      },
      201
    );
  } catch (err: unknown) {
    return serverError(err, "comments");
  }
};
