import { jsonResponse, errorResponse } from "../_shared/auth";

export interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || url.searchParams.get("query") || "";

    if (!query.trim()) {
      return jsonResponse({
        users: [],
        communities: [],
        posts: [],
      });
    }

    const trimmed = query.trim();
    const term = `%${trimmed.toLowerCase()}%`;

    // 1. users: por username ou nome
    const usersPromise = env.DB.prepare(`
      SELECT id, username, name, avatar_url, bio
      FROM users
      WHERE LOWER(username) LIKE ? OR (name IS NOT NULL AND LOWER(name) LIKE ?)
      ORDER BY 
        CASE 
          WHEN LOWER(username) = LOWER(?) THEN 0
          WHEN LOWER(username) LIKE ? THEN 1
          ELSE 2 
        END,
        id DESC
      LIMIT 8
    `)
      .bind(term, term, trimmed, `${trimmed.toLowerCase()}%`)
      .all<any>();

    // 2. communities: por name ou slug
    const communitiesPromise = env.DB.prepare(`
      SELECT id, name, slug, description, icon_color,
             (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = communities.id) AS members_count
      FROM communities
      WHERE LOWER(name) LIKE ? OR (slug IS NOT NULL AND LOWER(slug) LIKE ?)
      ORDER BY 
        CASE 
          WHEN LOWER(name) = LOWER(?) THEN 0
          WHEN LOWER(name) LIKE ? THEN 1
          ELSE 2 
        END,
        id DESC
      LIMIT 8
    `)
      .bind(term, term, trimmed, `${trimmed.toLowerCase()}%`)
      .all<any>();

    // 3. posts: pelo title ou content
    const postsPromise = env.DB.prepare(`
      SELECT p.id, p.title, p.content, p.media_url, p.media_type, p.post_type, p.created_at,
             u.username AS author_name, u.avatar_url AS author_avatar,
             c.name AS community_name, c.slug AS community_slug
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN communities c ON p.community_id = c.id
      WHERE (p.title IS NOT NULL AND LOWER(p.title) LIKE ?) OR LOWER(p.content) LIKE ?
      ORDER BY p.id DESC
      LIMIT 8
    `)
      .bind(term, term)
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
    return errorResponse(`Erro na busca global: ${err.message || String(err)}`, 500);
  }
};
