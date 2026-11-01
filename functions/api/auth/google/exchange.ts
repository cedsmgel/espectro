import { errorResponse, rateLimit, serverError } from "../../../_shared/auth";
import { sha256Hex } from "../../../_shared/google";
import { finishGoogleLogin } from "../../../_shared/googleAccount";
import { MfaEnv } from "../../../_shared/mfa";

export interface Env extends MfaEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

// POST /api/auth/google/exchange { code }: troca o código de uso único por uma sessão (ou pelo segundo passo do 2FA)
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const limited = await rateLimit(env.DB, request, "google-exchange", 20, 600);
    if (limited) return limited;

    const body: any = await request.json().catch(() => null);
    if (typeof body?.code !== "string" || body.code.length < 20 || body.code.length > 100) return errorResponse("Pedido inválido.", 400);

    const row = await env.DB.prepare(
      "UPDATE oauth_exchange SET used_at = CURRENT_TIMESTAMP WHERE code_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP RETURNING user_id"
    )
      .bind(await sha256Hex(body.code))
      .first<{ user_id: number }>();
    if (!row) return errorResponse("O login com o Google expirou. Tente de novo.", 400);

    return finishGoogleLogin(env, request, row.user_id);
  } catch (err: unknown) {
    return serverError(err, "google:exchange");
  }
};
