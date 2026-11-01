import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../../../../_shared/auth";
import { membership } from "../../../../_shared/groups";
import { EDIT_WINDOW_SECONDS, notifyGroup, type ChatEnv } from "../../../../_shared/chat";
import { releaseMedia } from "../../../../_shared/mediaCleanup";

export interface Env extends ChatEnv {
  DB: D1Database;
  JWT_SECRET: string;
  MEDIA_BUCKET?: R2Bucket;
  BUCKET?: R2Bucket;
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
      "SELECT sender_id, media_url FROM chat_group_messages WHERE id = ? AND group_id = ? AND deleted_at IS NULL"
    )
      .bind(messageId, groupId)
      .first<{ sender_id: number | null; media_url: string | null }>();
    if (!message) return errorResponse("Mensagem não encontrada.", 404);
    if (message.sender_id !== user.id && me.role !== "admin") {
      return errorResponse("Você só pode apagar as suas mensagens.", 403);
    }

    await env.DB.prepare(
      "UPDATE chat_group_messages SET content = '', media_url = NULL, deleted_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
      .bind(messageId)
      .run();

    await env.DB.prepare("DELETE FROM starred_messages WHERE kind = 'group' AND message_id = ?").bind(messageId).run();
    await notifyGroup(env, groupId, { type: "delete", message_id: messageId });
    // O arquivo sai do bucket se nenhuma outra mensagem ou publicação o usa
    context.waitUntil(releaseMedia(env, [message.media_url]));
    return jsonResponse({ ok: true });
  } catch (err: unknown) {
    return serverError(err, "groups/messages/delete");
  }
};

// PATCH { content }: edita uma mensagem de texto própria, até 15 minutos depois de enviada
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  try {
    const { request, env, params } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const groupId = Number(params.id);
    const messageId = Number(params.mid);
    const me = await membership(env.DB, groupId, user.id);
    if (!me) return errorResponse("Grupo não encontrado.", 404);

    const body = (await request.json().catch(() => null)) as { content?: string } | null;
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!content) return errorResponse("A mensagem não pode ficar vazia.", 400);
    if (content.length > 2000) return errorResponse("A mensagem deve ter no máximo 2000 caracteres.", 400);

    const row = await env.DB.prepare(
      `SELECT sender_id, content, message_type,
         CAST(strftime('%s', 'now') AS INTEGER) - CAST(strftime('%s', created_at) AS INTEGER) AS age
       FROM chat_group_messages WHERE id = ? AND group_id = ? AND deleted_at IS NULL`
    )
      .bind(messageId, groupId)
      .first<{ sender_id: number | null; content: string; message_type: string; age: number }>();

    if (!row) return errorResponse("Mensagem não encontrada.", 404);
    if (row.sender_id !== user.id) return errorResponse("Você só pode editar as suas próprias mensagens.", 403);
    if (row.message_type !== "text") return errorResponse("Só mensagens de texto podem ser editadas.", 400);
    if (row.age > EDIT_WINDOW_SECONDS) return errorResponse("O prazo de 15 minutos para editar já passou.", 400);

    // Texto igual ao atual: nada a gravar e a mensagem não ganha a marca de editada
    if (content === row.content) return jsonResponse({ edited: false, content });

    await env.DB.prepare("UPDATE chat_group_messages SET content = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(content, messageId)
      .run();
    const edited = await env.DB.prepare(
      "SELECT strftime('%Y-%m-%dT%H:%M:%SZ', edited_at) AS edited_at FROM chat_group_messages WHERE id = ?"
    )
      .bind(messageId)
      .first<{ edited_at: string }>();

    await notifyGroup(env, groupId, { type: "edit", message_id: messageId, content, edited_at: edited?.edited_at ?? null });
    return jsonResponse({ edited: true, content, edited_at: edited?.edited_at ?? null });
  } catch (err: unknown) {
    return serverError(err, "groups/messages/edit");
  }
};
