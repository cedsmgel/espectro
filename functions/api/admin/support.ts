import { jsonResponse, errorResponse, serverError } from "../../_shared/auth";
import { AdminEnv, logModeration, requireAdmin } from "../../_shared/admin";

// GET ?status=open|closed: fila do suporte
export const onRequestGet: PagesFunction<AdminEnv> = async ({ request, env }) => {
  try {
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;
    const closed = new URL(request.url).searchParams.get("status") === "closed";
    const { results } = await env.DB.prepare(
      `SELECT s.id, s.topic, s.message, s.contact_email, s.status,
         strftime('%Y-%m-%dT%H:%M:%SZ', s.created_at) AS created_at, u.username
       FROM support_messages s LEFT JOIN users u ON u.id = s.user_id
       WHERE s.status = ? ORDER BY s.id DESC LIMIT 50`
    )
      .bind(closed ? "closed" : "open")
      .all();
    const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM support_messages WHERE status = 'open'").first<{ n: number }>();
    return jsonResponse({ messages: results || [], open_count: Number(open?.n || 0) });
  } catch (err: unknown) {
    return serverError(err, "admin/support");
  }
};

// POST { id, status: 'closed' | 'open' }: marca como atendida (ou reabre)
export const onRequestPost: PagesFunction<AdminEnv> = async ({ request, env }) => {
  try {
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;
    const body = (await request.json().catch(() => null)) as { id?: number; status?: string } | null;
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0 || (body?.status !== "closed" && body?.status !== "open")) {
      return errorResponse("Pedido inválido.", 400);
    }
    await env.DB.prepare("UPDATE support_messages SET status = ?, closed_at = CASE WHEN ? = 'closed' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = ?")
      .bind(body.status, body.status, id)
      .run();
    await logModeration(env.DB, admin.id, body.status === "closed" ? "close_support" : "reopen_support", { type: "support", id });
    return jsonResponse({ ok: true });
  } catch (err: unknown) {
    return serverError(err, "admin/support");
  }
};
