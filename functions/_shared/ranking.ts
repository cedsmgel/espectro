// Ranking do feed "Para Você". Regras simples e explicáveis (sem modelo treinado): cada publicação ganha uma nota
// = qualidade (votos e comentários) x frescor x relação com a pessoa x afinidade x "já vista".
// Roda sobre um conjunto pequeno de candidatas (as 300 mais recentes) para caber nos 10 ms de CPU do plano gratuito.
// As constantes ficam todas aqui para ajustar com os dados de verdade.

export interface Candidate {
  id: number;
  author_id: number;
  community_id: number | null;
  created_at: string; // "YYYY-MM-DD HH:MM:SS" em UTC
  upvotes: number;
  downvotes: number;
  comments_count: number;
  author_name?: string;
  community_name?: string | null;
}

export interface Signals {
  viewerId: number;
  follows: Set<number>;
  friends: Set<number>;
  communities: Set<number>;
  // 0..1: quanto a pessoa lê aquele autor / assunto (vem do histórico de leitura; vazio se desligou a personalização)
  authorAffinity: Map<number, number>;
  tagAffinity: Map<string, number>;
  seen: Map<number, { impressions: number; opens: number }>;
  postTags: Map<number, string[]>;
}

export const WEIGHTS = {
  freshnessHours: 2, // soma ao tempo para a nota não explodir em publicações recém-criadas
  freshnessDecay: 1.25, // quanto mais alto, mais rápido o feed "esquece" publicações velhas
  follow: 1.7,
  friend: 1.5,
  community: 1.25,
  own: 0.5, // as próprias publicações não dominam o topo
  authorAffinity: 0.9,
  tagAffinity: 0.6,
  seenPerImpression: 0.55, // cada vez que apareceu na tela sem ser aberta
  seenOpened: 0.5, // já aberta (lida)
  seenFloor: 0.1,
  negativeVotes: 0.5, // mais descurtidas que curtidas
  authorRepeat: 0.75, // diversidade: cada publicação do mesmo autor já escolhida reduz a próxima
};

export interface Ranked<T> {
  post: T;
  score: number;
  why: string | null;
}

function ageHours(createdAt: string, now: number): number {
  const t = new Date(createdAt.replace(" ", "T") + "Z").getTime();
  return Number.isFinite(t) ? Math.max(0, (now - t) / 3_600_000) : 0;
}

export function scorePost(c: Candidate, s: Signals, now: number): { score: number; why: string | null } {
  const w = WEIGHTS;
  const net = c.upvotes - c.downvotes;
  const quality = (1 + Math.log1p(Math.max(0, net)) + 0.5 * Math.log1p(Math.max(0, c.comments_count))) * (net < -2 ? w.negativeVotes : 1);
  const freshness = 1 / Math.pow(ageHours(c.created_at, now) + w.freshnessHours, w.freshnessDecay);

  let relation = 1;
  let why: string | null = null;
  if (c.author_id === s.viewerId) relation = w.own;
  else if (s.follows.has(c.author_id)) {
    relation = w.follow;
    why = "Você segue";
  } else if (s.friends.has(c.author_id)) {
    relation = w.friend;
    why = "Seu amigo";
  } else if (c.community_id && s.communities.has(c.community_id)) {
    relation = w.community;
    why = c.community_name ? `Da comunidade e/${c.community_name}` : "Da sua comunidade";
  }

  const authorAff = s.authorAffinity.get(c.author_id) ?? 0;
  let tagAff = 0;
  let bestTag: string | null = null;
  for (const tag of s.postTags.get(c.id) || []) {
    const a = s.tagAffinity.get(tag) ?? 0;
    if (a > tagAff) {
      tagAff = a;
      bestTag = tag;
    }
  }
  if (!why && authorAff >= 0.3 && c.author_name) why = `Você costuma ler @${c.author_name}`;
  if (!why && tagAff >= 0.3 && bestTag) why = `Parecido com o que você lê (#${bestTag})`;
  if (!why && net >= 5) why = "Em alta";

  const seen = s.seen.get(c.id);
  let seenFactor = 1;
  if (seen) {
    seenFactor = seen.opens > 0 ? w.seenOpened : Math.pow(w.seenPerImpression, seen.impressions);
    seenFactor = Math.max(w.seenFloor, seenFactor);
  }

  const affinity = 1 + w.authorAffinity * authorAff + w.tagAffinity * tagAff;
  return { score: quality * freshness * relation * affinity * seenFactor, why };
}

// Ordena por nota e, na hora de escolher, reduz quem já apareceu muito entre as escolhidas (diversidade de autores)
export function rankFeed<T extends Candidate>(candidates: T[], signals: Signals, now: number, limit: number): Array<Ranked<T>> {
  const scored = candidates.map((post) => ({ post, ...scorePost(post, signals, now) }));
  const picked: Array<Ranked<T>> = [];
  const perAuthor = new Map<number, number>();
  const pool = scored.slice();

  while (picked.length < limit && pool.length) {
    let bestIndex = 0;
    let bestValue = -1;
    for (let i = 0; i < pool.length; i++) {
      const used = perAuthor.get(pool[i].post.author_id) ?? 0;
      const value = pool[i].score * Math.pow(WEIGHTS.authorRepeat, used);
      if (value > bestValue) {
        bestValue = value;
        bestIndex = i;
      }
    }
    const [chosen] = pool.splice(bestIndex, 1);
    perAuthor.set(chosen.post.author_id, (perAuthor.get(chosen.post.author_id) ?? 0) + 1);
    picked.push({ post: chosen.post, score: bestValue, why: chosen.why });
  }
  return picked;
}

// ---- Sinais da pessoa, a partir do histórico de leitura (post_events) --------------------------------------

export interface EventRow {
  post_id: number;
  type: string;
  value: number | null;
  author_id: number;
}

// Peso de cada evento: abrir vale 2; ficar na tela vale até 3 (30 s); só aparecer não conta como interesse
function eventWeight(e: EventRow): number {
  if (e.type === "open") return 2;
  if (e.type === "dwell" || e.type === "view") return Math.min(e.value ?? 0, 30_000) / 10_000;
  return 0;
}

export function buildAffinities(
  events: EventRow[],
  tagsOfPost: Map<number, string[]>
): { authorAffinity: Map<number, number>; tagAffinity: Map<string, number>; seen: Map<number, { impressions: number; opens: number }> } {
  const authorRaw = new Map<number, number>();
  const tagRaw = new Map<string, number>();
  const seen = new Map<number, { impressions: number; opens: number }>();

  for (const e of events) {
    const entry = seen.get(e.post_id) ?? { impressions: 0, opens: 0 };
    if (e.type === "impression" || e.type === "view") entry.impressions += 1;
    if (e.type === "open") entry.opens += 1;
    seen.set(e.post_id, entry);

    const weight = eventWeight(e);
    if (weight <= 0) continue;
    authorRaw.set(e.author_id, (authorRaw.get(e.author_id) ?? 0) + weight);
    for (const tag of tagsOfPost.get(e.post_id) || []) tagRaw.set(tag, (tagRaw.get(tag) ?? 0) + weight);
  }

  // x / (x + k) leva qualquer soma para 0..1 sem deixar um autor ou assunto dominar
  const authorAffinity = new Map<number, number>();
  for (const [id, raw] of authorRaw) authorAffinity.set(id, raw / (raw + 4));
  const tagAffinity = new Map<string, number>();
  for (const [tag, raw] of tagRaw) tagAffinity.set(tag, raw / (raw + 6));
  return { authorAffinity, tagAffinity, seen };
}
