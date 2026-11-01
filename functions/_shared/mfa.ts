import { errorResponse, UserPayload, verifyPassword } from "./auth";
import { base32Decode, matchTotp } from "./totp";

export interface MfaEnv {
  DB: D1Database;
  // Chave que cifra os segredos do autenticador. Sem ela, a verificação em duas etapas fica indisponível.
  TOTP_ENC_KEY?: string;
}

export const mfaAvailable = (env: MfaEnv): boolean => Boolean(env.TOTP_ENC_KEY && env.TOTP_ENC_KEY.length >= 32);

// Quanto tempo vale uma verificação recente para ações sensíveis
export const STEP_UP_SECONDS = 10 * 60;

const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function aesKey(env: MfaEnv): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.TOTP_ENC_KEY || ""));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(env: MfaEnv, secret: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(env), new Uint8Array(secret)));
  return `${bytesToBase64(iv)}.${bytesToBase64(cipher)}`;
}

export async function decryptSecret(env: MfaEnv, stored: string): Promise<Uint8Array> {
  const [iv, cipher] = stored.split(".");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv) }, await aesKey(env), base64ToBytes(cipher));
  return new Uint8Array(plain);
}

// Códigos de recuperação: sem caracteres confusos (0/O, 1/I), 10 caracteres em dois blocos
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const chars = [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

export const normalizeRecoveryCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, "");

async function hashRecoveryCode(env: MfaEnv, code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${env.TOTP_ENC_KEY}:${normalizeRecoveryCode(code)}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Substitui todos os códigos por um conjunto novo de 10 e devolve os códigos em texto (só aparecem agora)
export async function replaceRecoveryCodes(env: MfaEnv, userId: number): Promise<string[]> {
  const codes = Array.from({ length: 10 }, newRecoveryCode);
  const hashes = await Promise.all(codes.map((c) => hashRecoveryCode(env, c)));
  await env.DB.batch([
    env.DB.prepare("DELETE FROM mfa_recovery_codes WHERE user_id = ?").bind(userId),
    ...hashes.map((h) => env.DB.prepare("INSERT INTO mfa_recovery_codes (user_id, code_hash) VALUES (?, ?)").bind(userId, h)),
  ]);
  return codes;
}

export async function mfaState(db: D1Database, userId: number) {
  const row = await db
    .prepare("SELECT enabled_at, (SELECT COUNT(*) FROM mfa_recovery_codes WHERE user_id = ?1 AND used_at IS NULL) AS codes_left FROM user_mfa WHERE user_id = ?1")
    .bind(userId)
    .first<{ enabled_at: string | null; codes_left: number }>();
  return { enabled: Boolean(row?.enabled_at), pending: Boolean(row && !row.enabled_at), codesLeft: row?.codes_left ?? 0 };
}

export type SecondFactor = { code?: unknown; recovery_code?: unknown };

// Limite de tentativas ERRADAS: só falhas contam, então quem acerta de primeira nunca é barrado
const FAIL_WINDOW = 300;
const failKey = (scope: string) => `mfa-fail:${scope}:${Math.floor(Date.now() / 1000 / FAIL_WINDOW) * FAIL_WINDOW}`;

async function tooManyFailures(db: D1Database, scope: string, limit: number): Promise<boolean> {
  const row = await db.prepare("SELECT count FROM rate_limits WHERE key = ?").bind(failKey(scope)).first<{ count: number }>();
  return (row?.count ?? 0) >= limit;
}

async function recordFailure(db: D1Database, scope: string): Promise<void> {
  const bucket = Math.floor(Date.now() / 1000 / FAIL_WINDOW) * FAIL_WINDOW;
  await db
    .prepare("INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1")
    .bind(failKey(scope), bucket)
    .run();
}

// Confere o segundo fator (código do app OU código de recuperação). Com limite de tentativas e sem reaproveitar código.
export async function checkSecondFactor(
  env: MfaEnv,
  request: Request,
  userId: number,
  input: SecondFactor,
  options: { allowPending?: boolean } = {}
): Promise<{ ok: true; usedRecovery: boolean } | { ok: false; response: Response }> {
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const userScope = `u${userId}`;
  const ipScope = `ip${ip}`;
  if ((await tooManyFailures(env.DB, userScope, 5)) || (await tooManyFailures(env.DB, ipScope, 20))) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Muitas tentativas incorretas. Aguarde alguns minutos e tente de novo." }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "300" },
      }),
    };
  }

  const wrongAnswer = async () => {
    await Promise.all([recordFailure(env.DB, userScope), recordFailure(env.DB, ipScope)]);
    return { ok: false as const, response: errorResponse("Código incorreto ou expirado.", 403) };
  };

  if (typeof input.recovery_code === "string" && input.recovery_code.trim()) {
    const hash = await hashRecoveryCode(env, input.recovery_code);
    const used = await env.DB.prepare("UPDATE mfa_recovery_codes SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND code_hash = ? AND used_at IS NULL")
      .bind(userId, hash)
      .run();
    return used.meta.changes ? { ok: true, usedRecovery: true } : await wrongAnswer();
  }

  if (typeof input.code !== "string") return wrongAnswer();
  const row = await env.DB.prepare("SELECT secret_enc, enabled_at, last_used_step FROM user_mfa WHERE user_id = ?")
    .bind(userId)
    .first<{ secret_enc: string; enabled_at: string | null; last_used_step: number }>();
  if (!row || (!row.enabled_at && !options.allowPending)) return wrongAnswer();

  const step = await matchTotp(await decryptSecret(env, row.secret_enc), input.code.replace(/\s+/g, ""));
  if (step === null) return wrongAnswer();

  // O mesmo código (ou um mais antigo) não vale duas vezes
  const claimed = await env.DB.prepare("UPDATE user_mfa SET last_used_step = ? WHERE user_id = ? AND last_used_step < ?").bind(step, userId, step).run();
  return claimed.meta.changes ? { ok: true, usedRecovery: false } : wrongAnswer();
}

// Ações sensíveis de quem tem 2FA pedem uma verificação feita nos últimos 10 minutos
export async function requireRecentMfa(env: MfaEnv, auth: UserPayload): Promise<Response | null> {
  const state = await mfaState(env.DB, auth.id);
  if (!state.enabled) return null;
  const now = Math.floor(Date.now() / 1000);
  if ((auth.mfa_at ?? 0) >= now - STEP_UP_SECONDS) return null;
  return new Response(JSON.stringify({ error: "Confirme sua identidade com o código de verificação.", mfa_required: true }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

export async function checkPassword(env: MfaEnv, userId: number, password: unknown): Promise<boolean> {
  if (typeof password !== "string") return false;
  const row = await env.DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(userId).first<{ password_hash: string }>();
  return Boolean(row && (await verifyPassword(password, row.password_hash)));
}
