import { getAuthUser, jsonResponse, errorResponse } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// Helper para gerar slug amigável
function generateSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `comunidade-${Date.now()}`
  );
}

// GET: lista todas as comunidades ou busca uma única por slug/id
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    const id = url.searchParams.get("id");
    const secret = env.JWT_SECRET || "troque-este-segredo";

    const authUser = await getAuthUser(request, secret);
    const authUserId = authUser ? authUser.id : -1;

    if (slug || id) {
      const param = slug || id || "";
      const singleQuery = `
        SELECT 
          c.id,
          c.name,
          c.slug,
          c.description,
          c.owner_id,
          c.created_at,
          u.username AS owner_name,
          COUNT(DISTINCT cm.user_id) AS members_count,
          (SELECT COUNT(1) FROM community_members WHERE community_members.community_id = c.id AND community_members.user_id = ?) > 0 AS is_member
        FROM communities c
        JOIN users u ON c.owner_id = u.id
        LEFT JOIN community_members cm ON c.id = cm.community_id
        WHERE c.slug = ? OR CAST(c.id AS TEXT) = ?
        GROUP BY c.id, c.name, c.slug, c.description, c.owner_id, c.created_at, u.username
      `;

      const community = await env.DB.prepare(singleQuery)
        .bind(authUserId, param, param)
        .first();

      if (!community) {
        return errorResponse("Comunidade não encontrada.", 404);
      }

      return jsonResponse({
        ...community,
        is_member: Boolean((community as any).is_member),
      });
    }

    const query = `
      SELECT 
        c.id,
        c.name,
        c.slug,
        c.description,
        c.owner_id,
        c.created_at,
        u.username AS owner_name,
        COUNT(DISTINCT cm.user_id) AS members_count,
        (SELECT COUNT(1) FROM community_members WHERE community_members.community_id = c.id AND community_members.user_id = ?) > 0 AS is_member
      FROM communities c
      JOIN users u ON c.owner_id = u.id
      LEFT JOIN community_members cm ON c.id = cm.community_id
      GROUP BY c.id, c.name, c.slug, c.description, c.owner_id, c.created_at, u.username
      ORDER BY members_count DESC, c.id DESC
    `;

    const { results } = await env.DB.prepare(query).bind(authUserId).all();

    const formatted = (results || []).map((c: any) => ({
      ...c,
      is_member: Boolean(c.is_member),
    }));

    return jsonResponse(formatted);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao carregar comunidades.";
    return errorResponse(message, 500);
  }
};

// POST: cria comunidade ou entra em uma comunidade existente (community_members)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = env.JWT_SECRET || "troque-este-segredo";

    // Validação JWT
    const user = await getAuthUser(request, secret);
    if (!user) {
      return errorResponse("Não autorizado. Faça login para continuar.", 401);
    }

    let body: {
      action?: "create" | "join" | "leave";
      name?: string;
      slug?: string;
      description?: string;
      community_id?: number;
      community_slug?: string;
    };
    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    // Ação: Entrar na comunidade (community_members)
    if (body.action === "join" || (body.community_id && !body.name) || (body.community_slug && !body.name)) {
      let commId = body.community_id ? Number(body.community_id) : null;

      if (!commId && body.community_slug) {
        const comm = await env.DB.prepare(
          "SELECT id FROM communities WHERE slug = ? OR CAST(id AS TEXT) = ?"
        )
          .bind(body.community_slug, body.community_slug)
          .first<{ id: number }>();
        if (comm) commId = comm.id;
      }

      if (!commId) {
        return errorResponse("ID ou slug da comunidade é obrigatório para entrar.", 400);
      }

      const community = await env.DB.prepare("SELECT id, name FROM communities WHERE id = ?")
        .bind(commId)
        .first<{ id: number; name: string }>();

      if (!community) {
        return errorResponse("Comunidade não encontrada.", 404);
      }

      try {
        await env.DB.prepare(
          "INSERT OR IGNORE INTO community_members (user_id, community_id) VALUES (?, ?)"
        )
          .bind(user.id, commId)
          .run();

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
        const msg = err instanceof Error ? err.message : "Erro ao entrar na comunidade.";
        return errorResponse(msg, 500);
      }
    }

    // Ação: Sair da comunidade
    if (body.action === "leave" && body.community_id) {
      const commId = Number(body.community_id);
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
    }

    // Ação: Criar nova comunidade
    const { name, description } = body;
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return errorResponse("Nome da comunidade deve ter ao menos 2 caracteres.", 400);
    }

    const cleanName = name.trim();
    const cleanDesc = description ? description.trim() : "";
    const cleanSlug = body.slug?.trim() ? generateSlug(body.slug) : generateSlug(cleanName);

    // Verifica se já existe com esse nome ou slug
    const existing = await env.DB.prepare(
      "SELECT id FROM communities WHERE LOWER(name) = ? OR slug = ?"
    )
      .bind(cleanName.toLowerCase(), cleanSlug)
      .first();

    if (existing) {
      return errorResponse("Já existe uma comunidade com este nome ou slug.", 409);
    }

    // Insere comunidade com slug
    const insertResult = await env.DB.prepare(
      "INSERT INTO communities (name, slug, description, owner_id) VALUES (?, ?, ?, ?)"
    )
      .bind(cleanName, cleanSlug, cleanDesc, user.id)
      .run();

    const communityId = insertResult.meta.last_row_id;

    // Insere o criador automaticamente na tabela community_members
    await env.DB.prepare(
      "INSERT INTO community_members (user_id, community_id) VALUES (?, ?)"
    )
      .bind(user.id, communityId)
      .run();

    return jsonResponse(
      {
        id: communityId,
        name: cleanName,
        slug: cleanSlug,
        description: cleanDesc,
        owner_id: user.id,
        owner_name: user.username,
        members_count: 1,
        is_member: true,
      },
      201
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao processar comunidade.";
    return errorResponse(message, 500);
  }
};
