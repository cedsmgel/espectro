import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../../../_shared/auth";
import { membership } from "../../../_shared/groups";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// PUT { pinned?, archived? }: minhas preferências deste grupo na lista de conversas
export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const groupId = Number(params.id);
    if (!(await membership(env.DB, groupId, user.id))) return errorResponse("Grupo não encontrado.", 404);

    const body = (await request.json().catch(() => null)) as { pinned?: boolean; archived?: boolean } | null;
    const flag = (v: unknown) => (typeof v === "boolean" ? (v ? 1 : 0) : null);
    const pinned = flag(body?.pinned);
    const archived = flag(body?.archived);
    if (pinned === null && archived === null) return errorResponse("Nada para atualizar.", 400);

    await env.DB.prepare(
      `UPDATE chat_group_members SET pinned = COALESCE(?, pinned), archived = COALESCE(?, archived)
       WHERE group_id = ? AND user_id = ?`
    )
      .bind(pinned, archived, groupId, user.id)
      .run();

    return jsonResponse({ pinned: pinned === null ? undefined : Boolean(pinned), archived: archived === null ? undefined : Boolean(archived) });
  } catch (err: unknown) {
    return serverError(err, "groups/prefs");
  }
};
