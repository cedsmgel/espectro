import { errorResponse, jsonResponse, rateLimit, serverError } from "../../_shared/auth";
import { consumeEmailToken } from "../../_shared/emailTokens";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// POST /api/auth/verify-email { token }: confirma o e-mail (feito por POST para que leitores automáticos de link não consumam o token)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    const limited = await rateLimit(env.DB, request, "verify-ip", 30, 3600);
    if (limited) return limited;

    const body: any = await request.json().catch(() => null);
    const userId = await consumeEmailToken(env.DB, body?.token, "verify_email");
    if (!userId) return errorResponse("Este link expirou ou já foi usado. Peça um novo na central de segurança.", 400);

    await env.DB.prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP) WHERE id = ?").bind(userId).run();
    return jsonResponse({ verified: true });
  } catch (err: unknown) {
    return serverError(err, "auth:verify-email");
  }
};
