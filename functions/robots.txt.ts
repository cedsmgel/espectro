import { siteOrigin } from "./_shared/seo";

interface Env {
  SITE_URL?: string;
}

// GET /robots.txt: libera o site público e aponta o sitemap. Páginas privadas usam noindex (X-Robots-Tag),
// não Disallow, porque o buscador precisa conseguir abrir a página para ler o noindex.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const origin = siteOrigin(request, env);
  const body = ["User-agent: *", "Allow: /", "Disallow: /api/", "Disallow: /admin", "", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
};
