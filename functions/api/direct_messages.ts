import { getAuthUser, jsonResponse, errorResponse } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// Garante que a tabela direct_messages exista (self-healing)
async function ensureMessagesTable(db: D1Database) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        read_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {
    // ignore if already exists
  }
}

// GET: busca mensagens privadas trocadas entre o usuário logado e um amigo
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = env.JWT_SECRET || "troque-este-segredo";
    const user = await getAuthUser(request, secret);

    if (!user) {
      return errorResponse("Não autorizado. Faça login para ver mensagens.", 401);
    }

    await ensureMessagesTable(env.DB);

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

    // Consulta histórico ordenado cronologicamente
    const query = `
      SELECT 
        dm.id,
        dm.sender_id,
        dm.receiver_id,
        dm.content,
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
    const message = err instanceof Error ? err.message : "Erro ao carregar mensagens privadas.";
    return errorResponse(message, 500);
  }
};

// POST: envia uma nova mensagem privada direta
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = env.JWT_SECRET || "troque-este-segredo";
    const user = await getAuthUser(request, secret);

    if (!user) {
      return errorResponse("Não autorizado. Faça login para enviar mensagens.", 401);
    }

    await ensureMessagesTable(env.DB);

    let body: {
      receiver_id?: number;
      receiver_username?: string;
      content?: string;
    };

    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    const { content } = body;
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return errorResponse("O conteúdo da mensagem não pode ser vazio.", 400);
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

    const cleanContent = content.trim();

    const insertResult = await env.DB.prepare(`
      INSERT INTO direct_messages (sender_id, receiver_id, content)
      VALUES (?, ?, ?)
    `)
      .bind(user.id, targetId, cleanContent)
      .run();

    const newId = insertResult.meta.last_row_id;

    return jsonResponse(
      {
        id: newId,
        sender_id: user.id,
        receiver_id: targetId,
        sender_name: user.username,
        content: cleanContent,
        created_at: new Date().toISOString(),
      },
      201
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao enviar mensagem privada.";
    return errorResponse(message, 500);
  }
};
