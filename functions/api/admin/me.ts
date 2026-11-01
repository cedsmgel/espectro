import { getAuthUser, getJwtSecret, jsonResponse, errorResponse, serverError } from "../../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET /api/admin/me: diz se a conta logada é administradora (para mostrar o acesso à moderação)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const row = await env.DB.prepare("SELECT is_admin FROM users WHERE id = ?")
      .bind(user.id)
      .first<{ is_admin: number }>();
    return jsonResponse({ is_admin: Boolean(row?.is_admin) });
  } catch (err: unknown) {
    return serverError(err, "admin/me");
  }
};
