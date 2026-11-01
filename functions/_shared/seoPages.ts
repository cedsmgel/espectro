import { hiddenMeta, PageMeta, plainText, renderShell, SeoEnv, SITE_NAME, siteOrigin } from "./seo";

export interface SeoPagesEnv extends SeoEnv {
  DB: D1Database;
}

type Ctx = { request: Request; env: SeoPagesEnv };

const isoDate = (value: string) => new Date(value.replace(" ", "T") + "Z").toISOString();

// ---- Publicação: /post/:id
export async function postPage({ request, env }: Ctx, rawId: string): Promise<Response> {
  const path = `/post/${encodeURIComponent(rawId)}`;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return renderShell(request, env, hiddenMeta(path));
  const origin = siteOrigin(request, env);

  const p = await env.DB.prepare(
    `SELECT p.id, p.title, p.content, p.post_type, p.media_url, p.media_type, p.created_at, p.upvotes,
            u.username, u.name, u.is_private, u.deletion_requested_at, u.suspended_at,
            c.type AS community_type, c.name AS community_name
     FROM posts p JOIN users u ON u.id = p.author_id LEFT JOIN communities c ON c.id = p.community_id
     WHERE p.id = ?`
  )
    .bind(id)
    .first<{
      id: number;
      title: string | null;
      content: string;
      post_type: string;
      media_url: string | null;
      media_type: string | null;
      created_at: string;
      upvotes: number;
      username: string;
      name: string | null;
      is_private: number;
      deletion_requested_at: string | null;
      suspended_at: string | null;
      community_type: string | null;
      community_name: string | null;
    }>();

  // Perfil privado, conta em exclusão ou suspensa e comunidade privada nunca aparecem para buscadores
  if (!p || p.is_private || p.deletion_requested_at || p.suspended_at || p.community_type === "private") {
    return renderShell(request, env, hiddenMeta(path));
  }

  const author = p.name?.trim() || `@${p.username}`;
  const body = plainText(p.content, 5000);
  const headline = (p.title?.trim() || plainText(p.content, 70) || "Publicação").slice(0, 110);
  const image = p.media_url && p.media_type !== "video" ? p.media_url : null;
  const description = plainText(p.content, 160) || `Publicação de ${author} no ${SITE_NAME}${p.community_name ? ` em e/${p.community_name}` : ""}.`;
  const meta: PageMeta = {
    title: `${headline} - ${author} no ${SITE_NAME}`,
    description,
    path,
    image,
    type: "article",
    noscript: `${description} Por ${author}.`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SocialMediaPosting",
      headline,
      articleBody: body.slice(0, 2000),
      datePublished: isoDate(p.created_at),
      url: origin + path,
      author: { "@type": "Person", name: author, url: `${origin}/perfil/${encodeURIComponent(p.username)}` },
      ...(image ? { image: [image.startsWith("http") ? image : origin + image] } : {}),
      interactionStatistic: { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: Math.max(0, p.upvotes || 0) },
    },
  };
  return renderShell(request, env, meta);
}

// ---- Perfil: /perfil/:username (também /u/ e /profile/, com canonical em /perfil/)
export async function profilePage({ request, env }: Ctx, rawUsername: string): Promise<Response> {
  const path = `/perfil/${encodeURIComponent(rawUsername)}`;
  const origin = siteOrigin(request, env);
  const u = await env.DB.prepare(
    "SELECT username, name, bio, avatar_url, is_private, created_at, deletion_requested_at, suspended_at FROM users WHERE username = ? COLLATE NOCASE"
  )
    .bind(rawUsername.trim())
    .first<{
      username: string;
      name: string | null;
      bio: string | null;
      avatar_url: string | null;
      is_private: number;
      created_at: string;
      deletion_requested_at: string | null;
      suspended_at: string | null;
    }>();

  if (!u || u.deletion_requested_at || u.suspended_at) return renderShell(request, env, hiddenMeta(path));
  const canonical = `/perfil/${encodeURIComponent(u.username)}`;
  const display = u.name?.trim() || `@${u.username}`;
  const profileTitle = u.name?.trim() ? `${display} (@${u.username}) no ${SITE_NAME}` : `@${u.username} no ${SITE_NAME}`;

  // Perfil privado: sem indexar e sem descrever o conteúdo
  if (u.is_private) {
    return renderShell(request, env, {
      title: profileTitle,
      description: "Este perfil é privado.",
      path: canonical,
      noindex: true,
      type: "profile",
    });
  }

  const description = plainText(u.bio, 160) || `Veja as publicações de ${display} no ${SITE_NAME}.`;
  return renderShell(request, env, {
    title: profileTitle,
    description,
    path: canonical,
    image: u.avatar_url,
    type: "profile",
    noscript: description,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      dateCreated: isoDate(u.created_at),
      mainEntity: {
        "@type": "Person",
        name: display,
        alternateName: `@${u.username}`,
        url: origin + canonical,
        ...(u.avatar_url ? { image: u.avatar_url.startsWith("http") ? u.avatar_url : origin + u.avatar_url } : {}),
        ...(u.bio ? { description: plainText(u.bio, 300) } : {}),
      },
    },
  });
}

// ---- Comunidade: /e/:slug
export async function communityPage({ request, env }: Ctx, rawSlug: string): Promise<Response> {
  const path = `/e/${encodeURIComponent(rawSlug)}`;
  const c = await env.DB.prepare(
    `SELECT c.name, c.slug, c.description, c.type, c.icon_url, c.banner_url,
            (SELECT COUNT(1) FROM community_members m WHERE m.community_id = c.id AND m.status = 'active') AS members
     FROM communities c WHERE c.slug = ? OR CAST(c.id AS TEXT) = ?`
  )
    .bind(rawSlug, rawSlug)
    .first<{ name: string; slug: string | null; description: string | null; type: string; icon_url: string | null; banner_url: string | null; members: number }>();

  // Comunidade privada: nem o nome sai no HTML público
  if (!c || c.type === "private") return renderShell(request, env, hiddenMeta(path));

  const canonical = `/e/${encodeURIComponent(c.slug || rawSlug)}`;
  const description = plainText(c.description, 160) || `Comunidade e/${c.name} no ${SITE_NAME}, com ${c.members} ${c.members === 1 ? "membro" : "membros"}.`;
  return renderShell(request, env, {
    title: `e/${c.name} - comunidade no ${SITE_NAME}`,
    description,
    path: canonical,
    image: c.banner_url || c.icon_url,
    noscript: description,
  });
}

// ---- Hashtag: /tag/:tag (também /hashtag/)
export async function tagPage({ request, env }: Ctx, rawTag: string): Promise<Response> {
  let decoded = rawTag;
  try {
    decoded = decodeURIComponent(rawTag);
  } catch {
    // mantém o texto como veio
  }
  const tag = decoded.replace(/^#/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const path = `/tag/${encodeURIComponent(tag)}`;
  const row = await env.DB.prepare(
    `SELECT COUNT(1) AS n FROM post_hashtags ph JOIN hashtags h ON h.id = ph.hashtag_id
     JOIN posts p ON p.id = ph.post_id JOIN users u ON u.id = p.author_id
     WHERE h.tag = ? AND COALESCE(u.is_private, 0) = 0 AND u.deletion_requested_at IS NULL AND u.suspended_at IS NULL
       AND (p.community_id IS NULL OR p.community_id NOT IN (SELECT id FROM communities WHERE type = 'private'))`
  )
    .bind(tag)
    .first<{ n: number }>();
  const total = row?.n ?? 0;
  if (!total) return renderShell(request, env, { ...hiddenMeta(path), title: `#${tag} - ${SITE_NAME}` });
  const description = `${total} ${total === 1 ? "publicação" : "publicações"} com #${tag} no ${SITE_NAME}.`;
  return renderShell(request, env, { title: `#${tag} - publicações no ${SITE_NAME}`, description, path, noscript: description });
}
