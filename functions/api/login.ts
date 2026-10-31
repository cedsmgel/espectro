import { verifyPassword, signJWT, jsonResponse, errorResponse } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    let body: { username?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    const { username, password } = body;

    if (!username || !password) {
      return errorResponse("Username e senha são obrigatórios.", 400);
    }

    const cleanUsername = username.trim().toLowerCase();
    console.log("[LOGIN] env.DB:", env.DB ? "Conectado ao D1" : "MISSING", "cleanUsername:", cleanUsername);

    // Busca usuário no banco D1
    const user = await env.DB.prepare(
      "SELECT id, username, password_hash FROM users WHERE username = ?"
    )
      .bind(cleanUsername)
      .first<{ id: number; username: string; password_hash: string }>();

    if (!user) {
      return errorResponse("Credenciais inválidas.", 401);
    }

    // Compara senha com PBKDF2
    const passwordMatch = await verifyPassword(password, user.password_hash);
    if (!passwordMatch) {
      return errorResponse("Credenciais inválidas.", 401);
    }

    const secret = env.JWT_SECRET || "troque-este-segredo";

    // Gera o token JWT
    const token = await signJWT(
      {
        id: user.id,
        username: user.username,
      },
      secret
    );

    return jsonResponse({
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno no servidor.";
    return errorResponse(message, 500);
  }
};
