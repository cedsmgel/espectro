import { buildAffinities, Candidate, EventRow, Signals } from "./ranking";

function groupTags(rows: Array<{ post_id: number; tag: string }> | undefined): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const r of rows || []) {
    const list = map.get(r.post_id);
    if (list) list.push(r.tag);
    else map.set(r.post_id, [r.tag]);
  }
  return map;
}

// Junta, numa só ida ao banco (db.batch), tudo que o ranking precisa saber da pessoa e das publicações candidatas
export async function loadSignals(db: D1Database, viewerId: number | null, candidates: Candidate[]): Promise<Signals> {
  const minId = candidates.reduce((m, c) => (c.id < m ? c.id : m), Number.MAX_SAFE_INTEGER);
  const empty: Signals = {
    viewerId: viewerId ?? -1,
    follows: new Set(),
    friends: new Set(),
    communities: new Set(),
    authorAffinity: new Map(),
    tagAffinity: new Map(),
    seen: new Map(),
    postTags: new Map(),
  };
  if (!candidates.length) return empty;

  const tagsOfCandidates = db
    .prepare("SELECT ph.post_id, h.tag FROM post_hashtags ph JOIN hashtags h ON h.id = ph.hashtag_id WHERE ph.post_id >= ?")
    .bind(minId);

  // Visitante: só qualidade e frescor
  if (!viewerId) {
    const [tags] = await db.batch<{ post_id: number; tag: string }>([tagsOfCandidates]);
    return { ...empty, postTags: groupTags(tags.results) };
  }

  const [tags, follows, friends, communities, pref, events, eventTags] = await db.batch<Record<string, number | string | null>>([
    tagsOfCandidates,
    db.prepare("SELECT following_id AS id FROM follows WHERE follower_id = ?").bind(viewerId),
    db
      .prepare("SELECT CASE WHEN user_id = ?1 THEN friend_id ELSE user_id END AS id FROM friendships WHERE status = 'accepted' AND (user_id = ?1 OR friend_id = ?1)")
      .bind(viewerId),
    db.prepare("SELECT community_id AS id FROM community_members WHERE user_id = ? AND status = 'active'").bind(viewerId),
    db.prepare("SELECT personalization FROM users WHERE id = ?").bind(viewerId),
    db
      .prepare(
        `SELECT e.post_id, e.type, e.value, p.author_id
         FROM (SELECT post_id, type, value FROM post_events WHERE user_id = ? ORDER BY id DESC LIMIT 1500) e
         JOIN posts p ON p.id = e.post_id`
      )
      .bind(viewerId),
    db
      .prepare(
        `SELECT ph.post_id, h.tag FROM post_hashtags ph JOIN hashtags h ON h.id = ph.hashtag_id
         WHERE ph.post_id IN (SELECT post_id FROM (SELECT post_id FROM post_events WHERE user_id = ? ORDER BY id DESC LIMIT 1500))`
      )
      .bind(viewerId),
  ]);

  const ids = (r: D1Result<Record<string, number | string | null>>) => new Set((r.results || []).map((x) => Number(x.id)));
  const personalized = Number((pref.results?.[0] as { personalization?: number } | undefined)?.personalization ?? 1) !== 0;
  const affinities = personalized
    ? buildAffinities((events.results || []) as unknown as EventRow[], groupTags(eventTags.results as unknown as Array<{ post_id: number; tag: string }>))
    : { authorAffinity: new Map(), tagAffinity: new Map(), seen: new Map() };

  return {
    viewerId,
    follows: ids(follows),
    friends: ids(friends),
    communities: ids(communities),
    postTags: groupTags(tags.results as unknown as Array<{ post_id: number; tag: string }>),
    ...affinities,
  };
}
