import { areFriends, getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

const ONLINE_WINDOW_SECONDS = 90;

// POST: batimento de presença do app aberto (atualiza "visto por último")
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "presence", 20, 60, user.id);
    if (limited) return limited;

    await env.DB.prepare(
      `UPDATE users SET last_seen_at = CURRENT_TIMESTAMP
       WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < datetime('now', '-30 seconds'))`
    )
      .bind(user.id)
      .run();

    return jsonResponse({ ok: true });
  } catch (err: unknown) {
    return serverError(err, "presence");
  }
};

// GET ?friend_id=N: status do amigo. Só entre amigos, e só se os dois mostram o "visto por último".
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const friendId = Number(new URL(request.url).searchParams.get("friend_id"));
    if (!Number.isInteger(friendId) || friendId <= 0) {
      return errorResponse("friend_id é obrigatório.", 400);
    }

    if (!(await areFriends(env.DB, user.id, friendId))) {
      return jsonResponse({ visible: false, online: false, last_seen_at: null });
    }

    const row = await env.DB.prepare(
      `SELECT
         (SELECT show_last_seen FROM users WHERE id = ?1) AS mine,
         f.show_last_seen AS theirs,
         strftime('%Y-%m-%dT%H:%M:%SZ', f.last_seen_at) AS last_seen_at,
         CAST(strftime('%s', 'now') AS INTEGER) - CAST(strftime('%s', f.last_seen_at) AS INTEGER) AS age_seconds
       FROM users f WHERE f.id = ?2`
    )
      .bind(user.id, friendId)
      .first<{ mine: number; theirs: number; last_seen_at: string | null; age_seconds: number | null }>();

    if (!row || !row.mine || !row.theirs || !row.last_seen_at) {
      return jsonResponse({ visible: false, online: false, last_seen_at: null });
    }

    return jsonResponse({
      visible: true,
      online: row.age_seconds !== null && row.age_seconds <= ONLINE_WINDOW_SECONDS,
      last_seen_at: row.last_seen_at,
    });
  } catch (err: unknown) {
    return serverError(err, "presence");
  }
};
