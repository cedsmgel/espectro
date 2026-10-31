import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env, params } = context;
    const targetUsername = typeof params.username === "string" ? params.username : "";
    const secret = getJwtSecret(env);

    if (!targetUsername.trim()) {
      return errorResponse("Nome de usuário não informado.", 400);
    }

    // 1. Busca dados do usuário pelo nome de usuário
    const user = await env.DB.prepare(`
      SELECT id, username, name, bio, avatar_url, music, is_private, allow_scraps, created_at
      FROM users
      WHERE username = ? COLLATE NOCASE
    `)
      .bind(targetUsername.trim())
      .first<any>();

    if (!user) {
      return errorResponse("Usuário não encontrado.", 404);
    }

    // 2. Verifica autenticação do solicitante para status de amizade
    const auth = await getAuthUser(request, secret);
    const isSelf = auth && auth.id === user.id;

    let isFriend = false;
    let friendshipStatus: string | null = null;

    if (auth && !isSelf) {
      const friendship = await env.DB.prepare(`
        SELECT status FROM friendships
        WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
        LIMIT 1
      `)
        .bind(auth.id, user.id, user.id, auth.id)
        .first<{ status: string }>();

      if (friendship) {
        friendshipStatus = friendship.status;
        isFriend = friendship.status === "accepted";
      }
    }

    // 3. Busca comunidades das quais o usuário participa
    const { results: communities } = await env.DB.prepare(`
      SELECT c.id, c.name, c.slug, c.description, c.icon_color,
             (SELECT COUNT(*) FROM community_members cm2 WHERE cm2.community_id = c.id) AS members_count
      FROM community_members cm
      JOIN communities c ON cm.community_id = c.id
      WHERE cm.user_id = ?
      ORDER BY cm.joined_at DESC
      LIMIT 12
    `)
      .bind(user.id)
      .all<any>();

    return jsonResponse({
      user: {
        ...user,
        is_private: Boolean(user.is_private),
        allow_scraps: Boolean(user.allow_scraps ?? 1),
        is_friend: isFriend,
        is_self: Boolean(isSelf),
        friendship_status: friendshipStatus,
      },
      communities: communities || [],
    });
  } catch (err: any) {
    return serverError(err, "users/[username]");
  }
};
