export type ChatMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'file'
  | 'location'
  | 'gif'
  | 'sticker';

export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface ChatMessage {
  id?: number;
  sender_id: number;
  sender_username: string;
  content: string;
  message_type: ChatMessageType;
  media_url?: string | null;
  reply_to_id?: number | null;
  status?: MessageStatus;
  created_at: string;
}

interface SocketIdentity {
  id: number;
  username: string;
}

const VALID_TYPES: ChatMessageType[] = ['text', 'image', 'video', 'file', 'location', 'gif', 'sticker'];
const MAX_CONTENT_LENGTH = 4000;

function sanitizeMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url || url.length > 2048) return null;
  if (/^\/api\/media\/[\w\-./%]+$/.test(url) && !url.includes('..')) return url;
  if (/^https:\/\/[^\s<>"']+$/.test(url)) return url;
  return null;
}

export default {
  async fetch(): Promise<Response> {
    return new Response('Not found', { status: 404 });
  },
};

export class ChatRoom implements DurableObject {
  ctx: DurableObjectState;
  env: any;

  constructor(ctx: DurableObjectState, env: any) {
    this.ctx = ctx;
    this.env = env;

    this.ctx.blockConcurrencyWhile(async () => {
      try {
        this.ctx.storage.sql.exec(`
          CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            sender_username TEXT NOT NULL,
            content TEXT NOT NULL,
            message_type TEXT DEFAULT 'text',
            media_url TEXT,
            reply_to_id INTEGER,
            status TEXT DEFAULT 'sent',
            created_at TEXT NOT NULL
          );
        `);

        for (const stmt of [
          `ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'text';`,
          `ALTER TABLE messages ADD COLUMN media_url TEXT;`,
          `ALTER TABLE messages ADD COLUMN reply_to_id INTEGER;`,
          `ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'sent';`,
        ]) {
          try {
            this.ctx.storage.sql.exec(stmt);
          } catch {}
        }
      } catch (err) {
        console.error('Erro ao inicializar schema SQLite no ChatRoom:', err);
      }
    });
  }

  private getRecentMessages(): ChatMessage[] {
    try {
      const cursor = this.ctx.storage.sql.exec<Record<string, SqlStorageValue>>(`
        SELECT id, sender_id, sender_username, content,
               COALESCE(message_type, 'text') AS message_type,
               media_url, reply_to_id,
               COALESCE(status, 'sent') AS status,
               created_at
        FROM (
          SELECT id, sender_id, sender_username, content, message_type, media_url, reply_to_id, status, created_at
          FROM messages
          ORDER BY id DESC
          LIMIT 50
        )
        ORDER BY id ASC
      `);
      return cursor.toArray() as unknown as ChatMessage[];
    } catch (err) {
      console.error('Erro ao recuperar histórico do SQLite:', err);
    }
    return [];
  }

  private saveMessage(msg: ChatMessage): ChatMessage {
    try {
      const cursor = this.ctx.storage.sql.exec<Record<string, SqlStorageValue>>(
        `INSERT INTO messages (sender_id, sender_username, content, message_type, media_url, reply_to_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        msg.sender_id,
        msg.sender_username,
        msg.content,
        msg.message_type,
        msg.media_url || null,
        msg.reply_to_id || null,
        msg.status || 'sent',
        msg.created_at
      );
      const rows = cursor.toArray();
      if (rows.length > 0 && rows[0].id) {
        msg.id = Number(rows[0].id);
      }
    } catch (err) {
      console.error('Erro ao persistir mensagem no SQLite:', err);
    }
    return msg;
  }

  // Remove a mensagem apenas se pertencer ao usuário informado
  private deleteOwnMessage(id: number, userId: number): boolean {
    try {
      const rows = this.ctx.storage.sql
        .exec<Record<string, SqlStorageValue>>(`SELECT sender_id FROM messages WHERE id = ?`, id)
        .toArray();
      if (rows.length === 0 || Number(rows[0].sender_id) !== userId) return false;
      this.ctx.storage.sql.exec(`DELETE FROM messages WHERE id = ?`, id);
      return true;
    } catch (err) {
      console.error('Erro ao deletar mensagem do SQLite:', err);
    }
    return false;
  }

  private broadcast(payload: string, except?: WebSocket) {
    for (const client of this.ctx.getWebSockets()) {
      if (client === except) continue;
      try {
        client.send(payload);
      } catch {}
    }
  }

  // A identidade vem exclusivamente dos headers injetados por /api/chat após validar o JWT
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('ChatRoom Durable Object: requisição requer Upgrade: websocket', {
        status: 426,
      });
    }

    const userId = Number(request.headers.get('X-Chat-User-Id'));
    const username = request.headers.get('X-Chat-Username');
    if (!Number.isInteger(userId) || userId <= 0 || !username) {
      return new Response('Não autorizado', { status: 401 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: userId, username } satisfies SocketIdentity);

    server.send(JSON.stringify({ type: 'history', messages: this.getRecentMessages() }));

    const wsProtocol = request.headers.get('Sec-WebSocket-Protocol');
    const headers: Record<string, string> = {};
    if (wsProtocol) {
      headers['Sec-WebSocket-Protocol'] = wsProtocol;
    }

    return new Response(null, { status: 101, webSocket: client, headers });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const identity = ws.deserializeAttachment() as SocketIdentity | null;
      if (!identity) {
        ws.close(1008, 'Identidade ausente');
        return;
      }

      const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);
      if (raw.length > 16 * 1024) {
        ws.send(JSON.stringify({ type: 'error', error: 'Mensagem muito grande' }));
        return;
      }
      const data = JSON.parse(raw);

      if (data.type === 'read') {
        try {
          this.ctx.storage.sql.exec(
            `UPDATE messages SET status = 'read' WHERE sender_id != ? AND status != 'read'`,
            identity.id
          );
        } catch (err) {
          console.error('Erro ao atualizar status para read no SQLite:', err);
        }
        this.broadcast(JSON.stringify({ type: 'read', reader_id: identity.id }));
        return;
      }

      if (data.type === 'delete') {
        const messageId = Number(data.message_id || data.messageId || data.id);
        if (messageId && this.deleteOwnMessage(messageId, identity.id)) {
          this.broadcast(
            JSON.stringify({ type: 'delete', message_id: messageId, messageId: messageId })
          );
        }
        return;
      }

      if (data.type === 'typing') {
        this.broadcast(
          JSON.stringify({ type: 'typing', sender_id: identity.id, is_typing: !!data.is_typing }),
          ws
        );
        return;
      }

      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        return;
      }

      const isChatMessage =
        data.type === 'message' ||
        data.type === 'media' ||
        data.message_type ||
        data.media_url ||
        data.text !== undefined ||
        data.content !== undefined;

      if (!isChatMessage) return;

      const rawContent = String(data.content || data.text || data.filename || '').trim();
      if (rawContent.length > MAX_CONTENT_LENGTH) {
        ws.send(JSON.stringify({ type: 'error', error: 'Mensagem muito longa' }));
        return;
      }

      const rawType = (data.message_type ||
        (data.type !== 'message' && data.type !== 'media' ? data.type : 'text')) as ChatMessageType;
      let messageType: ChatMessageType = VALID_TYPES.includes(rawType) ? rawType : 'text';
      if (data.type === 'media' && (!rawType || rawType === 'text')) {
        const requested = data.message_type as ChatMessageType;
        messageType = VALID_TYPES.includes(requested) ? requested : 'image';
      }

      const mediaUrl = sanitizeMediaUrl(data.media_url);
      if (data.media_url && !mediaUrl) {
        ws.send(JSON.stringify({ type: 'error', error: 'URL de mídia inválida' }));
        return;
      }

      const replyRaw = Number(data.reply_to_id ?? data.replyToId);
      const replyToId = Number.isInteger(replyRaw) && replyRaw > 0 ? replyRaw : null;

      if (rawContent.length === 0 && !mediaUrl) return;

      const connectedSockets = this.ctx.getWebSockets();
      const initialStatus: MessageStatus = connectedSockets.length > 1 ? 'delivered' : 'sent';

      const newMsg: ChatMessage = {
        sender_id: identity.id,
        sender_username: identity.username,
        content: rawContent || (messageType === 'location' ? 'Localização compartilhada' : ''),
        message_type: messageType,
        media_url: mediaUrl,
        reply_to_id: replyToId,
        status: initialStatus,
        created_at: new Date().toISOString(),
      };

      this.saveMessage(newMsg);

      this.broadcast(
        JSON.stringify({
          type: 'message',
          message: newMsg,
          status: newMsg.status,
          media_url: newMsg.media_url,
          message_type: newMsg.message_type,
          content: newMsg.content,
          reply_to_id: newMsg.reply_to_id,
        })
      );
    } catch (err) {
      console.error('Erro ao processar mensagem do WebSocket:', err);
      try {
        ws.send(JSON.stringify({ type: 'error', error: 'Falha ao processar mensagem enviada' }));
      } catch {}
    }
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 ? 1000 : code, 'ChatRoom fechando conexão');
    } catch {}
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.warn('WebSocket erro no ChatRoom:', error);
    try {
      ws.close(1011, 'Erro inesperado');
    } catch {}
  }
}
