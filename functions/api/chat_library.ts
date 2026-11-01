import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

type Section = "media" | "links" | "docs";

const TYPE_FILTER: Record<Section, string> = {
  media: "IN ('image', 'video', 'gif')",
  docs: "IN ('file')",
  links: "= 'text'",
};

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

// GET ?section=media|links|docs&kind=dm|group&id=: mídias, links e documentos das minhas conversas
// (sem kind/id, de todas elas). Fotos de visualização única nunca aparecem aqui.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const url = new URL(request.url);
    const section = url.searchParams.get("section") as Section;
    if (!TYPE_FILTER[section]) return errorResponse("Seção inválida.", 400);
    const kind = url.searchParams.get("kind");
    const id = Number(url.searchParams.get("id"));
    const scoped = (kind === "dm" || kind === "group") && Number.isInteger(id) && id > 0;
    const wantDm = !scoped || kind === "dm";
    const wantGroup = !scoped || kind === "group";
    const limit = 60;

    const items: Array<Record<string, unknown>> = [];

    if (wantDm) {
      const { results } = await env.DB.prepare(
        `SELECT 'dm' AS kind, dm.id AS message_id, COALESCE(dm.message_type, 'text') AS message_type,
           dm.media_url, dm.content, su.username AS sender_username,
           CASE WHEN dm.sender_id = ?1 THEN dm.receiver_id ELSE dm.sender_id END AS chat_id,
           ou.username AS chat_name, strftime('%Y-%m-%dT%H:%M:%SZ', dm.created_at) AS created_at
         FROM direct_messages dm
         JOIN users su ON su.id = dm.sender_id
         JOIN users ou ON ou.id = CASE WHEN dm.sender_id = ?1 THEN dm.receiver_id ELSE dm.sender_id END
         WHERE (dm.sender_id = ?1 OR dm.receiver_id = ?1)
           AND (?2 IS NULL OR CASE WHEN dm.sender_id = ?1 THEN dm.receiver_id ELSE dm.sender_id END = ?2)
           AND COALESCE(dm.message_type, 'text') ${TYPE_FILTER[section]}
           AND dm.view_once = 0
           AND (dm.expires_at IS NULL OR dm.expires_at > datetime('now'))
           AND dm.id > COALESCE((SELECT cleared_before_id FROM conversation_settings
                                 WHERE user_id = ?1 AND friend_id = CASE WHEN dm.sender_id = ?1 THEN dm.receiver_id ELSE dm.sender_id END), 0)
           ${section === "links" ? "AND dm.content LIKE '%http%'" : "AND dm.media_url IS NOT NULL"}
         ORDER BY dm.id DESC LIMIT ?3`
      )
        .bind(user.id, scoped && kind === "dm" ? id : null, limit)
        .all<Record<string, unknown>>();
      items.push(...(results || []));
    }

    if (wantGroup) {
      const { results } = await env.DB.prepare(
        `SELECT 'group' AS kind, x.id AS message_id, x.message_type, x.media_url, x.content,
           su.username AS sender_username, x.group_id AS chat_id, g.name AS chat_name,
           strftime('%Y-%m-%dT%H:%M:%SZ', x.created_at) AS created_at
         FROM chat_group_messages x
         JOIN chat_group_members m ON m.group_id = x.group_id AND m.user_id = ?1
         JOIN chat_groups g ON g.id = x.group_id
         LEFT JOIN users su ON su.id = x.sender_id
         WHERE (?2 IS NULL OR x.group_id = ?2)
           AND x.created_at >= m.joined_at
           AND x.deleted_at IS NULL
           AND x.message_type ${TYPE_FILTER[section]}
           AND x.view_once = 0
           AND (x.expires_at IS NULL OR x.expires_at > datetime('now'))
           ${section === "links" ? "AND x.content LIKE '%http%'" : "AND x.media_url IS NOT NULL"}
         ORDER BY x.id DESC LIMIT ?3`
      )
        .bind(user.id, scoped && kind === "group" ? id : null, limit)
        .all<Record<string, unknown>>();
      items.push(...(results || []));
    }

    const sorted = items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit);
    if (section !== "links") return jsonResponse(sorted);

    // Links: uma linha por endereço encontrado no texto
    const links = sorted.flatMap((item) =>
      (String(item.content || "").match(URL_PATTERN) || []).map((href) => ({ ...item, href: href.replace(/[).,;!?]+$/, "") }))
    );
    return jsonResponse(links);
  } catch (err: unknown) {
    return serverError(err, "chat_library");
  }
};
