import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

const TYPES = ["impression", "open", "dwell"];
const MAX_EVENTS = 50;
const MAX_DWELL_MS = 10 * 60 * 1000;

// POST /api/events { events: [{ post_id, type: impression|open|dwell, value? }] }
// Registra o que a pessoa viu, para ordenar o feed. Só para quem não desligou a personalização.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "events", 120, 60, user.id);
    if (limited) return limited;

    const body = (await request.json().catch(() => null)) as { events?: Array<{ post_id?: number; type?: string; value?: number }> } | null;
    if (!body || !Array.isArray(body.events)) return errorResponse("Corpo inválido.", 400);

    const pref = await env.DB.prepare("SELECT personalization FROM users WHERE id = ?").bind(user.id).first<{ personalization: number }>();
    if (!pref || !pref.personalization) return jsonResponse({ recorded: 0 });

    const stmts: D1PreparedStatement[] = [];
    for (const e of body.events.slice(0, MAX_EVENTS)) {
      const postId = Number(e?.post_id);
      if (!Number.isInteger(postId) || postId <= 0 || !TYPES.includes(e?.type as string)) continue;
      let value: number | null = null;
      if (e.type === "dwell") {
        const ms = Math.round(Number(e.value));
        if (!Number.isFinite(ms) || ms < 500) continue;
        value = Math.min(ms, MAX_DWELL_MS);
      }
      stmts.push(
        env.DB.prepare(
          "INSERT INTO post_events (user_id, post_id, type, value) SELECT ?1, ?2, ?3, ?4 WHERE EXISTS (SELECT 1 FROM posts WHERE id = ?2 AND author_id != ?1)"
        ).bind(user.id, postId, e.type, value)
      );
    }
    if (stmts.length) await env.DB.batch(stmts);

    // Faxina: eventos com mais de 90 dias saem (de vez em quando, sem agendador)
    if (Math.random() < 0.01) {
      await env.DB.prepare("DELETE FROM post_events WHERE created_at < datetime('now', '-90 days')").run();
    }
    return jsonResponse({ recorded: stmts.length });
  } catch (err: unknown) {
    return serverError(err, "events");
  }
};
