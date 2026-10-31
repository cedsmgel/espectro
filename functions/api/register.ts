import { hashPassword, jsonResponse, errorResponse } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    let body: { username?: string; email?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    const { username, email, password } = body;

    if (!username || typeof username !== "string" || username.trim().length < 3) {
      return errorResponse("Username deve ter no mínimo 3 caracteres.", 400);
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return errorResponse("Email inválido.", 400);
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return errorResponse("Senha deve ter no mínimo 6 caracteres.", 400);
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

    // Inserção no D1
    console.log("[REGISTER] env.DB:", env.DB ? "Conectado ao D1" : "MISSING", "cleanUsername:", cleanUsername);
    const insertResult = await env.DB.prepare(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)"
    )
      .bind(cleanUsername, cleanEmail, passwordHash)
      .run();

    const newId = insertResult.meta.last_row_id;
    console.log("[REGISTER] Usuário registrado com sucesso. newId:", newId);

    return jsonResponse(
      {
        id: newId,
        username: cleanUsername,
      },
      201
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno no servidor.";
    return errorResponse(message, 500);
  }
};
