import { completeLogin } from "../_shared/loginFlow";
import { MfaEnv, mfaAvailable } from "../_shared/mfa";
import { verifyPassword, signJWT, verifyJWT, jsonResponse, errorResponse, getJwtSecret, serverError, rateLimit } from "../_shared/auth";
import { TurnstileEnv, turnstileFailedResponse, verifyTurnstile } from "../_shared/turnstile";

export interface Env extends MfaEnv, TurnstileEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

const DUMMY_HASH = `${"00".repeat(16)}:${"00".repeat(32)}`;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    const limited = await rateLimit(env.DB, request, "login-ip", 20, 300);
    if (limited) return limited;

    let body: { username?: string; password?: string; turnstile_token?: string; login_proof?: string };
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

    // Anti-bot (Turnstile). Logo depois do cadastro, a prova emitida pelo /api/register dispensa um segundo desafio
    const proof = typeof body.login_proof === "string" ? await verifyJWT(body.login_proof, getJwtSecret(env)) : null;
    const proofValid = proof?.purpose === "post_register";
    if (!proofValid && !(await verifyTurnstile(request, env, body.turnstile_token, "login"))) return turnstileFailedResponse();

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

    // A prova do cadastro só vale para a conta recém-criada
    if (proofValid && proof?.id !== user.id) return turnstileFailedResponse();

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

    // Com verificação em duas etapas, a senha sozinha não entra: devolve um token curto que só serve ao passo seguinte
    if (mfaAvailable(env)) {
      const mfa = await env.DB.prepare("SELECT 1 AS has_mfa FROM user_mfa WHERE user_id = ? AND enabled_at IS NOT NULL").bind(user.id).first();
      if (mfa) {
        const mfaToken = await signJWT(
          { id: user.id, username: user.username, purpose: "mfa", exp: Math.floor(Date.now() / 1000) + 300 },
          getJwtSecret(env)
        );
        return jsonResponse({ mfa_required: true, mfa_token: mfaToken });
      }
    }

    return completeLogin(env, request, user, { mfa: false });
  } catch (err: unknown) {
    return serverError(err, "login");
  }
};
