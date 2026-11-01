import { getMembership, isActive, isMod } from "./communities";

// Dados de uma comunidade para quem está vendo (mesmo formato em /api/communities?slug= e /api/communities/:slug)
export async function loadCommunityDetail(db: D1Database, slugOrId: string, viewerId: number | null): Promise<Record<string, unknown> | null> {
  const base = await db
    .prepare(
      `SELECT c.id, c.name, c.slug, c.description, c.icon_color, c.icon_url, c.banner_url, c.owner_id, c.created_at, c.type, c.welcome_message, c.require_tag,
              u.username AS owner_name,
              (SELECT COUNT(1) FROM community_members m WHERE m.community_id = c.id AND m.status = 'active') AS members_count
       FROM communities c JOIN users u ON u.id = c.owner_id
       WHERE c.slug = ? OR CAST(c.id AS TEXT) = ?`
    )
    .bind(slugOrId, slugOrId)
    .first<{ id: number; type: string; welcome_message: string | null; require_tag: number } & Record<string, unknown>>();
  if (!base) return null;

  const membership = await getMembership(db, base.id, viewerId);
  const detail: Record<string, unknown> = {
    ...base,
    require_tag: Boolean(base.require_tag),
    is_member: isActive(membership),
    my_role: membership.role,
    my_status: membership.status,
    i_am_mod: isMod(membership),
    can_post_here: false,
    ban_reason: membership.status === "banned" ? membership.banReason : null,
    banned_until: membership.status === "banned" ? membership.bannedUntil : null,
  };

  if (isMod(membership)) {
    const pending = await db.prepare("SELECT COUNT(1) AS n FROM community_members WHERE community_id = ? AND status = 'pending'").bind(base.id).first<{ n: number }>();
    detail.pending_count = pending ? pending.n : 0;
  }

  // Comunidade privada: quem não é membro vê só o cartão de apresentação (sem regras, hashtags nem boas-vindas)
  const locked = base.type === "private" && !isActive(membership);
  detail.locked = locked;
  if (locked) {
    detail.welcome_message = null;
    detail.rules = [];
    detail.tags = [];
    return detail;
  }

  const [rules, tags] = await Promise.all([
    db.prepare("SELECT title, description FROM community_rules WHERE community_id = ? ORDER BY position, id").bind(base.id).all(),
    db.prepare("SELECT tag FROM community_tags WHERE community_id = ? ORDER BY tag").bind(base.id).all<{ tag: string }>(),
  ]);
  detail.rules = rules.results || [];
  detail.tags = (tags.results || []).map((t) => t.tag);

  const type = base.type;
  detail.can_post_here =
    membership.status !== "banned" &&
    !!viewerId &&
    (type === "public" || (type === "restricted" ? isMod(membership) || (isActive(membership) && membership.approvedPoster) : isActive(membership)));
  return detail;
}
