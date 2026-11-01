// SEO no servidor: o app é uma página montada no navegador, então buscadores e prévias de link (WhatsApp, Telegram,
// Discord...) só enxergam o que vem no HTML. Aqui o HTML do app recebe, por rota pública, título, descrição,
// canonical, Open Graph, Twitter Card e dados estruturados. Conteúdo privado nunca entra: sai genérico e com noindex.

export interface SeoEnv {
  ASSETS: Fetcher;
  SITE_URL?: string; // ex.: https://espectro.com.br (quando houver domínio próprio)
}

export interface PageMeta {
  title: string;
  description: string;
  path: string; // caminho canônico, ex.: /post/12
  image?: string | null; // absoluta ou relativa ao site
  type?: "website" | "article" | "profile";
  noindex?: boolean;
  status?: number;
  jsonLd?: Record<string, unknown>;
  noscript?: string; // texto simples para quem não roda JavaScript
}

export const SITE_NAME = "Espectro";
const DEFAULT_IMAGE = "/icons/icon-512.png";

export function siteOrigin(request: Request, env: { SITE_URL?: string }): string {
  return (env.SITE_URL || new URL(request.url).origin).replace(/\/+$/, "");
}

export function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Resume um texto de publicação: tira o marcador de scrap, markdown simples e quebras de linha
export function plainText(content: string | null | undefined, max: number): string {
  let text = (content || "").replace(/^\[\[scrap:[\s\S]*?\]\]\n?/, "");
  text = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`~>]+/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

function absolute(url: string, origin: string): string {
  return /^https?:\/\//i.test(url) ? url : origin + (url.startsWith("/") ? url : "/" + url);
}

function metaTags(meta: PageMeta, origin: string): string {
  const url = origin + meta.path;
  const image = absolute(meta.image || DEFAULT_IMAGE, origin);
  const title = esc(meta.title);
  const description = esc(meta.description);
  const tags = [
    `<meta name="description" content="${description}" />`,
    `<meta name="robots" content="${meta.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta property="og:type" content="${meta.type || "website"}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta name="twitter:card" content="${meta.image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
  ];
  if (meta.jsonLd && !meta.noindex) {
    // "<" escapado para o JSON nunca fechar a tag <script>
    tags.push(`<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, "\\u003c")}</script>`);
  }
  return tags.join("\n    ");
}

// Devolve o HTML do app com as tags da página no <head>
export async function renderShell(request: Request, env: SeoEnv, meta: PageMeta): Promise<Response> {
  const origin = siteOrigin(request, env);
  const shell = await env.ASSETS.fetch(new Request(new URL("/", request.url).toString(), { headers: { Accept: "text/html" } }));
  const headers = new Headers(shell.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  if (meta.noindex) headers.set("X-Robots-Tag", "noindex, nofollow");

  const rewriter = new HTMLRewriter()
    .on("title", {
      element(el) {
        el.setInnerContent(meta.title);
      },
    })
    // A descrição padrão do index.html é substituída pela da página
    .on('meta[name="description"], meta[name="robots"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"]', {
      element(el) {
        el.remove();
      },
    })
    .on("head", {
      element(el) {
        el.append("\n    " + metaTags(meta, origin) + "\n", { html: true });
      },
    })
    .on("body", {
      element(el) {
        if (meta.noscript) el.append(`<noscript><main><h1>${esc(meta.title)}</h1><p>${esc(meta.noscript)}</p></main></noscript>`, { html: true });
      },
    });

  return rewriter.transform(new Response(shell.body, { status: meta.status || 200, headers }));
}

// Página genérica e sem indexação: conteúdo privado, inexistente ou suspenso
export function hiddenMeta(path: string, status = 200): PageMeta {
  return {
    title: `${SITE_NAME} - Plataforma Social Conectada`,
    description: "Entre para ver este conteúdo no Espectro.",
    path,
    noindex: true,
    status,
  };
}
