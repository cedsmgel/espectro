import { jsonResponse, errorResponse, rateLimit, serverError } from "../../../_shared/auth";
import { GoogleEnv, googleEnabled, randomUrlToken, sha256Hex } from "../../../_shared/google";

export interface Env extends GoogleEnv {
  DB: D1Database;
}

// POST /api/auth/google/onetap-nonce -> { nonce }
// O navegador entrega este nonce ao Google, que o grava dentro da credencial. Na volta ele só vale uma vez (5 min),
// então uma credencial copiada ou antiga não pode ser reaproveitada.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!googleEnabled(env)) return errorResponse("Entrar com o Google ainda não está disponível.", 503);

    const limited = await rateLimit(env.DB, request, "onetap-nonce", 30, 600);
    if (limited) return limited;

    const nonce = randomUrlToken(24);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM oauth_states WHERE expires_at < CURRENT_TIMESTAMP"),
      // Reusa oauth_states: state_hash = hash do nonce; code_verifier não se aplica ao One Tap
      env.DB
        .prepare("INSERT INTO oauth_states (state_hash, code_verifier, nonce, mode, user_id, expires_at) VALUES (?, '-', ?, 'onetap', NULL, datetime('now', '+5 minutes'))")
        .bind(await sha256Hex(nonce), nonce),
    ]);
    return jsonResponse({ nonce });
  } catch (err: unknown) {
    return serverError(err, "google:onetap-nonce");
  }
};
