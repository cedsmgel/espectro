import { errorResponse, getAuthUser, getJwtSecret, jsonResponse, serverError } from "../../../_shared/auth";
import { checkPassword, checkSecondFactor, MfaEnv, mfaState } from "../../../_shared/mfa";

export interface Env extends MfaEnv {
  JWT_SECRET: string;
}

// POST /api/account/mfa/disable { password, code | recovery_code }: desliga o 2FA (exige senha e segundo fator)
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const auth = await getAuthUser(request, getJwtSecret(env));
    if (!auth) return errorResponse("Não autorizado.", 401);

    const body: any = await request.json().catch(() => null);
    if (!(await mfaState(env.DB, auth.id)).enabled) return errorResponse("A verificação em duas etapas não está ativa.", 400);
    if (!(await checkPassword(env, auth.id, body?.password))) return errorResponse("Senha incorreta.", 403);

    const check = await checkSecondFactor(env, request, auth.id, body ?? {});
    if (!check.ok) return check.response;

    // Administradores não podem ficar sem 2FA
    const admin = await env.DB.prepare("SELECT is_admin FROM users WHERE id = ?").bind(auth.id).first<{ is_admin: number }>();
    if (admin?.is_admin) return errorResponse("Contas de administração precisam manter a verificação em duas etapas.", 403);

    await env.DB.batch([
      env.DB.prepare("DELETE FROM mfa_recovery_codes WHERE user_id = ?").bind(auth.id),
      env.DB.prepare("DELETE FROM user_mfa WHERE user_id = ?").bind(auth.id),
    ]);
    return jsonResponse({ enabled: false });
  } catch (err: unknown) {
    return serverError(err, "mfa:disable");
  }
};
