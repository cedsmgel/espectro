import { errorResponse, hashPassword, jsonResponse, rateLimit, serverError } from "../../_shared/auth";
import { consumeEmailToken } from "../../_shared/emailTokens";
import { EmailEnv, passwordChangedMessage, sendEmail } from "../../_shared/email";
import { forgetSession } from "../../_shared/session";
import { forgetSuspension } from "../../_shared/suspension";

export interface Env extends EmailEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

// POST /api/auth/reset-password { token, password }: troca a senha, encerra todas as sessões e avisa por e-mail
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env, waitUntil } = context;

    const limited = await rateLimit(env.DB, request, "reset-ip", 20, 3600);
    if (limited) return limited;

    const body: any = await request.json().catch(() => null);
    const token = body?.token;
    const password = body?.password;
    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
      return errorResponse("A senha deve ter entre 8 e 128 caracteres.", 400);
    }

    const userId = await consumeEmailToken(env.DB, token, "reset_password");
    if (!userId) return errorResponse("Este link expirou ou já foi usado. Peça um novo.", 400);

    const hash = await hashPassword(password);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.batch([
      // Receber o link provou o controle do e-mail
      env.DB.prepare(
        "UPDATE users SET password_hash = ?, sessions_valid_after = ?, has_password = 1, email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP) WHERE id = ?"
      ).bind(hash, now, userId),
      env.DB.prepare("UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL").bind(userId),
    ]);
    forgetSuspension(userId);
    forgetSession();

    const user = await env.DB.prepare("SELECT email FROM users WHERE id = ?").bind(userId).first<{ email: string }>();
    if (user?.email) {
      waitUntil(sendEmail(env, passwordChangedMessage(user.email)).then(() => undefined));
    }

    return jsonResponse({ changed: true });
  } catch (err: unknown) {
    return serverError(err, "auth:reset-password");
  }
};
