import { hashPassword } from "../../../_shared/auth";
import { appUrl } from "../../../_shared/email";
import { exchangeCode, GoogleEnv, googleEnabled, randomUrlToken, sha256Hex } from "../../../_shared/google";

export interface Env extends GoogleEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

// Nome de usuário a partir do e-mail: só letras minúsculas, números e _, de 3 a 30 caracteres, sem repetir
async function freeUsername(db: D1Database, email: string): Promise<string> {
  let base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 22);
  if (base.length < 3) base = `user${base}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    const taken = await db.prepare("SELECT 1 AS used FROM users WHERE username = ? COLLATE NOCASE").bind(candidate).first();
    if (!taken) return candidate;
  }
  return `${base}${Date.now() % 100000}`;
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

    let userId = identity?.user_id ?? null;

    if (!userId) {
      // E-mail já usado por uma conta do Espectro: não ligamos sozinho. Quem só digitou o e-mail no cadastro
      // não provou ser dono dele, e ligar daria a essa conta acesso a quem tiver entrado com o Google.
      const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE").bind(profile.email).first();
      if (existing) return go("/?auth_error=email_in_use");

      const username = await freeUsername(env.DB, profile.email);
      const unusablePassword = await hashPassword(randomUrlToken(32));
      const created = await env.DB.prepare(
        "INSERT INTO users (username, email, password_hash, has_password, name, email_verified_at) VALUES (?, ?, ?, 0, ?, CURRENT_TIMESTAMP)"
      )
        .bind(username, profile.email, unusablePassword, profile.name ? profile.name.slice(0, 50) : null)
        .run();
      userId = Number(created.meta.last_row_id);
      await env.DB.prepare("INSERT INTO oauth_identities (user_id, provider, subject, email) VALUES (?, 'google', ?, ?)")
        .bind(userId, profile.sub, profile.email)
        .run();
    }

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
