import { errorResponse, getAuthUser, getJwtSecret, jsonResponse, serverError, signJWT } from "../../../_shared/auth";
import { checkSecondFactor, MfaEnv, mfaState } from "../../../_shared/mfa";

export interface Env extends MfaEnv {
  JWT_SECRET: string;
}

// POST /api/account/mfa/reauth { code | recovery_code }: prova o segundo fator de novo e devolve um token com a verificação recente
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const secret = getJwtSecret(env);
    const auth = await getAuthUser(request, secret);
    if (!auth) return errorResponse("Não autorizado.", 401);
    if (!(await mfaState(env.DB, auth.id)).enabled) return errorResponse("A verificação em duas etapas não está ativa.", 400);

    const body: any = await request.json().catch(() => null);
    const check = await checkSecondFactor(env, request, auth.id, body ?? {});
    if (!check.ok) return check.response;

    const token = await signJWT({ id: auth.id, username: auth.username, sid: auth.sid, mfa_at: Math.floor(Date.now() / 1000) }, secret);
    return jsonResponse({ token });
  } catch (err: unknown) {
    return serverError(err, "mfa:reauth");
  }
};
