import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit, serverError } from "../_shared/auth";
import {
  cleanCommunityTags,
  cleanRules,
  COMMUNITY_TYPES,
  CommunityType,
  getMembership,
  isMod,
  logCommunityAction,
} from "../_shared/communities";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  MEDIA_BUCKET?: R2Bucket;
  BUCKET?: R2Bucket;
}

// GET /api/community_mod?community_id=1&view=requests|members|banned|log  (só moderação)
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    const url = new URL(request.url);
    const communityId = Number(url.searchParams.get("community_id"));
    const view = url.searchParams.get("view") || "requests";
    if (!communityId) return errorResponse("community_id é obrigatório.", 400);
    if (!isMod(await getMembership(env.DB, communityId, user.id))) return errorResponse("Só a moderação acessa isso.", 403);

    if (view === "log") {
      const { results } = await env.DB.prepare(
        `SELECT l.id, l.action, l.note, l.created_at, l.target_post_id,
                mu.username AS moderator_name, tu.username AS target_name
         FROM community_mod_log l
         LEFT JOIN users mu ON mu.id = l.moderator_id
         LEFT JOIN users tu ON tu.id = l.target_user_id
         WHERE l.community_id = ? ORDER BY l.id DESC LIMIT 50`
      )
        .bind(communityId)
        .all();
      return jsonResponse(results || []);
    }

    const where =
      view === "members" ? "cm.status = 'active'" : view === "banned" ? "cm.status = 'banned'" : view === "requests" ? "cm.status = 'pending'" : null;
    if (!where) return errorResponse("view inválida.", 400);

    const { results } = await env.DB.prepare(
      `SELECT cm.user_id, u.username, u.avatar_url, cm.role, cm.status, cm.approved_poster, cm.banned_until, cm.ban_reason, cm.joined_at
       FROM community_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.community_id = ? AND ${where}
       ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, cm.id DESC LIMIT 200`
    )
      .bind(communityId)
      .all();
    return jsonResponse((results || []).map((r: any) => ({ ...r, approved_poster: Boolean(r.approved_poster) })));
  } catch (err: unknown) {
    return serverError(err, "community_mod");
  }
};

// Aceita só arquivos enviados ao próprio Espectro; guarda o caminho relativo (/api/media/...)
function ownMediaPath(value: string, origin: string): string | null {
  let path = value.trim();
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      if (u.origin !== origin) return null;
      path = u.pathname;
    } catch {
      return null;
    }
  }
  return /^\/api\/media\/[\w\-./%]+$/.test(path) && !path.includes("..") ? path : null;
}

interface Body {
  community_id?: number;
  action?: string;
  user_id?: number;
  post_id?: number;
  reason?: string;
  days?: number | null;
  role?: string;
  value?: boolean;
  description?: string;
  welcome_message?: string;
  require_tag?: boolean;
  icon_color?: string;
  icon_url?: string | null;
  banner_url?: string | null;
  type?: string;
  tags?: unknown;
  rules?: unknown;
}

// POST /api/community_mod  { community_id, action, ... }
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) return errorResponse("Não autorizado.", 401);

    let body: Body;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Corpo da requisição inválido. Esperado JSON.", 400);
    }
    const communityId = Number(body.community_id);
    const action = body.action;
    if (!communityId || !action) return errorResponse("community_id e action são obrigatórios.", 400);

    const limited = await rateLimit(env.DB, request, "community-mod", 120, 3600, user.id);
    if (limited) return limited;

    const me = await getMembership(env.DB, communityId, user.id);
    if (!isMod(me)) return errorResponse("Só a moderação pode fazer isso.", 403);
    const iAmOwner = me.role === "owner";
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "";

    // ---- Ações sobre uma pessoa
    if (["approve", "reject", "ban", "unban", "set_role", "set_poster"].includes(action)) {
      const targetId = Number(body.user_id);
      if (!targetId) return errorResponse("user_id é obrigatório.", 400);
      if (targetId === user.id && action !== "set_poster") return errorResponse("Você não pode fazer isso consigo mesmo.", 400);
      const target = await getMembership(env.DB, communityId, targetId);

      if (target.role === "owner") return errorResponse("Quem criou a comunidade não pode ser alterado.", 403);
      if (target.role === "moderator" && !iAmOwner && action !== "set_poster") {
        return errorResponse("Só quem criou a comunidade mexe em outros moderadores.", 403);
      }

      if (action === "approve") {
        if (target.status !== "pending") return errorResponse("Esse pedido não está pendente.", 409);
        await env.DB.prepare("UPDATE community_members SET status = 'active' WHERE community_id = ? AND user_id = ?").bind(communityId, targetId).run();
        await logCommunityAction(env.DB, communityId, user.id, "approve_member", { userId: targetId });
      } else if (action === "reject") {
        if (target.status !== "pending") return errorResponse("Esse pedido não está pendente.", 409);
        await env.DB.prepare("DELETE FROM community_members WHERE community_id = ? AND user_id = ?").bind(communityId, targetId).run();
        await logCommunityAction(env.DB, communityId, user.id, "reject_member", { userId: targetId });
      } else if (action === "ban") {
        const days = body.days === null || body.days === undefined ? null : Math.floor(Number(body.days));
        if (days !== null && (!Number.isFinite(days) || days < 1 || days > 3650)) return errorResponse("Prazo do banimento inválido (1 a 3650 dias, ou vazio para permanente).", 400);
        const until = days === null ? null : new Date(Date.now() + days * 86400000).toISOString().slice(0, 19).replace("T", " ");
        const exists = await env.DB.prepare("SELECT 1 FROM users WHERE id = ?").bind(targetId).first();
        if (!exists) return errorResponse("Pessoa não encontrada.", 404);
        await env.DB.prepare(
          `INSERT INTO community_members (user_id, community_id, role, status, banned_until, ban_reason, approved_poster)
           VALUES (?, ?, 'member', 'banned', ?, ?, 0)
           ON CONFLICT(user_id, community_id) DO UPDATE SET role = 'member', status = 'banned', banned_until = excluded.banned_until, ban_reason = excluded.ban_reason, approved_poster = 0`
        )
          .bind(targetId, communityId, until, reason || null)
          .run();
        await logCommunityAction(env.DB, communityId, user.id, "ban", { userId: targetId, note: `${days === null ? "permanente" : days + " dias"}${reason ? ": " + reason : ""}` });
      } else if (action === "unban") {
        if (target.status !== "banned") return errorResponse("Essa pessoa não está banida.", 409);
        await env.DB.prepare("DELETE FROM community_members WHERE community_id = ? AND user_id = ?").bind(communityId, targetId).run();
        await logCommunityAction(env.DB, communityId, user.id, "unban", { userId: targetId });
      } else if (action === "set_role") {
        if (!iAmOwner) return errorResponse("Só quem criou a comunidade define moderadores.", 403);
        if (body.role !== "moderator" && body.role !== "member") return errorResponse("Papel inválido.", 400);
        if (target.status !== "active") return errorResponse("A pessoa precisa ser membro ativo.", 409);
        await env.DB.prepare("UPDATE community_members SET role = ? WHERE community_id = ? AND user_id = ?").bind(body.role, communityId, targetId).run();
        await logCommunityAction(env.DB, communityId, user.id, body.role === "moderator" ? "add_moderator" : "remove_moderator", { userId: targetId });
      } else {
        if (target.status !== "active") return errorResponse("A pessoa precisa ser membro ativo.", 409);
        await env.DB.prepare("UPDATE community_members SET approved_poster = ? WHERE community_id = ? AND user_id = ?").bind(body.value ? 1 : 0, communityId, targetId).run();
        await logCommunityAction(env.DB, communityId, user.id, body.value ? "approve_poster" : "revoke_poster", { userId: targetId });
      }
      return jsonResponse({ ok: true });
    }

    // ---- Fixar / desafixar publicação (até 2)
    if (action === "pin" || action === "unpin") {
      const postId = Number(body.post_id);
      if (!postId) return errorResponse("post_id é obrigatório.", 400);
      const post = await env.DB.prepare("SELECT id, community_id FROM posts WHERE id = ?").bind(postId).first<{ id: number; community_id: number | null }>();
      if (!post || post.community_id !== communityId) return errorResponse("Publicação não encontrada nesta comunidade.", 404);
      if (action === "pin") {
        const count = await env.DB.prepare("SELECT COUNT(1) AS n FROM community_pins WHERE community_id = ?").bind(communityId).first<{ n: number }>();
        const already = await env.DB.prepare("SELECT 1 FROM community_pins WHERE community_id = ? AND post_id = ?").bind(communityId, postId).first();
        if (!already && (count?.n ?? 0) >= 2) return errorResponse("Só é possível fixar 2 publicações. Desafixe uma antes.", 409);
        await env.DB.prepare("INSERT OR IGNORE INTO community_pins (community_id, post_id, position) VALUES (?, ?, ?)").bind(communityId, postId, count?.n ?? 0).run();
      } else {
        await env.DB.prepare("DELETE FROM community_pins WHERE community_id = ? AND post_id = ?").bind(communityId, postId).run();
      }
      await logCommunityAction(env.DB, communityId, user.id, action, { postId });
      return jsonResponse({ ok: true });
    }

    // ---- Remover publicação da comunidade
    if (action === "remove_post") {
      const postId = Number(body.post_id);
      if (!postId) return errorResponse("post_id é obrigatório.", 400);
      const post = await env.DB.prepare("SELECT id, author_id, community_id, media_url FROM posts WHERE id = ?")
        .bind(postId)
        .first<{ id: number; author_id: number; community_id: number | null; media_url: string | null }>();
      if (!post || post.community_id !== communityId) return errorResponse("Publicação não encontrada nesta comunidade.", 404);

      if (post.media_url) {
        let r2Key: string | null = null;
        if (post.media_url.includes("/api/media/")) {
          const part = post.media_url.split("/api/media/")[1];
          r2Key = part ? decodeURIComponent(part.split("?")[0]) : null;
        } else if (post.media_url.startsWith("videos/") || post.media_url.startsWith("images/")) {
          r2Key = post.media_url.split("?")[0];
        }
        const bucket = env.MEDIA_BUCKET || env.BUCKET;
        if (r2Key && bucket) {
          try {
            await bucket.delete(r2Key);
          } catch (e) {
            console.error("Erro ao apagar mídia no R2:", e);
          }
        }
      }
      await env.DB.batch([
        env.DB.prepare("DELETE FROM comments WHERE post_id = ?").bind(postId),
        env.DB.prepare("DELETE FROM community_pins WHERE post_id = ?").bind(postId),
        env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(postId),
      ]);
      await logCommunityAction(env.DB, communityId, user.id, "remove_post", { userId: post.author_id, postId, note: reason || null });
      return jsonResponse({ ok: true, removed_id: postId });
    }

    // ---- Configurações da comunidade
    if (action === "update_settings") {
      const sets: string[] = [];
      const vals: unknown[] = [];
      const notes: string[] = [];

      if (body.description !== undefined) {
        const d = String(body.description).trim();
        if (d.length > 500) return errorResponse("A descrição deve ter no máximo 500 caracteres.", 400);
        sets.push("description = ?");
        vals.push(d);
        notes.push("descrição");
      }
      if (body.welcome_message !== undefined) {
        const w = String(body.welcome_message).trim();
        if (w.length > 500) return errorResponse("A mensagem de boas-vindas deve ter no máximo 500 caracteres.", 400);
        sets.push("welcome_message = ?");
        vals.push(w || null);
        notes.push("boas-vindas");
      }
      if (body.require_tag !== undefined) {
        sets.push("require_tag = ?");
        vals.push(body.require_tag ? 1 : 0);
        notes.push("exigir hashtag");
      }
      // Aparência: cor do tema e imagens (só arquivos enviados ao próprio Espectro)
      if (body.icon_color !== undefined) {
        if (typeof body.icon_color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(body.icon_color.trim())) return errorResponse("Cor inválida.", 400);
        sets.push("icon_color = ?");
        vals.push(body.icon_color.trim());
        notes.push("cor");
      }
      for (const [field, label] of [["icon_url", "ícone"], ["banner_url", "banner"]] as const) {
        const value = body[field];
        if (value === undefined) continue;
        const path = typeof value === "string" ? ownMediaPath(value, new URL(request.url).origin) : null;
        if (value !== null && !path) {
          return errorResponse("Imagem inválida. Envie o arquivo pelo Espectro.", 400);
        }
        sets.push(`${field} = ?`);
        vals.push(path);
        notes.push(label);
      }
      if (body.type !== undefined) {
        if (!iAmOwner) return errorResponse("Só quem criou a comunidade muda o tipo.", 403);
        if (!(COMMUNITY_TYPES as string[]).includes(body.type)) return errorResponse("Tipo inválido.", 400);
        sets.push("type = ?");
        vals.push(body.type as CommunityType);
        notes.push("tipo " + body.type);
      }

      const stmts: D1PreparedStatement[] = [];
      if (body.tags !== undefined) {
        const tags = cleanCommunityTags(body.tags);
        if (!tags) return errorResponse("Use até 8 hashtags válidas (letras, números e _).", 400);
        stmts.push(env.DB.prepare("DELETE FROM community_tags WHERE community_id = ?").bind(communityId));
        for (const tag of tags) stmts.push(env.DB.prepare("INSERT OR IGNORE INTO community_tags (community_id, tag) VALUES (?, ?)").bind(communityId, tag));
        notes.push("hashtags");
      }
      if (body.rules !== undefined) {
        const rules = cleanRules(body.rules);
        if (!rules) return errorResponse("Use até 15 regras, com título de até 100 caracteres e descrição de até 500.", 400);
        stmts.push(env.DB.prepare("DELETE FROM community_rules WHERE community_id = ?").bind(communityId));
        rules.forEach((rule, i) =>
          stmts.push(env.DB.prepare("INSERT INTO community_rules (community_id, position, title, description) VALUES (?, ?, ?, ?)").bind(communityId, i, rule.title, rule.description || null))
        );
        notes.push("regras");
      }
      if (sets.length) stmts.push(env.DB.prepare(`UPDATE communities SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, communityId));
      if (!stmts.length) return errorResponse("Nada para alterar.", 400);

      await env.DB.batch(stmts);
      await logCommunityAction(env.DB, communityId, user.id, "update_settings", { note: notes.join(", ") });
      return jsonResponse({ ok: true });
    }

    return errorResponse("Ação desconhecida.", 400);
  } catch (err: unknown) {
    return serverError(err, "community_mod");
  }
};
