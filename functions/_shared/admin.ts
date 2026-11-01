import { getAuthUser, getJwtSecret, errorResponse, UserPayload } from "./auth";
import { mfaAvailable, mfaState } from "./mfa";
import { forgetSuspension } from "./suspension";

export interface AdminEnv {
  DB: D1Database;
  JWT_SECRET: string;
  MEDIA_BUCKET?: R2Bucket;
  BUCKET?: R2Bucket;
  TOTP_ENC_KEY?: string;
}

// Garante que quem chama é administrador. Consulta o banco: o token sozinho não dá poder de admin.
export async function requireAdmin(request: Request, env: AdminEnv): Promise<UserPayload | Response> {
  const user = await getAuthUser(request, getJwtSecret(env));
  if (!user) return errorResponse("Não autorizado.", 401);

  const row = await env.DB.prepare("SELECT is_admin FROM users WHERE id = ?")
    .bind(user.id)
    .first<{ is_admin: number }>();
  if (!row?.is_admin) return errorResponse("Acesso restrito a administradores.", 403);

  // Moderação exige verificação em duas etapas ativa (quando o servidor a oferece)
  if (mfaAvailable(env) && !(await mfaState(env.DB, user.id)).enabled) {
    return new Response(
      JSON.stringify({ error: "A moderação exige a verificação em duas etapas. Ative-a em Configurações > Segurança.", mfa_setup_required: true }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  return user;
}

export async function logModeration(
  db: D1Database,
  adminId: number,
  action: string,
  target: { userId?: number | null; type?: string; id?: number | null; note?: string | null } = {}
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO moderation_log (admin_id, action, target_user_id, target_type, target_id, note) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(adminId, action, target.userId ?? null, target.type ?? null, target.id ?? null, target.note ?? null)
    .run();
}

// Suspende uma conta. Administradores não podem ser suspensos. Retorna se algo mudou.
export async function suspendUser(db: D1Database, userId: number, reason: string): Promise<boolean> {
  const result = await db
    .prepare("UPDATE users SET suspended_at = CURRENT_TIMESTAMP, suspended_reason = ? WHERE id = ? AND is_admin = 0")
    .bind(reason.slice(0, 200), userId)
    .run();
  forgetSuspension(userId);
  return (result.meta.changes ?? 0) > 0;
}

export async function unsuspendUser(db: D1Database, userId: number): Promise<boolean> {
  const result = await db
    .prepare("UPDATE users SET suspended_at = NULL, suspended_reason = NULL WHERE id = ?")
    .bind(userId)
    .run();
  forgetSuspension(userId);
  return (result.meta.changes ?? 0) > 0;
}

// Remove uma publicação, os comentários e a mídia dela do R2
export async function removePost(env: AdminEnv, postId: number): Promise<{ removed: boolean; authorId: number | null }> {
  const post = await env.DB.prepare("SELECT author_id, media_url FROM posts WHERE id = ?")
    .bind(postId)
    .first<{ author_id: number; media_url: string | null }>();
  if (!post) return { removed: false, authorId: null };

  if (post.media_url?.includes("/api/media/")) {
    const key = decodeURIComponent(post.media_url.split("/api/media/")[1]?.split("?")[0] || "");
    const bucket = env.MEDIA_BUCKET || env.BUCKET;
    if (key && bucket) {
      try {
        await bucket.delete(key);
      } catch (err) {
        console.error("Falha ao remover mídia do R2:", err);
      }
    }
  }

  await env.DB.prepare("DELETE FROM comments WHERE post_id = ?").bind(postId).run();
  await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(postId).run();
  await env.DB.prepare(
    "UPDATE reports SET status = 'resolved', resolution = 'actioned', resolved_at = CURRENT_TIMESTAMP WHERE post_id = ? AND status = 'open'"
  )
    .bind(postId)
    .run();
  return { removed: true, authorId: post.author_id };
}

// Remove um comentário e as respostas a ele
export async function removeComment(db: D1Database, commentId: number): Promise<{ removed: boolean; authorId: number | null }> {
  const comment = await db.prepare("SELECT author_id FROM comments WHERE id = ?")
    .bind(commentId)
    .first<{ author_id: number }>();
  if (!comment) return { removed: false, authorId: null };

  await db.prepare("DELETE FROM comments WHERE parent_id = ?").bind(commentId).run();
  await db.prepare("DELETE FROM comments WHERE id = ?").bind(commentId).run();
  await db
    .prepare(
      "UPDATE reports SET status = 'resolved', resolution = 'actioned', resolved_at = CURRENT_TIMESTAMP WHERE comment_id = ? AND status = 'open'"
    )
    .bind(commentId)
    .run();
  return { removed: true, authorId: comment.author_id };
}
