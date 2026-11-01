import { getAuthUser, getJwtSecret, jsonResponse, errorResponse, rateLimit, serverError, signJWT } from "../../_shared/auth";
import { clientInfo, createSession, forgetSession, maskIp } from "../../_shared/session";
import { MfaEnv, requireRecentMfa } from "../../_shared/mfa";
import { forgetSuspension } from "../../_shared/suspension";

export interface Env extends MfaEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET /api/account/sessions: meus aparelhos conectados, com localização aproximada e IP parcialmente oculto
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = getJwtSecret(env);
    const auth = await getAuthUser(request, secret);
    if (!auth) return errorResponse("Não autorizado.", 401);

    // Login anterior ao registro de sessões: registra este aparelho agora e devolve um token com a sessão
    let sid = auth.sid;
    let token: string | undefined;
    if (!sid) {
      sid = (await createSession(env.DB, request, auth.id)).sid;
      token = await signJWT({ id: auth.id, username: auth.username, sid, mfa_at: auth.mfa_at }, secret);
    }

    const info = clientInfo(request);

    const { results } = await env.DB.prepare(
      `SELECT id, ip, country, region, city, browser, os, device,
              strftime('%Y-%m-%dT%H:%M:%SZ', created_at) AS created_at,
              strftime('%Y-%m-%dT%H:%M:%SZ', last_seen_at) AS last_seen_at
       FROM user_sessions
       WHERE user_id = ? AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
       ORDER BY last_seen_at DESC LIMIT 50`
    )
      .bind(auth.id)
      .all<{ id: string; ip: string | null } & Record<string, unknown>>();

    const sessions = (results || []).map(({ id, ip, ...rest }) => ({ id, ip: maskIp(ip), current: id === sid, ...rest }));
    // Este aparelho, com os dados lidos desta própria requisição (sempre disponível)
    const thisDevice = {
      browser: info.browser,
      os: info.os,
      device: info.device,
      ip: maskIp(info.ip),
      country: info.country,
      region: info.region,
      city: info.city,
      timezone: info.timezone,
    };
    return jsonResponse({ sessions, this_device: thisDevice, token });
  } catch (err: unknown) {
    return serverError(err, "account:sessions:list");
  }
};

// DELETE /api/account/sessions?id=X: encerra um aparelho. Sem id: sai de todos, inclusive deste.
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = getJwtSecret(env);
    const auth = await getAuthUser(request, secret);
    if (!auth) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "account-sessions", 30, 3600, auth.id);
    if (limited) return limited;

    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      if (!/^[0-9a-f]{32}$/.test(id)) return errorResponse("Sessão inválida.", 400);
      if (id === auth.sid) return errorResponse("Para sair deste aparelho, use o botão Sair do menu.", 400);
      await env.DB.prepare("UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND revoked_at IS NULL")
        .bind(id, auth.id)
        .run();
      forgetSession(id);
      return jsonResponse({ revoked: true });
    }

    // Sair de todos os aparelhos é uma ação sensível
    const stepUp = await requireRecentMfa(env, auth);
    if (stepUp) return stepUp;

    const now = Math.floor(Date.now() / 1000);
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET sessions_valid_after = ? WHERE id = ?").bind(now, auth.id),
      env.DB.prepare("UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL").bind(auth.id),
    ]);
    forgetSuspension(auth.id);
    forgetSession();

    return jsonResponse({ signed_out_everywhere: true });
  } catch (err: unknown) {
    return serverError(err, "account:sessions");
  }
};
