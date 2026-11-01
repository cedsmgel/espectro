// Tokens de uso único para confirmar e-mail e redefinir senha. No banco fica só o hash SHA-256.

export type TokenPurpose = "verify_email" | "reset_password";

const TTL_MINUTES: Record<TokenPurpose, number> = { verify_email: 24 * 60, reset_password: 30 };

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Cria um token novo e invalida os anteriores ainda não usados do mesmo tipo
export async function createEmailToken(db: D1Database, userId: number, purpose: TokenPurpose): Promise<string> {
  const token = randomToken();
  const hash = await sha256Hex(token);
  await db.batch([
    db.prepare("UPDATE email_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND purpose = ? AND used_at IS NULL").bind(userId, purpose),
    db
      .prepare(`INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, datetime('now', '+${TTL_MINUTES[purpose]} minutes'))`)
      .bind(userId, purpose, hash),
  ]);
  return token;
}

// Consome o token de forma atômica: só um uso, e só se ainda estiver válido. Devolve o dono ou null.
export async function consumeEmailToken(db: D1Database, token: string, purpose: TokenPurpose): Promise<number | null> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  const hash = await sha256Hex(token);
  const row = await db
    .prepare(
      "UPDATE email_tokens SET used_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP RETURNING user_id"
    )
    .bind(hash, purpose)
    .first<{ user_id: number }>();
  return row?.user_id ?? null;
}
