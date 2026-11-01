import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, sanitizeMediaUrl, serverError, rateLimit } from "../../_shared/auth";
import { notify } from "../../_shared/notifications";
import type { PushEnv } from "../../_shared/push";

export interface Env extends PushEnv {
  JWT_SECRET: string;
  MEDIA_BUCKET?: R2Bucket;
  BUCKET?: R2Bucket;
}

// GET: lista os posts com filtros opcionais (community_id, community_slug, post_type, feed)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
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

    // Posts de perfis privados só aparecem para o próprio autor e amigos aceitos
    const viewerId = authUser ? authUser.id : -1;
    query += ` AND (
      COALESCE(u.is_private, 0) = 0
      OR u.id = ?
      OR EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
          AND ((f.user_id = u.id AND f.friend_id = ?) OR (f.user_id = ? AND f.friend_id = u.id))
      )
    )`;
    params.push(viewerId, viewerId, viewerId);

    // Quem eu bloqueei (ou me bloqueou) some do feed
    query += ` AND p.author_id NOT IN (
      SELECT blocked_id FROM blocks WHERE blocker_id = ?
      UNION SELECT blocker_id FROM blocks WHERE blocked_id = ?
    )`;
    params.push(viewerId, viewerId);

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

    // media=video: só vídeos (feed Shorts); media=any: só posts com foto ou vídeo (grade do perfil)
    const mediaFilter = url.searchParams.get("media");
    if (mediaFilter === "video") {
      query += ` AND p.media_type = 'video' AND p.media_url IS NOT NULL AND p.media_url != ''`;
    } else if (mediaFilter === "any") {
      query += ` AND p.media_url IS NOT NULL AND p.media_url != ''`;
    }

    // Paginação: before_id traz os posts mais antigos que o último recebido
    const beforeId = Number(url.searchParams.get("before_id"));
    if (Number.isInteger(beforeId) && beforeId > 0) {
      query += ` AND p.id < ?`;
      params.push(beforeId);
    }

    const limitParam = Number(url.searchParams.get("limit"));
    const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 50;
    query += ` ORDER BY p.id DESC LIMIT ${limit}`;

    const stmt = env.DB.prepare(query);
    const { results } = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

    return jsonResponse(results || []);
  } catch (err: unknown) {
    return serverError(err, "posts/index");
  }
};

// POST: cria um novo post autenticado ou computa voto (upvote / downvote)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
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

      const post = await env.DB.prepare("SELECT id, author_id FROM posts WHERE id = ?")
        .bind(postId)
        .first<{ id: number; author_id: number }>();
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

      // Só o primeiro voto positivo de cada pessoa gera notificação
      if (finalVote === 1) {
        context.waitUntil(
          notify(env, {
            userId: post.author_id,
            actor: user,
            type: "post_upvote",
            postId,
            dedupeKey: `v:${postId}:${user.id}`,
          })
        );
      }

      return jsonResponse({
        ...(updated || { id: postId }),
        user_vote: finalVote === 1 ? "up" : finalVote === -1 ? "down" : null,
      });
    }

    // Criação de Post
    const limited = await rateLimit(env.DB, request, "post-create", 30, 600, user.id);
    if (limited) return limited;

    const { content, title, community_id, community_slug, media_url, media_type, post_type } = body;

    const cleanMediaUrl = sanitizeMediaUrl(media_url);
    if (media_url && !cleanMediaUrl) {
      return errorResponse("URL de mídia inválida.", 400);
    }
    const cleanContent = content && typeof content === "string" ? content.trim() : "";
    const cleanTitle = title && typeof title === "string" && title.trim().length > 0 ? title.trim() : null;

    if (cleanContent.length > 2000) {
      return errorResponse("O conteúdo da postagem excede 2.000 caracteres.", 400);
    }
    if (cleanTitle && cleanTitle.length > 200) {
      return errorResponse("O título excede 200 caracteres.", 400);
    }

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
    return serverError(err, "posts/index");
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
    return serverError(err, "posts/index");
  }
};

