export const MAX_GROUP_MEMBERS = 256;

export interface Membership {
  role: "admin" | "member";
  joined_at: string;
}

// Papel e data de entrada de um usuário no grupo; null se não for membro
export async function membership(db: D1Database, groupId: number, userId: number): Promise<Membership | null> {
  const row = await db
    .prepare("SELECT role, strftime('%Y-%m-%d %H:%M:%S', joined_at) AS joined_at FROM chat_group_members WHERE group_id = ? AND user_id = ?")
    .bind(groupId, userId)
    .first<Membership>();
  return row ? { role: row.role as Membership["role"], joined_at: row.joined_at } : null;
}

export async function memberCount(db: D1Database, groupId: number): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM chat_group_members WHERE group_id = ?")
    .bind(groupId)
    .first<{ n: number }>();
  return Number(row?.n || 0);
}
