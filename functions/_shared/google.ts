import { appUrl, EmailEnv } from "./email";

// Entrar com o Google: fluxo "authorization code" com PKCE e nonce, sem biblioteca.
// O Google devolve o id_token direto do endpoint de token (TLS), então conferimos emissor, público, validade e nonce.

export interface GoogleEnv extends Pick<EmailEnv, "APP_URL"> {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  // Só para testes locais com um servidor falso; em produção fica vazio e vale o endereço do Google
  GOOGLE_TOKEN_URL?: string;
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

  const issuerOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  const audienceOk = claims.aud === env.GOOGLE_CLIENT_ID;
  const notExpired = typeof claims.exp === "number" && claims.exp > Math.floor(Date.now() / 1000);
  if (!issuerOk || !audienceOk || !notExpired || claims.nonce !== nonce) return null;
  if (typeof claims.sub !== "string" || typeof claims.email !== "string") return null;

  return {
    sub: claims.sub,
    email: claims.email.toLowerCase(),
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: typeof claims.name === "string" ? claims.name : null,
  };
}
