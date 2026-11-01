import { errorResponse, getAuthUser, getJwtSecret, jsonResponse, rateLimit, serverError } from "../../_shared/auth";
import { createEmailToken } from "../../_shared/emailTokens";
import { emailEnabled, EmailEnv, sendEmail, verifyEmailMessage } from "../../_shared/email";

export interface Env extends EmailEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

// POST /api/auth/resend-verification: manda de novo o e-mail de confirmação (só logado)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env, waitUntil } = context;
    const auth = await getAuthUser(request, getJwtSecret(env));
    if (!auth) return errorResponse("Não autorizado.", 401);

    if (!emailEnabled(env) && env.EMAIL_DEV_LOG !== "1") return errorResponse("O envio de e-mails ainda não está disponível.", 503);

    const limited = await rateLimit(env.DB, request, "verify-resend", 3, 3600, auth.id);
    if (limited) return limited;

    const user = await env.DB.prepare("SELECT email, email_verified_at FROM users WHERE id = ?")
      .bind(auth.id)
      .first<{ email: string; email_verified_at: string | null }>();
    if (!user) return errorResponse("Conta não encontrada.", 404);
    if (user.email_verified_at) return jsonResponse({ already_verified: true });

    const token = await createEmailToken(env.DB, auth.id, "verify_email");
    waitUntil(
      sendEmail(env, { ...verifyEmailMessage(env, user.email, token), idempotencyKey: `verify-${auth.id}-${token.slice(0, 16)}` }).then((r) => {
        if (!r.sent) console.error("Falha ao enviar confirmação de e-mail:", r.error);
      })
    );
    return jsonResponse({ sent: true });
  } catch (err: unknown) {
    return serverError(err, "auth:resend-verification");
  }
};
