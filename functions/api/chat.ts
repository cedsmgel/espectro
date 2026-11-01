import { verifyJWT, errorResponse, getJwtSecret, areFriends, serverError, isBlockedBetween } from "../_shared/auth";
import type { UserPayload } from "../_shared/auth";
import { groupRoomName } from "../_shared/chat";
import { membership } from "../_shared/groups";
import { suspensionOf } from "../_shared/suspension";

export interface Env {
  CHAT_ROOMS: DurableObjectNamespace;
  DB: D1Database;
  JWT_SECRET: string;
}

// Autenticação via JWT (suporta Header Authorization, Query param ?token= ou Sec-WebSocket-Protocol)
function extractToken(request: Request, url: URL): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) return authHeader.substring(7).trim();
  if (url.searchParams.has("token")) return url.searchParams.get("token");
  const wsProtocol = request.headers.get("Sec-WebSocket-Protocol");
  return wsProtocol ? wsProtocol.trim() : null;
}

// Repassa ao Durable Object com a identidade vinda do JWT (nunca do cliente)
function forwardToRoom(env: Env, request: Request, url: URL, roomName: string, authUser: UserPayload, peerId?: number): Promise<Response> {
  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.delete("X-Chat-User-Id");
  forwardHeaders.delete("X-Chat-Username");
  forwardHeaders.delete("X-Chat-Peer-Id");
  forwardHeaders.delete("Authorization");
  forwardHeaders.set("X-Chat-User-Id", String(authUser.id));
  forwardHeaders.set("X-Chat-Username", authUser.username);
  if (peerId !== undefined) forwardHeaders.set("X-Chat-Peer-Id", String(peerId));

  url.searchParams.delete("token");
  const forwarded = new Request(url.toString(), { method: "GET", headers: forwardHeaders });
  return env.CHAT_ROOMS.get(env.CHAT_ROOMS.idFromName(roomName)).fetch(forwarded);
}

// Valida o token e a suspensão (o middleware só olha o header Authorization, e o socket usa ?token=)
async function authenticate(env: Env, request: Request, url: URL): Promise<UserPayload | Response> {
  const token = extractToken(request, url);
  if (!token) {
    return errorResponse("Não autorizado. Forneça o token JWT válido para conectar ao chat.", 401);
  }
  const authUser = await verifyJWT(token, getJwtSecret(env));
  if (!authUser) {
    return errorResponse("Não autorizado. Token JWT inválido ou expirado.", 401);
  }
  if ((await suspensionOf(env.DB, authUser.id)).suspended) {
    return errorResponse("Sua conta foi suspensa.", 403);
  }
  return authUser;
}

// Sala de um grupo: só quem é membro conecta
async function connectToGroup(env: Env, request: Request, url: URL, groupParam: string): Promise<Response> {
  const groupId = parseInt(groupParam, 10);
  if (isNaN(groupId) || groupId <= 0) {
    return errorResponse("Identificador de grupo inválido.", 400);
  }

  const authUser = await authenticate(env, request, url);
  if (authUser instanceof Response) return authUser;

  if (!(await membership(env.DB, groupId, authUser.id))) {
    return errorResponse("Acesso proibido. Você não é membro deste grupo.", 403);
  }
  if (!env.CHAT_ROOMS) {
    return errorResponse("Binding CHAT_ROOMS não configurado no ambiente.", 500);
  }
  return forwardToRoom(env, request, url, groupRoomName(groupId), authUser);
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const url = new URL(request.url);

    const groupParam = url.searchParams.get("group");
    if (groupParam !== null) {
      return await connectToGroup(env, request, url, groupParam);
    }

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

    // 2. Autenticação
    const authUser = await authenticate(env, request, url);
    if (authUser instanceof Response) return authUser;

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
    if (await isBlockedBetween(env.DB, authUser.id, otherId)) {
      return errorResponse("Você não pode conversar com este usuário.", 403);
    }
    if (!(await areFriends(env.DB, authUser.id, otherId))) {
      return errorResponse("Você só pode conversar com seus amigos.", 403);
    }

    // 6. Repassa ao Durable Object
    return forwardToRoom(env, request, url, conversationId, authUser, otherId);
  } catch (err: unknown) {
    return serverError(err, "chat");
  }
};
