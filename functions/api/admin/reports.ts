import { jsonResponse, errorResponse, serverError } from "../../_shared/auth";
import { AdminEnv, logModeration, removeComment, removePost, requireAdmin, suspendUser } from "../../_shared/admin";

const PAGE = 30;

function snippet(value: unknown, max = 300): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

// GET /api/admin/reports?status=open|closed&before_id=: fila de denúncias com o contexto de cada uma
export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  try {
    const { request, env } = context;
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;

    const url = new URL(request.url);
    const closed = url.searchParams.get("status") === "closed";
    const beforeParam = Number(url.searchParams.get("before_id"));
    const beforeId = Number.isInteger(beforeParam) && beforeParam > 0 ? beforeParam : null;

    const { results } = await env.DB.prepare(
      `SELECT r.id, r.reason, r.details, r.status, r.resolution, r.resolution_note,
         r.message_id, r.post_id, r.comment_id,
         strftime('%Y-%m-%dT%H:%M:%SZ', r.created_at) AS created_at,
         strftime('%Y-%m-%dT%H:%M:%SZ', r.resolved_at) AS resolved_at,
         r.reporter_id, ru.username AS reporter_username,
         r.reported_id, tu.username AS reported_username,
         tu.suspended_at IS NOT NULL AS reported_suspended, tu.is_admin AS reported_is_admin,
         m.content AS message_content, m.message_type AS message_type,
         p.title AS post_title, p.content AS post_content,
         c.content AS comment_content,
         (SELECT COUNT(*) FROM reports o WHERE o.reported_id = r.reported_id) AS reported_total
       FROM reports r
       JOIN users ru ON ru.id = r.reporter_id
       JOIN users tu ON tu.id = r.reported_id
       LEFT JOIN direct_messages m ON m.id = r.message_id
       LEFT JOIN posts p ON p.id = r.post_id
       LEFT JOIN comments c ON c.id = r.comment_id
       WHERE ((?1 = 0 AND r.status = 'open') OR (?1 = 1 AND r.status <> 'open')) AND (?2 IS NULL OR r.id < ?2)
       ORDER BY r.id DESC LIMIT ?3`
    )
      .bind(closed ? 1 : 0, beforeId, PAGE + 1)
      .all<Record<string, unknown>>();

    const rows = results || [];
    const reports = rows.slice(0, PAGE).map((row) => ({
      ...row,
      reported_suspended: Boolean(row.reported_suspended),
      reported_is_admin: Boolean(row.reported_is_admin),
      message_content: snippet(row.message_content),
      post_content: snippet(row.post_content),
      comment_content: snippet(row.comment_content),
    }));

    const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'").first<{ n: number }>();

    return jsonResponse({ reports, has_more: rows.length > PAGE, open_count: open?.n ?? 0 });
  } catch (err: unknown) {
    return serverError(err, "admin/reports");
  }
};

// POST { id, resolution: 'dismissed' | 'actioned', note?, suspend?, remove_content? }: resolve uma denúncia
export const onRequestPost: PagesFunction<AdminEnv> = async (context) => {
  try {
    const { request, env } = context;
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;

    const body = (await request.json().catch(() => null)) as {
      id?: number;
      resolution?: string;
      note?: string;
      suspend?: boolean;
      remove_content?: boolean;
    } | null;

    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) return errorResponse("Denúncia inválida.", 400);
    if (body?.resolution !== "dismissed" && body?.resolution !== "actioned") {
      return errorResponse("Resolução inválida.", 400);
    }
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";

    const report = await env.DB.prepare(
      "SELECT id, reported_id, post_id, comment_id, reason, status FROM reports WHERE id = ?"
    )
      .bind(id)
      .first<{ id: number; reported_id: number; post_id: number | null; comment_id: number | null; reason: string; status: string }>();
    if (!report) return errorResponse("Denúncia não encontrada.", 404);
    if (report.status !== "open") return errorResponse("Esta denúncia já foi resolvida.", 409);

    const done: string[] = [];

    if (body.resolution === "actioned" && body.remove_content) {
      if (report.post_id) {
        const result = await removePost(env, report.post_id);
        if (result.removed) {
          done.push("publicação removida");
          await logModeration(env.DB, admin.id, "remove_post", { userId: report.reported_id, type: "post", id: report.post_id, note: note || null });
        }
      } else if (report.comment_id) {
        const result = await removeComment(env.DB, report.comment_id);
        if (result.removed) {
          done.push("comentário removido");
          await logModeration(env.DB, admin.id, "remove_comment", { userId: report.reported_id, type: "comment", id: report.comment_id, note: note || null });
        }
      }
    }

    if (body.resolution === "actioned" && body.suspend) {
      const reason = note || `Denúncia procedente: ${report.reason}`;
      if (await suspendUser(env.DB, report.reported_id, reason)) {
        done.push("conta suspensa");
        await logModeration(env.DB, admin.id, "suspend", { userId: report.reported_id, type: "report", id: report.id, note: reason });
      } else {
        return errorResponse("Não foi possível suspender esta conta (administradores não podem ser suspensos).", 400);
      }
    }

    await env.DB.prepare(
      `UPDATE reports
       SET status = 'resolved', resolution = ?, resolution_note = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(body.resolution, note || null, admin.id, id)
      .run();
    await logModeration(env.DB, admin.id, body.resolution === "dismissed" ? "dismiss_report" : "resolve_report", {
      userId: report.reported_id,
      type: "report",
      id: report.id,
      note: note || null,
    });

    return jsonResponse({ resolved: true, done });
  } catch (err: unknown) {
    return serverError(err, "admin/reports");
  }
};
