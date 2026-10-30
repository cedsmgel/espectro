export interface ChatMessage {
  id?: number;
  sender_id: number;
  sender_username: string;
  content: string;
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
              created_at TEXT NOT NULL
            );
          `);
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
          SELECT id, sender_id, sender_username, content, created_at 
          FROM (
            SELECT id, sender_id, sender_username, content, created_at 
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
          `INSERT INTO messages (sender_id, sender_username, content, created_at) VALUES (?, ?, ?, ?)`,
          msg.sender_id,
          msg.sender_username,
          msg.content,
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

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // Chamado quando uma mensagem é recebida de qualquer cliente conectado
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
      const data = JSON.parse(raw);

      // Tratamento de novas mensagens de chat
      if (data.type === "message" || data.content) {
        const newMsg: ChatMessage = {
          sender_id: Number(data.sender_id || 0),
          sender_username: String(data.sender_username || "Usuário"),
          content: String(data.content || "").trim(),
          created_at: data.created_at || new Date().toISOString(),
        };

        if (newMsg.content.length > 0) {
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
      } else if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      }
    } catch (err) {
      console.error("Erro ao processar mensagem do WebSocket:", err);
      try {
        ws.send(JSON.stringify({ type: "error", message: "Formato JSON inválido." }));
      } catch {}
    }
  }

  // Chamado quando um cliente desconecta
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    try {
      ws.close(code, reason || "Conexão encerrada.");
    } catch {
      // Socket pode já ter sido fechado
    }
  }

  // Tratamento de erros de conexão
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error("Erro na conexão WebSocket:", error);
    try {
      ws.close(1011, "Erro interno de WebSocket.");
    } catch {}
  }
}
