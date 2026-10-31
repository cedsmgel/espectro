import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

async function summary(db: D1Database, userId: number) {
  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM notifications WHERE user_id = ?1 AND read_at IS NULL) AS unread,
         (SELECT COUNT(*) FROM friendships WHERE friend_id = ?1 AND status = 'pending') AS pending_requests,
         (SELECT COUNT(*) FROM direct_messages WHERE receiver_id = ?1 AND read_at IS NULL) AS unread_messages`
    )
    .bind(userId)
    .first<{ unread: number; pending_requests: number; unread_messages: number }>();

  return {
    unread: Number(row?.unread || 0),
    pending_requests: Number(row?.pending_requests || 0),
    unread_messages: Number(row?.unread_messages || 0),
  };
}

// GET: lista paginada (?before_id=&limit=) ou só os contadores (?count=1)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const url = new URL(request.url);
    const counts = await summary(env.DB, user.id);

    if (url.searchParams.get("count") === "1") {
      return jsonResponse({ ...counts, total_badge: counts.unread + counts.pending_requests });
    }

    const limitParam = Number(url.searchParams.get("limit"));
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 20;
    const beforeParam = Number(url.searchParams.get("before_id"));
    const beforeId = Number.isInteger(beforeParam) && beforeParam > 0 ? beforeParam : null;

    const { results } = await env.DB.prepare(
      `SELECT
         n.id, n.type, n.post_id, n.comment_id, n.content,
         n.read_at IS NOT NULL AS read,
         strftime('%Y-%m-%dT%H:%M:%SZ', n.created_at) AS created_at,
         a.id AS actor_id, a.username AS actor_username, a.avatar_url AS actor_avatar
       FROM notifications n
       LEFT JOIN users a ON a.id = n.actor_id
       WHERE n.user_id = ? AND (? IS NULL OR n.id < ?)
       ORDER BY n.id DESC
       LIMIT ?`
    )
      .bind(user.id, beforeId, beforeId, limit + 1)
      .all<Record<string, unknown>>();

    const rows = results || [];
    return jsonResponse({
      notifications: rows.slice(0, limit).map((r) => ({ ...r, read: Boolean(r.read) })),
      has_more: rows.length > limit,
      summary: { ...counts, total_badge: counts.unread + counts.pending_requests },
    });
  } catch (err: unknown) {
    return serverError(err, "notifications");
  }
};

// POST { action: "read", ids: number[] } | { action: "unread", ids } | { action: "read_all" }
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const body = (await request.json().catch(() => null)) as { action?: string; ids?: unknown } | null;

    if (body?.action === "read_all") {
      await env.DB.prepare(
        "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL"
      )
        .bind(user.id)
        .run();
      return jsonResponse({ summary: await summary(env.DB, user.id) });
    }

    if (body?.action === "read" || body?.action === "unread") {
      const ids = Array.isArray(body.ids)
        ? body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 100)
        : [];
      if (ids.length === 0) return errorResponse("ids é obrigatório.", 400);

      const placeholders = ids.map(() => "?").join(",");
      const setClause = body.action === "read" ? "read_at = CURRENT_TIMESTAMP" : "read_at = NULL";
      await env.DB.prepare(`UPDATE notifications SET ${setClause} WHERE user_id = ? AND id IN (${placeholders})`)
        .bind(user.id, ...ids)
        .run();
      return jsonResponse({ summary: await summary(env.DB, user.id) });
    }

    return errorResponse("Ação inválida.", 400);
  } catch (err: unknown) {
    return serverError(err, "notifications");
  }
};

// DELETE ?id= remove uma notificação
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) return errorResponse("id é obrigatório.", 400);

    await env.DB.prepare("DELETE FROM notifications WHERE id = ? AND user_id = ?").bind(id, user.id).run();
    return jsonResponse({ summary: await summary(env.DB, user.id) });
  } catch (err: unknown) {
    return serverError(err, "notifications");
  }
};
