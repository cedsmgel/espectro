import { rateLimit, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
}

const NAMES = ["LCP", "INP", "CLS", "FCP", "TTFB"];
const RATINGS = ["good", "needs-improvement", "poor"];
const DEVICES = ["phone", "desktop"];
const RETENTION_DAYS = 30;

// POST { name, value, rating, path, device, connection? }: medição de desempenho de uma visita.
// Anônimo de propósito: não guarda IP, conta nem identificador da pessoa.
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      value?: unknown;
      rating?: unknown;
      path?: unknown;
      device?: unknown;
      connection?: unknown;
    } | null;

    const value = Number(body?.value);
    if (
      !body ||
      typeof body.name !== "string" ||
      !NAMES.includes(body.name) ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 600000 ||
      typeof body.rating !== "string" ||
      !RATINGS.includes(body.rating) ||
      typeof body.path !== "string" ||
      !/^[/\w:.-]{1,60}$/.test(body.path) ||
      typeof body.device !== "string" ||
      !DEVICES.includes(body.device)
    ) {
      return new Response(null, { status: 400 });
    }

    const connection = typeof body.connection === "string" && /^[\w-]{1,10}$/.test(body.connection) ? body.connection : null;

    const limited = await rateLimit(env.DB, request, "vitals", 120, 60);
    if (limited) return limited;

    await env.DB.prepare(
      "INSERT INTO web_vitals (name, value, rating, path, device, connection) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(body.name, value, body.rating, body.path, body.device, connection)
      .run();

    // Limpeza ocasional: guarda só os últimos 30 dias
    if (Math.random() < 0.02) {
      await env.DB.prepare("DELETE FROM web_vitals WHERE created_at < datetime('now', ?)")
        .bind(`-${RETENTION_DAYS} days`)
        .run();
    }

    return new Response(null, { status: 204 });
  } catch (err: unknown) {
    return serverError(err, "vitals");
  }
};
