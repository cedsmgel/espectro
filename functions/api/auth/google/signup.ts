import { errorResponse, rateLimit, serverError } from "../../../_shared/auth";
import { GoogleProfile, sha256Hex } from "../../../_shared/google";
import { finishGoogleLogin, resolveGoogleAccount } from "../../../_shared/googleAccount";
import { MfaEnv } from "../../../_shared/mfa";

export interface Env extends MfaEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

// POST /api/auth/google/signup { signup_token, age_confirmed }: cria a conta de quem entrou com o Google pela primeira
// vez, depois de declarar ter 13 anos ou mais e aceitar os termos. O token vale 10 minutos e uma única vez.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const limited = await rateLimit(env.DB, request, "google-signup", 20, 600);
    if (limited) return limited;

    const body: any = await request.json().catch(() => null);
    if (typeof body?.signup_token !== "string" || body.signup_token.length < 20 || body.signup_token.length > 100) {
      return errorResponse("Pedido inválido.", 400);
    }
    // A declaração é conferida antes de gastar o token: dá para tentar de novo marcando a caixa
    if (body.age_confirmed !== true) {
      return errorResponse("Para criar a conta, confirme que você tem 13 anos ou mais e aceita os termos.", 400);
    }

    const pending = await env.DB.prepare(
      "DELETE FROM oauth_states WHERE state_hash = ? AND mode = 'signup_pending' AND expires_at > CURRENT_TIMESTAMP RETURNING nonce"
    )
      .bind(await sha256Hex(body.signup_token))
      .first<{ nonce: string }>();
    if (!pending) return errorResponse("O cadastro com o Google expirou. Tente de novo.", 400);

    let profile: GoogleProfile;
    try {
      profile = JSON.parse(pending.nonce) as GoogleProfile;
    } catch {
      return errorResponse("Pedido inválido.", 400);
    }

    const account = await resolveGoogleAccount(env.DB, profile, { ageConfirmed: true });
    if (account.kind === "email_in_use") return errorResponse("Já existe uma conta com este e-mail. Entre nela para ligar o Google.", 409);
    if (account.kind !== "ok") return errorResponse("Não foi possível criar a conta.", 400);

    return finishGoogleLogin(env, request, account.userId);
  } catch (err: unknown) {
    return serverError(err, "google:signup");
  }
};
