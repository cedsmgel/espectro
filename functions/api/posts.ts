import { getAuthUser, jsonResponse, errorResponse } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET: lista os posts com filtros opcionais (community_id, community_slug, post_type)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const communityId = url.searchParams.get("community_id");
    const communitySlug = url.searchParams.get("community_slug");
    const postType = url.searchParams.get("post_type");

    let query = `
      SELECT 
        p.id,
        p.title,
        p.content,
        p.media_url,
        p.media_type,
        p.upvotes,
        p.downvotes,
        p.post_type,
        p.created_at,
        p.author_id,
        u.username AS author_name,
        u.avatar_url AS author_avatar,
        p.community_id,
        c.name AS community_name,
        c.slug AS community_slug,
        (SELECT COUNT(1) FROM comments WHERE comments.post_id = p.id) AS comments_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN communities c ON p.community_id = c.id
      WHERE 1=1
    `;

    const params: unknown[] = [];

    if (communityId) {
      query += ` AND p.community_id = ?`;
      params.push(Number(communityId));
    }

    if (communitySlug) {
      query += ` AND c.slug = ?`;
      params.push(communitySlug);
    }

    if (postType) {
      query += ` AND p.post_type = ?`;
      params.push(postType);
    }

    query += ` ORDER BY p.id DESC LIMIT 50`;

    const stmt = env.DB.prepare(query);
    const { results } = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

    return jsonResponse(results || []);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao carregar posts.";
    return errorResponse(message, 500);
  }
};

// POST: cria um novo post autenticado ou computa voto (upvote / downvote)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = env.JWT_SECRET || "troque-este-segredo";

    // Validação do JWT
    const user = await getAuthUser(request, secret);
    if (!user) {
      return errorResponse("Não autorizado. Token inválido ou ausente.", 401);
    }

    let body: {
      action?: "create" | "vote";
      post_id?: number;
      vote_type?: "up" | "down";
      content?: string;
      title?: string;
      community_id?: number | null;
      community_slug?: string | null;
      media_url?: string;
      media_type?: "image" | "video" | "gif" | null;
      post_type?: "discussion" | "scrap";
    };

    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    // Ação de Voto (Upvote / Downvote)
    if (body.action === "vote" && body.post_id) {
      const postId = Number(body.post_id);
      const isUp = body.vote_type === "up";
      const column = isUp ? "upvotes" : "downvotes";

      await env.DB.prepare(`UPDATE posts SET ${column} = ${column} + 1 WHERE id = ?`)
        .bind(postId)
        .run();

      const updated = await env.DB.prepare(
        "SELECT id, upvotes, downvotes FROM posts WHERE id = ?"
      )
        .bind(postId)
        .first();

      return jsonResponse(updated || { id: postId });
    }

    // Criação de Post
    const { content, title, community_id, community_slug, media_url, media_type, post_type } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return errorResponse("O conteúdo da postagem não pode ser vazio.", 400);
    }

    const cleanContent = content.trim();
    const cleanTitle = title ? title.trim() : null;
    const cleanMediaUrl = media_url ? media_url.trim() : null;
    const cleanMediaType = media_type && ["image", "video", "gif"].includes(media_type) ? media_type : null;
    const cleanPostType = post_type === "discussion" ? "discussion" : "scrap";

    let commId = community_id ? Number(community_id) : null;

    // Se forneceu slug em vez de ID, resolve o community_id
    if (!commId && community_slug) {
      const commBySlug = await env.DB.prepare("SELECT id FROM communities WHERE slug = ?")
        .bind(community_slug)
        .first<{ id: number }>();
      if (commBySlug) {
        commId = commBySlug.id;
      }
    }

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
      `INSERT INTO posts (
        author_id, 
        community_id, 
        content, 
        title, 
        media_url, 
        media_type, 
        post_type, 
        upvotes, 
        downvotes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`
    )
      .bind(
        user.id,
        commId,
        cleanContent,
        cleanTitle,
        cleanMediaUrl,
        cleanMediaType,
        cleanPostType
      )
      .run();

    const newId = insertResult.meta.last_row_id;

    return jsonResponse(
      {
        id: newId,
        author_id: user.id,
        author_name: user.username,
        community_id: commId,
        title: cleanTitle,
        content: cleanContent,
        media_url: cleanMediaUrl,
        media_type: cleanMediaType,
        post_type: cleanPostType,
        upvotes: 0,
        downvotes: 0,
        comments_count: 0,
        created_at: new Date().toISOString(),
      },
      201
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao processar post.";
    return errorResponse(message, 500);
  }
};
