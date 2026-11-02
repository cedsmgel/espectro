import { hashPassword, jsonResponse, errorResponse, serverError, rateLimit, signJWT, getJwtSecret } from "../_shared/auth";
import { TurnstileEnv, turnstileFailedResponse, verifyTurnstile } from "../_shared/turnstile";
import { createEmailToken } from "../_shared/emailTokens";
import { emailEnabled, EmailEnv, sendEmail, verifyEmailMessage } from "../_shared/email";

export interface Env extends EmailEnv, TurnstileEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    const limited = await rateLimit(env.DB, request, "register", 10, 3600);
    if (limited) return limited;

    let body: { username?: string; email?: string; password?: string; turnstile_token?: string; age_confirmed?: boolean };
    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    if (!(await verifyTurnstile(request, env, body.turnstile_token, "signup"))) return turnstileFailedResponse();

    const { username, email, password } = body;

    // Idade mínima: 13 anos, declarada no cadastro junto com o aceite dos termos
    if (body.age_confirmed !== true) {
      return errorResponse("Para criar a conta, confirme que você tem 13 anos ou mais e aceita os termos.", 400);
    }

    if (!username || typeof username !== "string" || !/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
      return errorResponse("Username deve ter de 3 a 30 caracteres, apenas letras, números e underline.", 400);
    }

    if (
      !email ||
      typeof email !== "string" ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return errorResponse("Email inválido.", 400);
    }

    if (!password || typeof password !== "string" || password.length < 8 || password.length > 128) {
      return errorResponse("Senha deve ter entre 8 e 128 caracteres.", 400);
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // Verifica duplicidade
    const existing = await env.DB.prepare(
      "SELECT id, username, email FROM users WHERE username = ? OR email = ?"
    )
      .bind(cleanUsername, cleanEmail)
      .first<{ id: number; username: string; email: string }>();

    if (existing) {
      if (existing.username.toLowerCase() === cleanUsername) {
        return errorResponse("Nome de usuário já está em uso.", 409);
      }
      return errorResponse("E-mail já cadastrado.", 409);
    }

    // Hash da senha com PBKDF2 (Web Crypto)
    const passwordHash = await hashPassword(password);

    // Inserção no D1    const insertResult = await env.DB.prepare(
      "INSERT INTO users (username, email, password_hash, terms_accepted_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)"
    )
      .bind(cleanUsername, cleanEmail, passwordHash)
      .run();

    const newId = insertResult.meta.last_row_id;

    // E-mail de confirmação em segundo plano: o cadastro nunca espera nem falha por causa dele
    if (emailEnabled(env) || env.EMAIL_DEV_LOG === "1") {
      context.waitUntil(
        (async () => {
          const token = await createEmailToken(env.DB, Number(newId), "verify_email");
          const result = await sendEmail(env, { ...verifyEmailMessage(env, cleanEmail, token), idempotencyKey: `verify-${newId}-${token.slice(0, 16)}` });
          if (!result.sent) console.error("Falha ao enviar confirmação de e-mail:", result.error);
        })().catch(() => undefined)
      );
    }
    return jsonResponse(
      {
        id: newId,
        username: cleanUsername,
        // Vale 2 minutos e só para o login imediato desta conta: evita pedir um segundo desafio logo após o cadastro
        login_proof: await signJWT({ id: Number(newId), username: cleanUsername, purpose: "post_register", exp: Math.floor(Date.now() / 1000) + 120 }, getJwtSecret(env)),
      },
      201
    );
  } catch (err: unknown) {
    return serverError(err, "register");
  }
};
