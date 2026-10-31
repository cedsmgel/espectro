import { verifyJWT, errorResponse, getJwtSecret, areFriends, serverError } from "../_shared/auth";

export interface Env {
  CHAT_ROOMS: DurableObjectNamespace;
  DB: D1Database;
  JWT_SECRET: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const url = new URL(request.url);

    // 1. Extração dos identificadores dos participantes da conversa
    const user1Param = url.searchParams.get("user1");
    const user2Param = url.searchParams.get("user2");

    if (!user1Param || !user2Param) {
      return errorResponse("Os parâmetros user1 e user2 são obrigatórios na requisição.", 400);
    }

    const u1 = parseInt(user1Param, 10);
    const u2 = parseInt(user2Param, 10);

    if (isNaN(u1) || isNaN(u2) || u1 === u2) {
      return errorResponse("Identificadores de usuários inválidos para a sala de chat.", 400);
    }

    // 2. Autenticação via JWT (suporta Header Authorization, Query param ?token= ou Sec-WebSocket-Protocol)
    const secret = getJwtSecret(env);
    let token: string | null = null;

    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else if (url.searchParams.has("token")) {
      token = url.searchParams.get("token");
    } else {
      const wsProtocol = request.headers.get("Sec-WebSocket-Protocol");
      if (wsProtocol) {
        token = wsProtocol.trim();
      }
    }

    if (!token) {
      return errorResponse("Não autorizado. Forneça o token JWT válido para conectar ao chat.", 401);
    }

    const authUser = await verifyJWT(token, secret);
    if (!authUser) {
      return errorResponse("Não autorizado. Token JWT inválido ou expirado.", 401);
    }

    // 3. Validação de segurança: apenas os dois usuários da conversa podem se conectar
    if (authUser.id !== u1 && authUser.id !== u2) {
      return errorResponse("Acesso proibido. Você não é participante desta conversa privada.", 403);
    }

    // 4. Geração de ID determinístico único para a conversa (ex: chat_1_2)
    const [minId, maxId] = [u1, u2].sort((a, b) => a - b);
    const conversationId = `chat_${minId}_${maxId}`;

    if (!env.CHAT_ROOMS) {
      return errorResponse("Binding CHAT_ROOMS não configurado no ambiente.", 500);
    }

    // 5. Apenas amigos podem conversar
    const otherId = authUser.id === u1 ? u2 : u1;
    if (!(await areFriends(env.DB, authUser.id, otherId))) {
      return errorResponse("Você só pode conversar com seus amigos.", 403);
    }

    // 6. Repassa ao Durable Object com a identidade vinda do JWT (nunca do cliente)
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.delete("X-Chat-User-Id");
    forwardHeaders.delete("X-Chat-Username");
    forwardHeaders.delete("Authorization");
    forwardHeaders.set("X-Chat-User-Id", String(authUser.id));
    forwardHeaders.set("X-Chat-Username", authUser.username);
    forwardHeaders.set("X-Chat-Peer-Id", String(otherId));

    url.searchParams.delete("token");
    const forwarded = new Request(url.toString(), { method: "GET", headers: forwardHeaders });

    const id = env.CHAT_ROOMS.idFromName(conversationId);
    return env.CHAT_ROOMS.get(id).fetch(forwarded);
  } catch (err: unknown) {
    return serverError(err, "chat");
  }
};
