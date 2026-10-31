import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET: usuários que eu bloqueei
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const { results } = await env.DB.prepare(
      `SELECT u.id, u.username, u.avatar_url, strftime('%Y-%m-%dT%H:%M:%SZ', b.created_at) AS created_at
       FROM blocks b JOIN users u ON u.id = b.blocked_id
       WHERE b.blocker_id = ?
       ORDER BY b.created_at DESC
       LIMIT 200`
    )
      .bind(user.id)
      .all();

    return jsonResponse(results || []);
  } catch (err: unknown) {
    return serverError(err, "blocks");
  }
};

// POST { user_id }: bloqueia. Desfaz a amizade e pedidos pendentes nos dois sentidos.
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "block", 30, 3600, user.id);
    if (limited) return limited;

    const body = (await request.json().catch(() => null)) as { user_id?: number } | null;
    const targetId = Number(body?.user_id);
    if (!Number.isInteger(targetId) || targetId <= 0 || targetId === user.id) {
      return errorResponse("user_id inválido.", 400);
    }

    const target = await env.DB.prepare("SELECT id, username FROM users WHERE id = ?")
      .bind(targetId)
      .first<{ id: number; username: string }>();
    if (!target) return errorResponse("Usuário não encontrado.", 404);

    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)").bind(user.id, targetId),
      env.DB.prepare(
        "DELETE FROM friendships WHERE (user_id = ?1 AND friend_id = ?2) OR (user_id = ?2 AND friend_id = ?1)"
      ).bind(user.id, targetId),
    ]);

    return jsonResponse({ blocked: true, user: { id: target.id, username: target.username } }, 201);
  } catch (err: unknown) {
    return serverError(err, "blocks");
  }
};

// DELETE ?user_id=: desbloqueia (não restaura a amizade)
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const targetId = Number(new URL(request.url).searchParams.get("user_id"));
    if (!Number.isInteger(targetId) || targetId <= 0) return errorResponse("user_id inválido.", 400);

    await env.DB.prepare("DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?").bind(user.id, targetId).run();
    return jsonResponse({ blocked: false });
  } catch (err: unknown) {
    return serverError(err, "blocks");
  }
};
