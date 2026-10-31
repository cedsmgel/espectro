import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  GIPHY_API_KEY?: string;
}

// GET /api/gifs?type=gifs|stickers&q=&categories=1
// Chave do GIPHY fica só no servidor (secret GIPHY_API_KEY).
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);
    if (!env.GIPHY_API_KEY) return errorResponse("GIFs indisponíveis no momento.", 503);

    const limited = await rateLimit(env.DB, request, "gifs", 120, 60, user.id);
    if (limited) return limited;

    const url = new URL(request.url);
    const base = "https://api.giphy.com/v1";
    const params = new URLSearchParams({ api_key: env.GIPHY_API_KEY, rating: "g", lang: "pt" });

    if (url.searchParams.get("categories") === "1") {
      const res = await fetch(`${base}/gifs/categories?${params}`);
      if (!res.ok) return errorResponse("Não foi possível carregar as categorias.", 502);
      const data = (await res.json()) as { data?: any[] };
      const categories = (data.data || []).map((c) => ({
        name: c.name as string,
        query: (c.name_encoded || c.name) as string,
        preview: c.gif?.images?.fixed_width_small?.url || c.gif?.images?.fixed_width?.url || null,
      }));
      return jsonResponse({ categories });
    }

    const type = url.searchParams.get("type") === "stickers" ? "stickers" : "gifs";
    const q = (url.searchParams.get("q") || "").trim().slice(0, 50);
    params.set("limit", "24");
    const endpoint = q ? `${base}/${type}/search?${params}&q=${encodeURIComponent(q)}` : `${base}/${type}/trending?${params}`;

    const res = await fetch(endpoint);
    if (!res.ok) return errorResponse("Não foi possível buscar agora.", 502);

    const data = (await res.json()) as { data?: any[] };
    const results = (data.data || [])
      .map((g) => ({
        id: String(g.id),
        title: g.title || (type === "stickers" ? "Figurinha" : "GIF"),
        preview: g.images?.fixed_width?.url || g.images?.fixed_height?.url || null,
        url: g.images?.original?.url || null,
      }))
      .filter((g) => g.preview && g.url);

    return jsonResponse({ results, type, attribution: "GIPHY" });
  } catch (err: unknown) {
    return serverError(err, "gifs");
  }
};
