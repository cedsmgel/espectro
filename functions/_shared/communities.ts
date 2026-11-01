import { normalizeTag } from "./hashtags";

// Regras de comunidade do Espectro (modelo do Reddit): nome 3 a 21 caracteres, tipos público/restrito/privado,
// moderação por papéis, hashtags no lugar de flairs.

export type CommunityType = "public" | "restricted" | "private";
export const COMMUNITY_TYPES: CommunityType[] = ["public", "restricted", "private"];

export const NAME_RE = /^[A-Za-z0-9_]{3,21}$/;
export const MAX_RULES = 15;
export const MAX_COMMUNITY_TAGS = 8;

export interface Membership {
  role: "owner" | "moderator" | "member" | null;
  status: "active" | "pending" | "banned" | null;
  approvedPoster: boolean;
  banReason: string | null;
  bannedUntil: string | null;
}

export const NO_MEMBERSHIP: Membership = { role: null, status: null, approvedPoster: false, banReason: null, bannedUntil: null };

export const isActive = (m: Membership) => m.status === "active";
export const isMod = (m: Membership) => isActive(m) && (m.role === "owner" || m.role === "moderator");

// Banimento com prazo vencido deixa de valer: a linha é limpa na hora e a pessoa volta a poder entrar
export async function getMembership(db: D1Database, communityId: number, userId: number | null): Promise<Membership> {
  if (!userId || userId <= 0) return NO_MEMBERSHIP;
  const row = await db
    .prepare("SELECT role, status, banned_until, ban_reason, approved_poster FROM community_members WHERE community_id = ? AND user_id = ?")
    .bind(communityId, userId)
    .first<{ role: Membership["role"]; status: Membership["status"]; banned_until: string | null; ban_reason: string | null; approved_poster: number }>();
  if (!row) return NO_MEMBERSHIP;

  if (row.status === "banned" && row.banned_until && new Date(row.banned_until.replace(" ", "T") + "Z").getTime() <= Date.now()) {
    await db.prepare("DELETE FROM community_members WHERE community_id = ? AND user_id = ?").bind(communityId, userId).run();
    return NO_MEMBERSHIP;
  }
  return { role: row.role, status: row.status, approvedPoster: Boolean(row.approved_poster), banReason: row.ban_reason, bannedUntil: row.banned_until };
}

export function canViewContent(type: CommunityType, m: Membership): boolean {
  return type !== "private" || isActive(m);
}

// Quem pode publicar: público = qualquer pessoa não banida; restrito = aprovados e moderação; privado = membros ativos
export function canPost(type: CommunityType, m: Membership): boolean {
  if (m.status === "banned") return false;
  if (type === "public") return true;
  if (type === "restricted") return isMod(m) || (isActive(m) && m.approvedPoster);
  return isActive(m);
}

// Valida e limpa a lista de hashtags da comunidade; devolve null se algo estiver inválido
export function cleanCommunityTags(input: unknown): string[] | null {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) return null;
  const tags: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") return null;
    const tag = normalizeTag(raw.trim().replace(/^#/, ""));
    if (!tag) continue;
    if (!/^[\p{L}\p{N}_]{2,30}$/u.test(tag) || !/\p{L}/u.test(tag)) return null;
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags.length > MAX_COMMUNITY_TAGS ? null : tags;
}

export function cleanRules(input: unknown): Array<{ title: string; description: string }> | null {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || input.length > MAX_RULES) return null;
  const rules: Array<{ title: string; description: string }> = [];
  for (const item of input) {
    const title = typeof item?.title === "string" ? item.title.trim() : "";
    const description = typeof item?.description === "string" ? item.description.trim() : "";
    if (!title) continue;
    if (title.length > 100 || description.length > 500) return null;
    rules.push({ title, description });
  }
  return rules;
}

// Condição SQL: publicações de comunidade privada só aparecem para membros ativos (? = id de quem vê).
// Requer a tabela de comunidades com o alias "c" (LEFT JOIN) e as publicações com o alias "p".
export const VISIBLE_IN_PRIVATE_SQL = `(p.community_id IS NULL OR COALESCE(c.type, 'public') != 'private' OR EXISTS (
  SELECT 1 FROM community_members vm WHERE vm.community_id = p.community_id AND vm.user_id = ? AND vm.status = 'active'))`;

// Para descoberta pública (busca, hashtags): conteúdo de comunidade privada nunca entra, para ninguém
export const NOT_IN_PRIVATE_SQL = `(p.community_id IS NULL OR p.community_id NOT IN (SELECT id FROM communities WHERE type = 'private'))`;

export async function communityTypeOf(db: D1Database, communityId: number): Promise<CommunityType | null> {
  const row = await db.prepare("SELECT type FROM communities WHERE id = ?").bind(communityId).first<{ type: CommunityType }>();
  return row ? row.type : null;
}

// A pessoa pode ver o que está dentro da comunidade (e dos posts dela)?
export async function canViewCommunityId(db: D1Database, communityId: number | null, viewerId: number | null): Promise<boolean> {
  if (!communityId) return true;
  const type = await communityTypeOf(db, communityId);
  if (!type || type !== "private") return true;
  return isActive(await getMembership(db, communityId, viewerId));
}

export async function logCommunityAction(
  db: D1Database,
  communityId: number,
  moderatorId: number | null,
  action: string,
  target: { userId?: number | null; postId?: number | null; note?: string | null } = {}
): Promise<void> {
  await db
    .prepare("INSERT INTO community_mod_log (community_id, moderator_id, action, target_user_id, target_post_id, note) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(communityId, moderatorId, action, target.userId ?? null, target.postId ?? null, target.note ?? null)
    .run();
}
