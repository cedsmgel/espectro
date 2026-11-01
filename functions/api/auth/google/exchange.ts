import { errorResponse, getJwtSecret, jsonResponse, rateLimit, serverError, signJWT } from "../../../_shared/auth";
import { sha256Hex } from "../../../_shared/google";
import { completeLogin } from "../../../_shared/loginFlow";
import { MfaEnv, mfaAvailable } from "../../../_shared/mfa";

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

    const user = await env.DB.prepare("SELECT id, username, suspended_at, deletion_requested_at FROM users WHERE id = ?")
      .bind(row.user_id)
      .first<{ id: number; username: string; suspended_at: string | null; deletion_requested_at: string | null }>();
    if (!user || user.suspended_at) return errorResponse("Não foi possível entrar.", 403);

    // Quem ativou a verificação em duas etapas continua precisando dela, também ao entrar com o Google
    if (mfaAvailable(env)) {
      const mfa = await env.DB.prepare("SELECT 1 AS has_mfa FROM user_mfa WHERE user_id = ? AND enabled_at IS NOT NULL").bind(user.id).first();
      if (mfa) {
        const mfaToken = await signJWT({ id: user.id, username: user.username, purpose: "mfa", exp: Math.floor(Date.now() / 1000) + 300 }, getJwtSecret(env));
        return jsonResponse({ mfa_required: true, mfa_token: mfaToken });
      }
    }

    return completeLogin(env, request, user, { mfa: false });
  } catch (err: unknown) {
    return serverError(err, "google:exchange");
  }
};
