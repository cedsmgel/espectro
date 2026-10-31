import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET: lista membros de uma comunidade ou verifica status de membro
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const communityId = url.searchParams.get("community_id");
    const secret = getJwtSecret(env);

    if (!communityId) {
      return errorResponse("O parâmetro community_id é obrigatório.", 400);
    }

    const commId = Number(communityId);
    const authUser = await getAuthUser(request, secret);

    // Consulta se o usuário autenticado é membro
    let isMember = false;
    if (authUser) {
      const membership = await env.DB.prepare(
        "SELECT 1 FROM community_members WHERE user_id = ? AND community_id = ?"
      )
        .bind(authUser.id, commId)
        .first();
      isMember = !!membership;
    }

    // Lista membros da comunidade
    const membersQuery = `
      SELECT 
        cm.id,
        cm.user_id,
        cm.community_id,
        cm.joined_at,
        u.username,
        u.avatar_url
      FROM community_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.community_id = ?
      ORDER BY cm.id DESC
      LIMIT 100
    `;

    const { results } = await env.DB.prepare(membersQuery).bind(commId).all();

    return jsonResponse({
      community_id: commId,
      members_count: results ? results.length : 0,
      is_member: isMember,
      members: results || [],
    });
  } catch (err: unknown) {
    return serverError(err, "community_members");
  }
};

// POST: Entrar na Comunidade (Insere na tabela community_members do D1)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = getJwtSecret(env);

    // Validação de autenticação
    const user = await getAuthUser(request, secret);
    if (!user) {
      return errorResponse("Não autorizado. Faça login para entrar na comunidade.", 401);
    }

    let body: {
      community_id?: number;
      community_slug?: string;
    };

    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    let commId = body.community_id ? Number(body.community_id) : null;

    // Se passou slug, busca o ID da comunidade correspondente
    if (!commId && body.community_slug) {
      const comm = await env.DB.prepare(
        "SELECT id FROM communities WHERE slug = ? OR CAST(id AS TEXT) = ?"
      )
        .bind(body.community_slug, body.community_slug)
        .first<{ id: number }>();
      if (comm) commId = comm.id;
    }

    if (!commId) {
      return errorResponse("ID ou slug da comunidade é obrigatório.", 400);
    }

    // Verifica se a comunidade existe
    const community = await env.DB.prepare("SELECT id, name FROM communities WHERE id = ?")
      .bind(commId)
      .first<{ id: number; name: string }>();

    if (!community) {
      return errorResponse("Comunidade não encontrada.", 404);
    }

    // Insere na tabela community_members (INSERT OR IGNORE para evitar duplicações)
    await env.DB.prepare(
      "INSERT OR IGNORE INTO community_members (user_id, community_id) VALUES (?, ?)"
    )
      .bind(user.id, commId)
      .run();

    // Conta o total atualizado de membros
    const countResult = await env.DB.prepare(
      "SELECT COUNT(1) AS total FROM community_members WHERE community_id = ?"
    )
      .bind(commId)
      .first<{ total: number }>();

    return jsonResponse({
      message: `Você entrou na comunidade e/${community.name}!`,
      community_id: commId,
      is_member: true,
      members_count: countResult ? countResult.total : 1,
    });
  } catch (err: unknown) {
    return serverError(err, "community_members");
  }
};

// DELETE: Sair da Comunidade
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = getJwtSecret(env);

    const user = await getAuthUser(request, secret);
    if (!user) {
      return errorResponse("Não autorizado.", 401);
    }

    const url = new URL(request.url);
    const commId = Number(url.searchParams.get("community_id"));

    if (!commId) {
      return errorResponse("Parâmetro community_id obrigatório.", 400);
    }

    await env.DB.prepare(
      "DELETE FROM community_members WHERE user_id = ? AND community_id = ?"
    )
      .bind(user.id, commId)
      .run();

    const countResult = await env.DB.prepare(
      "SELECT COUNT(1) AS total FROM community_members WHERE community_id = ?"
    )
      .bind(commId)
      .first<{ total: number }>();

    return jsonResponse({
      message: "Você saiu da comunidade.",
      community_id: commId,
      is_member: false,
      members_count: countResult ? countResult.total : 0,
    });
  } catch (err: unknown) {
    return serverError(err, "community_members");
  }
};
