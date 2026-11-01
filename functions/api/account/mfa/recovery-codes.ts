import { errorResponse, getAuthUser, getJwtSecret, jsonResponse, serverError } from "../../../_shared/auth";
import { checkPassword, checkSecondFactor, MfaEnv, mfaState, replaceRecoveryCodes } from "../../../_shared/mfa";

export interface Env extends MfaEnv {
  JWT_SECRET: string;
}

// POST /api/account/mfa/recovery-codes { password, code }: gera um conjunto novo (os antigos deixam de valer)
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const auth = await getAuthUser(request, getJwtSecret(env));
    if (!auth) return errorResponse("Não autorizado.", 401);

    const body: any = await request.json().catch(() => null);
    if (!(await mfaState(env.DB, auth.id)).enabled) return errorResponse("Ative a verificação em duas etapas primeiro.", 400);
    if (!(await checkPassword(env, auth.id, body?.password))) return errorResponse("Senha incorreta.", 403);

    // Só o código do app: um código de recuperação não gera outros
    const check = await checkSecondFactor(env, request, auth.id, { code: body?.code });
    if (!check.ok) return check.response;

    return jsonResponse({ recovery_codes: await replaceRecoveryCodes(env, auth.id) });
  } catch (err: unknown) {
    return serverError(err, "mfa:recovery-codes");
  }
};
