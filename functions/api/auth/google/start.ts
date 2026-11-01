import { errorResponse, getAuthUser, getJwtSecret, jsonResponse, rateLimit, serverError } from "../../../_shared/auth";
import { authorizeUrl, GoogleEnv, googleEnabled, pkceChallenge, randomUrlToken, sha256Hex } from "../../../_shared/google";

export interface Env extends GoogleEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

// POST /api/auth/google/start { mode: "login" | "link" } -> { url }
// "link" (ligar o Google a uma conta existente) exige estar logado: o navegador não envia o token em um redirecionamento.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!googleEnabled(env)) return errorResponse("Entrar com o Google ainda não está disponível.", 503);

    const limited = await rateLimit(env.DB, request, "google-start", 30, 600);
    if (limited) return limited;

    const body: any = await request.json().catch(() => null);
    const mode = body?.mode === "link" ? "link" : "login";

    let userId: number | null = null;
    if (mode === "link") {
      const auth = await getAuthUser(request, getJwtSecret(env));
      if (!auth) return errorResponse("Não autorizado.", 401);
      userId = auth.id;
    }

    const state = randomUrlToken();
    const verifier = randomUrlToken(48);
    const nonce = randomUrlToken(16);

    await env.DB.batch([
      env.DB.prepare("DELETE FROM oauth_states WHERE expires_at < CURRENT_TIMESTAMP"),
      env.DB
        .prepare("INSERT INTO oauth_states (state_hash, code_verifier, nonce, mode, user_id, expires_at) VALUES (?, ?, ?, ?, ?, datetime('now', '+10 minutes'))")
        .bind(await sha256Hex(state), verifier, nonce, mode, userId),
    ]);

    return jsonResponse({ url: authorizeUrl(env, state, await pkceChallenge(verifier), nonce) });
  } catch (err: unknown) {
    return serverError(err, "google:start");
  }
};
