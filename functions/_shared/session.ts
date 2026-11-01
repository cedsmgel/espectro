// Sessões por aparelho. A localização vem da própria Cloudflare (request.cf): sem serviço externo,
// sem enviar o IP de ninguém a terceiros e sem custo de latência.

export const SESSION_DAYS = 7;

export interface ClientInfo {
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  asn: number | null;
  asOrg: string | null;
  browser: string;
  os: string;
  device: "mobile" | "tablet" | "desktop";
  userAgent: string;
}

export function parseUserAgent(ua: string): Pick<ClientInfo, "browser" | "os" | "device"> {
  const browser = /Edg(e|A|iOS)?\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
    ? "Opera"
    : /SamsungBrowser/.test(ua)
    ? "Samsung Internet"
    : /Firefox\/|FxiOS/.test(ua)
    ? "Firefox"
    : /Chrome\/|CriOS/.test(ua)
    ? "Chrome"
    : /Safari\//.test(ua)
    ? "Safari"
    : "Navegador";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
    ? "Android"
    : /Mac OS X|Macintosh/.test(ua)
    ? "macOS"
    : /Linux|X11/.test(ua)
    ? "Linux"
    : "Sistema desconhecido";
  const device = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? "tablet" : /Mobi|iPhone|Android/.test(ua) ? "mobile" : "desktop";
  return { browser, os, device };
}

export function clientInfo(request: Request): ClientInfo {
  const cf = ((request as unknown as { cf?: Record<string, unknown> }).cf || {}) as Record<string, unknown>;
  const userAgent = (request.headers.get("User-Agent") || "").slice(0, 300);
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    ip: request.headers.get("CF-Connecting-IP"),
    country: str(cf.country) || str(request.headers.get("CF-IPCountry")),
    region: str(cf.region),
    city: str(cf.city),
    timezone: str(cf.timezone),
    asn: typeof cf.asn === "number" ? cf.asn : null,
    asOrg: str(cf.asOrganization),
    userAgent,
    ...parseUserAgent(userAgent),
  };
}

// IP com o final oculto: 203.0.113.xxx ou 2001:db8:85a3:xxxx
export function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}:xxxx`;
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.xxx` : null;
}

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface NewSession {
  sid: string;
  info: ClientInfo;
  // Primeiro acesso deste país + navegador + sistema para esta conta (e a conta já tinha acessos antes)
  unfamiliar: boolean;
}

export async function createSession(db: D1Database, request: Request, userId: number): Promise<NewSession> {
  const info = clientInfo(request);
  const sid = randomId();

  const known = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN COALESCE(country, '') = COALESCE(?2, '') AND browser = ?3 AND os = ?4 THEN 1 ELSE 0 END) AS same
       FROM user_sessions WHERE user_id = ?1`
    )
    .bind(userId, info.country, info.browser, info.os)
    .first<{ total: number; same: number | null }>();

  await db
    .prepare(
      `INSERT INTO user_sessions (id, user_id, ip, country, region, city, timezone, asn, as_org, browser, os, device, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+${SESSION_DAYS} days'))`
    )
    .bind(sid, userId, info.ip, info.country, info.region, info.city, info.timezone, info.asn, info.asOrg, info.browser, info.os, info.device, info.userAgent)
    .run();

  return { sid, info, unfamiliar: (known?.total ?? 0) > 0 && (known?.same ?? 0) === 0 };
}

// Estado da sessão em memória por 15 segundos, como a suspensão, para não consultar o banco a cada chamada
const CACHE_MS = 15000;
const TOUCH_MS = 10 * 60 * 1000;
const cache = new Map<string, { active: boolean; at: number; touched: number }>();

export async function sessionIsActive(db: D1Database, sid: string, userId: number): Promise<boolean> {
  const hit = cache.get(sid);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.active;

  const row = await db
    .prepare("SELECT 1 AS ok FROM user_sessions WHERE id = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP")
    .bind(sid, userId)
    .first();
  const active = Boolean(row);

  let touched = hit?.touched ?? 0;
  if (active && Date.now() - touched > TOUCH_MS) {
    touched = Date.now();
    await db.prepare("UPDATE user_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").bind(sid).run();
  }
  if (cache.size > 1000) cache.clear();
  cache.set(sid, { active, at: Date.now(), touched });
  return active;
}

export function forgetSession(sid?: string): void {
  if (sid) cache.delete(sid);
  else cache.clear();
}

export function describeLocation(info: Pick<ClientInfo, "city" | "region" | "country">, countryName?: string): string {
  return [info.city, info.region, countryName || info.country].filter(Boolean).join(", ") || "local desconhecido";
}
