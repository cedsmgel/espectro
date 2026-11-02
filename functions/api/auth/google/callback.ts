import { appUrl } from "../../../_shared/email";
import { exchangeCode, GoogleEnv, googleEnabled, randomUrlToken, sha256Hex } from "../../../_shared/google";
import { createPendingLink, createPendingSignup, resolveGoogleAccount } from "../../../_shared/googleAccount";

export interface Env extends GoogleEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET /api/auth/google/callback: volta do Google. Nunca devolve token na URL: manda um código de troca de uso único.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const go = (path: string) => Response.redirect(`${appUrl(env)}${path}`, 302);
  try {
    if (!googleEnabled(env)) return go("/?auth_error=google_unavailable");

    const url = new URL(request.url);
    if (url.searchParams.get("error")) return go("/?auth_error=google_cancelled");

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return go("/?auth_error=google_failed");

    // O estado só vale uma vez e por 10 minutos (protege contra CSRF e reaproveitamento)
    const saved = await env.DB.prepare(
      "DELETE FROM oauth_states WHERE state_hash = ? AND expires_at > CURRENT_TIMESTAMP RETURNING code_verifier, nonce, mode, user_id"
    )
      .bind(await sha256Hex(state))
      .first<{ code_verifier: string; nonce: string; mode: string; user_id: number | null }>();
    if (!saved) return go("/?auth_error=google_failed");

    const profile = await exchangeCode(env, code, saved.code_verifier, saved.nonce);
    if (!profile) return go("/?auth_error=google_failed");
    if (!profile.emailVerified) return go("/?auth_error=google_email_unverified");

    const identity = await env.DB.prepare("SELECT user_id FROM oauth_identities WHERE provider = 'google' AND subject = ?")
      .bind(profile.sub)
      .first<{ user_id: number }>();

    // Ligar o Google a uma conta que já está logada
    if (saved.mode === "link" && saved.user_id) {
      if (identity && identity.user_id !== saved.user_id) return go("/settings/account?google=in_use");
      if (!identity) {
        await env.DB.prepare("INSERT INTO oauth_identities (user_id, provider, subject, email) VALUES (?, 'google', ?, ?)")
          .bind(saved.user_id, profile.sub, profile.email)
          .run();
      }
      return go("/settings/account?google=linked");
    }

    const account = await resolveGoogleAccount(env.DB, profile);
    // E-mail de uma conta que já existe: em vez de um erro sem saída, leva a uma tela pedindo a senha dessa conta
    if (account.kind === "email_in_use") {
      const linkToken = await createPendingLink(env.DB, profile);
      return go(`/entrar/google?link=${encodeURIComponent(linkToken)}&email=${encodeURIComponent(profile.email)}`);
    }
    // Conta nova: pede a declaração de idade mínima e o aceite dos termos antes de criar
    if (account.kind === "signup_required") {
      const signupToken = await createPendingSignup(env.DB, profile);
      return go(`/entrar/google?signup=${encodeURIComponent(signupToken)}&email=${encodeURIComponent(profile.email)}`);
    }
    const userId = account.userId;

    const user = await env.DB.prepare("SELECT suspended_at FROM users WHERE id = ?").bind(userId).first<{ suspended_at: string | null }>();
    if (!user) return go("/?auth_error=google_failed");
    if (user.suspended_at) return go("/?auth_error=suspended");

    const exchange = randomUrlToken(32);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM oauth_exchange WHERE expires_at < CURRENT_TIMESTAMP"),
      env.DB.prepare("INSERT INTO oauth_exchange (code_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+60 seconds'))").bind(
        await sha256Hex(exchange),
        userId
      ),
    ]);
    return go(`/entrar/google?code=${encodeURIComponent(exchange)}`);
  } catch (err) {
    console.error("google:callback", err);
    return go("/?auth_error=google_failed");
  }
};
