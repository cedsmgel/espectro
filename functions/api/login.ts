import { verifyPassword, signJWT, jsonResponse, errorResponse, getJwtSecret, serverError, rateLimit } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

const DUMMY_HASH = `${"00".repeat(16)}:${"00".repeat(32)}`;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    const limited = await rateLimit(env.DB, request, "login-ip", 20, 300);
    if (limited) return limited;

    let body: { username?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    const { username, password } = body;

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
      return errorResponse("Username e senha são obrigatórios.", 400);
    }

    if (username.length > 100 || password.length > 128) {
      return errorResponse("Credenciais inválidas.", 401);
    }

    const cleanUsername = username.trim().toLowerCase();

    const limitedUser = await rateLimit(env.DB, request, "login-user", 8, 300, cleanUsername);
    if (limitedUser) return limitedUser;

    // Busca usuário no banco D1
    const user = await env.DB.prepare(
      "SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE"
    )
      .bind(cleanUsername)
      .first<{ id: number; username: string; password_hash: string }>();

    if (!user) {
      // Executa o mesmo custo de hash para não revelar se o usuário existe pelo tempo de resposta
      await verifyPassword(password, DUMMY_HASH);
      return errorResponse("Credenciais inválidas.", 401);
    }

    // Compara senha com PBKDF2
    const passwordMatch = await verifyPassword(password, user.password_hash);
    if (!passwordMatch) {
      return errorResponse("Credenciais inválidas.", 401);
    }

    const secret = getJwtSecret(env);

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
    return serverError(err, "login");
  }
};
