import { jsonResponse, errorResponse, serverError, escapeLike, rateLimit, getAuthUser, getJwtSecret } from "../_shared/auth";
import { cachedForVisitors } from "../_shared/edgeCache";
import { NOT_IN_PRIVATE_SQL } from "../_shared/communities";

export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

const handleGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const limited = await rateLimit(env.DB, request, "search", 60, 60);
    if (limited) return limited;

    const url = new URL(request.url);
    const query = (url.searchParams.get("q") || url.searchParams.get("query") || "").slice(0, 100);
    const viewer = await getAuthUser(request, getJwtSecret(env));
    const viewerId = viewer ? viewer.id : -1;

    if (!query.trim()) {
      return jsonResponse({
        users: [],
        communities: [],
        posts: [],
      });
    }

    const trimmed = query.trim();
    const term = `%${escapeLike(trimmed.toLowerCase())}%`;
    const prefix = `${escapeLike(trimmed.toLowerCase())}%`;

    // 1. users: por username ou nome
    const usersPromise = env.DB.prepare(`
      SELECT id, username, name, avatar_url, bio
      FROM users
      WHERE (LOWER(username) LIKE ? ESCAPE '\\' OR (name IS NOT NULL AND LOWER(name) LIKE ? ESCAPE '\\'))
        AND deletion_requested_at IS NULL
        AND id NOT IN (
          SELECT blocked_id FROM blocks WHERE blocker_id = ?
          UNION SELECT blocker_id FROM blocks WHERE blocked_id = ?
        )
      ORDER BY 
        CASE 
          WHEN LOWER(username) = LOWER(?) THEN 0
          WHEN LOWER(username) LIKE ? ESCAPE '\\' THEN 1
          ELSE 2 
        END,
        id DESC
      LIMIT 8
    `)
      .bind(term, term, viewerId, viewerId, trimmed, prefix)
      .all<any>();

    // 2. communities: por name ou slug
    const communitiesPromise = env.DB.prepare(`
      SELECT id, name, slug, description, icon_color, icon_url,
             (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = communities.id AND cm.status = 'active') AS members_count
      FROM communities
      WHERE type != 'private' AND (LOWER(name) LIKE ? ESCAPE '\\' OR (slug IS NOT NULL AND LOWER(slug) LIKE ? ESCAPE '\\'))
      ORDER BY 
        CASE 
          WHEN LOWER(name) = LOWER(?) THEN 0
          WHEN LOWER(name) LIKE ? ESCAPE '\\' THEN 1
          ELSE 2 
        END,
        id DESC
      LIMIT 8
    `)
      .bind(term, term, trimmed, prefix)
      .all<any>();

    // 3. posts: pelo title ou content
    const postsPromise = env.DB.prepare(`
      SELECT p.id, p.title, p.content, p.media_url, p.media_type, p.post_type, p.created_at,
             u.username AS author_name, u.avatar_url AS author_avatar,
             c.name AS community_name, c.slug AS community_slug
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN communities c ON p.community_id = c.id
      WHERE ((p.title IS NOT NULL AND LOWER(p.title) LIKE ? ESCAPE '\\') OR LOWER(p.content) LIKE ? ESCAPE '\\')
        AND (
          COALESCE(u.is_private, 0) = 0
          OR u.id = ?
          OR EXISTS (
            SELECT 1 FROM friendships f
            WHERE f.status = 'accepted'
              AND ((f.user_id = u.id AND f.friend_id = ?) OR (f.user_id = ? AND f.friend_id = u.id))
          )
        )
        AND p.author_id NOT IN (
          SELECT blocked_id FROM blocks WHERE blocker_id = ?
          UNION SELECT blocker_id FROM blocks WHERE blocked_id = ?
        )
        AND ${NOT_IN_PRIVATE_SQL}
      ORDER BY p.id DESC
      LIMIT 8
    `)
      .bind(term, term, viewerId, viewerId, viewerId, viewerId, viewerId)
      .all<any>();

    const [usersRes, communitiesRes, postsRes] = await Promise.all([
      usersPromise,
      communitiesPromise,
      postsPromise,
    ]);

    return jsonResponse({
      users: usersRes.results || [],
      communities: communitiesRes.results || [],
      posts: postsRes.results || [],
    });
  } catch (err: any) {
    return serverError(err, "search");
  }
};

export const onRequestGet: PagesFunction<Env> = (context) => cachedForVisitors(context.request, 30, async () => handleGet(context));
