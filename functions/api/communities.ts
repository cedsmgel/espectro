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

// GET: lista todas as comunidades ou busca uma única por slug
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");

    if (slug) {
      const singleQuery = `
        SELECT 
          c.id,
          c.name,
          c.slug,
          c.description,
          c.owner_id,
          c.created_at,
          u.username AS owner_name,
          COUNT(cm.user_id) AS members_count
        FROM communities c
        JOIN users u ON c.owner_id = u.id
        LEFT JOIN community_members cm ON c.id = cm.community_id
        WHERE c.slug = ?
        GROUP BY c.id, c.name, c.slug, c.description, c.owner_id, c.created_at, u.username
      `;

      const community = await env.DB.prepare(singleQuery).bind(slug).first();
      if (!community) {
        return errorResponse("Comunidade não encontrada.", 404);
      }
      return jsonResponse(community);
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
        COUNT(cm.user_id) AS members_count
      FROM communities c
      JOIN users u ON c.owner_id = u.id
      LEFT JOIN community_members cm ON c.id = cm.community_id
      GROUP BY c.id, c.name, c.slug, c.description, c.owner_id, c.created_at, u.username
      ORDER BY members_count DESC, c.id DESC
    `;

    const { results } = await env.DB.prepare(query).all();

    return jsonResponse(results || []);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao carregar comunidades.";
    return errorResponse(message, 500);
  }
};

// POST: cria comunidade ou entra em uma comunidade existente
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
      action?: "create" | "join";
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

    // Ação: Entrar em comunidade existente
    if (body.action === "join" || (body.community_id && !body.name) || body.community_slug) {
      let commId = body.community_id ? Number(body.community_id) : null;

      if (!commId && body.community_slug) {
        const comm = await env.DB.prepare("SELECT id FROM communities WHERE slug = ?")
          .bind(body.community_slug)
          .first<{ id: number }>();
        if (comm) commId = comm.id;
      }

      if (!commId) {
        return errorResponse("ID ou slug da comunidade é obrigatório para entrar.", 400);
      }

      const community = await env.DB.prepare("SELECT id, name FROM communities WHERE id = ?")
        .bind(commId)
        .first();

      if (!community) {
        return errorResponse("Comunidade não encontrada.", 404);
      }

      try {
        await env.DB.prepare(
          "INSERT OR IGNORE INTO community_members (user_id, community_id) VALUES (?, ?)"
        )
          .bind(user.id, commId)
          .run();

        return jsonResponse({
          message: "Você agora é membro da comunidade!",
          community_id: commId,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro ao entrar na comunidade.";
        return errorResponse(msg, 500);
      }
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

    // Insere o criador automaticamente como primeiro membro
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
      },
      201
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao processar comunidade.";
    return errorResponse(message, 500);
  }
};
