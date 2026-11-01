import { createSession, describeLocation } from "../_shared/session";
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
      `SELECT id, username, password_hash, suspended_at, suspended_reason, deletion_requested_at FROM users WHERE ${cleanUsername.includes("@") ? "email" : "username"} = ? COLLATE NOCASE`
    )
      .bind(cleanUsername)
      .first<{ id: number; username: string; password_hash: string; suspended_at: string | null; suspended_reason: string | null; deletion_requested_at: string | null }>();

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

    // Só avisa da suspensão depois da senha conferir, para não revelar contas a quem não é dono
    if (user.suspended_at) {
      return jsonResponse(
        { error: `Sua conta foi suspensa.${user.suspended_reason ? ` Motivo: ${user.suspended_reason}` : ""}`, suspended: true },
        403
      );
    }

    // Entrar durante o prazo de arrependimento cancela a exclusão
    const deletionCanceled = Boolean(user.deletion_requested_at);
    if (deletionCanceled) {
      await env.DB.prepare("UPDATE users SET deletion_requested_at = NULL, deletion_scheduled_for = NULL WHERE id = ?").bind(user.id).run();
    }

    const secret = getJwtSecret(env);

    // Registra a sessão deste aparelho (localização aproximada e dispositivo) e avisa se for um acesso novo
    const session = await createSession(env.DB, request, user.id);
    if (session.unfamiliar) {
      let country = session.info.country || undefined;
      try {
        if (country) country = new Intl.DisplayNames(["pt-BR"], { type: "region" }).of(country) || country;
      } catch {}
      const where = describeLocation(session.info, country);
      await env.DB.prepare(
        "INSERT OR IGNORE INTO notifications (user_id, actor_id, type, content, dedupe_key) VALUES (?, NULL, 'security_login', ?, ?)"
      )
        .bind(
          user.id,
          `${session.info.browser} em ${session.info.os} · ${where}. Se não foi você, troque a senha e saia de todos os dispositivos.`,
          `login:${session.sid}`
        )
        .run();
    }

    // Gera o token JWT
    const token = await signJWT(
      {
        id: user.id,
        username: user.username,
        sid: session.sid,
      },
      secret
    );

    return jsonResponse({
      token,
      deletion_canceled: deletionCanceled,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (err: unknown) {
    return serverError(err, "login");
  }
};
