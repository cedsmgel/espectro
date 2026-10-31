import {
  getAuthUser,
  jsonResponse,
  errorResponse,
  getJwtSecret,
  areFriends,
  sanitizeMediaUrl,
  serverError,
  rateLimit,
} from "../_shared/auth";
import { MESSAGE_COLUMNS, notifyRoom, type ChatEnv, type DirectMessageRow } from "../_shared/chat";

export interface Env extends ChatEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

const MESSAGE_TYPES = ["text", "image", "video", "file", "location", "gif", "sticker"];
const CLIENT_ID_PATTERN = /^[\w-]{8,64}$/;

async function fetchMessage(db: D1Database, id: number): Promise<DirectMessageRow | null> {
  return db
    .prepare(`SELECT ${MESSAGE_COLUMNS} FROM direct_messages dm JOIN users u ON u.id = dm.sender_id WHERE dm.id = ?`)
    .bind(id)
    .first<DirectMessageRow>();
}

// GET: histórico paginado com um amigo (?friend_id=&before_id=&limit=) ou contagem de não lidas (?unread=count)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));

    if (!user) {
      return errorResponse("Não autorizado. Faça login para ver mensagens.", 401);
    }

    const url = new URL(request.url);

    if (url.searchParams.get("unread") === "count") {
      const countRes = await env.DB.prepare(
        "SELECT COUNT(*) AS unread_count FROM direct_messages WHERE receiver_id = ? AND read_at IS NULL"
      )
        .bind(user.id)
        .first<{ unread_count: number }>();

      return jsonResponse({ unread_count: countRes?.unread_count || 0 });
    }

    const friendId = Number(url.searchParams.get("friend_id"));
    if (!Number.isInteger(friendId) || friendId <= 0) {
      return errorResponse("O parâmetro friend_id é obrigatório.", 400);
    }

    const limitParam = Number(url.searchParams.get("limit"));
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 30;
    const beforeParam = Number(url.searchParams.get("before_id"));
    const beforeId = Number.isInteger(beforeParam) && beforeParam > 0 ? beforeParam : null;

    const { results } = await env.DB.prepare(
      `SELECT ${MESSAGE_COLUMNS}
       FROM direct_messages dm
       JOIN users u ON u.id = dm.sender_id
       WHERE ((dm.sender_id = ? AND dm.receiver_id = ?) OR (dm.sender_id = ? AND dm.receiver_id = ?))
         AND (? IS NULL OR dm.id < ?)
         AND dm.id > COALESCE(
           (SELECT cleared_before_id FROM conversation_settings WHERE user_id = ? AND friend_id = ?), 0)
       ORDER BY dm.id DESC
       LIMIT ?`
    )
      .bind(user.id, friendId, friendId, user.id, beforeId, beforeId, user.id, friendId, limit + 1)
      .all<DirectMessageRow>();

    const rows = results || [];
    const hasMore = rows.length > limit;
    const messages = rows.slice(0, limit).reverse();

    return jsonResponse({ messages, has_more: hasMore });
  } catch (err: unknown) {
    return serverError(err, "direct_messages");
  }
};

// POST: envia uma mensagem. `client_id` torna o envio idempotente (reenvios não duplicam).
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));

    if (!user) {
      return errorResponse("Não autorizado. Faça login para enviar mensagens.", 401);
    }

    const limited = await rateLimit(env.DB, request, "dm-send", 120, 60, user.id);
    if (limited) return limited;

    let body: {
      receiver_id?: number;
      receiver_username?: string;
      content?: string;
      message_type?: string;
      media_url?: string;
      reply_to_id?: number | null;
      client_id?: string;
    };

    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    const content = typeof body.content === "string" ? body.content.trim() : "";
    const messageType = MESSAGE_TYPES.includes(body.message_type || "") ? (body.message_type as string) : "text";
    const mediaUrl = sanitizeMediaUrl(body.media_url);
    if (body.media_url && !mediaUrl) {
      return errorResponse("URL de mídia inválida.", 400);
    }

    if (!content && !mediaUrl) {
      return errorResponse("O conteúdo da mensagem ou mídia é obrigatório.", 400);
    }
    if (content.length > 4000) {
      return errorResponse("Mensagem muito longa (máximo 4000 caracteres).", 400);
    }

    let clientId: string | null = null;
    if (body.client_id !== undefined && body.client_id !== null) {
      if (typeof body.client_id !== "string" || !CLIENT_ID_PATTERN.test(body.client_id)) {
        return errorResponse("client_id inválido.", 400);
      }
      clientId = body.client_id;
    }

    let targetId = body.receiver_id ? Number(body.receiver_id) : null;

    if (!targetId && body.receiver_username) {
      const targetUser = await env.DB.prepare("SELECT id FROM users WHERE LOWER(username) = ?")
        .bind(String(body.receiver_username).trim().toLowerCase())
        .first<{ id: number }>();
      if (targetUser) targetId = targetUser.id;
    }

    if (!targetId || !Number.isInteger(targetId)) {
      return errorResponse("Destinatário é obrigatório.", 400);
    }

    if (targetId === user.id) {
      return errorResponse("Você não pode enviar mensagem direta para você mesmo.", 400);
    }

    if (!(await areFriends(env.DB, user.id, targetId))) {
      return errorResponse("Você só pode enviar mensagens para seus amigos.", 403);
    }

    // Reenvio da mesma mensagem: devolve a já gravada, sem duplicar nem notificar de novo
    if (clientId) {
      const existing = await env.DB.prepare(
        "SELECT id FROM direct_messages WHERE sender_id = ? AND client_id = ?"
      )
        .bind(user.id, clientId)
        .first<{ id: number }>();
      if (existing) {
        const row = await fetchMessage(env.DB, existing.id);
        return jsonResponse({ message: row, duplicate: true });
      }
    }

    let replyToId: number | null = null;
    if (body.reply_to_id) {
      const replyId = Number(body.reply_to_id);
      const target = Number.isInteger(replyId)
        ? await env.DB.prepare(
            "SELECT id FROM direct_messages WHERE id = ? AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))"
          )
            .bind(replyId, user.id, targetId, targetId, user.id)
            .first()
        : null;
      if (target) replyToId = replyId;
    }

    const insertResult = await env.DB.prepare(
      `INSERT INTO direct_messages (sender_id, receiver_id, content, message_type, media_url, reply_to_id, client_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(user.id, targetId, content, messageType, mediaUrl, replyToId, clientId)
      .run();

    const newId = Number(insertResult.meta.last_row_id);
    let message = (await fetchMessage(env.DB, newId)) as DirectMessageRow;

    // Entrega em tempo real; se o destinatário está conectado, marca como entregue
    const { delivered } = await notifyRoom(env, user.id, targetId, { type: "message", message }, targetId);
    if (delivered) {
      await env.DB.prepare("UPDATE direct_messages SET delivered_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(newId)
        .run();
      message = { ...message, status: "delivered" };
      await notifyRoom(env, user.id, targetId, { type: "status", message_id: newId, status: "delivered" });
    }

    return jsonResponse({ message }, 201);
  } catch (err: unknown) {
    return serverError(err, "direct_messages");
  }
};

// DELETE: remove uma mensagem enviada pelo próprio usuário (?id=)
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) {
      return errorResponse("Não autorizado.", 401);
    }

    const messageId = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(messageId) || messageId <= 0) {
      return errorResponse("ID da mensagem é obrigatório.", 400);
    }

    const row = await env.DB.prepare(
      "SELECT id, sender_id, receiver_id FROM direct_messages WHERE id = ?"
    )
      .bind(messageId)
      .first<{ id: number; sender_id: number; receiver_id: number }>();

    if (!row) {
      return errorResponse("Mensagem não encontrada.", 404);
    }
    if (row.sender_id !== user.id) {
      return errorResponse("Você só pode excluir suas próprias mensagens.", 403);
    }

    await env.DB.prepare("DELETE FROM direct_messages WHERE id = ?").bind(messageId).run();
    await notifyRoom(env, row.sender_id, row.receiver_id, {
      type: "delete",
      message_id: messageId,
      messageId,
    });

    return jsonResponse({ success: true, deleted_id: messageId });
  } catch (err: unknown) {
    return serverError(err, "direct_messages");
  }
};
