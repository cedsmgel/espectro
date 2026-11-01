import { errorResponse, getAuthUser, getJwtSecret, jsonResponse, serverError, signJWT } from "../../../_shared/auth";
import { checkSecondFactor, MfaEnv, mfaState, replaceRecoveryCodes } from "../../../_shared/mfa";

export interface Env extends MfaEnv {
  JWT_SECRET: string;
}

// POST /api/account/mfa/enable { code }: confirma o primeiro código, liga o 2FA e mostra os códigos de recuperação (uma vez)
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const secret = getJwtSecret(env);
    const auth = await getAuthUser(request, secret);
    if (!auth) return errorResponse("Não autorizado.", 401);

    const state = await mfaState(env.DB, auth.id);
    if (state.enabled) return errorResponse("A verificação em duas etapas já está ativa.", 409);
    if (!state.pending) return errorResponse("Comece a configuração antes de confirmar o código.", 400);

    const body: any = await request.json().catch(() => null);
    const check = await checkSecondFactor(env, request, auth.id, { code: body?.code }, { allowPending: true });
    if (!check.ok) return check.response;

    await env.DB.prepare("UPDATE user_mfa SET enabled_at = CURRENT_TIMESTAMP WHERE user_id = ?").bind(auth.id).run();
    const codes = await replaceRecoveryCodes(env, auth.id);

    // Este aparelho acabou de provar o segundo fator
    const token = await signJWT({ id: auth.id, username: auth.username, sid: auth.sid, mfa_at: Math.floor(Date.now() / 1000) }, secret);
    return jsonResponse({ enabled: true, recovery_codes: codes, token });
  } catch (err: unknown) {
    return serverError(err, "mfa:enable");
  }
};
