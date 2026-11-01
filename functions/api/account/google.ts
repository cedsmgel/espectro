import { errorResponse, getAuthUser, getJwtSecret, jsonResponse, serverError } from "../../_shared/auth";
import { GoogleEnv, googleEnabled } from "../../_shared/google";
import { MfaEnv, requireRecentMfa } from "../../_shared/mfa";

export interface Env extends MfaEnv, GoogleEnv {
  JWT_SECRET: string;
}

// GET /api/account/google: a conta do Google ligada à minha conta
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const auth = await getAuthUser(request, getJwtSecret(env));
    if (!auth) return errorResponse("Não autorizado.", 401);

    const identity = await env.DB.prepare("SELECT email FROM oauth_identities WHERE user_id = ? AND provider = 'google'").bind(auth.id).first<{ email: string | null }>();
    const user = await env.DB.prepare("SELECT has_password FROM users WHERE id = ?").bind(auth.id).first<{ has_password: number }>();
    return jsonResponse({
      available: googleEnabled(env),
      linked: Boolean(identity),
      email: identity?.email ?? null,
      has_password: Boolean(user?.has_password),
    });
  } catch (err: unknown) {
    return serverError(err, "account:google:status");
  }
};

// DELETE /api/account/google: desliga o Google. Só se a conta tiver senha própria, senão a pessoa ficaria sem como entrar.
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const auth = await getAuthUser(request, getJwtSecret(env));
    if (!auth) return errorResponse("Não autorizado.", 401);

    const stepUp = await requireRecentMfa(env, auth);
    if (stepUp) return stepUp;

    const user = await env.DB.prepare("SELECT has_password FROM users WHERE id = ?").bind(auth.id).first<{ has_password: number }>();
    if (!user?.has_password) return errorResponse("Defina uma senha antes de desligar o Google, para não perder o acesso à conta.", 409);

    await env.DB.prepare("DELETE FROM oauth_identities WHERE user_id = ? AND provider = 'google'").bind(auth.id).run();
    return jsonResponse({ linked: false });
  } catch (err: unknown) {
    return serverError(err, "account:google:unlink");
  }
};
