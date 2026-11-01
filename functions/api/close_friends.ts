import { areFriends, getAuthUser, jsonResponse, errorResponse, getJwtSecret, isBlockedBetween, rateLimit, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET /api/close_friends[?q=busca]: meus amigos, com a marca de quem está na lista de melhores amigos (a lista é privada)
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase();
    const like = q ? `%${q.replace(/[%_]/g, "")}%` : null;

    const { results } = await env.DB.prepare(
      `SELECT u.id, u.username, u.name, u.avatar_url,
              EXISTS(SELECT 1 FROM close_friends c WHERE c.user_id = ?1 AND c.friend_id = u.id) AS close
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_id = ?1 THEN f.friend_id ELSE f.user_id END
       WHERE f.status = 'accepted' AND (f.user_id = ?1 OR f.friend_id = ?1)
         AND u.deletion_requested_at IS NULL AND u.suspended_at IS NULL
         AND (?2 IS NULL OR LOWER(u.username) LIKE ?2 OR LOWER(COALESCE(u.name, '')) LIKE ?2)
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ?1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ?1))
       ORDER BY close DESC, u.username COLLATE NOCASE
       LIMIT 500`
    )
      .bind(user.id, like)
      .all();

    const friends = (results || []).map((r: any) => ({ ...r, close: Boolean(r.close) }));
    return jsonResponse({ friends, close_count: friends.filter((f) => f.close).length });
  } catch (err: unknown) {
    return serverError(err, "close_friends");
  }
};

// POST /api/close_friends { friend_id, close }: coloca ou tira uma pessoa da lista. Sem aviso para ela.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "close-friends", 120, 3600, user.id);
    if (limited) return limited;

    const body = (await request.json().catch(() => null)) as { friend_id?: number; close?: boolean } | null;
    const friendId = Number(body?.friend_id);
    if (!Number.isInteger(friendId) || friendId <= 0 || typeof body?.close !== "boolean") return errorResponse("friend_id e close são obrigatórios.", 400);

    if (body.close) {
      if (!(await areFriends(env.DB, user.id, friendId)) || (await isBlockedBetween(env.DB, user.id, friendId))) {
        return errorResponse("Só amigos podem entrar na lista de melhores amigos.", 403);
      }
      await env.DB.prepare("INSERT OR IGNORE INTO close_friends (user_id, friend_id) VALUES (?, ?)").bind(user.id, friendId).run();
    } else {
      await env.DB.prepare("DELETE FROM close_friends WHERE user_id = ? AND friend_id = ?").bind(user.id, friendId).run();
    }

    const count = await env.DB.prepare("SELECT COUNT(1) AS n FROM close_friends WHERE user_id = ?").bind(user.id).first<{ n: number }>();
    return jsonResponse({ close: body.close, close_count: count?.n ?? 0 });
  } catch (err: unknown) {
    return serverError(err, "close_friends");
  }
};
