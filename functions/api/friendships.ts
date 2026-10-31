import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError, rateLimit } from "../_shared/auth";
import { pushFriendRequest, type PushEnv } from "../_shared/push";

export interface Env extends PushEnv {
  JWT_SECRET: string;
}

// GET: lista amigos ou pesquisa usuários para adicionar
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = getJwtSecret(env);
    const user = await getAuthUser(request, secret);

    if (!user) {
      return errorResponse("Não autorizado. Faça login.", 401);
    }


    const url = new URL(request.url);
    const search = url.searchParams.get("search");

    // Pesquisar novos usuários para adicionar como amigos
    if (search && search.trim().length > 0) {
      const q = `%${search.trim().toLowerCase()}%`;
      const usersQuery = `
        SELECT 
          u.id, 
          u.username, 
          u.avatar_url,
          (
            SELECT status FROM friendships f 
            WHERE (f.user_id = ? AND f.friend_id = u.id) 
               OR (f.user_id = u.id AND f.friend_id = ?)
            LIMIT 1
          ) AS friendship_status,
          (
            SELECT f.user_id FROM friendships f
            WHERE (f.user_id = ? AND f.friend_id = u.id)
               OR (f.user_id = u.id AND f.friend_id = ?)
            LIMIT 1
          ) AS friendship_from
        FROM users u
        WHERE u.id != ? AND LOWER(u.username) LIKE ?
        LIMIT 20
      `;

      const { results } = await env.DB.prepare(usersQuery)
        .bind(user.id, user.id, user.id, user.id, user.id, q)
        .all();

      return jsonResponse(results || []);
    }

    // Pedidos de amizade recebidos aguardando aceite
    if (url.searchParams.get("pending") === "1") {
      const { results } = await env.DB.prepare(`
        SELECT f.id AS friendship_id, f.created_at, u.id AS friend_id, u.username, u.avatar_url, f.status
        FROM friendships f
        JOIN users u ON f.user_id = u.id
        WHERE f.friend_id = ? AND f.status = 'pending'
        ORDER BY f.id DESC
      `)
        .bind(user.id)
        .all();
      return jsonResponse(results || []);
    }

    // Lista de amigos do usuário logado
    const friendsQuery = `
      SELECT 
        f.id AS friendship_id,
        f.status,
        f.created_at,
        CASE WHEN f.user_id = ? THEN u2.id ELSE u1.id END AS friend_id,
        CASE WHEN f.user_id = ? THEN u2.username ELSE u1.username END AS username,
        CASE WHEN f.user_id = ? THEN u2.avatar_url ELSE u1.avatar_url END AS avatar_url
      FROM friendships f
      JOIN users u1 ON f.user_id = u1.id
      JOIN users u2 ON f.friend_id = u2.id
      WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
      ORDER BY f.id DESC
    `;

    const { results } = await env.DB.prepare(friendsQuery)
      .bind(user.id, user.id, user.id, user.id, user.id)
      .all();

    return jsonResponse(results || []);
  } catch (err: unknown) {
    return serverError(err, "friendships");
  }
};

// POST: adicionar amigo / aceitar amizade
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = getJwtSecret(env);
    const user = await getAuthUser(request, secret);

    if (!user) {
      return errorResponse("Não autorizado. Faça login para adicionar amigos.", 401);
    }


    const limited = await rateLimit(env.DB, request, "friend-request", 30, 3600, user.id);
    if (limited) return limited;

    let body: {
      friend_id?: number;
      friend_username?: string;
    };

    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    let targetFriendId = body.friend_id ? Number(body.friend_id) : null;

    if (!targetFriendId && body.friend_username) {
      const targetUser = await env.DB.prepare("SELECT id FROM users WHERE LOWER(username) = ?")
        .bind(body.friend_username.trim().toLowerCase())
        .first<{ id: number }>();
      if (targetUser) targetFriendId = targetUser.id;
    }

    if (!targetFriendId) {
      return errorResponse("ID ou nome de usuário do amigo é obrigatório.", 400);
    }

    if (targetFriendId === user.id) {
      return errorResponse("Você não pode adicionar a si mesmo como amigo.", 400);
    }

    // Verifica se o usuário alvo existe
    const target = await env.DB.prepare("SELECT id, username FROM users WHERE id = ?")
      .bind(targetFriendId)
      .first<{ id: number; username: string }>();

    if (!target) {
      return errorResponse("Usuário não encontrado.", 404);
    }

    const existing = await env.DB.prepare(`
      SELECT id, user_id, status FROM friendships
      WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
      LIMIT 1
    `)
      .bind(user.id, targetFriendId, targetFriendId, user.id)
      .first<{ id: number; user_id: number; status: string }>();

    const friendPayload = (status: string) => ({
      id: target.id,
      username: target.username,
      status,
    });

    if (existing?.status === "accepted") {
      return jsonResponse({
        message: `Você já é amigo de @${target.username}.`,
        friend: friendPayload("accepted"),
      });
    }

    if (existing?.status === "blocked") {
      return errorResponse("Não foi possível enviar o pedido de amizade.", 403);
    }

    // O alvo já havia pedido amizade: este POST é o aceite
    if (existing && existing.user_id === targetFriendId) {
      await env.DB.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ?")
        .bind(existing.id)
        .run();
      return jsonResponse({
        message: `Você agora é amigo de @${target.username}!`,
        friend: friendPayload("accepted"),
      });
    }

    if (existing) {
      return jsonResponse({
        message: `Pedido de amizade para @${target.username} já enviado. Aguardando aceite.`,
        friend: friendPayload("pending"),
      });
    }

    await env.DB.prepare(
      "INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, 'pending')"
    )
      .bind(user.id, targetFriendId)
      .run();

    context.waitUntil(pushFriendRequest(env, user, targetFriendId));

    return jsonResponse({
      message: `Pedido de amizade enviado para @${target.username}. Aguardando aceite.`,
      friend: friendPayload("pending"),
    });
  } catch (err: unknown) {
    return serverError(err, "friendships");
  }
};

// DELETE: remover amigo
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = getJwtSecret(env);
    const user = await getAuthUser(request, secret);

    if (!user) {
      return errorResponse("Não autorizado.", 401);
    }

    const url = new URL(request.url);
    const friendId = Number(url.searchParams.get("friend_id"));

    if (!friendId) {
      return errorResponse("Parâmetro friend_id é obrigatório.", 400);
    }

    await env.DB.prepare(`
      DELETE FROM friendships 
      WHERE (user_id = ? AND friend_id = ?) 
         OR (user_id = ? AND friend_id = ?)
    `)
      .bind(user.id, friendId, friendId, user.id)
      .run();

    return jsonResponse({ message: "Amizade removida com sucesso." });
  } catch (err: unknown) {
    return serverError(err, "friendships");
  }
};
