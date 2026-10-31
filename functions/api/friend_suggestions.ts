import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET: recomendações de amigos, ordenadas por amigos em comum e comunidades em comum
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
       )
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
            WHERE a.user_id = ?1 AND b.user_id = u.id) AS shared_communities
       FROM users u
       WHERE u.id != ?1
         AND u.id NOT IN (SELECT rid FROM related)
         AND u.id NOT IN (SELECT suggested_id FROM dismissed_suggestions WHERE user_id = ?1)
         AND u.id NOT IN (
           SELECT blocked_id FROM blocks WHERE blocker_id = ?1
           UNION SELECT blocker_id FROM blocks WHERE blocked_id = ?1
         )
       ORDER BY mutual_friends DESC, shared_communities DESC, u.id DESC
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
