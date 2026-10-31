import {
  getAuthUser,
  jsonResponse,
  errorResponse,
  getJwtSecret,
  isBlockedBetween,
  rateLimit,
  serverError,
} from "../../_shared/auth";
import { REACTION_EMOJIS, notifyRoom, type ChatEnv } from "../../_shared/chat";
import { pushReaction, type PushEnv } from "../../_shared/push";

export interface Env extends ChatEnv, PushEnv {
  JWT_SECRET: string;
}

// PUT { message_id, emoji | null }: reage (ou remove a reação) a uma mensagem da própria conversa
export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "reaction", 60, 60, user.id);
    if (limited) return limited;

    const body = (await request.json().catch(() => null)) as { message_id?: number; emoji?: string | null } | null;
    const messageId = Number(body?.message_id);
    if (!body || !Number.isInteger(messageId) || messageId <= 0) {
      return errorResponse("message_id é obrigatório.", 400);
    }

    const emoji = body.emoji === null || body.emoji === undefined ? null : String(body.emoji);
    if (emoji !== null && !REACTION_EMOJIS.includes(emoji)) {
      return errorResponse("Reação inválida.", 400);
    }

    const message = await env.DB.prepare(
      "SELECT id, sender_id, receiver_id FROM direct_messages WHERE id = ?"
    )
      .bind(messageId)
      .first<{ id: number; sender_id: number; receiver_id: number }>();

    // Quem não participa da conversa recebe o mesmo "não encontrada" de uma mensagem inexistente
    if (!message || (message.sender_id !== user.id && message.receiver_id !== user.id)) {
      return errorResponse("Mensagem não encontrada.", 404);
    }

    const otherId = message.sender_id === user.id ? message.receiver_id : message.sender_id;
    if (await isBlockedBetween(env.DB, user.id, otherId)) {
      return errorResponse("Não foi possível reagir.", 403);
    }

    const previous = await env.DB.prepare(
      "SELECT emoji FROM message_reactions WHERE message_id = ? AND user_id = ?"
    )
      .bind(messageId, user.id)
      .first<{ emoji: string }>();

    if (emoji === null) {
      await env.DB.prepare("DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?")
        .bind(messageId, user.id)
        .run();
    } else {
      await env.DB.prepare(
        `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)
         ON CONFLICT(message_id, user_id) DO UPDATE SET emoji = excluded.emoji, created_at = CURRENT_TIMESTAMP`
      )
        .bind(messageId, user.id, emoji)
        .run();
    }

    const event = { type: "reaction", message_id: messageId, user_id: user.id, emoji };
    const { delivered } = await notifyRoom(env, user.id, otherId, event, otherId);

    // Avisa por push só quem fica sabendo de uma reação nova à própria mensagem e não está na conversa
    if (emoji !== null && emoji !== previous?.emoji && message.sender_id === otherId && !delivered) {
      context.waitUntil(pushReaction(env, user, otherId, emoji));
    }

    return jsonResponse({ message_id: messageId, user_id: user.id, emoji });
  } catch (err: unknown) {
    return serverError(err, "direct_messages/reaction");
  }
};
