// Cloudflare Turnstile (anti-bot) nas rotas de cadastro, login e "esqueci a senha".
// O navegador manda o token (cf-turnstile-response); o servidor confirma no siteverify. Nunca o navegador.

export interface TurnstileEnv {
  TURNSTILE_SITEKEY?: string; // chave pública: se estiver definida, o Turnstile é exigido
  TURNSTILE_SECRET?: string; // secret do Pages
  TURNSTILE_HOSTNAMES?: string; // hostnames do site neste ambiente, separados por vírgula (produção: espectro.pages.dev)
}

export type TurnstileAction = "signup" | "login" | "forgot_password";

// Sem TURNSTILE_SITEKEY o recurso fica desligado (desenvolvimento local e testes). Com ele, tudo é obrigatório.
export const turnstileEnabled = (env: TurnstileEnv): boolean => Boolean(env.TURNSTILE_SITEKEY);

interface SiteverifyResult {
  success?: boolean;
  action?: string;
  hostname?: string;
}

// true = pode seguir. Falha fechada: sem secret, sem hostnames, erro de rede ou resposta estranha, nega.
export async function verifyTurnstile(request: Request, env: TurnstileEnv, token: unknown, expectedAction: TurnstileAction): Promise<boolean> {
  if (!turnstileEnabled(env)) return true;

  const hostnames = new Set((env.TURNSTILE_HOSTNAMES ?? "").split(",").map((h) => h.trim()).filter(Boolean));
  if (!env.TURNSTILE_SECRET || hostnames.size === 0) {
    console.error("Turnstile ativo, mas TURNSTILE_SECRET ou TURNSTILE_HOSTNAMES não estão configurados.");
    return false;
  }
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;

  let result: SiteverifyResult;
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
    const ip = request.headers.get("CF-Connecting-IP");
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body,
    });
    if (!res.ok) throw new Error(`siteverify ${res.status}`);
    result = (await res.json()) as SiteverifyResult;
  } catch (err) {
    console.error("Turnstile siteverify falhou:", err instanceof Error ? err.message : err);
    return false;
  }

  return result.success === true && result.action === expectedAction && typeof result.hostname === "string" && hostnames.has(result.hostname);
}

export function turnstileFailedResponse(): Response {
  return new Response(JSON.stringify({ error: "Não foi possível confirmar que você é uma pessoa. Tente de novo.", turnstile_failed: true }), {
    status: 403,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
