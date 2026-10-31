import { hashPassword, jsonResponse, errorResponse, serverError, rateLimit } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    const limited = await rateLimit(env.DB, request, "register", 10, 3600);
    if (limited) return limited;

    let body: { username?: string; email?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    const { username, email, password } = body;

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
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)"
    )
      .bind(cleanUsername, cleanEmail, passwordHash)
      .run();

    const newId = insertResult.meta.last_row_id;
    return jsonResponse(
      {
        id: newId,
        username: cleanUsername,
      },
      201
    );
  } catch (err: unknown) {
    return serverError(err, "register");
  }
};
