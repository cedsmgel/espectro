import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

// Rotas com identificador viram um padrão, para a medição agrupar as páginas do mesmo tipo
const ROUTES: Array<[RegExp, string]> = [
  [/^\/post\/[^/]+/, '/post/:id'],
  [/^\/(u|perfil|profile)\/[^/]+/, '/perfil/:username'],
  [/^\/(c|e|comunidade|comunidades)\/[^/]+/, '/e/:slug'],
  [/^\/grupos\/[^/]+/, '/grupos/:id'],
  [/^\/(settings|configuracoes)\//, '/configuracoes'],
];

export function routeLabel(pathname: string): string {
  for (const [pattern, label] of ROUTES) {
    if (pattern.test(pathname)) return label;
  }
  const clean = pathname.replace(/\/+$/, '') || '/';
  return /^[/\w.-]{1,40}$/.test(clean) ? clean : '/outra';
}

function report(metric: Metric, route: string, device: 'phone' | 'desktop') {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    path: route,
    device,
    connection: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? null,
  });

  try {
    if (navigator.sendBeacon && navigator.sendBeacon('/api/vitals', new Blob([body], { type: 'application/json' }))) return;
  } catch {}
  void fetch('/api/vitals', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
}

// Mede a experiência real de quem usa o app (sem identificar a pessoa) e envia para /api/vitals.
// A rota guardada é a de entrada: cada medição vale para a visita que começou nela.
export function startVitals(): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  const route = routeLabel(window.location.pathname);
  const device = window.matchMedia('(max-width: 767px)').matches ? 'phone' : 'desktop';
  const handler = (metric: Metric) => report(metric, route, device);

  onTTFB(handler);
  onFCP(handler);
  onLCP(handler);
  onCLS(handler);
  onINP(handler);
}
