export type ChatMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'file'
  | 'location'
  | 'gif'
  | 'sticker';

export interface ChatMessage {
  id?: number;
  sender_id: number;
  sender_username: string;
  content: string;
  message_type: ChatMessageType;
  media_url?: string | null;
  created_at: string;
}

export class ChatRoom implements DurableObject {
  ctx: DurableObjectState;
  env: any;

  constructor(ctx: DurableObjectState, env: any) {
    this.ctx = ctx;
    this.env = env;

    // Inicialização do SQLite interno da sala com blockConcurrencyWhile
    this.ctx.blockConcurrencyWhile(async () => {
      try {
        if (this.ctx.storage.sql) {
          this.ctx.storage.sql.exec(`
            CREATE TABLE IF NOT EXISTS messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              sender_id INTEGER NOT NULL,
              sender_username TEXT NOT NULL,
              content TEXT NOT NULL,
              message_type TEXT DEFAULT 'text',
              media_url TEXT,
              created_at TEXT NOT NULL
            );
          `);

          // Migrações seguras caso a tabela já existisse no SQLite do DO
          try {
            this.ctx.storage.sql.exec(`ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'text';`);
          } catch {}
          try {
            this.ctx.storage.sql.exec(`ALTER TABLE messages ADD COLUMN media_url TEXT;`);
          } catch {}
        }
      } catch (err) {
        console.error("Erro ao inicializar schema SQLite no ChatRoom:", err);
      }
    });
  }

  // Busca as últimas 50 mensagens armazenadas no SQLite interno
  private getRecentMessages(): ChatMessage[] {
    try {
      if (this.ctx.storage.sql) {
        const cursor = this.ctx.storage.sql.exec<Record<string, SqlStorageValue>>(`
          SELECT id, sender_id, sender_username, content, 
                 COALESCE(message_type, 'text') AS message_type, 
                 media_url, created_at 
          FROM (
            SELECT id, sender_id, sender_username, content, message_type, media_url, created_at 
            FROM messages 
            ORDER BY id DESC 
            LIMIT 50
          ) 
          ORDER BY id ASC
        `);
        return cursor.toArray() as unknown as ChatMessage[];
      }
    } catch (err) {
      console.error("Erro ao recuperar histórico do SQLite:", err);
    }
    return [];
  }

  // Persiste uma mensagem no SQLite interno do Durable Object
  private saveMessage(msg: ChatMessage): ChatMessage {
    try {
      if (this.ctx.storage.sql) {
        this.ctx.storage.sql.exec(
          `INSERT INTO messages (sender_id, sender_username, content, message_type, media_url, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          msg.sender_id,
          msg.sender_username,
          msg.content,
          msg.message_type || 'text',
          msg.media_url || null,
          msg.created_at
        );
      }
    } catch (err) {
      console.error("Erro ao persistir mensagem no SQLite:", err);
    }
    return msg;
  }

  // Endpoint de conexão WebSocket com Hibernação
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("ChatRoom Durable Object: requisição requer Upgrade: websocket", {
        status: 426,
      });
    }

    // Cria o par de WebSockets
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Habilita a Hibernação de WebSocket para economizar recursos (o DO dorme enquanto ocioso)
    this.ctx.acceptWebSocket(server);

    // Envia o histórico das últimas 50 mensagens para o cliente recém-conectado
    const history = this.getRecentMessages();
    server.send(
      JSON.stringify({
        type: "history",
        messages: history,
      })
    );

    const wsProtocol = request.headers.get("Sec-WebSocket-Protocol");
    const headers: Record<string, string> = {};
    if (wsProtocol) {
      headers["Sec-WebSocket-Protocol"] = wsProtocol;
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers,
    });
  }

  // Chamado quando uma mensagem é recebida de qualquer cliente conectado
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
      const data = JSON.parse(raw);

      // Tratamento de mensagens de chat (texto, fotos, vídeos, arquivos, localização, gifs, stickers)
      const isChatMessage =
        data.type === "message" ||
        data.message_type ||
        data.media_url ||
        data.text !== undefined ||
        data.content !== undefined;

      if (isChatMessage && data.type !== "typing" && data.type !== "ping") {
        const rawContent = String(data.content || data.text || "").trim();
        const rawType = (data.message_type || (data.type !== "message" ? data.type : "text")) as ChatMessageType;
        const validTypes: ChatMessageType[] = [
          'text',
          'image',
          'video',
          'file',
          'location',
          'gif',
          'sticker',
        ];
        const messageType: ChatMessageType = validTypes.includes(rawType) ? rawType : 'text';
        const mediaUrl = data.media_url ? String(data.media_url).trim() : null;

        // Aceita se tiver texto OU se tiver URL de mídia (ou for localização)
        if (rawContent.length > 0 || mediaUrl) {
          const newMsg: ChatMessage = {
            sender_id: Number(data.sender_id || 0),
            sender_username: String(data.sender_username || "Usuário"),
            content: rawContent || (messageType === 'location' ? 'Localização compartilhada' : ''),
            message_type: messageType,
            media_url: mediaUrl,
            created_at: data.created_at || new Date().toISOString(),
          };

          // 1. Salva no SQLite interno do Durable Object
          this.saveMessage(newMsg);

          // 2. Faz o broadcast para todos os conectados na sala
          const payload = JSON.stringify({
            type: "message",
            message: newMsg,
          });

          const connectedSockets = this.ctx.getWebSockets();
          for (const client of connectedSockets) {
            try {
              client.send(payload);
            } catch (sendErr) {
              console.error("Erro ao enviar mensagem para socket conectado:", sendErr);
            }
          }
        }
      } else if (data.type === "typing") {
        // Broadcast de status de digitação para os outros participantes da sala
        const payload = JSON.stringify({
          type: "typing",
          sender_id: Number(data.sender_id || 0),
          is_typing: !!data.is_typing,
        });
        const connectedSockets = this.ctx.getWebSockets();
        for (const client of connectedSockets) {
          if (client !== ws) {
            try {
              client.send(payload);
            } catch {}
          }
        }
      } else if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      }
    } catch (err) {
      console.error("Erro ao processar mensagem do WebSocket:", err);
      try {
        ws.send(JSON.stringify({ type: "error", error: "Falha ao processar mensagem enviada" }));
      } catch {}
    }
  }

  // Chamado quando a conexão WebSocket é encerrada
  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ): Promise<void> {
    try {
      ws.close(code, "ChatRoom fechando conexão");
    } catch {}
  }

  // Chamado se ocorrer erro na conexão WebSocket
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.warn("WebSocket erro no ChatRoom:", error);
    try {
      ws.close(1011, "Erro inesperado");
    } catch {}
  }
}
