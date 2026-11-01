import { getAuthUser, getJwtSecret, jsonResponse, errorResponse, rateLimit, serverError, signJWT } from "../../_shared/auth";
import { forgetSuspension } from "../../_shared/suspension";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// DELETE /api/account/sessions: sai de todos os dispositivos (este continua com um token novo)
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = getJwtSecret(env);
    const auth = await getAuthUser(request, secret);
    if (!auth) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "account-sessions", 10, 3600, auth.id);
    if (limited) return limited;

    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("UPDATE users SET sessions_valid_after = ? WHERE id = ?").bind(now, auth.id).run();
    forgetSuspension(auth.id);

    const token = await signJWT({ id: auth.id, username: auth.username }, secret);
    return jsonResponse({ signed_out_everywhere: true, token });
  } catch (err: unknown) {
    return serverError(err, "account:sessions");
  }
};
