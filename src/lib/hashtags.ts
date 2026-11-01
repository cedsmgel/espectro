// Mesma regra do servidor (functions/_shared/hashtags.ts): #palavra com 2 a 50 letras, números ou _, com ao menos uma letra.
// Sem lookbehind, para funcionar em Safari/iOS mais antigos.
const HASHTAG_RE = /(^|[^\p{L}\p{N}_&/#])#([\p{L}\p{N}_]{2,50})/gu;

// Forma usada no endereço e no banco: minúscula e sem acentos
export function tagKey(raw: string): string {
  return raw.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export interface TextPart {
  text: string;
  // Preenchido quando o trecho é uma hashtag
  tag?: string;
}

// Divide um texto em trechos comuns e hashtags, na ordem original
export function splitHashtags(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(HASHTAG_RE)) {
    const word = match[2];
    if (!/\p{L}/u.test(word)) continue;
    const start = (match.index ?? 0) + match[1].length;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: `#${word}`, tag: tagKey(word) });
    last = start + 1 + word.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.length ? parts : [{ text }];
}

// A palavra que está sendo digitada com # na posição do cursor (para sugestões), ou null
export function hashtagAtCursor(value: string, cursor: number): string | null {
  const before = value.slice(0, cursor);
  const match = /(^|[^\p{L}\p{N}_&/#])#([\p{L}\p{N}_]{1,50})$/u.exec(before);
  return match ? match[2] : null;
}
