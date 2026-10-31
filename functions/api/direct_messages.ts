import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, areFriends, sanitizeMediaUrl, serverError, rateLimit } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET: busca mensagens privadas trocadas entre o usuário logado e um amigo
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = getJwtSecret(env);
    const user = await getAuthUser(request, secret);

    if (!user) {
      return errorResponse("Não autorizado. Faça login para ver mensagens.", 401);
    }


    const url = new URL(request.url);
    const unreadParam = url.searchParams.get("unread");

    // Retorna a contagem real de mensagens não lidas recebidas pelo usuário logado
    if (unreadParam === "count") {
      const countRes = await env.DB.prepare(`
        SELECT COUNT(*) AS unread_count 
        FROM direct_messages 
        WHERE receiver_id = ? AND read_at IS NULL
      `)
        .bind(user.id)
        .first<{ unread_count: number }>();

      return jsonResponse({ unread_count: countRes?.unread_count || 0 });
    }

    const friendId = url.searchParams.get("friend_id");

    if (!friendId) {
      return errorResponse("O parâmetro friend_id é obrigatório.", 400);
    }

    const fid = Number(friendId);
    if (!Number.isInteger(fid) || fid <= 0) {
      return errorResponse("friend_id inválido.", 400);
    }

    // Consulta histórico ordenado cronologicamente
    const query = `
      SELECT 
        dm.id,
        dm.sender_id,
        dm.receiver_id,
        dm.content,
        COALESCE(dm.message_type, 'text') AS message_type,
        dm.media_url,
        dm.created_at,
        u.username AS sender_name
      FROM direct_messages dm
      JOIN users u ON dm.sender_id = u.id
      WHERE (dm.sender_id = ? AND dm.receiver_id = ?)
         OR (dm.sender_id = ? AND dm.receiver_id = ?)
      ORDER BY dm.id ASC
      LIMIT 100
    `;

    const { results } = await env.DB.prepare(query)
      .bind(user.id, fid, fid, user.id)
      .all();

    // Marca mensagens recebidas como lidas
    await env.DB.prepare(`
      UPDATE direct_messages 
      SET read_at = CURRENT_TIMESTAMP 
      WHERE sender_id = ? AND receiver_id = ? AND read_at IS NULL
    `)
      .bind(fid, user.id)
      .run();

    return jsonResponse(results || []);
  } catch (err: unknown) {
    return serverError(err, "direct_messages");
  }
};

// POST: envia uma nova mensagem privada direta
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = getJwtSecret(env);
    const user = await getAuthUser(request, secret);

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
    };

    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    const content = body.content || "";
    const allowedTypes = ["text", "image", "video", "file", "location", "gif", "sticker"];
    const messageType = allowedTypes.includes(body.message_type || "") ? (body.message_type as string) : "text";
    const mediaUrl = sanitizeMediaUrl(body.media_url);
    if (body.media_url && !mediaUrl) {
      return errorResponse("URL de mídia inválida.", 400);
    }

    if (!content.trim() && !mediaUrl) {
      return errorResponse("O conteúdo da mensagem ou mídia é obrigatório.", 400);
    }

    let targetId = body.receiver_id ? Number(body.receiver_id) : null;

    if (!targetId && body.receiver_username) {
      const targetUser = await env.DB.prepare("SELECT id FROM users WHERE LOWER(username) = ?")
        .bind(body.receiver_username.trim().toLowerCase())
        .first<{ id: number }>();
      if (targetUser) targetId = targetUser.id;
    }

    if (!targetId) {
      return errorResponse("Destinatário é obrigatório.", 400);
    }

    if (targetId === user.id) {
      return errorResponse("Você não pode enviar mensagem direta para você mesmo.", 400);
    }

    if (!(await areFriends(env.DB, user.id, targetId))) {
      return errorResponse("Você só pode enviar mensagens para seus amigos.", 403);
    }

    const cleanContent = content.trim();
    if (cleanContent.length > 4000) {
      return errorResponse("Mensagem muito longa (máximo 4000 caracteres).", 400);
    }

    const insertResult = await env.DB.prepare(`
      INSERT INTO direct_messages (sender_id, receiver_id, content, message_type, media_url)
      VALUES (?, ?, ?, ?, ?)
    `)
      .bind(user.id, targetId, cleanContent, messageType, mediaUrl)
      .run();

    const newId = insertResult.meta.last_row_id;

    return jsonResponse(
      {
        id: newId,
        sender_id: user.id,
        receiver_id: targetId,
        sender_name: user.username,
        content: cleanContent,
        message_type: messageType,
        media_url: mediaUrl,
        created_at: new Date().toISOString(),
      },
      201
    );
  } catch (err: unknown) {
    return serverError(err, "direct_messages");
  }
};
