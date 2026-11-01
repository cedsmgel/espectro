import React, { useEffect, useState } from 'react';
import { adminApi, AdminVitals, AdminVitalsMetric } from '../../lib/api';

// Limites do Google para o percentil 75: até "bom" é verde, acima de "ruim" é vermelho
const METRICS: Array<{ name: string; label: string; hint: string; good: number; poor: number; unit: 'ms' | 'score' }> = [
  { name: 'LCP', label: 'Conteúdo principal', hint: 'Tempo até aparecer a maior parte da tela (LCP)', good: 2500, poor: 4000, unit: 'ms' },
  { name: 'INP', label: 'Resposta ao toque', hint: 'Tempo entre tocar e a tela reagir (INP)', good: 200, poor: 500, unit: 'ms' },
  { name: 'CLS', label: 'Estabilidade', hint: 'Quanto o conteúdo pula enquanto carrega (CLS)', good: 0.1, poor: 0.25, unit: 'score' },
  { name: 'FCP', label: 'Primeira imagem', hint: 'Tempo até aparecer qualquer coisa na tela (FCP)', good: 1800, poor: 3000, unit: 'ms' },
  { name: 'TTFB', label: 'Resposta do servidor', hint: 'Tempo até o servidor começar a responder (TTFB)', good: 800, poor: 1800, unit: 'ms' },
];

const DEVICES: Array<{ id: 'phone' | 'desktop'; label: string }> = [
  { id: 'phone', label: 'Celular' },
  { id: 'desktop', label: 'Computador' },
];

type Tone = 'good' | 'needs' | 'poor';

function toneOf(value: number, good: number, poor: number): Tone {
  return value <= good ? 'good' : value <= poor ? 'needs' : 'poor';
}

const TONE_TEXT: Record<Tone, string> = { good: 'text-emerald-500', needs: 'text-amber-500', poor: 'text-error' };
const TONE_LABEL: Record<Tone, string> = { good: 'Bom', needs: 'Pode melhorar', poor: 'Ruim' };

function format(value: number, unit: 'ms' | 'score'): string {
  if (unit === 'score') return value.toFixed(2);
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(1)} s`;
}

const Distribution: React.FC<{ metric: AdminVitalsMetric }> = ({ metric }) => {
  const total = metric.good + metric.needs + metric.poor || 1;
  return (
    <div
      className="flex h-1.5 w-full rounded-full overflow-hidden bg-surface-container-high"
      role="img"
      aria-label={`${Math.round((metric.good / total) * 100)}% bom, ${Math.round((metric.needs / total) * 100)}% pode melhorar, ${Math.round((metric.poor / total) * 100)}% ruim`}
    >
      <span className="bg-emerald-500" style={{ width: `${(metric.good / total) * 100}%` }} />
      <span className="bg-amber-500" style={{ width: `${(metric.needs / total) * 100}%` }} />
      <span className="bg-error" style={{ width: `${(metric.poor / total) * 100}%` }} />
    </div>
  );
};

// Desempenho real percebido por quem usa o app, medido nos aparelhos das pessoas
export const PerformanceTab: React.FC = () => {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<AdminVitals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    adminApi
      .vitals(days)
      .then((res) => active && setData(res))
      .catch((err: any) => active && setError(err?.message || 'Não foi possível carregar as medições.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [days]);

  const find = (name: string, device: string) => data?.metrics.find((m) => m.name === name && m.device === device);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-full border border-outline-variant self-start">
        {[7, 30].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setDays(value)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
              days === value ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {value} dias
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-error bg-error-container/60 rounded-xl px-3 py-2">{error}</p>}
      {loading && <p className="text-xs text-on-surface-variant text-center py-4">Carregando...</p>}

      {!loading && !error && data && data.total === 0 && (
        <p className="text-sm text-on-surface-variant text-center py-10">
          Ainda sem medições neste período. Elas aparecem conforme as pessoas abrem o app.
        </p>
      )}

      {!loading && data && data.total > 0 && (
        <>
          <p className="text-[11px] text-on-surface-variant">
            {data.total} medições nos últimos {data.days} dias. O número grande é o percentil 75: três em cada quatro visitas
            foram melhores que ele.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {METRICS.map((metric) => (
              <article key={metric.name} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-bold text-on-surface">{metric.label}</h3>
                  <p className="text-[11px] text-on-surface-variant">{metric.hint}</p>
                </div>
                {DEVICES.map((device) => {
                  const row = find(metric.name, device.id);
                  if (!row) {
                    return (
                      <div key={device.id} className="text-[11px] text-on-surface-variant">
                        {device.label}: sem dados
                      </div>
                    );
                  }
                  const tone = toneOf(row.p75, metric.good, metric.poor);
                  return (
                    <div key={device.id} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-semibold text-on-surface-variant">{device.label}</span>
                        <span className="text-[11px] text-on-surface-variant">{row.count} medições</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-bold tabular-nums ${TONE_TEXT[tone]}`}>{format(row.p75, metric.unit)}</span>
                        <span className={`text-[11px] font-semibold ${TONE_TEXT[tone]}`}>{TONE_LABEL[tone]}</span>
                      </div>
                      <Distribution metric={row} />
                    </div>
                  );
                })}
              </article>
            ))}
          </div>

          {data.pages.length > 0 && (
            <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
              <h3 className="text-sm font-bold text-on-surface mb-1">Páginas de entrada mais lentas</h3>
              <p className="text-[11px] text-on-surface-variant mb-3">Tempo até o conteúdo principal aparecer (LCP, percentil 75).</p>
              <ul className="flex flex-col gap-2">
                {data.pages.map((page) => {
                  const tone = toneOf(page.p75, 2500, 4000);
                  return (
                    <li key={page.path} className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-mono text-on-surface truncate">{page.path}</span>
                      <span className="flex items-baseline gap-2 shrink-0">
                        <span className="text-[11px] text-on-surface-variant">{page.count} visitas</span>
                        <span className={`font-bold tabular-nums ${TONE_TEXT[tone]}`}>{format(page.p75, 'ms')}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
};
