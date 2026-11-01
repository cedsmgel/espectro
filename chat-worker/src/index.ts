// Relay em tempo real: as mensagens são gravadas no D1 pelas Functions (/api/direct_messages);
// este Durable Object só entrega eventos aos sockets conectados e repassa "digitando".

interface SocketIdentity {
  id: number;
  username: string;
}

interface BroadcastBody {
  event?: Record<string, unknown>;
  deliveredTo?: number | null;
  kick?: number | null;
}

export default {
  async fetch(): Promise<Response> {
    return new Response('Not found', { status: 404 });
  },
};

export class ChatRoom implements DurableObject {
  ctx: DurableObjectState;
  env: unknown;

  constructor(ctx: DurableObjectState, env: unknown) {
    this.ctx = ctx;
    this.env = env;
  }

  private broadcast(payload: string, except?: WebSocket) {
    for (const client of this.ctx.getWebSockets()) {
      if (client === except) continue;
      try {
        client.send(payload);
      } catch {}
    }
  }

  // Fecha as conexões de um usuário (ex.: saiu ou foi removido do grupo)
  private disconnectUser(userId: number) {
    for (const socket of this.ctx.getWebSockets()) {
      const identity = socket.deserializeAttachment() as SocketIdentity | null;
      if (identity?.id !== userId) continue;
      try {
        socket.close(1008, 'Removido do grupo');
      } catch {}
    }
  }

  private hasUserConnected(userId: number): boolean {
    return this.ctx.getWebSockets().some((socket) => {
      const identity = socket.deserializeAttachment() as SocketIdentity | null;
      return identity?.id === userId;
    });
  }

  async fetch(request: Request): Promise<Response> {
    // Eventos vindos do servidor (Pages Functions) após gravar no D1
    if (request.method === 'POST' && request.headers.get('X-Internal-Broadcast') === '1') {
      const body = (await request.json().catch(() => null)) as BroadcastBody | null;
      if (!body || typeof body !== 'object') {
        return new Response('Bad request', { status: 400 });
      }
      if (typeof body.kick === 'number') {
        this.disconnectUser(body.kick);
        if (!body.event) return Response.json({ delivered: false });
      }
      if (!body.event || typeof body.event !== 'object') {
        return new Response('Bad request', { status: 400 });
      }

      const delivered =
        typeof body.deliveredTo === 'number' ? this.hasUserConnected(body.deliveredTo) : false;

      const event =
        body.event.type === 'message' && delivered
          ? { ...body.event, message: { ...(body.event.message as object), status: 'delivered' } }
          : body.event;

      this.broadcast(JSON.stringify(event));
      return Response.json({ delivered });
    }

    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('ChatRoom Durable Object: requisição requer Upgrade: websocket', {
        status: 426,
      });
    }

    // A identidade vem exclusivamente dos headers injetados por /api/chat após validar o JWT
    const userId = Number(request.headers.get('X-Chat-User-Id'));
    const username = request.headers.get('X-Chat-Username');
    if (!Number.isInteger(userId) || userId <= 0 || !username) {
      return new Response('Não autorizado', { status: 401 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: userId, username } satisfies SocketIdentity);

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
      if (raw.length > 1024) return;
      const data = JSON.parse(raw);

      if (data.type === 'typing') {
        this.broadcast(
          JSON.stringify({ type: 'typing', sender_id: identity.id, is_typing: !!data.is_typing }),
          ws
        );
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      } else {
        ws.send(
          JSON.stringify({ type: 'error', error: 'Atualize a página para continuar usando o chat.' })
        );
      }
    } catch (err) {
      console.error('Erro ao processar mensagem do WebSocket:', err);
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
