import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, sanitizeMediaUrl } from "../../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  MEDIA_BUCKET?: R2Bucket;
  BUCKET?: R2Bucket;
}

// Garante que a tabela posts e todas as suas colunas existam (self-healing no D1)
async function ensurePostsTable(db: D1Database) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author_id INTEGER NOT NULL REFERENCES users(id),
        community_id INTEGER REFERENCES communities(id),
        content TEXT NOT NULL,
        title TEXT,
        media_url TEXT,
        media_type TEXT,
        post_type TEXT DEFAULT 'scrap',
        upvotes INTEGER DEFAULT 0,
        downvotes INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch {
    // ignore
  }
}

// GET: lista os posts com filtros opcionais (community_id, community_slug, post_type, feed)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    await ensurePostsTable(env.DB);
    const url = new URL(request.url);
    const communityId = url.searchParams.get("community_id");
    const communitySlug = url.searchParams.get("community_slug");
    const authorId = url.searchParams.get("author_id");
    const authorName = url.searchParams.get("author_name");
    const postType = url.searchParams.get("post_type");
    const feed = url.searchParams.get("feed"); // 'home' | 'all'
    const secret = getJwtSecret(env);
    const authUser = await getAuthUser(request, secret);

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
        c.icon_color AS community_icon_color,
        (SELECT COUNT(1) FROM comments WHERE comments.post_id = p.id) AS comments_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN communities c ON p.community_id = c.id
      WHERE 1=1
    `;

    const params: unknown[] = [];

    if (authorId || authorName) {
      // 1. Verifica se o autor possui perfil privado (is_private)
      const authorQuery = authorId
        ? "SELECT id, is_private FROM users WHERE id = ?"
        : "SELECT id, is_private FROM users WHERE LOWER(username) = ?";
      const authorParam = authorId ? Number(authorId) : authorName!.toLowerCase();
      const authorRow = await env.DB.prepare(authorQuery).bind(authorParam).first<any>();

      if (authorRow && authorRow.is_private) {
        const isSelf = authUser && authUser.id === authorRow.id;
        let isFriend = false;
        if (authUser && !isSelf) {
          const friendship = await env.DB.prepare(
            "SELECT id FROM friendships WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND status = 'accepted'"
          )
            .bind(authUser.id, authorRow.id, authorRow.id, authUser.id)
            .first();
          isFriend = Boolean(friendship);
        }

        // Se o perfil for privado e o visitante não for amigo nem o próprio autor, oculta os posts
        if (!isSelf && !isFriend) {
          return jsonResponse([]);
        }
      }

      if (authorId) {
        query += ` AND p.author_id = ?`;
        params.push(Number(authorId));
      } else if (authorName) {
        query += ` AND LOWER(u.username) = ?`;
        params.push(authorName.toLowerCase());
      }
    }

    if (communityId) {
      query += ` AND p.community_id = ?`;
      params.push(Number(communityId));
    } else if (communitySlug) {
      query += ` AND (c.slug = ? OR CAST(c.id AS TEXT) = ?)`;
      params.push(communitySlug, communitySlug);
    } else if (feed === "home" && authUser) {
      // Feed Principal: exibe posts gerais (sem comunidade) E posts das comunidades em que o usuário participa
      query += ` AND (p.community_id IS NULL OR p.community_id IN (SELECT community_id FROM community_members WHERE user_id = ?))`;
      params.push(authUser.id);
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
    await ensurePostsTable(env.DB);
    const secret = getJwtSecret(env);

    // Validação do JWT
    const user = await getAuthUser(request, secret);
    if (!user) {
      return errorResponse("Não autorizado. Token inválido ou ausente.", 401);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    // Ação de Voto (Upvote / Downvote)
    if (body.action === "vote" && body.post_id) {
      const postId = Number(body.post_id);
      if (!Number.isInteger(postId) || postId <= 0 || !["up", "down"].includes(body.vote_type)) {
        return errorResponse("Voto inválido.", 400);
      }
      const newVote = body.vote_type === "up" ? 1 : -1;

      const post = await env.DB.prepare("SELECT id FROM posts WHERE id = ?").bind(postId).first();
      if (!post) {
        return errorResponse("Publicação não encontrada.", 404);
      }

      const previous = await env.DB.prepare(
        "SELECT vote FROM post_votes WHERE user_id = ? AND post_id = ?"
      )
        .bind(user.id, postId)
        .first<{ vote: number }>();

      // Mesmo voto novamente remove o voto; voto oposto troca; sem voto prévio cria
      let finalVote: number | null = newVote;
      let upDelta = 0;
      let downDelta = 0;
      if (previous && previous.vote === newVote) {
        finalVote = null;
        if (newVote === 1) upDelta = -1;
        else downDelta = -1;
      } else if (previous) {
        if (newVote === 1) {
          upDelta = 1;
          downDelta = -1;
        } else {
          upDelta = -1;
          downDelta = 1;
        }
      } else if (newVote === 1) {
        upDelta = 1;
      } else {
        downDelta = 1;
      }

      const writeVote =
        finalVote === null
          ? env.DB.prepare("DELETE FROM post_votes WHERE user_id = ? AND post_id = ?").bind(user.id, postId)
          : env.DB.prepare(
              "INSERT INTO post_votes (user_id, post_id, vote) VALUES (?, ?, ?) ON CONFLICT(user_id, post_id) DO UPDATE SET vote = excluded.vote"
            ).bind(user.id, postId, finalVote);

      await env.DB.batch([
        writeVote,
        env.DB.prepare(
          "UPDATE posts SET upvotes = MAX(0, COALESCE(upvotes, 0) + ?), downvotes = MAX(0, COALESCE(downvotes, 0) + ?) WHERE id = ?"
        ).bind(upDelta, downDelta, postId),
      ]);

      const updated = await env.DB.prepare(
        "SELECT id, upvotes, downvotes FROM posts WHERE id = ?"
      )
        .bind(postId)
        .first();

      return jsonResponse({
        ...(updated || { id: postId }),
        user_vote: finalVote === 1 ? "up" : finalVote === -1 ? "down" : null,
      });
    }

    // Criação de Post
    const { content, title, community_id, community_slug, media_url, media_type, post_type } = body;

    const cleanMediaUrl = sanitizeMediaUrl(media_url);
    if (media_url && !cleanMediaUrl) {
      return errorResponse("URL de mídia inválida.", 400);
    }
    const cleanContent = content && typeof content === "string" ? content.trim() : "";
    const cleanTitle = title && typeof title === "string" && title.trim().length > 0 ? title.trim() : null;

    // Se o post não tiver conteúdo nem mídia, rejeita
    if (!cleanContent && !cleanMediaUrl) {
      return errorResponse("O conteúdo da postagem ou anexo de mídia não pode ser vazio.", 400);
    }

    // Se for discussão sem mídia anexada, exige título
    if (post_type === "discussion" && !cleanMediaUrl && !cleanTitle) {
      return errorResponse("Discussões sem mídia precisam ter um título.", 400);
    }

    const cleanMediaType = media_type && ["image", "video", "gif"].includes(media_type) ? media_type : (cleanMediaUrl ? "image" : null);
    const cleanPostType = post_type === "discussion" ? "discussion" : "scrap";

    let commId = community_id ? Number(community_id) : null;

    if (!commId && community_slug) {
      const commBySlug = await env.DB.prepare("SELECT id FROM communities WHERE slug = ?")
        .bind(community_slug)
        .first<{ id: number }>();
      if (commBySlug) {
        commId = commBySlug.id;
      }
    }

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

    const createdPost = await env.DB.prepare(
      `SELECT 
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
        c.icon_color AS community_icon_color,
        0 AS comments_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN communities c ON p.community_id = c.id
      WHERE p.id = ?`
    )
      .bind(newId)
      .first();

    return jsonResponse(
      createdPost || {
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

// DELETE: fallback para remoção com query param ?id=...
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const secret = getJwtSecret(env);
    const user = await getAuthUser(request, secret);

    if (!user) {
      return errorResponse("Não autorizado. Faça login para excluir.", 401);
    }

    const url = new URL(request.url);
    const postId = url.searchParams.get("id");

    if (!postId || isNaN(Number(postId))) {
      return errorResponse("ID do post é obrigatório.", 400);
    }

    const numericPostId = Number(postId);

    const post = await env.DB.prepare(
      "SELECT id, author_id, media_url, media_type FROM posts WHERE id = ?"
    )
      .bind(numericPostId)
      .first<{ id: number; author_id: number; media_url: string | null; media_type: string | null }>();

    if (!post) {
      return errorResponse("Publicação não encontrada.", 404);
    }

    if (post.author_id !== user.id) {
      return errorResponse("Você não tem permissão para excluir esta publicação.", 403);
    }

    if (post.media_url) {
      let r2Key: string | null = null;
      if (post.media_url.includes("/api/media/")) {
        const parts = post.media_url.split("/api/media/");
        r2Key = parts[1] ? decodeURIComponent(parts[1].split("?")[0]) : null;
      } else if (post.media_url.startsWith("videos/") || post.media_url.startsWith("images/")) {
        r2Key = post.media_url.split("?")[0];
      }

      if (r2Key) {
        const bucket = env.MEDIA_BUCKET || env.BUCKET;
        if (bucket) {
          try {
            await bucket.delete(r2Key);
          } catch (r2Err) {
            console.error("Erro ao deletar arquivo do Cloudflare R2:", r2Err);
          }
        }
      }
    }

    try {
      await env.DB.prepare("DELETE FROM comments WHERE post_id = ?").bind(numericPostId).run();
    } catch {}

    await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(numericPostId).run();

    return jsonResponse({
      success: true,
      message: "Publicação excluída com sucesso.",
      deleted_id: numericPostId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao deletar publicação.";
    return errorResponse(message, 500);
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
};
