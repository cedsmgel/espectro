import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET: conversas do usuário (última mensagem, não lidas, preferências e visto por último)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) {
      return errorResponse("Não autorizado.", 401);
    }

    const { results } = await env.DB.prepare(
      `WITH pairs AS (
         SELECT peer_id, MAX(id) AS last_id
         FROM (
           SELECT CASE WHEN sender_id = ?1 THEN receiver_id ELSE sender_id END AS peer_id, id
           FROM direct_messages
           WHERE sender_id = ?1 OR receiver_id = ?1
         ) m
         WHERE id > COALESCE(
           (SELECT cleared_before_id FROM conversation_settings WHERE user_id = ?1 AND friend_id = m.peer_id), 0)
           AND peer_id NOT IN (
             SELECT blocked_id FROM blocks WHERE blocker_id = ?1
             UNION SELECT blocker_id FROM blocks WHERE blocked_id = ?1
           )
         GROUP BY peer_id
       )
       SELECT
         p.peer_id AS friend_id,
         u.username,
         u.avatar_url,
         dm.id AS last_message_id,
         dm.sender_id AS last_sender_id,
         dm.content AS last_content,
         COALESCE(dm.message_type, 'text') AS last_message_type,
         strftime('%Y-%m-%dT%H:%M:%SZ', dm.created_at) AS last_created_at,
         (SELECT COUNT(*) FROM direct_messages x
            WHERE x.sender_id = p.peer_id AND x.receiver_id = ?1 AND x.read_at IS NULL) AS unread_count,
         COALESCE(cs.muted, 0) AS muted,
         COALESCE(cs.theme, 'default') AS theme,
         COALESCE(cs.wallpaper, 'none') AS wallpaper,
         cs.nickname AS nickname,
         COALESCE(cs.pinned, 0) AS pinned,
         COALESCE(cs.manual_unread, 0) AS manual_unread,
         COALESCE(cs.archived, 0) AS archived,
         CASE WHEN me.show_last_seen = 1 AND u.show_last_seen = 1
           THEN strftime('%Y-%m-%dT%H:%M:%SZ', u.last_seen_at) END AS peer_last_seen_at
       FROM pairs p
       JOIN direct_messages dm ON dm.id = p.last_id
       JOIN users u ON u.id = p.peer_id
       JOIN users me ON me.id = ?1
       LEFT JOIN conversation_settings cs ON cs.user_id = ?1 AND cs.friend_id = p.peer_id
       ORDER BY dm.id DESC
       LIMIT 200`
    )
      .bind(user.id)
      .all<Record<string, unknown>>();

    return jsonResponse(
      (results || []).map((row) => ({
        ...row,
        muted: Boolean(row.muted),
        pinned: Boolean(row.pinned),
        manual_unread: Boolean(row.manual_unread),
        archived: Boolean(row.archived),
      }))
    );
  } catch (err: unknown) {
    return serverError(err, "conversations");
  }
};
