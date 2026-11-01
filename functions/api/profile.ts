import { getAuthUser, signJWT, jsonResponse, errorResponse, getJwtSecret, serverError, sanitizeMediaUrl } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  MEDIA_BUCKET?: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const targetUsername = url.searchParams.get("username");
    const secret = getJwtSecret(env);

    // 1. Busca perfil público por nome de usuário (?username=...)
    if (targetUsername) {
      const user = await env.DB.prepare(
        "SELECT id, username, name, bio, avatar_url, music, is_private, allow_scraps, created_at FROM users WHERE username = ? COLLATE NOCASE"
      )
        .bind(targetUsername.trim())
        .first<any>();

      if (!user) {
        return errorResponse("Usuário não encontrado.", 404);
      }

      const auth = await getAuthUser(request, secret);
      const isSelf = auth && auth.id === user.id;

      let isFriend = false;
      if (auth && !isSelf) {
        const friendship = await env.DB.prepare(
          "SELECT id FROM friendships WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND status = 'accepted'"
        )
          .bind(auth.id, user.id, user.id, auth.id)
          .first();
        isFriend = Boolean(friendship);
      }

      return jsonResponse({
        user: {
          ...user,
          is_private: Boolean(user.is_private),
          allow_scraps: Boolean(user.allow_scraps ?? 1),
          is_friend: isFriend,
          is_self: Boolean(isSelf),
        },
      });
    }

    // 2. Busca perfil privado do usuário logado (via token JWT)
    const auth = await getAuthUser(request, secret);
    if (!auth) {
      return errorResponse("Não autenticado. Forneça um token válido.", 401);
    }

    const user = await env.DB.prepare(
      "SELECT id, username, email, name, bio, avatar_url, music, is_private, allow_scraps, created_at FROM users WHERE id = ?"
    )
      .bind(auth.id)
      .first<any>();

    if (!user) {
      return errorResponse("Conta de usuário não encontrada no banco de dados.", 404);
    }

    return jsonResponse({
      user: {
        ...user,
        is_private: Boolean(user.is_private),
        allow_scraps: Boolean(user.allow_scraps ?? 1),
        is_friend: true,
        is_self: true,
      },
    });
  } catch (err: any) {
    return serverError(err, "profile");
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = getJwtSecret(env);

    // 1. Validação do JWT
    const auth = await getAuthUser(request, secret);
    if (!auth) {
      return errorResponse("Não autorizado. Faça login para atualizar seu perfil.", 401);
    }

    // 2. Extração dos dados enviados
    const body: any = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorResponse("Corpo da requisição inválido.", 400);
    }

    const current = await env.DB.prepare(
      "SELECT name, bio, avatar_url, music FROM users WHERE id = ?"
    )
      .bind(auth.id)
      .first<{ name: string | null; bio: string | null; avatar_url: string | null; music: string | null }>();
    if (!current) {
      return errorResponse("Conta de usuário não encontrada.", 404);
    }

    const textField = (value: unknown, previous: string | null, max: number, label: string) => {
      if (value === undefined) return { value: previous };
      if (value === null || value === "") return { value: null };
      const text = String(value).trim();
      if (text.length > max) return { error: `${label} deve ter no máximo ${max} caracteres.` };
      return { value: text || null };
    };

    const rawUsername = body.username ? String(body.username).trim() : auth.username;
    const nameField = textField(body.name, current.name, 50, "O nome");
    const bioField = textField(body.bio, current.bio, 160, "A bio");
    const musicField = textField(body.music, current.music, 200, "A música");
    const fieldError = nameField.error || bioField.error || musicField.error;
    if (fieldError) {
      return errorResponse(fieldError, 400);
    }
    const rawName = nameField.value ?? null;
    const rawBio = bioField.value ?? null;
    const rawMusic = musicField.value ?? null;

    let rawAvatarUrl: string | null = current.avatar_url;
    if (body.avatar_url !== undefined) {
      if (!body.avatar_url) {
        rawAvatarUrl = null;
      } else {
        rawAvatarUrl = sanitizeMediaUrl(body.avatar_url);
        if (!rawAvatarUrl) {
          return errorResponse("URL do avatar inválida.", 400);
        }
      }
    }

    // 3. Validação do nome de usuário
    if (!rawUsername || rawUsername.length < 3 || rawUsername.length > 30) {
      return errorResponse("O nome de usuário deve ter entre 3 e 30 caracteres.", 400);
    }
    if (!/^[a-zA-Z0-9_]+$/.test(rawUsername)) {
      return errorResponse("O nome de usuário só pode conter letras, números e underlines.", 400);
    }

    // 4. Verifica se o username já está em uso por outro usuário
    const existing = await env.DB.prepare(
      "SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?"
    )
      .bind(rawUsername, auth.id)
      .first();

    if (existing) {
      return errorResponse("Este nome de usuário já está em uso por outro membro.", 400);
    }

    // 5. Atualização dos dados no D1
    await env.DB.prepare(
      `UPDATE users 
       SET name = ?, username = ?, bio = ?, avatar_url = ?, music = ?
       WHERE id = ?`
    )
      .bind(rawName, rawUsername, rawBio, rawAvatarUrl, rawMusic, auth.id)
      .run();

    // 6. Busca os dados atualizados
    const updatedUser = await env.DB.prepare(
      "SELECT id, username, email, name, bio, avatar_url, music, is_private, allow_scraps, created_at FROM users WHERE id = ?"
    )
      .bind(auth.id)
      .first();

    // 7. Se o username mudou, gera novo JWT para manter a sessão sincronizada
    let newToken: string | undefined;
    if (rawUsername.toLowerCase() !== auth.username.toLowerCase()) {
      newToken = await signJWT({ id: auth.id, username: rawUsername }, secret);
    }

    return jsonResponse({
      message: "Perfil atualizado com sucesso!",
      user: updatedUser,
      token: newToken,
    });
  } catch (err: any) {
    return serverError(err, "profile");
  }
};

