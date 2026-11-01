import { errorResponse, getAuthUser, getJwtSecret, jsonResponse, rateLimit, serverError } from "../../../_shared/auth";
import { checkPassword, encryptSecret, mfaAvailable, MfaEnv, mfaState } from "../../../_shared/mfa";
import { base32Encode, generateSecret, otpauthUri } from "../../../_shared/totp";

export interface Env extends MfaEnv {
  JWT_SECRET: string;
}

// POST /api/account/mfa/setup { password }: começa a configuração e devolve o segredo para o app autenticador
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const auth = await getAuthUser(request, getJwtSecret(env));
    if (!auth) return errorResponse("Não autorizado.", 401);
    if (!mfaAvailable(env)) return errorResponse("A verificação em duas etapas ainda não está disponível.", 503);

    const limited = await rateLimit(env.DB, request, "mfa-setup", 10, 3600, auth.id);
    if (limited) return limited;

    const body: any = await request.json().catch(() => null);
    if (!(await checkPassword(env, auth.id, body?.password))) return errorResponse("Senha incorreta.", 403);

    if ((await mfaState(env.DB, auth.id)).enabled) return errorResponse("A verificação em duas etapas já está ativa.", 409);

    const secret = generateSecret();
    await env.DB.prepare(
      `INSERT INTO user_mfa (user_id, secret_enc, enabled_at, last_used_step) VALUES (?, ?, NULL, 0)
       ON CONFLICT(user_id) DO UPDATE SET secret_enc = excluded.secret_enc, enabled_at = NULL, last_used_step = 0`
    )
      .bind(auth.id, await encryptSecret(env, secret))
      .run();

    const secretBase32 = base32Encode(secret);
    return jsonResponse({ secret: secretBase32, otpauth_uri: otpauthUri(auth.username, secretBase32) });
  } catch (err: unknown) {
    return serverError(err, "mfa:setup");
  }
};
