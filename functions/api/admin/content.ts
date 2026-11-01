import { jsonResponse, errorResponse, serverError } from "../../_shared/auth";
import { AdminEnv, logModeration, removeComment, removePost, requireAdmin } from "../../_shared/admin";

// DELETE /api/admin/content?type=post|comment&id=: remove qualquer publicação ou comentário
export const onRequestDelete: PagesFunction<AdminEnv> = async (context) => {
  try {
    const { request, env } = context;
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;

    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) return errorResponse("ID inválido.", 400);
    const note = (url.searchParams.get("note") || "").trim().slice(0, 300) || null;

    if (type === "post") {
      const result = await removePost(env, id);
      if (!result.removed) return errorResponse("Publicação não encontrada.", 404);
      await logModeration(env.DB, admin.id, "remove_post", { userId: result.authorId, type: "post", id, note });
      return jsonResponse({ removed: true });
    }

    if (type === "comment") {
      const result = await removeComment(env.DB, id);
      if (!result.removed) return errorResponse("Comentário não encontrado.", 404);
      await logModeration(env.DB, admin.id, "remove_comment", { userId: result.authorId, type: "comment", id, note });
      return jsonResponse({ removed: true });
    }

    return errorResponse("Tipo inválido.", 400);
  } catch (err: unknown) {
    return serverError(err, "admin/content");
  }
};
