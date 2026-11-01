import { appUrl, EmailEnv } from "./email";

// Entrar com o Google: fluxo "authorization code" com PKCE e nonce, sem biblioteca.
// O Google devolve o id_token direto do endpoint de token (TLS), então conferimos emissor, público, validade e nonce.

export interface GoogleEnv extends Pick<EmailEnv, "APP_URL"> {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  // Só para testes locais com um servidor falso; em produção fica vazio e vale o endereço do Google
  GOOGLE_TOKEN_URL?: string;
  // Idem para as chaves públicas (JWKS) usadas na verificação da assinatura do One Tap
  GOOGLE_JWKS_URL?: string;
}

export const googleEnabled = (env: GoogleEnv): boolean => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

// Este endereço precisa estar cadastrado exatamente assim no Google Cloud Console
export const googleRedirectUri = (env: GoogleEnv): string => `${appUrl(env)}/api/auth/google/callback`;

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const randomUrlToken = (size = 32) => bytesToBase64Url(crypto.getRandomValues(new Uint8Array(size)));

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return bytesToBase64Url(new Uint8Array(digest));
}

export function authorizeUrl(env: GoogleEnv, state: string, challenge: string, nonce: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID || "",
    redirect_uri: googleRedirectUri(env),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    // Sempre mostra a escolha de conta (evita entrar sem querer na conta errada do navegador)
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  // Domínio Google Workspace, quando a conta pertence a um
  hostedDomain: string | null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    const json = new TextDecoder().decode(Uint8Array.from(atob(part.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Troca o código pelo id_token e valida o que ele afirma
export async function exchangeCode(env: GoogleEnv, code: string, verifier: string, nonce: string): Promise<GoogleProfile | null> {
  const response = await fetch(env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID || "",
      client_secret: env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: googleRedirectUri(env),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!response.ok) return null;

  const body = (await response.json().catch(() => null)) as { id_token?: string } | null;
  const claims = body?.id_token ? decodeJwtPayload(body.id_token) : null;
  if (!claims) return null;

  return profileFromClaims(env, claims, nonce);
}

// Confere emissor, público (aud), validade e, se pedido, o nonce; devolve o perfil ou null.
// Para o One Tap o nonce é conferido pelo chamador (uso único no banco), então aqui vem como null.
export function profileFromClaims(env: GoogleEnv, claims: Record<string, unknown>, nonce: string | null): GoogleProfile | null {
  const issuerOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  const audienceOk = claims.aud === env.GOOGLE_CLIENT_ID;
  const now = Math.floor(Date.now() / 1000);
  const notExpired = typeof claims.exp === "number" && claims.exp > now;
  const issuedSanely = typeof claims.iat !== "number" || claims.iat <= now + 300;
  if (!issuerOk || !audienceOk || !notExpired || !issuedSanely) return null;
  if (nonce !== null && claims.nonce !== nonce) return null;
  if (typeof claims.sub !== "string" || !claims.sub || typeof claims.email !== "string") return null;

  return {
    sub: claims.sub,
    email: claims.email.toLowerCase(),
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: typeof claims.name === "string" ? claims.name : null,
    hostedDomain: typeof claims.hd === "string" ? claims.hd : null,
  };
}

// O Google só é autoridade sobre o e-mail de @gmail.com e de contas Workspace (com "hd"). Para outros domínios,
// o dono do endereço pode ter mudado mesmo com email_verified, então não o tratamos como confirmado.
export const trustedEmail = (profile: GoogleProfile): boolean =>
  profile.emailVerified && (profile.email.endsWith("@gmail.com") || Boolean(profile.hostedDomain));

// ---- Verificação de assinatura (One Tap): a credencial chega do navegador, então NADA nela é confiável sem isto

interface Jwk {
  kid: string;
  kty: string;
  alg?: string;
  n: string;
  e: string;
}

let jwksCache: { keys: Jwk[]; expiresAt: number } | null = null;

async function googleKeys(env: GoogleEnv, forceRefresh = false): Promise<Jwk[]> {
  if (!forceRefresh && jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  const response = await fetch(env.GOOGLE_JWKS_URL || "https://www.googleapis.com/oauth2/v3/certs");
  if (!response.ok) return jwksCache?.keys ?? [];
  const body = (await response.json().catch(() => null)) as { keys?: Jwk[] } | null;
  const keys = body?.keys ?? [];
  // Respeita o Cache-Control do Google (as chaves giram); sem ele, 1 hora
  const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get("Cache-Control") || "")?.[1]) || 3600;
  jwksCache = { keys, expiresAt: Date.now() + Math.min(maxAge, 86400) * 1000 };
  return keys;
}

const base64UrlToBytes = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

// Valida a assinatura RS256 da credencial com as chaves públicas do Google e devolve as claims (ainda sem checar aud/iss/exp)
export async function verifyGoogleSignature(env: GoogleEnv, token: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0]))) as { alg?: string; kid?: string };
    if (header.alg !== "RS256" || !header.kid) return null;

    let key = (await googleKeys(env)).find((k) => k.kid === header.kid);
    // Chave desconhecida: o Google pode ter girado as chaves; tenta uma vez com a lista nova
    if (!key) key = (await googleKeys(env, true)).find((k) => k.kid === header.kid);
    if (!key || key.kty !== "RSA") return null;

    const cryptoKey = await crypto.subtle.importKey("jwk", { kty: "RSA", n: key.n, e: key.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      base64UrlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    return valid ? decodeJwtPayload(token) : null;
  } catch {
    return null;
  }
}
