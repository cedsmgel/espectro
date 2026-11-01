import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../../../_shared/auth";
import { membership } from "../../../_shared/groups";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET /api/groups/:id: dados do grupo, membros e meu papel (só para membros)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env, params } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const groupId = Number(params.id);
    const me = await membership(env.DB, groupId, user.id);
    if (!me) return errorResponse("Grupo não encontrado.", 404);

    const group = await env.DB.prepare(
      "SELECT id, name, description, only_admins_send, created_by, disappear_seconds, members_can_edit_info, members_can_add, members_can_invite FROM chat_groups WHERE id = ?"
    )
      .bind(groupId)
      .first<Record<string, unknown>>();
    if (!group) return errorResponse("Grupo não encontrado.", 404);

    const { results } = await env.DB.prepare(
      `SELECT u.id, u.username, u.avatar_url, m.role, strftime('%Y-%m-%dT%H:%M:%SZ', m.joined_at) AS joined_at
       FROM chat_group_members m JOIN users u ON u.id = m.user_id
       WHERE m.group_id = ?
       ORDER BY CASE m.role WHEN 'admin' THEN 0 ELSE 1 END, m.joined_at`
    )
      .bind(groupId)
      .all();

    return jsonResponse({
      group: {
        ...group,
        only_admins_send: Boolean(group.only_admins_send),
        members_can_edit_info: Boolean(group.members_can_edit_info),
        members_can_add: Boolean(group.members_can_add),
        members_can_invite: Boolean(group.members_can_invite),
      },
      members: results || [],
      my_role: me.role,
    });
  } catch (err: unknown) {
    return serverError(err, "groups/detail");
  }
};
