import { getAuthUser, getJwtSecret, jsonResponse, errorResponse, serverError } from "../_shared/auth";
import { cachedForVisitors } from "../_shared/edgeCache";
import { NOT_IN_PRIVATE_SQL } from "../_shared/communities";
import { normalizeTag } from "../_shared/hashtags";

export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

// Só conta publicações de perfis públicos (e de quem eu enxergo), para uma hashtag não vazar posts privados
const VISIBLE_POSTS = `
  (COALESCE(u.is_private, 0) = 0 OR u.id = ?1 OR EXISTS (
     SELECT 1 FROM friendships f WHERE f.status = 'accepted'
       AND ((f.user_id = u.id AND f.friend_id = ?1) OR (f.user_id = ?1 AND f.friend_id = u.id))))
  AND u.deletion_requested_at IS NULL
  AND u.suspended_at IS NULL
  AND ${NOT_IN_PRIVATE_SQL}`;

// GET /api/hashtags?trending=1[&limit=10]  -> mais usadas na última semana
// GET /api/hashtags?q=mus                  -> sugestões por prefixo (ordem de uso)
// GET /api/hashtags?tag=musica             -> total de publicações da hashtag
const handleGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const viewer = await getAuthUser(request, getJwtSecret(env));
    const viewerId = viewer?.id ?? -1;

    if (url.searchParams.get("trending")) {
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 10, 1), 20);
      const { results } = await env.DB.prepare(
        `SELECT h.tag, COUNT(*) AS posts
         FROM post_hashtags ph
         JOIN hashtags h ON h.id = ph.hashtag_id
         JOIN posts p ON p.id = ph.post_id
         JOIN users u ON u.id = p.author_id
         WHERE p.created_at >= datetime('now', '-7 days') AND ${VISIBLE_POSTS}
         GROUP BY h.id ORDER BY posts DESC, MAX(p.id) DESC LIMIT ${limit}`
      )
        .bind(viewerId)
        .all();
      return jsonResponse(results || []);
    }

    const q = url.searchParams.get("q");
    if (q !== null) {
      const prefix = normalizeTag(q.replace(/^#/, "")).replace(/[^\p{L}\p{N}_]/gu, "").slice(0, 50);
      if (prefix.length < 1) return jsonResponse([]);
      const { results } = await env.DB.prepare(
        `SELECT h.tag, COUNT(ph.post_id) AS posts
         FROM hashtags h LEFT JOIN post_hashtags ph ON ph.hashtag_id = h.id
         WHERE h.tag LIKE ? || '%'
         GROUP BY h.id ORDER BY posts DESC, h.tag LIMIT 6`
      )
        .bind(prefix)
        .all();
      return jsonResponse(results || []);
    }

    const tag = url.searchParams.get("tag");
    if (tag) {
      const key = normalizeTag(tag.replace(/^#/, ""));
      const row = await env.DB.prepare(
        `SELECT COUNT(*) AS posts
         FROM post_hashtags ph
         JOIN hashtags h ON h.id = ph.hashtag_id
         JOIN posts p ON p.id = ph.post_id
         JOIN users u ON u.id = p.author_id
         WHERE h.tag = ?2 AND ${VISIBLE_POSTS}`
      )
        .bind(viewerId, key)
        .first<{ posts: number }>();
      return jsonResponse({ tag: key, posts: row?.posts ?? 0 });
    }

    return errorResponse("Informe trending, q ou tag.", 400);
  } catch (err: unknown) {
    return serverError(err, "hashtags");
  }
};

export const onRequestGet: PagesFunction<Env> = (context) => cachedForVisitors(context.request, 60, async () => handleGet(context));
