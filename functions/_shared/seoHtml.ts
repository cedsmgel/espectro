import { esc, plainText } from "./seo";

// Corpo HTML das páginas públicas, montado por texto (sem rodar React): no plano gratuito de Workers o limite é de
// 10 ms de CPU por requisição. O app do navegador assume o lugar deste HTML assim que carrega.

const card = "bg-surface-container-lowest rounded-2xl border border-outline-variant";
const muted = "text-on-surface-variant";

export function fmtDate(sql: string | null | undefined): string {
  if (!sql) return "";
  const d = new Date(sql.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function tagKey(tag: string): string {
  return tag.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Texto da publicação: escapa tudo, preserva quebras de linha, **negrito** e transforma #hashtags em links
export function richText(content: string | null | undefined): string {
  const raw = (content || "").replace(/^\[\[scrap:[\s\S]*?\]\]\n?/, "").slice(0, 6000);
  return esc(raw)
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\s)#([\p{L}\p{N}_]{2,50})/gu, (_m, pre: string, tag: string) => `${pre}<a href="/tag/${encodeURIComponent(tagKey(tag))}" class="text-primary hover:underline">#${tag}</a>`)
    .split(/\n{2,}/)
    .map((p) => `<p class="leading-relaxed">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function layout(inner: string): string {
  return (
    `<div class="min-h-screen bg-surface text-on-surface"><div class="pt-16 md:pt-0 md:pl-20">` +
    `<main class="w-full max-w-2xl mx-auto px-4 pt-6 pb-24 flex flex-col gap-4">` +
    `<a href="/" class="font-bold text-lg tracking-tight">Espectro</a>${inner}</main></div></div>`
  );
}

export interface ListedPost {
  id: number;
  title: string | null;
  content: string;
  created_at: string;
  author_name?: string;
  username?: string;
  comments?: number;
  upvotes?: number;
}

// Lista de publicações: título (ou começo do texto), autor, data e contadores
export function postList(posts: ListedPost[], empty: string): string {
  if (!posts.length) return `<p class="${muted} text-sm py-6 text-center">${esc(empty)}</p>`;
  return posts
    .map((p) => {
      const title = esc(p.title?.trim() || plainText(p.content, 90) || "Publicação");
      const excerpt = p.title?.trim() ? esc(plainText(p.content, 180)) : "";
      const by = p.username ? ` · <a href="/perfil/${encodeURIComponent(p.username)}" class="hover:underline">@${esc(p.username)}</a>` : "";
      return (
        `<article class="${card} p-4 flex flex-col gap-1">` +
        `<a href="/post/${p.id}" class="font-semibold text-base hover:underline">${title}</a>` +
        (excerpt ? `<p class="text-sm ${muted}">${excerpt}</p>` : "") +
        `<p class="text-xs ${muted}"><time datetime="${esc(p.created_at)}">${fmtDate(p.created_at)}</time>${by} · ${p.upvotes ?? 0} votos · ${p.comments ?? 0} comentários</p>` +
        `</article>`
      );
    })
    .join("");
}

export interface PostBody {
  id: number;
  title: string | null;
  content: string;
  created_at: string;
  username: string;
  name: string | null;
  upvotes: number;
  media_url: string | null;
  media_type: string | null;
  community_name: string | null;
  community_slug: string | null;
}

export function postBody(p: PostBody, comments: Array<{ username: string; name: string | null; content: string; created_at: string }>): string {
  const author = esc(p.name?.trim() || `@${p.username}`);
  const media =
    p.media_url && p.media_type !== "video"
      ? `<img src="${esc(p.media_url)}" alt="" class="w-full rounded-xl max-h-[28rem] object-cover" loading="lazy" />`
      : "";
  const community = p.community_name ? ` · <a href="/e/${encodeURIComponent(p.community_slug || p.community_name)}" class="text-primary hover:underline">e/${esc(p.community_name)}</a>` : "";
  const list = comments.length
    ? comments
        .map(
          (c) =>
            `<li class="py-3 border-t border-outline-variant"><p class="text-xs ${muted}"><a href="/perfil/${encodeURIComponent(c.username)}" class="font-semibold text-on-surface hover:underline">${esc(c.name?.trim() || "@" + c.username)}</a> · ${fmtDate(c.created_at)}</p><div class="text-sm">${richText(c.content)}</div></li>`
        )
        .join("")
    : "";
  return layout(
    `<article class="${card} p-5 flex flex-col gap-3">` +
      `<p class="text-sm ${muted}"><a href="/perfil/${encodeURIComponent(p.username)}" class="font-semibold text-on-surface hover:underline">${author}</a> · <time datetime="${esc(p.created_at)}">${fmtDate(p.created_at)}</time>${community}</p>` +
      (p.title?.trim() ? `<h1 class="text-2xl font-bold">${esc(p.title.trim())}</h1>` : "") +
      `<div class="text-base flex flex-col gap-3">${richText(p.content)}</div>${media}` +
      `<p class="text-xs ${muted}">${p.upvotes} votos · ${comments.length} ${comments.length === 1 ? "comentário" : "comentários"}</p>` +
      `</article>` +
      (list ? `<section class="${card} px-5 py-2"><h2 class="font-bold text-sm pt-3">Comentários</h2><ul>${list}</ul></section>` : "")
  );
}

export function profileBody(
  u: { username: string; name: string | null; bio: string | null; avatar_url: string | null; posts: number },
  posts: ListedPost[]
): string {
  const display = esc(u.name?.trim() || `@${u.username}`);
  const avatar = u.avatar_url
    ? `<img src="${esc(u.avatar_url)}" alt="" class="w-20 h-20 rounded-full object-cover" />`
    : `<div class="w-20 h-20 rounded-full bg-primary-container text-on-primary font-bold text-2xl flex items-center justify-center uppercase">${esc(u.username.charAt(0))}</div>`;
  return layout(
    `<header class="${card} p-5 flex items-center gap-4">${avatar}<div class="min-w-0"><h1 class="text-2xl font-bold truncate">${display}</h1><p class="text-sm ${muted}">@${esc(u.username)} · ${u.posts} ${u.posts === 1 ? "publicação" : "publicações"}</p>${u.bio ? `<p class="text-sm mt-1">${esc(plainText(u.bio, 300))}</p>` : ""}</div></header>` +
      `<h2 class="font-bold text-sm">Publicações</h2>` +
      postList(posts, "Ainda não há publicações.")
  );
}

export function communityBody(
  c: { name: string; description: string | null; members: number; welcome_message: string | null; type: string },
  tags: string[],
  rules: Array<{ title: string; description: string | null }>,
  posts: ListedPost[]
): string {
  return layout(
    `<header class="${card} p-5 flex flex-col gap-2"><h1 class="text-2xl font-bold">e/${esc(c.name)}</h1>` +
      `<p class="text-xs ${muted}">${c.type === "restricted" ? "Restrita" : "Pública"} · ${c.members} ${c.members === 1 ? "membro" : "membros"}</p>` +
      (c.description ? `<p class="text-sm">${esc(plainText(c.description, 500))}</p>` : "") +
      (c.welcome_message ? `<div class="text-sm">${richText(c.welcome_message)}</div>` : "") +
      (tags.length ? `<p class="text-sm">${tags.map((t) => `<a href="/tag/${encodeURIComponent(t)}" class="text-primary hover:underline">#${esc(t)}</a>`).join(" ")}</p>` : "") +
      `</header>` +
      (rules.length
        ? `<section class="${card} p-5"><h2 class="font-bold text-sm mb-2">Regras</h2><ol class="list-decimal pl-5 text-sm flex flex-col gap-1">${rules.map((r) => `<li><strong>${esc(r.title)}</strong>${r.description ? ` — ${esc(r.description)}` : ""}</li>`).join("")}</ol></section>`
        : "") +
      `<h2 class="font-bold text-sm">Publicações</h2>` +
      postList(posts, "Ainda não há publicações.")
  );
}

export function tagBody(tag: string, total: number, posts: ListedPost[]): string {
  return layout(
    `<header class="${card} p-5"><h1 class="text-2xl font-bold">#${esc(tag)}</h1><p class="text-sm ${muted}">${total} ${total === 1 ? "publicação" : "publicações"}</p></header>` + postList(posts, "Nenhuma publicação ainda.")
  );
}
