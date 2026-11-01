// Prévia de link (Open Graph): o site é uma SPA, então quem recebe o link (WhatsApp, Telegram, X)
// lê só o HTML inicial. Estas funções entregam o mesmo HTML do app com título, descrição e imagem
// da publicação ou do perfil já no <head>.

export interface PreviewMeta {
  title: string;
  description: string;
  image: string;
  url: string;
  type: "article" | "profile";
  largeImage: boolean;
  noindex: boolean;
}

const MARKER_RE = /^\[\[scrap:\{.*?\}\]\]\s*/;

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Texto corrido para a descrição: sem marcação de recado nem de Markdown, em no máximo `max` caracteres
export function summarize(text: string | null | undefined, max = 200): string {
  const plain = (text || "")
    .replace(MARKER_RE, "")
    .replace(/[*_`>#~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

// URL absoluta de uma mídia: caminhos /api/media/ viram absolutos e só https externo é aceito
export function absoluteMediaUrl(origin: string, value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\/api\/media\/[\w\-./%]+$/.test(value) && !value.includes("..")) return `${origin}${value}`;
  if (/^https:\/\/[^\s<>"']+$/.test(value)) return value;
  return null;
}

function metaTags(meta: PreviewMeta): string {
  const title = escapeAttr(meta.title);
  const description = escapeAttr(meta.description);
  const image = escapeAttr(meta.image);
  const url = escapeAttr(meta.url);
  return [
    `<meta name="description" content="${description}">`,
    `<link rel="canonical" href="${url}">`,
    meta.noindex ? `<meta name="robots" content="noindex">` : "",
    `<meta property="og:site_name" content="Espectro">`,
    `<meta property="og:locale" content="pt_BR">`,
    `<meta property="og:type" content="${meta.type}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta name="twitter:card" content="${meta.largeImage ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${image}">`,
  ]
    .filter(Boolean)
    .join("\n    ");
}

// Entrega o HTML do app (o mesmo de qualquer outra rota) com a prévia no <head>.
// Sem `meta`, devolve o app como está.
export async function withPreview(next: () => Promise<Response>, meta: PreviewMeta | null): Promise<Response> {
  const shell = await next();
  const type = shell.headers.get("content-type") || "";
  if (!meta || !shell.ok || !type.includes("text/html")) return shell;

  const headers = new Headers(shell.headers);
  headers.delete("content-length");
  headers.delete("etag");
  headers.set("Cache-Control", "no-cache");

  return new HTMLRewriter()
    .on("title", {
      element(element) {
        element.setInnerContent(meta.title);
      },
    })
    .on('meta[name="description"]', {
      element(element) {
        element.remove();
      },
    })
    .on("head", {
      element(element) {
        element.append(`\n    ${metaTags(meta)}\n  `, { html: true });
      },
    })
    .transform(new Response(shell.body, { status: shell.status, headers }));
}
