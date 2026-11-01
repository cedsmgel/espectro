import { CommunityType, getMembership } from "./communities";

export interface JoinResult {
  status: number;
  body: Record<string, unknown>;
}

async function activeCount(db: D1Database, communityId: number): Promise<number> {
  const row = await db.prepare("SELECT COUNT(1) AS total FROM community_members WHERE community_id = ? AND status = 'active'").bind(communityId).first<{ total: number }>();
  return row ? row.total : 0;
}

// Entrar (ou pedir para entrar): pública e restrita entram na hora; privada fica pendente até a moderação aprovar
export async function joinCommunity(db: D1Database, communityId: number, userId: number): Promise<JoinResult> {
  const community = await db.prepare("SELECT id, name, type FROM communities WHERE id = ?").bind(communityId).first<{ id: number; name: string; type: CommunityType }>();
  if (!community) return { status: 404, body: { error: "Comunidade não encontrada." } };

  const membership = await getMembership(db, communityId, userId);
  if (membership.status === "banned") {
    return { status: 403, body: { error: `Você foi banido desta comunidade${membership.banReason ? `: ${membership.banReason}` : "."}` } };
  }

  let status = membership.status;
  if (!status) {
    status = community.type === "private" ? "pending" : "active";
    await db.prepare("INSERT OR IGNORE INTO community_members (user_id, community_id, role, status) VALUES (?, ?, 'member', ?)").bind(userId, communityId, status).run();
  }

  return {
    status: 200,
    body: {
      message: status === "pending" ? `Pedido enviado. A moderação de e/${community.name} vai analisar.` : `Você entrou na comunidade e/${community.name}!`,
      community_id: communityId,
      is_member: status === "active",
      status,
      members_count: await activeCount(db, communityId),
    },
  };
}

// Sair (ou cancelar o pedido). Quem criou não sai; o banimento não some ao "sair".
export async function leaveCommunity(db: D1Database, communityId: number, userId: number): Promise<JoinResult> {
  const membership = await getMembership(db, communityId, userId);
  if (membership.role === "owner") {
    return { status: 400, body: { error: "Quem criou a comunidade não pode sair. Transfira a comunidade para outra pessoa primeiro." } };
  }
  if (membership.status !== "banned") {
    await db.prepare("DELETE FROM community_members WHERE user_id = ? AND community_id = ?").bind(userId, communityId).run();
  }
  return {
    status: 200,
    body: { message: "Você saiu da comunidade.", community_id: communityId, is_member: false, status: null, members_count: await activeCount(db, communityId) },
  };
}
