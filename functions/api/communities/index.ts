import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, serverError } from "../../_shared/auth";
import { cachedForVisitors } from "../../_shared/edgeCache";
import {
  cleanCommunityTags,
  cleanRules,
  COMMUNITY_TYPES,
  CommunityType,
  NAME_RE,
} from "../../_shared/communities";
import { loadCommunityDetail } from "../../_shared/communityDetail";
import { joinCommunity, leaveCommunity } from "../../_shared/communityJoin";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// GET: lista as comunidades (privadas só aparecem para quem é membro) ou devolve uma por slug/id
const handleGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    const id = url.searchParams.get("id");

    const authUser = await getAuthUser(request, getJwtSecret(env));
    const authUserId = authUser ? authUser.id : -1;

    if (slug || id) {
      const community = await loadCommunityDetail(env.DB, slug || id || "", authUser ? authUser.id : null);
      if (!community) return errorResponse("Comunidade não encontrada.", 404);
      return jsonResponse(community);
    }

    const { results } = await env.DB.prepare(
      `SELECT c.id, c.name, c.slug, c.description, c.icon_color, c.icon_url, c.owner_id, c.created_at, c.type,
              u.username AS owner_name,
              (SELECT COUNT(1) FROM community_members m WHERE m.community_id = c.id AND m.status = 'active') AS members_count,
              EXISTS(SELECT 1 FROM community_members m WHERE m.community_id = c.id AND m.user_id = ?1 AND m.status = 'active') AS is_member
       FROM communities c
       JOIN users u ON c.owner_id = u.id
       WHERE c.type != 'private' OR EXISTS (SELECT 1 FROM community_members m WHERE m.community_id = c.id AND m.user_id = ?1 AND m.status = 'active')
       ORDER BY members_count DESC, c.id DESC`
    )
      .bind(authUserId)
      .all();

    return jsonResponse((results || []).map((c: any) => ({ ...c, is_member: Boolean(c.is_member) })));
  } catch (err: unknown) {
    return serverError(err, "communities/index");
  }
};

// POST: cria comunidade, entra (ou pede para entrar) ou sai
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) {
      return errorResponse("Não autorizado. Faça login para continuar.", 401);
    }

    let body: {
      action?: "create" | "join" | "leave";
      name?: string;
      description?: string;
      community_id?: number;
      community_slug?: string;
      icon_color?: string;
      type?: string;
      tags?: unknown;
      rules?: unknown;
      welcome_message?: string;
      require_tag?: boolean;
    };
    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }

    // ---- Entrar (ou pedir para entrar)
    if (body.action === "join" || (body.community_id && !body.name) || (body.community_slug && !body.name)) {
      let commId = body.community_id ? Number(body.community_id) : null;
      if (!commId && body.community_slug) {
        const comm = await env.DB.prepare("SELECT id FROM communities WHERE slug = ? OR CAST(id AS TEXT) = ?").bind(body.community_slug, body.community_slug).first<{ id: number }>();
        if (comm) commId = comm.id;
      }
      if (!commId) return errorResponse("ID ou slug da comunidade é obrigatório para entrar.", 400);

      const joined = await joinCommunity(env.DB, commId, user.id);
      return jsonResponse(joined.body, joined.status);
    }

    // ---- Sair (ou cancelar o pedido)
    if (body.action === "leave" && body.community_id) {
      const commId = Number(body.community_id);
      const left = await leaveCommunity(env.DB, commId, user.id);
      return jsonResponse(left.body, left.status);
    }

    // ---- Criar
    const limited = await rateLimit(env.DB, request, "community-create", 5, 3600, user.id);
    if (limited) return limited;

    const { name, description, icon_color } = body;
    if (!name || typeof name !== "string" || !NAME_RE.test(name.trim())) {
      return errorResponse("O nome deve ter de 3 a 21 caracteres, só letras, números e _ (sem espaços). Ele não pode ser mudado depois.", 400);
    }
    const cleanName = name.trim();
    const cleanDesc = description ? String(description).trim() : "";
    if (cleanDesc.length > 500) return errorResponse("A descrição deve ter no máximo 500 caracteres.", 400);

    const type = (COMMUNITY_TYPES as string[]).includes(body.type || "public") ? ((body.type || "public") as CommunityType) : null;
    if (!type) return errorResponse("Tipo de comunidade inválido.", 400);

    const tags = cleanCommunityTags(body.tags);
    if (!tags) return errorResponse("Use até 8 hashtags válidas (letras, números e _).", 400);
    const rules = cleanRules(body.rules);
    if (!rules) return errorResponse("Use até 15 regras, com título de até 100 caracteres e descrição de até 500.", 400);
    const welcome = typeof body.welcome_message === "string" ? body.welcome_message.trim().slice(0, 500) : "";

    const slugValue = cleanName.toLowerCase();
    const cleanColor =
      typeof icon_color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(icon_color.trim()) ? icon_color.trim() : "#404040";

    const existing = await env.DB.prepare("SELECT id FROM communities WHERE LOWER(name) = ? OR slug = ?").bind(slugValue, slugValue).first();
    if (existing) return errorResponse("Já existe uma comunidade com este nome.", 409);

    const insert = await env.DB.prepare(
      "INSERT INTO communities (name, slug, description, icon_color, owner_id, type, welcome_message, require_tag) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(cleanName, slugValue, cleanDesc, cleanColor, user.id, type, welcome || null, body.require_tag ? 1 : 0)
      .run();
    const communityId = Number(insert.meta.last_row_id);

    await env.DB.batch([
      env.DB.prepare("INSERT INTO community_members (user_id, community_id, role, status) VALUES (?, ?, 'owner', 'active')").bind(user.id, communityId),
      ...tags.map((tag) => env.DB.prepare("INSERT OR IGNORE INTO community_tags (community_id, tag) VALUES (?, ?)").bind(communityId, tag)),
      ...rules.map((rule, index) =>
        env.DB.prepare("INSERT INTO community_rules (community_id, position, title, description) VALUES (?, ?, ?, ?)").bind(communityId, index, rule.title, rule.description || null)
      ),
    ]);

    return jsonResponse(
      {
        id: communityId,
        name: cleanName,
        slug: slugValue,
        description: cleanDesc,
        icon_color: cleanColor,
        owner_id: user.id,
        owner_name: user.username,
        type,
        members_count: 1,
        is_member: true,
      },
      201
    );
  } catch (err: unknown) {
    return serverError(err, "communities/index");
  }
};

export const onRequestGet: PagesFunction<Env> = (context) => cachedForVisitors(context.request, 60, async () => handleGet(context));
