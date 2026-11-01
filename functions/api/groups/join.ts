import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, serverError } from "../../_shared/auth";
import { MAX_GROUP_MEMBERS, membership, memberCount } from "../../_shared/groups";
import { notifyGroup, type ChatEnv } from "../../_shared/chat";

export interface Env extends ChatEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

const CODE_PATTERN = /^[a-f0-9]{16}$/;

// GET ?code=: nome e tamanho do grupo de um convite, para a pessoa decidir se entra
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);
    const code = new URL(request.url).searchParams.get("code") || "";
    if (!CODE_PATTERN.test(code)) return errorResponse("Convite inválido.", 404);
    const group = await env.DB.prepare(
      `SELECT g.id, g.name, g.description, (SELECT COUNT(*) FROM chat_group_members m WHERE m.group_id = g.id) AS members_count
       FROM chat_groups g WHERE g.invite_code = ?`
    )
      .bind(code)
      .first<{ id: number; name: string; description: string | null; members_count: number }>();
    if (!group) return errorResponse("Convite inválido ou expirado.", 404);
    return jsonResponse({ ...group, already_member: Boolean(await membership(env.DB, group.id, user.id)) });
  } catch (err: unknown) {
    return serverError(err, "groups/join");
  }
};

// POST { code }: entra no grupo pelo link de convite (sem ver as mensagens de antes da entrada)
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);
    const limited = await rateLimit(env.DB, request, "group-join", 20, 60, user.id);
    if (limited) return limited;

    const body = (await request.json().catch(() => null)) as { code?: string } | null;
    const code = body?.code || "";
    if (!CODE_PATTERN.test(code)) return errorResponse("Convite inválido ou expirado.", 404);
    const group = await env.DB.prepare("SELECT id, name FROM chat_groups WHERE invite_code = ?").bind(code).first<{ id: number; name: string }>();
    if (!group) return errorResponse("Convite inválido ou expirado.", 404);

    if (await membership(env.DB, group.id, user.id)) return jsonResponse({ id: group.id, joined: false });
    if ((await memberCount(env.DB, group.id)) >= MAX_GROUP_MEMBERS) return errorResponse("O grupo atingiu o limite de membros.", 400);

    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (?, ?, 'member')").bind(group.id, user.id),
      env.DB.prepare("INSERT INTO chat_group_messages (group_id, sender_id, content, message_type) VALUES (?, ?, ?, 'system')").bind(
        group.id,
        user.id,
        `@${user.username} entrou pelo link de convite`
      ),
    ]);
    await notifyGroup(env, group.id, { type: "refresh" });
    return jsonResponse({ id: group.id, joined: true }, 201);
  } catch (err: unknown) {
    return serverError(err, "groups/join");
  }
};
