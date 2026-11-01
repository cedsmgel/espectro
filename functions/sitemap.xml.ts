import { esc, siteOrigin } from "./_shared/seo";

interface Env {
  DB: D1Database;
  SITE_URL?: string;
}

const PUBLIC_AUTHOR = "COALESCE(u.is_private, 0) = 0 AND u.deletion_requested_at IS NULL AND u.suspended_at IS NULL";
const NOT_PRIVATE_COMMUNITY = "(p.community_id IS NULL OR p.community_id NOT IN (SELECT id FROM communities WHERE type = 'private'))";

const day = (value: string | null | undefined) => (value ? value.slice(0, 10) : undefined);

// GET /sitemap.xml: só o que é público (perfis, publicações e comunidades privados ficam de fora)
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const origin = siteOrigin(request, env);
  const urls: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: string }> = [
    { loc: "/", changefreq: "hourly", priority: "1.0" },
    { loc: "/comunidades", changefreq: "daily", priority: "0.7" },
    { loc: "/explorar", changefreq: "hourly", priority: "0.6" },
  ];

  try {
    const [communities, profiles, posts, tags] = await Promise.all([
      env.DB.prepare("SELECT slug, created_at FROM communities WHERE type != 'private' AND slug IS NOT NULL ORDER BY id DESC LIMIT 2000").all<{ slug: string; created_at: string }>(),
      env.DB.prepare(
        `SELECT u.username, MAX(p.created_at) AS last FROM users u JOIN posts p ON p.author_id = u.id
         WHERE ${PUBLIC_AUTHOR} AND ${NOT_PRIVATE_COMMUNITY} GROUP BY u.id ORDER BY last DESC LIMIT 5000`
      ).all<{ username: string; last: string }>(),
      env.DB.prepare(
        `SELECT p.id, p.created_at FROM posts p JOIN users u ON u.id = p.author_id
         WHERE ${PUBLIC_AUTHOR} AND ${NOT_PRIVATE_COMMUNITY} ORDER BY p.id DESC LIMIT 20000`
      ).all<{ id: number; created_at: string }>(),
      env.DB.prepare(
        `SELECT h.tag, COUNT(1) AS n, MAX(p.created_at) AS last FROM hashtags h
         JOIN post_hashtags ph ON ph.hashtag_id = h.id JOIN posts p ON p.id = ph.post_id JOIN users u ON u.id = p.author_id
         WHERE ${PUBLIC_AUTHOR} AND ${NOT_PRIVATE_COMMUNITY} GROUP BY h.id HAVING n >= 2 ORDER BY n DESC LIMIT 1000`
      ).all<{ tag: string; last: string }>(),
    ]);

    for (const c of communities.results || []) urls.push({ loc: `/e/${encodeURIComponent(c.slug)}`, lastmod: day(c.created_at), changefreq: "daily", priority: "0.6" });
    for (const u of profiles.results || []) urls.push({ loc: `/perfil/${encodeURIComponent(u.username)}`, lastmod: day(u.last), changefreq: "weekly", priority: "0.5" });
    for (const p of posts.results || []) urls.push({ loc: `/post/${p.id}`, lastmod: day(p.created_at), changefreq: "monthly", priority: "0.5" });
    for (const t of tags.results || []) urls.push({ loc: `/tag/${encodeURIComponent(t.tag)}`, lastmod: day(t.last), changefreq: "daily", priority: "0.4" });
  } catch {
    // Sem banco: ainda entrega as páginas fixas
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${esc(origin + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}${u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : ""}${u.priority ? `<priority>${u.priority}</priority>` : ""}</url>`
      )
      .join("\n") +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900, s-maxage=3600" },
  });
};
