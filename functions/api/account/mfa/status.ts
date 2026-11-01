import { errorResponse, getAuthUser, getJwtSecret, jsonResponse, serverError } from "../../../_shared/auth";
import { mfaAvailable, MfaEnv, mfaState } from "../../../_shared/mfa";

export interface Env extends MfaEnv {
  JWT_SECRET: string;
}

// GET /api/account/mfa/status
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const auth = await getAuthUser(request, getJwtSecret(env));
    if (!auth) return errorResponse("Não autorizado.", 401);
    const state = await mfaState(env.DB, auth.id);
    return jsonResponse({ available: mfaAvailable(env), enabled: state.enabled, recovery_codes_left: state.codesLeft });
  } catch (err: unknown) {
    return serverError(err, "mfa:status");
  }
};
