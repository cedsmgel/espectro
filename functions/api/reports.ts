import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export const REPORT_REASONS = ["spam", "assedio", "conteudo_improprio", "golpe", "outro"];

// POST { user_id | post_id | comment_id, reason, details?, message_id? }: registra uma denúncia para moderação.
// Para publicação e comentário, o denunciado é o autor do conteúdo.
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const limited = await rateLimit(env.DB, request, "report", 10, 3600, user.id);
    if (limited) return limited;

    const body = (await request.json().catch(() => null)) as {
      user_id?: number;
      post_id?: number;
      comment_id?: number;
      reason?: string;
      details?: string;
      message_id?: number;
    } | null;

    if (!body?.reason || !REPORT_REASONS.includes(body.reason)) {
      return errorResponse("Motivo inválido.", 400);
    }

    const details = typeof body.details === "string" ? body.details.trim() : "";
    if (details.length > 500) return errorResponse("Os detalhes devem ter no máximo 500 caracteres.", 400);

    // Descobre quem está sendo denunciado e o conteúdo, se houver
    let reportedId = Number(body.user_id);
    let postId: number | null = null;
    let commentId: number | null = null;

    if (body.post_id !== undefined && body.post_id !== null) {
      const id = Number(body.post_id);
      const post = Number.isInteger(id)
        ? await env.DB.prepare("SELECT author_id FROM posts WHERE id = ?").bind(id).first<{ author_id: number }>()
        : null;
      if (!post) return errorResponse("Publicação não encontrada.", 404);
      postId = id;
      reportedId = post.author_id;
    } else if (body.comment_id !== undefined && body.comment_id !== null) {
      const id = Number(body.comment_id);
      const comment = Number.isInteger(id)
        ? await env.DB.prepare("SELECT author_id FROM comments WHERE id = ?").bind(id).first<{ author_id: number }>()
        : null;
      if (!comment) return errorResponse("Comentário não encontrado.", 404);
      commentId = id;
      reportedId = comment.author_id;
    }

    if (!Number.isInteger(reportedId) || reportedId <= 0 || reportedId === user.id) {
      return errorResponse("Não é possível denunciar este conteúdo.", 400);
    }

    const target = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(reportedId).first();
    if (!target) return errorResponse("Usuário não encontrado.", 404);

    // A mensagem denunciada precisa ser da conversa entre os dois
    let messageId: number | null = null;
    if (body.message_id !== undefined && body.message_id !== null) {
      const id = Number(body.message_id);
      const message = Number.isInteger(id)
        ? await env.DB.prepare(
            `SELECT id FROM direct_messages
             WHERE id = ?1 AND ((sender_id = ?2 AND receiver_id = ?3) OR (sender_id = ?3 AND receiver_id = ?2))`
          )
            .bind(id, user.id, reportedId)
            .first()
        : null;
      if (!message) return errorResponse("Mensagem não encontrada nesta conversa.", 404);
      messageId = id;
    }

    // Evita denúncias repetidas idênticas em aberto
    const duplicate = await env.DB.prepare(
      `SELECT id FROM reports
       WHERE reporter_id = ? AND reported_id = ? AND reason = ? AND status = 'open'
         AND COALESCE(message_id, 0) = COALESCE(?, 0)
         AND COALESCE(post_id, 0) = COALESCE(?, 0)
         AND COALESCE(comment_id, 0) = COALESCE(?, 0)`
    )
      .bind(user.id, reportedId, body.reason, messageId, postId, commentId)
      .first();

    if (!duplicate) {
      await env.DB.prepare(
        "INSERT INTO reports (reporter_id, reported_id, message_id, post_id, comment_id, reason, details) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(user.id, reportedId, messageId, postId, commentId, body.reason, details || null)
        .run();
    }

    return jsonResponse({ reported: true }, 201);
  } catch (err: unknown) {
    return serverError(err, "reports");
  }
};
