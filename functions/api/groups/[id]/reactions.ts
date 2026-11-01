import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, serverError } from "../../../_shared/auth";
import { membership } from "../../../_shared/groups";
import { REACTION_EMOJIS, notifyGroup, type ChatEnv } from "../../../_shared/chat";

export interface Env extends ChatEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

// PUT { message_id, emoji | null }: reage (ou remove a reação) a uma mensagem do grupo
export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "reaction", 60, 60, user.id);
    if (limited) return limited;

    const groupId = Number(params.id);
    if (!(await membership(env.DB, groupId, user.id))) return errorResponse("Grupo não encontrado.", 404);

    const body = (await request.json().catch(() => null)) as { message_id?: number; emoji?: string | null } | null;
    const messageId = Number(body?.message_id);
    if (!body || !Number.isInteger(messageId) || messageId <= 0) return errorResponse("message_id é obrigatório.", 400);
    const emoji = body.emoji === null || body.emoji === undefined ? null : String(body.emoji);
    if (emoji !== null && !REACTION_EMOJIS.includes(emoji)) return errorResponse("Reação inválida.", 400);

    const message = await env.DB.prepare(
      "SELECT id FROM chat_group_messages WHERE id = ? AND group_id = ? AND deleted_at IS NULL AND message_type != 'system'"
    )
      .bind(messageId, groupId)
      .first();
    if (!message) return errorResponse("Mensagem não encontrada.", 404);

    if (emoji === null) {
      await env.DB.prepare("DELETE FROM group_message_reactions WHERE message_id = ? AND user_id = ?").bind(messageId, user.id).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO group_message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)
         ON CONFLICT(message_id, user_id) DO UPDATE SET emoji = excluded.emoji, created_at = CURRENT_TIMESTAMP`
      )
        .bind(messageId, user.id, emoji)
        .run();
    }

    await notifyGroup(env, groupId, { type: "reaction", message_id: messageId, user_id: user.id, emoji });
    return jsonResponse({ message_id: messageId, user_id: user.id, emoji });
  } catch (err: unknown) {
    return serverError(err, "groups/reactions");
  }
};
