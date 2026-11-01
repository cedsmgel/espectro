import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET: recomendações de amigos, pontuadas por amigos em comum, comunidades em comum,
// conversas nas publicações um do outro e atividade recente
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const { results } = await env.DB.prepare(
      `WITH my_friends AS (
         SELECT CASE WHEN user_id = ?1 THEN friend_id ELSE user_id END AS fid
         FROM friendships
         WHERE status = 'accepted' AND (user_id = ?1 OR friend_id = ?1)
       ),
       related AS (
         SELECT CASE WHEN user_id = ?1 THEN friend_id ELSE user_id END AS rid
         FROM friendships
         WHERE user_id = ?1 OR friend_id = ?1
       ),
       candidates AS (
         SELECT
           u.id,
           u.username,
           u.name,
           u.avatar_url,
           (SELECT COUNT(*) FROM friendships f
              WHERE f.status = 'accepted'
                AND ((f.user_id = u.id AND f.friend_id IN (SELECT fid FROM my_friends))
                  OR (f.friend_id = u.id AND f.user_id IN (SELECT fid FROM my_friends)))) AS mutual_friends,
           (SELECT COUNT(*) FROM community_members a
              JOIN community_members b ON a.community_id = b.community_id
              WHERE a.user_id = ?1 AND b.user_id = u.id AND a.status = 'active' AND b.status = 'active') AS shared_communities,
           (SELECT COUNT(*) FROM comments c JOIN posts p ON p.id = c.post_id
              WHERE (c.author_id = u.id AND p.author_id = ?1)
                 OR (c.author_id = ?1 AND p.author_id = u.id)) AS interactions,
           CASE WHEN u.last_seen_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END AS recently_active
         FROM users u
         WHERE u.id != ?1
           AND u.suspended_at IS NULL
           AND u.deletion_requested_at IS NULL
           AND u.id NOT IN (SELECT rid FROM related)
           AND u.id NOT IN (SELECT suggested_id FROM dismissed_suggestions WHERE user_id = ?1)
           AND u.id NOT IN (
             SELECT blocked_id FROM blocks WHERE blocker_id = ?1
             UNION SELECT blocker_id FROM blocks WHERE blocked_id = ?1
           )
       )
       SELECT * FROM candidates
       ORDER BY (mutual_friends * 5 + shared_communities * 3 + interactions * 2 + recently_active) DESC, id DESC
       LIMIT 12`
    )
      .bind(user.id)
      .all();

    return jsonResponse(results || []);
  } catch (err: unknown) {
    return serverError(err, "friend_suggestions");
  }
};

// POST { dismiss_id }: some com uma recomendação
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const body = (await request.json().catch(() => null)) as { dismiss_id?: number } | null;
    const dismissId = Number(body?.dismiss_id);
    if (!Number.isInteger(dismissId) || dismissId <= 0 || dismissId === user.id) {
      return errorResponse("dismiss_id inválido.", 400);
    }

    await env.DB.prepare("INSERT OR IGNORE INTO dismissed_suggestions (user_id, suggested_id) VALUES (?, ?)")
      .bind(user.id, dismissId)
      .run();

    return jsonResponse({ dismissed: true });
  } catch (err: unknown) {
    return serverError(err, "friend_suggestions");
  }
};
