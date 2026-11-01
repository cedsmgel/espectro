import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET: comunidades que a pessoa ainda não participa, ordenadas por amigos que já estão nelas,
// movimento recente (publicações nos últimos 14 dias) e tamanho
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
       candidates AS (
         SELECT c.id, c.name, c.slug, c.description, c.icon_color,
           (SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id AND m.status = 'active') AS members_count,
           (SELECT COUNT(*) FROM community_members m
              WHERE m.community_id = c.id AND m.status = 'active' AND m.user_id IN (SELECT fid FROM my_friends)) AS friends_in,
           (SELECT COUNT(*) FROM posts p
              WHERE p.community_id = c.id AND p.created_at >= datetime('now', '-14 days')) AS recent_posts
         FROM communities c
         WHERE c.type != 'private'
           AND c.id NOT IN (SELECT community_id FROM community_members WHERE user_id = ?1)
           AND c.id NOT IN (SELECT community_id FROM dismissed_community_suggestions WHERE user_id = ?1)
       )
       SELECT * FROM candidates
       ORDER BY (friends_in * 5 + MIN(recent_posts, 10) * 2 + MIN(members_count, 50) / 5) DESC, id DESC
       LIMIT 6`
    )
      .bind(user.id)
      .all();

    return jsonResponse(results || []);
  } catch (err: unknown) {
    return serverError(err, "community_suggestions");
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
    if (!Number.isInteger(dismissId) || dismissId <= 0) return errorResponse("dismiss_id inválido.", 400);

    const community = await env.DB.prepare("SELECT id FROM communities WHERE id = ?").bind(dismissId).first();
    if (!community) return errorResponse("Comunidade não encontrada.", 404);

    await env.DB.prepare("INSERT OR IGNORE INTO dismissed_community_suggestions (user_id, community_id) VALUES (?, ?)")
      .bind(user.id, dismissId)
      .run();

    return jsonResponse({ dismissed: true });
  } catch (err: unknown) {
    return serverError(err, "community_suggestions");
  }
};
