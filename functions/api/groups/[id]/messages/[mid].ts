import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../../../../_shared/auth";
import { membership } from "../../../../_shared/groups";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// DELETE /api/groups/:id/messages/:mid: apaga a mensagem (autor ou admin do grupo).
// O conteúdo é removido do banco; a linha fica para manter a ordem e as respostas.
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const { request, env, params } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const groupId = Number(params.id);
    const messageId = Number(params.mid);
    const me = await membership(env.DB, groupId, user.id);
    if (!me) return errorResponse("Grupo não encontrado.", 404);

    const message = await env.DB.prepare(
      "SELECT sender_id FROM chat_group_messages WHERE id = ? AND group_id = ? AND deleted_at IS NULL"
    )
      .bind(messageId, groupId)
      .first<{ sender_id: number | null }>();
    if (!message) return errorResponse("Mensagem não encontrada.", 404);
    if (message.sender_id !== user.id && me.role !== "admin") {
      return errorResponse("Você só pode apagar as suas mensagens.", 403);
    }

    await env.DB.prepare(
      "UPDATE chat_group_messages SET content = '', media_url = NULL, deleted_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
      .bind(messageId)
      .run();

    return jsonResponse({ ok: true });
  } catch (err: unknown) {
    return serverError(err, "groups/messages/delete");
  }
};
