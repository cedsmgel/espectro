// "Curtido por ..." e comentários em destaque embaixo de cada publicação, com os AMIGOS de quem vê na frente.
// Duas consultas para a página inteira de publicações (até 50), com ROW_NUMBER para pegar os 2 primeiros de cada uma.

export interface SocialPost {
  id: number;
  liked_by?: string[];
  comment_preview?: Array<{ username: string; content: string }>;
}

const MAX_POSTS = 60;
const PREVIEW = 2;

// Só aparece quem é visível para quem vê: conta ativa, não bloqueada e (perfil público, amigo ou a própria pessoa)
const VISIBLE_USER = `
  u.deletion_requested_at IS NULL AND u.suspended_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ?1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ?1))
  AND (COALESCE(u.is_private, 0) = 0 OR u.id = ?1 OR ${friendSql("u.id")})`;

function friendSql(userCol: string): string {
  return `EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted' AND ((f.user_id = ?1 AND f.friend_id = ${userCol}) OR (f.user_id = ${userCol} AND f.friend_id = ?1)))`;
}

export async function attachSocial<T extends SocialPost>(db: D1Database, posts: T[], viewerId: number | null): Promise<T[]> {
  if (!posts.length || posts.length > MAX_POSTS) return posts;
  const viewer = viewerId ?? -1;
  const ids = posts.map((p) => p.id);
  const marks = ids.map((_, i) => `?${i + 2}`).join(",");

  const [likes, comments] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT post_id, username FROM (
           SELECT v.post_id, u.username,
                  ROW_NUMBER() OVER (PARTITION BY v.post_id ORDER BY ${friendSql("u.id")} DESC, v.rowid DESC) AS rn
           FROM post_votes v JOIN users u ON u.id = v.user_id
           WHERE v.vote = 1 AND v.post_id IN (${marks}) AND u.id != ?1 AND ${VISIBLE_USER}
         ) WHERE rn <= ${PREVIEW}`
      )
      .bind(viewer, ...ids),
    db
      .prepare(
        `SELECT post_id, username, content FROM (
           SELECT c.post_id, u.username, c.content,
                  ROW_NUMBER() OVER (PARTITION BY c.post_id ORDER BY ${friendSql("u.id")} DESC, c.id DESC) AS rn
           FROM comments c JOIN users u ON u.id = c.author_id
           WHERE c.parent_id IS NULL AND c.post_id IN (${marks}) AND ${VISIBLE_USER}
         ) WHERE rn <= ${PREVIEW}`
      )
      .bind(viewer, ...ids),
  ]);

  const likedBy = new Map<number, string[]>();
  for (const r of (likes.results || []) as Array<{ post_id: number; username: string }>) {
    likedBy.set(r.post_id, [...(likedBy.get(r.post_id) || []), r.username]);
  }
  const previews = new Map<number, Array<{ username: string; content: string }>>();
  for (const r of (comments.results || []) as Array<{ post_id: number; username: string; content: string }>) {
    const content = r.content.length > 140 ? r.content.slice(0, 139) + "…" : r.content;
    previews.set(r.post_id, [...(previews.get(r.post_id) || []), { username: r.username, content }]);
  }

  return posts.map((p) => ({ ...p, liked_by: likedBy.get(p.id) || [], comment_preview: previews.get(p.id) || [] }));
}
