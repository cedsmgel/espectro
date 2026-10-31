import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../../_shared/auth";
import { notifyRoom, type ChatEnv } from "../../_shared/chat";

export interface Env extends ChatEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

// POST { friend_id }: marca como lidas as mensagens recebidas desse amigo
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) {
      return errorResponse("Não autorizado.", 401);
    }

    const body = (await request.json().catch(() => null)) as { friend_id?: number; all?: boolean } | null;

    if (body?.all) {
      const result = await env.DB.prepare(
        `UPDATE direct_messages
         SET read_at = CURRENT_TIMESTAMP, delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
         WHERE receiver_id = ? AND read_at IS NULL`
      )
        .bind(user.id)
        .run();
      return jsonResponse({ marked: Number(result.meta.changes || 0) });
    }

    const friendId = Number(body?.friend_id);
    if (!Number.isInteger(friendId) || friendId <= 0) {
      return errorResponse("friend_id é obrigatório.", 400);
    }

    const result = await env.DB.prepare(
      `UPDATE direct_messages
       SET read_at = CURRENT_TIMESTAMP, delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
       WHERE sender_id = ? AND receiver_id = ? AND read_at IS NULL`
    )
      .bind(friendId, user.id)
      .run();

    await env.DB.prepare("UPDATE conversation_settings SET manual_unread = 0 WHERE user_id = ? AND friend_id = ?")
      .bind(user.id, friendId)
      .run();

    const changes = Number(result.meta.changes || 0);
    if (changes > 0) {
      await notifyRoom(env, user.id, friendId, { type: "read", reader_id: user.id });
    }

    return jsonResponse({ marked: changes });
  } catch (err: unknown) {
    return serverError(err, "direct_messages/read");
  }
};
