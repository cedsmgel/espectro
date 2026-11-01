import { authStorage } from './api';

// Fila de eventos de leitura, enviada em lotes. Alimenta a ordenação do feed.
// A pessoa pode desligar em Configurações > Privacidade; o servidor então descarta tudo.
type PostEvent = { post_id: number; type: 'impression' | 'open' | 'dwell' | 'view'; value?: number };

const queue: PostEvent[] = [];
const seen = new Set<number>(); // impressões já contadas nesta sessão
const views = new Map<number, number>(); // visualizações por publicação nesta sessão (máx. 2: a mesma publicação não vira várias linhas)
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const token = authStorage.getToken();
  if (!token || queue.length === 0) {
    queue.length = 0;
    return;
  }
  const events = queue.splice(0, 50);
  fetch('/api/events', {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ events }),
  }).catch(() => {});
  if (queue.length) timer = setTimeout(flush, 2000);
}

export function trackPost(event: PostEvent) {
  if (!authStorage.getToken()) return;
  if (event.type === 'impression') {
    if (seen.has(event.post_id)) return;
    seen.add(event.post_id);
  }
  if (event.type === 'view') {
    const count = views.get(event.post_id) ?? 0;
    if (count >= 2) return;
    views.set(event.post_id, count + 1);
  }
  queue.push(event);
  if (queue.length >= 20) flush();
  else if (!timer) timer = setTimeout(flush, 5000);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}
