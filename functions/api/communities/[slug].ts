import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, serverError } from "../../_shared/auth";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { params, request, env } = context;
    const slug = params.slug as string;
    if (!slug) {
      return errorResponse("Slug ou ID da comunidade não informado.", 400);
    }

    const secret = getJwtSecret(env);
    const authUser = await getAuthUser(request, secret);
    const authUserId = authUser ? authUser.id : -1;

    const singleQuery = `
      SELECT 
        c.id,
        c.name,
        c.slug,
        c.description,
        c.icon_color,
        c.owner_id,
        c.created_at,
        u.username AS owner_name,
        COUNT(DISTINCT cm.user_id) AS members_count,
        (SELECT COUNT(1) FROM community_members WHERE community_members.community_id = c.id AND community_members.user_id = ?) > 0 AS is_member
      FROM communities c
      JOIN users u ON c.owner_id = u.id
      LEFT JOIN community_members cm ON c.id = cm.community_id
      WHERE c.slug = ? OR CAST(c.id AS TEXT) = ?
      GROUP BY c.id, c.name, c.slug, c.description, c.icon_color, c.owner_id, c.created_at, u.username
    `;

    const community = await env.DB.prepare(singleQuery)
      .bind(authUserId, slug, slug)
      .first();

    if (!community) {
      return errorResponse("Comunidade não encontrada.", 404);
    }

    return jsonResponse({
      ...community,
      is_member: Boolean((community as any).is_member),
    });
  } catch (err: unknown) {
    return serverError(err, "communities/[slug]");
  }
};
