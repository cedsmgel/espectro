import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET /api/activity: minha atividade recente (comentários e votos), só para mim
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const [comments, votes] = await Promise.all([
      env.DB.prepare(
        `SELECT c.id, c.post_id, c.content, strftime('%Y-%m-%dT%H:%M:%SZ', c.created_at) AS created_at,
                p.title AS post_title, p.content AS post_content
         FROM comments c JOIN posts p ON p.id = c.post_id
         WHERE c.author_id = ? ORDER BY c.id DESC LIMIT 50`
      )
        .bind(user.id)
        .all(),
      env.DB.prepare(
        `SELECT v.post_id, v.vote, p.title AS post_title, p.content AS post_content
         FROM post_votes v JOIN posts p ON p.id = v.post_id
         WHERE v.user_id = ? ORDER BY v.rowid DESC LIMIT 50`
      )
        .bind(user.id)
        .all(),
    ]);

    return jsonResponse({ comments: comments.results || [], votes: votes.results || [] });
  } catch (err: unknown) {
    return serverError(err, "activity");
  }
};
