import { getAuthUser, jsonResponse, errorResponse } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET: lista os 50 posts mais recentes com autor e comunidade
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { env } = context;

    const query = `
      SELECT 
        p.id,
        p.content,
        p.created_at,
        p.author_id,
        u.username AS author_name,
        u.avatar_url AS author_avatar,
        p.community_id,
        c.name AS community_name
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN communities c ON p.community_id = c.id
      ORDER BY p.id DESC
      LIMIT 50
    `;

    const { results } = await env.DB.prepare(query).all();

    return jsonResponse(results || []);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao carregar posts.";
    return errorResponse(message, 500);
  }
};

// POST: cria um novo post autenticado
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = env.JWT_SECRET || "troque-este-segredo";

    // Validação do JWT
    const user = await getAuthUser(request, secret);
    if (!user) {
      return errorResponse("Não autorizado. Token inválido ou ausente.", 401);
    }

    let body: { content?: string; community_id?: number | null };
    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    const { content, community_id } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return errorResponse("O conteúdo da postagem não pode ser vazio.", 400);
    }

    const cleanContent = content.trim();
    const commId = community_id ? Number(community_id) : null;

    // Se informou comunidade, valida se ela existe
    if (commId) {
      const comm = await env.DB.prepare("SELECT id FROM communities WHERE id = ?")
        .bind(commId)
        .first();
      if (!comm) {
        return errorResponse("Comunidade especificada não encontrada.", 404);
      }
    }

    const insertResult = await env.DB.prepare(
      "INSERT INTO posts (author_id, community_id, content) VALUES (?, ?, ?)"
    )
      .bind(user.id, commId, cleanContent)
      .run();

    const newId = insertResult.meta.last_row_id;

    return jsonResponse(
      {
        id: newId,
        author_id: user.id,
        author_name: user.username,
        community_id: commId,
        content: cleanContent,
        created_at: new Date().toISOString(),
      },
      201
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao criar post.";
    return errorResponse(message, 500);
  }
};
