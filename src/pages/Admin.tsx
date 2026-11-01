import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { EmptyState } from '../components/EmptyState';
import { adminApi, AdminReport, AdminUser, authStorage } from '../lib/api';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { PerformanceTab } from '../components/admin/PerformanceTab';

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  assedio: 'Assédio ou ameaça',
  conteudo_improprio: 'Conteúdo impróprio',
  golpe: 'Golpe ou falsidade',
  outro: 'Outro motivo',
};

function formatDate(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const Badge: React.FC<{ tone: 'error' | 'neutral' | 'primary'; children: React.ReactNode }> = ({ tone, children }) => (
  <span
    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
      tone === 'error'
        ? 'bg-error-container text-on-error-container'
        : tone === 'primary'
        ? 'bg-primary/15 text-primary'
        : 'bg-surface-container-high text-on-surface-variant'
    }`}
  >
    {children}
  </span>
);

const Quote: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="rounded-xl bg-surface-container-low border-l-4 border-outline-variant px-3 py-2">
    <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-0.5">{label}</span>
    <div className="text-xs text-on-surface whitespace-pre-wrap break-words">{children}</div>
  </div>
);

const ReportCard: React.FC<{
  report: AdminReport;
  onResolve: (
    report: AdminReport,
    body: { resolution: 'dismissed' | 'actioned'; note?: string; suspend?: boolean; remove_content?: boolean }
  ) => Promise<void>;
}> = ({ report, onResolve }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const isOpen = report.status === 'open';
  const hasContent = Boolean(report.post_id || report.comment_id);

  const run = async (body: { resolution: 'dismissed' | 'actioned'; suspend?: boolean; remove_content?: boolean }, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await onResolve(report, { ...body, note: note.trim() || undefined });
    } finally {
      setBusy(false);
    }
  };

  const buttonClass =
    'px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer disabled:opacity-50 transition-colors';

  return (
    <article className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="error">{REASON_LABELS[report.reason] || report.reason}</Badge>
        <span className="text-[11px] text-on-surface-variant">
          #{report.id} · {formatDate(report.created_at)}
        </span>
      </div>

      <p className="text-xs text-on-surface flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="font-semibold">@{report.reporter_username}</span> denunciou
        <Link to={`/perfil/${encodeURIComponent(report.reported_username)}`} className="font-semibold text-primary hover:underline">
          @{report.reported_username}
        </Link>
        <Badge tone="neutral">{report.reported_total} denúncia(s) no total</Badge>
        {report.reported_suspended && <Badge tone="error">Conta suspensa</Badge>}
        {report.reported_is_admin && <Badge tone="primary">Admin</Badge>}
      </p>

      {report.details && <Quote label="Detalhes da denúncia">{report.details}</Quote>}
      {report.message_id && (
        <Quote label="Mensagem denunciada">{report.message_content || 'Mensagem sem texto (mídia).'}</Quote>
      )}
      {report.post_id && (
        <Quote label="Publicação denunciada">
          {report.post_title || report.post_content ? (
            <>
              {report.post_title && <strong className="block">{report.post_title}</strong>}
              {report.post_content}
              <Link to={`/post/${report.post_id}`} className="block mt-1 text-primary hover:underline">
                Abrir publicação
              </Link>
            </>
          ) : (
            'A publicação já foi removida.'
          )}
        </Quote>
      )}
      {report.comment_id && (
        <Quote label="Comentário denunciado">{report.comment_content || 'O comentário já foi removido.'}</Quote>
      )}

      {isOpen ? (
        <div className="flex flex-col gap-2.5 pt-1">
          <input
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Observação (opcional, fica no registro)"
            className="w-full h-9 px-3 rounded-xl bg-surface-container-low text-xs text-on-surface placeholder:text-on-surface-variant outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run({ resolution: 'dismissed' })}
              className={`${buttonClass} bg-surface-container text-on-surface hover:bg-surface-container-high`}
            >
              Dispensar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run({ resolution: 'actioned' })}
              className={`${buttonClass} bg-primary-container text-on-primary hover:bg-primary`}
            >
              Marcar como resolvida
            </button>
            {hasContent && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run({ resolution: 'actioned', remove_content: true }, 'Remover este conteúdo definitivamente?')}
                className={`${buttonClass} bg-error text-white hover:opacity-90`}
              >
                Remover conteúdo
              </button>
            )}
            {!report.reported_is_admin && !report.reported_suspended && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    { resolution: 'actioned', suspend: true },
                    `Suspender a conta de @${report.reported_username}? A pessoa perde o acesso imediatamente.`
                  )
                }
                className={`${buttonClass} bg-error text-white hover:opacity-90`}
              >
                Suspender conta
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-on-surface-variant">
          {report.resolution === 'dismissed' ? 'Dispensada' : 'Resolvida'} em {formatDate(report.resolved_at)}
          {report.resolution_note ? ` · ${report.resolution_note}` : ''}
        </p>
      )}
    </article>
  );
};

const ReportsTab: React.FC<{ onCount: (n: number) => void }> = ({ onCount }) => {
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (beforeId?: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminApi.reports(status, beforeId);
        setReports((prev) => (beforeId ? [...prev, ...res.reports] : res.reports));
        setHasMore(res.has_more);
        onCount(res.open_count);
      } catch (err: any) {
        setError(err?.message || 'Não foi possível carregar as denúncias.');
      } finally {
        setLoading(false);
      }
    },
    [status, onCount]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (
    report: AdminReport,
    body: { resolution: 'dismissed' | 'actioned'; note?: string; suspend?: boolean; remove_content?: boolean }
  ) => {
    setError(null);
    try {
      const res = await adminApi.resolveReport({ id: report.id, ...body });
      setNotice(res.done.length > 0 ? `Denúncia resolvida: ${res.done.join(', ')}.` : 'Denúncia resolvida.');
      setReports((prev) => prev.filter((item) => item.id !== report.id));
      onCount(-1);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível resolver a denúncia.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-full border border-outline-variant/30 self-start">
        {(['open', 'closed'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
              status === value ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {value === 'open' ? 'Abertas' : 'Resolvidas'}
          </button>
        ))}
      </div>

      {notice && (
        <p className="text-xs text-on-surface bg-primary/10 rounded-xl px-3 py-2" role="status" onClick={() => setNotice(null)}>
          {notice}
        </p>
      )}
      {error && <p className="text-xs text-error bg-error-container/60 rounded-xl px-3 py-2">{error}</p>}

      {!loading && reports.length === 0 && !error && (
        <p className="text-sm text-on-surface-variant text-center py-10">
          {status === 'open' ? 'Nenhuma denúncia aberta. Tudo em dia.' : 'Nenhuma denúncia resolvida ainda.'}
        </p>
      )}

      {reports.map((report) => (
        <ReportCard key={report.id} report={report} onResolve={resolve} />
      ))}

      {loading && <p className="text-xs text-on-surface-variant text-center py-4">Carregando...</p>}
      {hasMore && !loading && (
        <button
          type="button"
          onClick={() => load(reports[reports.length - 1]?.id)}
          className="self-center px-4 py-2 rounded-full text-xs font-semibold text-primary bg-surface-container-low cursor-pointer"
        >
          Carregar mais
        </button>
      )}
    </div>
  );
};

const UsersTab: React.FC = () => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suspendingId, setSuspendingId] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      setUsers((await adminApi.users(q)).users);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar as contas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(query.trim()), query ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  const setSuspended = async (target: AdminUser, suspend: boolean) => {
    setError(null);
    try {
      await adminApi.setSuspended(target.id, suspend, suspend ? reason.trim() || undefined : undefined);
      setSuspendingId(null);
      setReason('');
      await load(query.trim());
    } catch (err: any) {
      setError(err?.message || 'Não foi possível alterar a conta.');
    }
  };

  const me = authStorage.getUser();

  return (
    <div className="flex flex-col gap-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar conta por nome de usuário"
        aria-label="Buscar conta"
        className="w-full h-10 px-4 rounded-full bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface placeholder:text-on-surface-variant outline-none"
      />
      {error && <p className="text-xs text-error bg-error-container/60 rounded-xl px-3 py-2">{error}</p>}
      {loading && <p className="text-xs text-on-surface-variant text-center py-4">Carregando...</p>}
      {!loading && users.length === 0 && <p className="text-sm text-on-surface-variant text-center py-10">Nenhuma conta encontrada.</p>}

      <ul className="flex flex-col gap-2.5">
        {users.map((account) => (
          <li key={account.id} className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3.5 flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link to={`/perfil/${encodeURIComponent(account.username)}`} className="text-sm font-semibold text-on-surface hover:text-primary truncate block">
                  @{account.username}
                </Link>
                <span className="text-[11px] text-on-surface-variant">
                  Desde {formatDate(account.created_at)} · {account.reports_total} denúncia(s), {account.reports_open} aberta(s)
                </span>
              </div>
              <div className="flex flex-wrap gap-1 justify-end shrink-0">
                {account.is_admin && <Badge tone="primary">Admin</Badge>}
                {account.suspended_at && <Badge tone="error">Suspensa</Badge>}
              </div>
            </div>

            {account.suspended_at && (
              <p className="text-[11px] text-on-surface-variant">
                Suspensa em {formatDate(account.suspended_at)}
                {account.suspended_reason ? ` · ${account.suspended_reason}` : ''}
              </p>
            )}

            {!account.is_admin && account.id !== me?.id && (
              <div className="flex flex-col gap-2">
                {account.suspended_at ? (
                  <button
                    type="button"
                    onClick={() => setSuspended(account, false)}
                    className="self-start px-3 py-1.5 rounded-full text-[11px] font-semibold bg-primary-container text-on-primary hover:bg-primary cursor-pointer"
                  >
                    Reativar conta
                  </button>
                ) : suspendingId === account.id ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={reason}
                      maxLength={200}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Motivo (a pessoa verá ao tentar entrar)"
                      className="flex-1 h-9 px-3 rounded-xl bg-surface-container-low text-xs text-on-surface placeholder:text-on-surface-variant outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSuspended(account, true)}
                        className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-error text-white hover:opacity-90 cursor-pointer"
                      >
                        Confirmar suspensão
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSuspendingId(null);
                          setReason('');
                        }}
                        className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-surface-container text-on-surface cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSuspendingId(account.id)}
                    className="self-start px-3 py-1.5 rounded-full text-[11px] font-semibold bg-surface-container text-error hover:bg-error-container/30 cursor-pointer"
                  >
                    Suspender conta
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const Admin: React.FC = () => {
  const user = authStorage.getUser();
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<'reports' | 'users' | 'performance'>('reports');
  const [openCount, setOpenCount] = useState<number | null>(null);

  // onCount recebe o total de abertas ou -1 quando uma é resolvida
  const handleCount = useCallback((value: number) => {
    setOpenCount((prev) => (value === -1 ? Math.max(0, (prev ?? 1) - 1) : value));
  }, []);

  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />
      <div className="pt-16 md:pt-0 min-h-screen flex flex-col pl-0 md:pl-20 pb-24 md:pb-0">{content}</div>
    </div>
  );

  if (!user) {
    return shell(
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyState icon="shield" title="Entre para continuar" description="A moderação é restrita a administradores." actionLabel="Entrar" actionLink="/login" className="max-w-md w-full" />
      </div>
    );
  }

  if (isAdmin === null) {
    return shell(<p className="flex-1 flex items-center justify-center text-xs text-on-surface-variant">Verificando acesso...</p>);
  }

  if (!isAdmin) {
    return shell(
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyState icon="lock" title="Acesso restrito" description="Esta área é só para administradores do Espectro." actionLabel="Voltar ao início" actionLink="/" className="max-w-md w-full" />
      </div>
    );
  }

  return shell(
    <main className="w-full py-8">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">gavel</span>
            Moderação
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Resolva denúncias, remova conteúdo e suspenda contas. Toda ação fica registrada.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-full border border-outline-variant/30 self-start">
          <button
            type="button"
            onClick={() => setTab('reports')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
              tab === 'reports' ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Denúncias
            {openCount !== null && openCount > 0 && (
              <span className="px-1.5 rounded-full bg-error text-white text-[10px] font-bold">{openCount}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('users')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
              tab === 'users' ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Contas
          </button>
          <button
            type="button"
            onClick={() => setTab('performance')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
              tab === 'performance' ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Desempenho
          </button>
        </div>

        {tab === 'reports' ? <ReportsTab onCount={handleCount} /> : tab === 'users' ? <UsersTab /> : <PerformanceTab />}
      </div>
    </main>
  );
};
