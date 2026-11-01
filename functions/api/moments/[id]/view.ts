import { areFriends, getAuthUser, jsonResponse, errorResponse, getJwtSecret, isBlockedBetween, rateLimit, serverError } from "../../../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// POST /api/moments/:id/view: registra que eu vi (só amigos, nunca o próprio autor)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env, params } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "moment-view", 240, 60, user.id);
    if (limited) return limited;

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) return errorResponse("ID inválido.", 400);

    const moment = await env.DB.prepare("SELECT user_id FROM moments WHERE id = ? AND expires_at > CURRENT_TIMESTAMP")
      .bind(id)
      .first<{ user_id: number }>();
    if (!moment) return errorResponse("Momentum não encontrado.", 404);
    if (moment.user_id === user.id) return jsonResponse({ ok: true });
    if (!(await areFriends(env.DB, user.id, moment.user_id)) || (await isBlockedBetween(env.DB, user.id, moment.user_id))) {
      return errorResponse("Momentum não encontrado.", 404);
    }

    await env.DB.prepare("INSERT OR IGNORE INTO moment_views (moment_id, viewer_id) VALUES (?, ?)").bind(id, user.id).run();
    return jsonResponse({ ok: true });
  } catch (err: unknown) {
    return serverError(err, "moments:view");
  }
};

// GET /api/moments/:id/view: quem viu (só o autor)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env, params } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) return errorResponse("ID inválido.", 400);

    const moment = await env.DB.prepare("SELECT user_id FROM moments WHERE id = ?").bind(id).first<{ user_id: number }>();
    if (!moment || moment.user_id !== user.id) return errorResponse("Momentum não encontrado.", 404);

    const { results } = await env.DB.prepare(
      `SELECT u.id, u.username, u.avatar_url, strftime('%Y-%m-%dT%H:%M:%SZ', v.viewed_at) AS viewed_at
       FROM moment_views v JOIN users u ON u.id = v.viewer_id
       WHERE v.moment_id = ? ORDER BY v.viewed_at DESC LIMIT 200`
    )
      .bind(id)
      .all();
    return jsonResponse(results || []);
  } catch (err: unknown) {
    return serverError(err, "moments:viewers");
  }
};
