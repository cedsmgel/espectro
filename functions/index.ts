import { siteOrigin } from "./_shared/seo";

interface Env {
  ASSETS: Fetcher;
  SITE_URL?: string;
}

// GET /: a landing já renderizada no build (SSG, arquivo landing.html). Com parâmetros (?q=, ?filter=, ?auth_error=)
// ou se o arquivo faltar, entrega o app normal.
export const onRequestGet: PagesFunction<Env> = async ({ request, env, next }) => {
  const url = new URL(request.url);
  if (url.search) return next();

  try {
    const landing = await env.ASSETS.fetch(new Request(new URL("/landing", request.url).toString(), { headers: { Accept: "text/html" } }));
    if (!landing.ok || !(landing.headers.get("content-type") || "").includes("text/html")) return next();

    const origin = siteOrigin(request, env);
    const headers = new Headers(landing.headers);
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    const rewriter = new HTMLRewriter().on("head", {
      element(el) {
        el.append(`\n    <link rel="canonical" href="${origin}/" />\n    <meta property="og:url" content="${origin}/" />\n`, { html: true });
      },
    });
    return rewriter.transform(new Response(landing.body, { status: 200, headers }));
  } catch {
    return next();
  }
};
