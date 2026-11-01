// Cache de borda (Cache API) para respostas de LEITURA PÚBLICA servidas a visitantes (sem Authorization).
// A primeira chamada consulta o banco; as seguintes, dentro do prazo, saem prontas. Poupa leituras e CPU no D1.
// Quem está logado (header Authorization) ou manda Cache-Control: no-cache nunca passa por aqui.

export async function cachedForVisitors(request: Request, ttlSeconds: number, build: () => Promise<Response>): Promise<Response> {
  const skip = request.headers.has("Authorization") || /no-cache/i.test(request.headers.get("Cache-Control") || "");
  const cache = typeof caches !== "undefined" ? (caches as unknown as { default?: Cache }).default : undefined;
  if (skip || !cache) return build();

  const key = new Request(new URL(request.url).toString(), { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;

  const fresh = await build();
  if (fresh.status !== 200) return fresh;

  const stored = new Response(fresh.clone().body, fresh);
  stored.headers.set("Cache-Control", `public, max-age=0, s-maxage=${ttlSeconds}`);
  await cache.put(key, stored.clone());
  return stored;
}
