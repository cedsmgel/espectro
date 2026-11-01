import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, isBlockedBetween, serverError } from "../../../_shared/auth";
import { MAX_GROUP_MEMBERS, membership, memberCount } from "../../../_shared/groups";
import { kickFromGroup, notifyGroup, type ChatEnv } from "../../../_shared/chat";

export interface Env extends ChatEnv {
  DB: D1Database;
  JWT_SECRET: string;
}

// Regras (inspiradas no WhatsApp):
// - quem cria o grupo vira admin; só admins alteram nome/descrição, adicionam, removem e promovem/rebaixam
// - um admin não pode ser removido por outro admin: antes precisa ser rebaixado
// - qualquer membro pode sair; se o último admin sair, o membro mais antigo vira admin
// - grupo sem membros é apagado
// - um admin pode restringir o envio de mensagens só para admins
// - novos membros não veem o histórico anterior à entrada

type Body = {
  action?: string;
  user_id?: number;
  user_ids?: unknown;
  name?: string;
  description?: string;
  only_admins_send?: boolean;
};

// POST /api/groups/:id/manage { action, ... }
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env, params } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const groupId = Number(params.id);
    const me = await membership(env.DB, groupId, user.id);
    if (!me) return errorResponse("Grupo não encontrado.", 404);

    const body = ((await request.json().catch(() => null)) || {}) as Body;
    const isAdmin = me.role === "admin";
    const notAdmin = () => errorResponse("Só administradores podem fazer isso.", 403);
    const targetId = Number(body.user_id);

    // Grava o aviso e manda os membros conectados recarregarem o grupo
    const systemMessage = async (text: string) => {
      await env.DB.prepare(
        "INSERT INTO chat_group_messages (group_id, sender_id, content, message_type) VALUES (?, ?, ?, 'system')"
      )
        .bind(groupId, user.id, text)
        .run();
      await notifyGroup(env, groupId, { type: "refresh" });
    };

    switch (body.action) {
      case "leave": {
        await env.DB.prepare("DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ?")
          .bind(groupId, user.id)
          .run();
        const remaining = await memberCount(env.DB, groupId);
        if (remaining === 0) {
          await env.DB.prepare("DELETE FROM chat_groups WHERE id = ?").bind(groupId).run();
          return jsonResponse({ left: true, deleted: true });
        }
        if (me.role === "admin") {
          const admins = await env.DB.prepare(
            "SELECT COUNT(*) AS n FROM chat_group_members WHERE group_id = ? AND role = 'admin'"
          )
            .bind(groupId)
            .first<{ n: number }>();
          if (Number(admins?.n || 0) === 0) {
            await env.DB.prepare(
              `UPDATE chat_group_members SET role = 'admin' WHERE group_id = ? AND user_id = (
                 SELECT user_id FROM chat_group_members WHERE group_id = ? ORDER BY joined_at, user_id LIMIT 1)`
            )
              .bind(groupId, groupId)
              .run();
          }
        }
        await systemMessage(`@${user.username} saiu do grupo`);
        await kickFromGroup(env, groupId, user.id);
        return jsonResponse({ left: true, deleted: false });
      }

      case "update": {
        if (!isAdmin) return notAdmin();
        const name = typeof body.name === "string" ? body.name.trim() : undefined;
        if (name !== undefined && (name.length < 2 || name.length > 50)) {
          return errorResponse("O nome do grupo deve ter de 2 a 50 caracteres.", 400);
        }
        const description = typeof body.description === "string" ? body.description.trim() : undefined;
        if (description !== undefined && description.length > 300) {
          return errorResponse("A descrição deve ter no máximo 300 caracteres.", 400);
        }
        const onlyAdmins = typeof body.only_admins_send === "boolean" ? (body.only_admins_send ? 1 : 0) : undefined;
        await env.DB.prepare(
          `UPDATE chat_groups SET
             name = COALESCE(?, name),
             description = COALESCE(?, description),
             only_admins_send = COALESCE(?, only_admins_send)
           WHERE id = ?`
        )
          .bind(name ?? null, description ?? null, onlyAdmins ?? null, groupId)
          .run();
        if (name !== undefined) await systemMessage(`@${user.username} alterou o nome do grupo para "${name}"`);
        else await notifyGroup(env, groupId, { type: "refresh" });
        return jsonResponse({ updated: true });
      }

      case "add": {
        if (!isAdmin) return notAdmin();
        const ids = Array.isArray(body.user_ids)
          ? [...new Set(body.user_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n !== user.id))]
          : [];
        if (ids.length === 0) return errorResponse("Escolha pelo menos uma pessoa.", 400);
        const current = await memberCount(env.DB, groupId);
        if (current + ids.length > MAX_GROUP_MEMBERS) return errorResponse("O grupo atingiu o limite de membros.", 400);

        const placeholders = ids.map(() => "?").join(",");
        const friends = await env.DB.prepare(
          `SELECT CASE WHEN user_id = ?1 THEN friend_id ELSE user_id END AS fid
           FROM friendships WHERE status = 'accepted' AND (user_id = ?1 OR friend_id = ?1)
             AND CASE WHEN user_id = ?1 THEN friend_id ELSE user_id END IN (${placeholders})`
        )
          .bind(user.id, ...ids)
          .all<{ fid: number }>();
        const toAdd: Array<{ id: number; username: string }> = [];
        for (const row of friends.results || []) {
          if (await isBlockedBetween(env.DB, user.id, row.fid)) continue;
          const already = await membership(env.DB, groupId, row.fid);
          if (already) continue;
          const u = await env.DB.prepare("SELECT username FROM users WHERE id = ?").bind(row.fid).first<{ username: string }>();
          if (u) toAdd.push({ id: row.fid, username: u.username });
        }
        if (toAdd.length === 0) return errorResponse("Só é possível adicionar amigos que ainda não estão no grupo.", 400);

        await env.DB.batch([
          ...toAdd.map((p) =>
            env.DB.prepare("INSERT OR IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (?, ?, 'member')").bind(groupId, p.id)
          ),
          env.DB.prepare("INSERT INTO chat_group_messages (group_id, sender_id, content, message_type) VALUES (?, ?, ?, 'system')").bind(
            groupId,
            user.id,
            `@${user.username} adicionou ${toAdd.map((p) => `@${p.username}`).join(", ")}`
          ),
        ]);
        return jsonResponse({ added: toAdd.length });
      }

      case "remove": {
        if (!isAdmin) return notAdmin();
        if (!Number.isInteger(targetId) || targetId <= 0 || targetId === user.id) {
          return errorResponse("Use 'Sair do grupo' para sair.", 400);
        }
        const target = await membership(env.DB, groupId, targetId);
        if (!target) return errorResponse("Essa pessoa não está no grupo.", 404);
        if (target.role === "admin") return errorResponse("Rebaixe o administrador antes de removê-lo.", 400);
        const name = await env.DB.prepare("SELECT username FROM users WHERE id = ?").bind(targetId).first<{ username: string }>();
        await env.DB.prepare("DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ?").bind(groupId, targetId).run();
        await systemMessage(`@${user.username} removeu @${name?.username || "um membro"}`);
        await kickFromGroup(env, groupId, targetId);
        return jsonResponse({ removed: true });
      }

      case "promote":
      case "demote": {
        if (!isAdmin) return notAdmin();
        const target = await membership(env.DB, groupId, targetId);
        if (!target) return errorResponse("Essa pessoa não está no grupo.", 404);
        const name = await env.DB.prepare("SELECT username FROM users WHERE id = ?").bind(targetId).first<{ username: string }>();
        if (body.action === "promote") {
          await env.DB.prepare("UPDATE chat_group_members SET role = 'admin' WHERE group_id = ? AND user_id = ?")
            .bind(groupId, targetId)
            .run();
          await systemMessage(`@${user.username} tornou @${name?.username} administrador`);
        } else {
          const admins = await env.DB.prepare(
            "SELECT COUNT(*) AS n FROM chat_group_members WHERE group_id = ? AND role = 'admin'"
          )
            .bind(groupId)
            .first<{ n: number }>();
          if (Number(admins?.n || 0) <= 1) return errorResponse("O grupo precisa de pelo menos um administrador.", 400);
          await env.DB.prepare("UPDATE chat_group_members SET role = 'member' WHERE group_id = ? AND user_id = ?")
            .bind(groupId, targetId)
            .run();
          await systemMessage(`@${user.username} removeu @${name?.username} dos administradores`);
        }
        return jsonResponse({ role: body.action === "promote" ? "admin" : "member" });
      }

      default:
        return errorResponse("Ação inválida.", 400);
    }
  } catch (err: unknown) {
    return serverError(err, "groups/manage");
  }
};
