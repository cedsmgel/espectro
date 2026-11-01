import { errorResponse, getJwtSecret, serverError, verifyJWT } from "../../_shared/auth";
import { completeLogin } from "../../_shared/loginFlow";
import { checkSecondFactor, MfaEnv } from "../../_shared/mfa";

export interface Env extends MfaEnv {
  JWT_SECRET: string;
}

// POST /api/login/mfa { mfa_token, code | recovery_code }: segundo passo do login
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const body: any = await request.json().catch(() => null);
    if (!body || typeof body.mfa_token !== "string") return errorResponse("Pedido inválido.", 400);

    // O token do primeiro passo só serve aqui e dura 5 minutos
    const payload = await verifyJWT(body.mfa_token, getJwtSecret(env));
    if (!payload || payload.purpose !== "mfa") return errorResponse("A verificação expirou. Entre de novo com a senha.", 401);

    const user = await env.DB.prepare("SELECT id, username, suspended_at, deletion_requested_at FROM users WHERE id = ?")
      .bind(payload.id)
      .first<{ id: number; username: string; suspended_at: string | null; deletion_requested_at: string | null }>();
    if (!user || user.suspended_at) return errorResponse("Não foi possível entrar.", 403);

    const result = await checkSecondFactor(env, request, user.id, body);
    if (!result.ok) return result.response;

    return completeLogin(env, request, user, { mfa: true });
  } catch (err: unknown) {
    return serverError(err, "login:mfa");
  }
};
