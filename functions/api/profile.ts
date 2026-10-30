import { getAuthUser, signJWT, jsonResponse, errorResponse } from "../_shared/auth";

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
    const secret = env.JWT_SECRET || "troque-este-segredo";

    // 1. Busca perfil público por nome de usuário (?username=...)
    if (targetUsername) {
      const user = await env.DB.prepare(
        "SELECT id, username, name, bio, avatar_url, created_at FROM users WHERE username = ? COLLATE NOCASE"
      )
        .bind(targetUsername.trim())
        .first();

      if (!user) {
        return errorResponse("Usuário não encontrado.", 404);
      }

      return jsonResponse({ user });
    }

    // 2. Busca perfil privado do usuário logado (via token JWT)
    const auth = await getAuthUser(request, secret);
    if (!auth) {
      return errorResponse("Não autenticado. Forneça um token válido.", 401);
    }

    const user = await env.DB.prepare(
      "SELECT id, username, email, name, bio, avatar_url, created_at FROM users WHERE id = ?"
    )
      .bind(auth.id)
      .first();

    if (!user) {
      return errorResponse("Conta de usuário não encontrada no banco de dados.", 404);
    }

    return jsonResponse({ user });
  } catch (err: any) {
    return errorResponse(`Erro ao recuperar perfil: ${err.message || String(err)}`, 500);
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = env.JWT_SECRET || "troque-este-segredo";

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

    const rawUsername = body.username ? String(body.username).trim() : auth.username;
    const rawName = body.name !== undefined ? (body.name ? String(body.name).trim() : null) : null;
    const rawBio = body.bio !== undefined ? (body.bio ? String(body.bio).trim() : null) : null;
    const rawAvatarUrl = body.avatar_url !== undefined ? (body.avatar_url ? String(body.avatar_url).trim() : null) : null;

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
       SET name = ?, username = ?, bio = ?, avatar_url = ? 
       WHERE id = ?`
    )
      .bind(rawName, rawUsername, rawBio, rawAvatarUrl, auth.id)
      .run();

    // 6. Busca os dados atualizados
    const updatedUser = await env.DB.prepare(
      "SELECT id, username, email, name, bio, avatar_url, created_at FROM users WHERE id = ?"
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
    return errorResponse(`Erro ao atualizar perfil: ${err.message || String(err)}`, 500);
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
};
