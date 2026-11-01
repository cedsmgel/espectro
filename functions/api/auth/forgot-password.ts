import { errorResponse, jsonResponse, rateLimit, serverError } from "../../_shared/auth";
import { createEmailToken } from "../../_shared/emailTokens";
import { emailEnabled, EmailEnv, resetPasswordMessage, sendEmail } from "../../_shared/email";

export interface Env extends EmailEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

// POST /api/auth/forgot-password { email }
// A resposta é sempre a mesma, exista a conta ou não, para não revelar quem tem cadastro.
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env, waitUntil } = context;

    const limitedIp = await rateLimit(env.DB, request, "forgot-ip", 10, 3600);
    if (limitedIp) return limitedIp;

    const body: any = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse("Informe um e-mail válido.", 400);
    }
    if (!emailEnabled(env) && env.EMAIL_DEV_LOG !== "1") {
      return errorResponse("A recuperação por e-mail ainda não está disponível.", 503);
    }

    const limitedEmail = await rateLimit(env.DB, request, "forgot-email", 3, 3600, email);
    if (limitedEmail) return limitedEmail;

    const user = await env.DB.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE AND suspended_at IS NULL AND deletion_requested_at IS NULL")
      .bind(email)
      .first<{ id: number }>();

    if (user) {
      const token = await createEmailToken(env.DB, user.id, "reset_password");
      // Em segundo plano: o tempo de resposta não revela se a conta existe
      waitUntil(
        sendEmail(env, { ...resetPasswordMessage(env, email, token), idempotencyKey: `reset-${user.id}-${token.slice(0, 16)}` }).then((r) => {
          if (!r.sent) console.error("Falha ao enviar recuperação de senha:", r.error);
        })
      );
    }

    return jsonResponse({ ok: true });
  } catch (err: unknown) {
    return serverError(err, "auth:forgot-password");
  }
};
