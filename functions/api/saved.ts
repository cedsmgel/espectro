import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// POST /api/saved { post_id }: salva a publicação (a lista sai de GET /api/posts?saved=1)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "saved", 120, 3600, user.id);
    if (limited) return limited;

    const body: any = await request.json().catch(() => null);
    const postId = Number(body?.post_id);
    if (!Number.isInteger(postId) || postId <= 0) return errorResponse("Publicação inválida.", 400);

    const post = await env.DB.prepare("SELECT id FROM posts WHERE id = ?").bind(postId).first();
    if (!post) return errorResponse("Publicação não encontrada.", 404);

    await env.DB.prepare("INSERT OR IGNORE INTO saved_posts (user_id, post_id) VALUES (?, ?)").bind(user.id, postId).run();
    return jsonResponse({ saved: true });
  } catch (err: unknown) {
    return serverError(err, "saved:add");
  }
};

// DELETE /api/saved?post_id=N: remove dos salvos
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const postId = Number(new URL(request.url).searchParams.get("post_id"));
    if (!Number.isInteger(postId) || postId <= 0) return errorResponse("Publicação inválida.", 400);

    await env.DB.prepare("DELETE FROM saved_posts WHERE user_id = ? AND post_id = ?").bind(user.id, postId).run();
    return jsonResponse({ saved: false });
  } catch (err: unknown) {
    return serverError(err, "saved:remove");
  }
};
