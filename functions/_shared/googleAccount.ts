import { getJwtSecret, hashPassword, jsonResponse, errorResponse, signJWT } from "./auth";
import { GoogleProfile, randomUrlToken, sha256Hex, trustedEmail } from "./google";
import { completeLogin } from "./loginFlow";
import { MfaEnv, mfaAvailable } from "./mfa";

// Regras de conta do Google compartilhadas pelo login com botão (código + PKCE) e pelo One Tap

interface AccountEnv extends MfaEnv {
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

export type ResolvedGoogleAccount = { kind: "ok"; userId: number; created: boolean } | { kind: "email_in_use" };

// Acha a conta ligada a este "sub" do Google ou cria uma nova. Um e-mail que já pertence a uma conta do Espectro
// NUNCA é ligado sozinho: quem só digitou o e-mail no cadastro não provou ser dono dele.
export async function resolveGoogleAccount(db: D1Database, profile: GoogleProfile): Promise<ResolvedGoogleAccount> {
  const identity = await db
    .prepare("SELECT user_id FROM oauth_identities WHERE provider = 'google' AND subject = ?")
    .bind(profile.sub)
    .first<{ user_id: number }>();
  if (identity) return { kind: "ok", userId: identity.user_id, created: false };

  const existing = await db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE").bind(profile.email).first();
  if (existing) return { kind: "email_in_use" };

  const username = await freeUsername(db, profile.email);
  const unusablePassword = await hashPassword(randomUrlToken(32));
  // E-mail só entra como confirmado quando o Google é autoridade sobre ele (@gmail.com ou Workspace)
  const created = await db
    .prepare(
      `INSERT INTO users (username, email, password_hash, has_password, name, email_verified_at)
       VALUES (?, ?, ?, 0, ?, ${trustedEmail(profile) ? "CURRENT_TIMESTAMP" : "NULL"})`
    )
    .bind(username, profile.email, unusablePassword, profile.name ? profile.name.slice(0, 50) : null)
    .run();
  const userId = Number(created.meta.last_row_id);
  await db.prepare("INSERT INTO oauth_identities (user_id, provider, subject, email) VALUES (?, 'google', ?, ?)").bind(userId, profile.sub, profile.email).run();
  return { kind: "ok", userId, created: true };
}

// Último passo comum: conta suspensa não entra e quem tem 2FA ainda precisa do segundo passo
export async function finishGoogleLogin(env: AccountEnv, request: Request, userId: number): Promise<Response> {
  const user = await env.DB.prepare("SELECT id, username, suspended_at, deletion_requested_at FROM users WHERE id = ?")
    .bind(userId)
    .first<{ id: number; username: string; suspended_at: string | null; deletion_requested_at: string | null }>();
  if (!user || user.suspended_at) return errorResponse("Não foi possível entrar.", 403);

  if (mfaAvailable(env)) {
    const mfa = await env.DB.prepare("SELECT 1 AS has_mfa FROM user_mfa WHERE user_id = ? AND enabled_at IS NOT NULL").bind(user.id).first();
    if (mfa) {
      const mfaToken = await signJWT({ id: user.id, username: user.username, purpose: "mfa", exp: Math.floor(Date.now() / 1000) + 300 }, getJwtSecret(env));
      return jsonResponse({ mfa_required: true, mfa_token: mfaToken });
    }
  }

  return completeLogin(env, request, user, { mfa: false });
}

// Cria o pedido pendente de ligação (10 min): o Google já provou quem é, mas ligar a uma conta que já existe só
// acontece depois de a pessoa confirmar a senha dessa conta (e o 2FA, se houver). Devolve o código do pedido.
// Reusa oauth_states: code_verifier guarda o "sub" e nonce guarda o e-mail do Google.
export async function createPendingLink(db: D1Database, profile: GoogleProfile): Promise<string> {
  const linkToken = randomUrlToken(32);
  await db.batch([
    db.prepare("DELETE FROM oauth_states WHERE expires_at < CURRENT_TIMESTAMP"),
    db
      .prepare("INSERT INTO oauth_states (state_hash, code_verifier, nonce, mode, user_id, expires_at) VALUES (?, ?, ?, 'link_pending', NULL, datetime('now', '+10 minutes'))")
      .bind(await sha256Hex(linkToken), profile.sub, profile.email),
  ]);
  return linkToken;
}
