import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// DELETE /api/moments/:id: apaga um Momentum meu
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const { request, env, params } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) return errorResponse("ID inválido.", 400);

    const result = await env.DB.prepare("DELETE FROM moments WHERE id = ? AND user_id = ?").bind(id, user.id).run();
    if (!result.meta.changes) return errorResponse("Momentum não encontrado.", 404);
    return jsonResponse({ deleted: true });
  } catch (err: unknown) {
    return serverError(err, "moments:delete");
  }
};
