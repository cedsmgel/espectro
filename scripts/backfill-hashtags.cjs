// Preenche as hashtags das publicações que já existiam antes da migração 0035.
// Uso:  node scripts/backfill-hashtags.cjs --remote
//       node scripts/backfill-hashtags.cjs --local --persist-to .wrangler/pwa
// Pode rodar de novo sem problema (só acrescenta o que falta). A regra de extração é a mesma de
// functions/_shared/hashtags.ts e src/lib/hashtags.ts.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const target = args.includes('--remote') ? ['--remote'] : ['--local', ...(args.includes('--persist-to') ? ['--persist-to', args[args.indexOf('--persist-to') + 1]] : [])];

const HASHTAG_RE = /(^|[^\p{L}\p{N}_&/#])#([\p{L}\p{N}_]{2,50})/gu;
const MAX = 10;
const normalize = (raw) => raw.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function extract(...texts) {
  const found = [];
  for (const text of texts) {
    if (!text) continue;
    const clean = text.replace(/`[^`]*`/g, ' ');
    for (const match of clean.matchAll(HASHTAG_RE)) {
      if (!/\p{L}/u.test(match[2])) continue;
      const tag = normalize(match[2]);
      if (!found.includes(tag)) found.push(tag);
      if (found.length >= MAX) return found;
    }
  }
  return found;
}

const wrangler = (extra) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'espectro', ...target, ...extra], { encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 });

const raw = wrangler(['--json', '--command', '"SELECT id, title, content FROM posts"']);
const parsed = JSON.parse(raw.slice(raw.indexOf('[')));
const posts = parsed[0].results;

const sql = [];
let linked = 0;
for (const post of posts) {
  for (const tag of extract(post.title, post.content)) {
    const safe = tag.replace(/'/g, "''");
    sql.push(`INSERT OR IGNORE INTO hashtags (tag) VALUES ('${safe}');`);
    sql.push(`INSERT OR IGNORE INTO post_hashtags (post_id, hashtag_id) SELECT ${Number(post.id)}, id FROM hashtags WHERE tag = '${safe}';`);
    linked++;
  }
}

if (!sql.length) {
  console.log(`${posts.length} publicações lidas; nenhuma hashtag para ligar.`);
  process.exit(0);
}
const file = path.join(os.tmpdir(), `backfill-hashtags-${Date.now()}.sql`);
fs.writeFileSync(file, sql.join('\n'));
wrangler(['--file', `"${file}"`]);
fs.unlinkSync(file);
console.log(`${posts.length} publicações lidas; ${linked} vínculos de hashtag criados.`);
