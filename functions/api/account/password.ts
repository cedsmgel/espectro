import { getAuthUser, getJwtSecret, hashPassword, jsonResponse, errorResponse, rateLimit, serverError, signJWT, verifyPassword } from "../../_shared/auth";
import { forgetSuspension } from "../../_shared/suspension";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// POST /api/account/password { current, next }: troca a senha e encerra as outras sessões
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = getJwtSecret(env);
    const auth = await getAuthUser(request, secret);
    if (!auth) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "account-password", 6, 3600, auth.id);
    if (limited) return limited;

    const body: any = await request.json().catch(() => null);
    const current = body?.current;
    const next = body?.next;
    if (typeof current !== "string" || typeof next !== "string") return errorResponse("Preencha a senha atual e a nova.", 400);
    if (next.length < 8 || next.length > 128) return errorResponse("A nova senha deve ter entre 8 e 128 caracteres.", 400);
    if (next === current) return errorResponse("A nova senha precisa ser diferente da atual.", 400);

    const user = await env.DB.prepare("SELECT username, password_hash FROM users WHERE id = ?")
      .bind(auth.id)
      .first<{ username: string; password_hash: string }>();
    if (!user || !(await verifyPassword(current, user.password_hash))) return errorResponse("Senha atual incorreta.", 403);

    const hash = await hashPassword(next);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("UPDATE users SET password_hash = ?, sessions_valid_after = ? WHERE id = ?").bind(hash, now, auth.id).run();
    forgetSuspension(auth.id);

    // Novo token para este aparelho continuar logado; os demais precisam entrar de novo
    const token = await signJWT({ id: auth.id, username: user.username }, secret);
    return jsonResponse({ changed: true, token });
  } catch (err: unknown) {
    return serverError(err, "account:password");
  }
};
