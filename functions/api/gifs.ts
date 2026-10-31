import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  GIPHY_API_KEY?: string;
}

// GET ?q=: busca de GIFs no GIPHY. A chave fica só no servidor (secret GIPHY_API_KEY).
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    if (!env.GIPHY_API_KEY) return errorResponse("GIFs indisponíveis no momento.", 503);

    const limited = await rateLimit(env.DB, request, "gifs", 120, 60, user.id);
    if (limited) return limited;

    const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 50);
    const params = new URLSearchParams({ api_key: env.GIPHY_API_KEY, limit: "24", rating: "g" });
    const endpoint = q
      ? `https://api.giphy.com/v1/gifs/search?${params}&q=${encodeURIComponent(q)}`
      : `https://api.giphy.com/v1/gifs/trending?${params}`;

    const res = await fetch(endpoint);
    if (!res.ok) return errorResponse("Não foi possível buscar GIFs agora.", 502);

    const data = (await res.json()) as { data?: any[] };
    const results = (data.data || [])
      .map((g) => ({
        id: String(g.id),
        title: g.title || "GIF",
        preview: g.images?.fixed_width?.url || g.images?.fixed_height?.url || null,
        url: g.images?.original?.url || null,
      }))
      .filter((g) => g.preview && g.url);

    return jsonResponse({ results, attribution: "GIPHY" });
  } catch (err: unknown) {
    return serverError(err, "gifs");
  }
};
