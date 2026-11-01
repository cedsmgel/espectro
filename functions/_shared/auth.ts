// Utilitários de autenticação usando Web Crypto API (sem dependências externas)

export interface UserPayload {
  id: number;
  username: string;
  exp?: number;
  iat?: number;
  sid?: string;
  // Última vez (segundos) em que o segundo fator foi verificado nesta sessão
  mfa_at?: number;
  // Token de uso restrito (ex.: "mfa" = primeiro passo do login); nunca vale como sessão
  purpose?: string;
}

// Segredo do JWT: sem fallback. Falha se não estiver configurado ou for fraco.
export function getJwtSecret(env: { JWT_SECRET?: string }): string {
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret === "troque-este-segredo") {
    throw new Error("Configuração do servidor incompleta.");
  }
  return secret;
}

// Converte ArrayBuffer para string Hexadecimal
function buf2hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Converte string Hexadecimal para Uint8Array
function hex2buf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Codificação base64url para JWT
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return atob(base64);
}

// Gera hash PBKDF2 com Salt aleatório
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: "SHA-256",
    },
    passKey,
    256
  );

  return `${buf2hex(salt.buffer)}:${buf2hex(derivedBits)}`;
}

// Valida senha contra hash PBKDF2
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;

  const [saltHex, originalHashHex] = parts;
  const salt = hex2buf(saltHex);

  const passKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: "SHA-256",
    },
    passKey,
    256
  );

  const computed = buf2hex(derivedBits);
  if (computed.length !== originalHashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ originalHashHex.charCodeAt(i);
  }
  return diff === 0;
}

// Gera JWT assinado com HMAC-SHA256
export async function signJWT(payload: UserPayload, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const tokenPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: payload.exp || Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 dias
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(dataToSign)
  );

  const encodedSignature = base64UrlEncodeBytes(new Uint8Array(signature));
  return `${dataToSign}.${encodedSignature}`;
}

// Valida JWT e retorna o payload
export async function verifyJWT(token: string, secret: string): Promise<UserPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const header = JSON.parse(base64UrlDecode(encodedHeader));
    if (header.alg !== "HS256") return null;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigBytes = Uint8Array.from(base64UrlDecode(encodedSignature), (c) =>
      c.charCodeAt(0)
    );

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(dataToSign)
    );

    if (!isValid) return null;

    const payload: UserPayload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token expirado
    }

    return payload;
  } catch {
    return null;
  }
}

// Extrai usuário autenticado do header Authorization
export async function getAuthUser(request: Request, secret: string): Promise<UserPayload | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  const payload = await verifyJWT(token, secret);
  return payload && !payload.purpose ? payload : null;
}

// Verifica se dois usuários têm amizade aceita (em qualquer direção)
export async function areFriends(db: D1Database, a: number, b: number): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT id FROM friendships WHERE status = 'accepted' AND ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) LIMIT 1"
    )
    .bind(a, b, b, a)
    .first();
  return Boolean(row);
}

// Há bloqueio entre os dois usuários, em qualquer sentido?
export async function isBlockedBetween(db: D1Database, a: number, b: number): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT 1 AS found FROM blocks WHERE (blocker_id = ?1 AND blocked_id = ?2) OR (blocker_id = ?2 AND blocked_id = ?1) LIMIT 1"
    )
    .bind(a, b)
    .first();
  return Boolean(row);
}

// Aceita apenas URLs de mídia do próprio site (/api/media/...) ou https; descarta o resto (javascript:, data:, etc.)
export function sanitizeMediaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!url || url.length > 2048) return null;
  if (/^\/api\/media\/[\w\-./%]+$/.test(url) && !url.includes("..")) return url;
  if (/^https:\/\/[^\s<>"']+$/.test(url)) return url;
  return null;
}

// Rate limit por janela fixa usando D1. Retorna uma Response 429 quando excedido, senão null.
// Se o D1 falhar, deixa passar (fail-open) para não derrubar o serviço.
export async function rateLimit(
  db: D1Database,
  request: Request,
  name: string,
  limit: number,
  windowSec: number,
  subject?: string | number
): Promise<Response | null> {
  try {
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / windowSec) * windowSec;
    const key = `${name}:${subject ?? ip}:${bucket}`;

    const row = await db
      .prepare(
        "INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count"
      )
      .bind(key, bucket)
      .first<{ count: number }>();

    if (Math.random() < 0.01) {
      await db.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(now - 86400).run();
    }

    if (row && row.count > limit) {
      const retryAfter = Math.max(1, bucket + windowSec - now);
      return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }), {
        status: 429,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Retry-After": String(retryAfter),
        },
      });
    }
  } catch (err) {
    console.error("rateLimit falhou:", err);
  }
  return null;
}

// Erro 500 genérico: detalhes ficam só nos logs do servidor
export function serverError(err: unknown, context: string): Response {
  console.error(`[${context}]`, err);
  return errorResponse("Erro interno do servidor.", 500);
}

// Escapa curingas do LIKE (usar com ESCAPE '\')
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Autor com perfil privado só tem conteúdo visível para ele mesmo e amigos aceitos
export async function canViewAuthorContent(
  db: D1Database,
  authorId: number,
  viewerId: number | null
): Promise<boolean> {
  const author = await db
    .prepare("SELECT is_private FROM users WHERE id = ?")
    .bind(authorId)
    .first<{ is_private: number }>();
  if (!author || !author.is_private) return true;
  if (viewerId === null) return false;
  if (viewerId === authorId) return true;
  return areFriends(db, viewerId, authorId);
}

// Respostas JSON formatadas
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
