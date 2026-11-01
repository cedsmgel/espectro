import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

async function counts(db: D1Database, userId: number) {
  const [followers, following] = await Promise.all([
    db.prepare("SELECT COUNT(1) AS n FROM follows WHERE following_id = ?").bind(userId).first<{ n: number }>(),
    db.prepare("SELECT COUNT(1) AS n FROM follows WHERE follower_id = ?").bind(userId).first<{ n: number }>(),
  ]);
  return { followers_count: followers?.n ?? 0, following_count: following?.n ?? 0 };
}

// GET /api/follows?user_id=2 -> { following, followers_count, following_count }
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const targetId = Number(new URL(request.url).searchParams.get("user_id"));
    if (!targetId) return errorResponse("user_id é obrigatório.", 400);
    const viewer = await getAuthUser(request, getJwtSecret(env));
    const row = viewer
      ? await env.DB.prepare("SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?").bind(viewer.id, targetId).first()
      : null;
    return jsonResponse({ following: Boolean(row), ...(await counts(env.DB, targetId)) });
  } catch (err: unknown) {
    return serverError(err, "follows");
  }
};

// POST /api/follows { user_id } -> seguir
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado. Faça login para seguir.", 401);

    const body = (await request.json().catch(() => null)) as { user_id?: number } | null;
    const targetId = Number(body?.user_id);
    if (!targetId) return errorResponse("user_id é obrigatório.", 400);
    if (targetId === user.id) return errorResponse("Você não pode seguir a si mesmo.", 400);

    const limited = await rateLimit(env.DB, request, "follow", 60, 3600, user.id);
    if (limited) return limited;

    const target = await env.DB.prepare("SELECT id, is_private FROM users WHERE id = ? AND deletion_requested_at IS NULL AND suspended_at IS NULL")
      .bind(targetId)
      .first<{ id: number; is_private: number }>();
    if (!target) return errorResponse("Pessoa não encontrada.", 404);

    const blocked = await env.DB.prepare(
      "SELECT 1 FROM blocks WHERE (blocker_id = ?1 AND blocked_id = ?2) OR (blocker_id = ?2 AND blocked_id = ?1)"
    )
      .bind(user.id, targetId)
      .first();
    if (blocked) return errorResponse("Não é possível seguir esta pessoa.", 403);

    if (target.is_private) {
      return errorResponse("Este perfil é privado. Envie um pedido de amizade para acompanhar as publicações.", 403);
    }

    await env.DB.prepare("INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)").bind(user.id, targetId).run();
    return jsonResponse({ following: true, ...(await counts(env.DB, targetId)) });
  } catch (err: unknown) {
    return serverError(err, "follows");
  }
};

// DELETE /api/follows?user_id=2 -> deixar de seguir
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);
    const targetId = Number(new URL(request.url).searchParams.get("user_id"));
    if (!targetId) return errorResponse("user_id é obrigatório.", 400);
    await env.DB.prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ?").bind(user.id, targetId).run();
    return jsonResponse({ following: false, ...(await counts(env.DB, targetId)) });
  } catch (err: unknown) {
    return serverError(err, "follows");
  }
};
