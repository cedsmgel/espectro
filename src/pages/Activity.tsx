import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { activityApi, ActivitySummary, authStorage, BlockedUser, blocksApi } from '../lib/api';
import { parseScrap } from '../lib/scrapStyle';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';

type Section = 'votos' | 'comentarios' | 'arquivados' | 'bloqueados' | 'leitura';
const TITLES: Record<Section, string> = {
  votos: 'Curtidas e votos',
  comentarios: 'Comentários',
  arquivados: 'Momentum arquivados',
  bloqueados: 'Contas bloqueadas',
  leitura: 'Publicações vistas',
};

const snippet = (title: string | null | undefined, content: string, max = 110) => {
  const text = title?.trim() || parseScrap(content || '').body.replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text || 'Publicação';
};

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

const Empty: React.FC<{ text: string }> = ({ text }) => <p className="text-sm text-on-surface-variant text-center py-16">{text}</p>;

const GroupTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant pt-6 pb-1">{children}</h2>
);

const Row: React.FC<{ to: string; icon: string; label: string; count?: number | null }> = ({ to, icon, label, count }) => (
  <Link to={to} className="flex items-center gap-4 py-4 border-b border-outline-variant hover:bg-surface-container-low/60 transition-colors">
    <span className="material-symbols-outlined text-[26px] text-on-surface">{icon}</span>
    <span className="flex-1 text-base text-on-surface">{label}</span>
    {typeof count === 'number' && <span className="text-sm text-on-surface-variant tabular-nums">{count}</span>}
    <span className="material-symbols-outlined text-[22px] text-on-surface-variant">chevron_right</span>
  </Link>
);

// Lista paginada genérica: carrega a primeira página e "Carregar mais" com o cursor da última linha
function usePagedList<T>(view: 'votes' | 'comments' | 'archived', cursorOf: (item: T) => number) {
  const [items, setItems] = useState<T[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let active = true;
    activityApi
      .list<T>(view)
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setHasMore(res.has_more);
      })
      .catch(() => active && setItems([]));
    return () => {
      active = false;
    };
  }, [view]);

  const loadMore = useCallback(async () => {
    if (!items || items.length === 0) return;
    setLoadingMore(true);
    try {
      const res = await activityApi.list<T>(view, cursorOf(items[items.length - 1]));
      setItems([...items, ...res.items]);
      setHasMore(res.has_more);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [items, view, cursorOf]);

  return { items, hasMore, loadingMore, loadMore };
}

const MoreButton: React.FC<{ show: boolean; busy: boolean; onClick: () => void }> = ({ show, busy, onClick }) =>
  show ? (
    <button type="button" onClick={onClick} disabled={busy} className="self-center my-4 px-5 py-2 rounded-full border border-outline-variant text-sm font-semibold hover:bg-surface-container cursor-pointer disabled:opacity-50">
      {busy ? 'Carregando...' : 'Carregar mais'}
    </button>
  ) : null;

type VoteItem = { cursor: number; post_id: number; vote: number; voted_at: string; post_title: string | null; post_content: string; author_name: string };
const VotesList: React.FC = () => {
  const { items, hasMore, loadingMore, loadMore } = usePagedList<VoteItem>('votes', (i) => i.cursor);
  if (items === null) return <Empty text="Carregando..." />;
  if (items.length === 0) return <Empty text="Você ainda não votou em nenhuma publicação." />;
  return (
    <div className="flex flex-col">
      <ul>
        {items.map((v) => (
          <li key={v.cursor}>
            <Link to={`/post/${v.post_id}`} className="flex items-center gap-3 py-3 border-b border-outline-variant hover:bg-surface-container-low/60 transition-colors">
              <span className={`material-symbols-outlined text-[22px] ${v.vote > 0 ? 'text-primary' : 'text-on-surface-variant'}`}>{v.vote > 0 ? 'arrow_upward' : 'arrow_downward'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-on-surface truncate">{snippet(v.post_title, v.post_content)}</p>
                <p className="text-xs text-on-surface-variant truncate">@{v.author_name} · {dateLabel(v.voted_at)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <MoreButton show={hasMore} busy={loadingMore} onClick={() => void loadMore()} />
    </div>
  );
};

type CommentItem = { id: number; post_id: number; content: string; created_at: string; post_title: string | null; post_content: string };
const CommentsList: React.FC = () => {
  const { items, hasMore, loadingMore, loadMore } = usePagedList<CommentItem>('comments', (i) => i.id);
  if (items === null) return <Empty text="Carregando..." />;
  if (items.length === 0) return <Empty text="Você ainda não comentou." />;
  return (
    <div className="flex flex-col">
      <ul>
        {items.map((c) => (
          <li key={c.id}>
            <Link to={`/post/${c.post_id}`} className="block py-3 border-b border-outline-variant hover:bg-surface-container-low/60 transition-colors">
              <p className="text-sm text-on-surface whitespace-pre-line">{c.content.length > 220 ? c.content.slice(0, 219) + '…' : c.content}</p>
              <p className="text-xs text-on-surface-variant mt-1 truncate">em "{snippet(c.post_title, c.post_content, 60)}" · {dateLabel(c.created_at)}</p>
            </Link>
          </li>
        ))}
      </ul>
      <MoreButton show={hasMore} busy={loadingMore} onClick={() => void loadMore()} />
    </div>
  );
};

type ArchivedItem = { id: number; media_url: string | null; media_type: 'image' | 'video' | 'text'; text: string | null; bg: string | null; audience: string; created_at: string; views_count: number };
const ArchivedGrid: React.FC = () => {
  const { items, hasMore, loadingMore, loadMore } = usePagedList<ArchivedItem>('archived', (i) => i.id);
  if (items === null) return <Empty text="Carregando..." />;
  if (items.length === 0) return <Empty text="Seus Momentum aparecem aqui depois de 24 horas." />;
  return (
    <div className="flex flex-col">
      <ul className="grid grid-cols-3 gap-px bg-outline-variant border border-outline-variant">
        {items.map((m) => (
          <li key={m.id} className="relative aspect-[3/4] overflow-hidden bg-surface-container-low">
            {m.media_type === 'image' && m.media_url ? (
              <img src={m.media_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
            ) : m.media_type === 'video' && m.media_url ? (
              <video src={`${m.media_url}#t=0.1`} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-2 text-center text-white text-xs font-semibold" style={{ background: m.bg || '#333' }}>
                {m.text}
              </div>
            )}
            <span className="absolute left-1.5 bottom-1.5 text-[11px] font-semibold text-white drop-shadow flex items-center gap-1">
              {m.audience === 'close_friends' && <span className="material-symbols-outlined text-[13px] text-emerald-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>}
              {dateLabel(m.created_at)}
            </span>
            <span className="absolute right-1.5 top-1.5 text-[11px] font-semibold text-white drop-shadow flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[14px]">visibility</span>
              {m.views_count}
            </span>
          </li>
        ))}
      </ul>
      <MoreButton show={hasMore} busy={loadingMore} onClick={() => void loadMore()} />
    </div>
  );
};

const BlockedList: React.FC = () => {
  const [users, setUsers] = useState<BlockedUser[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  useEffect(() => {
    blocksApi.list().then(setUsers).catch(() => setUsers([]));
  }, []);
  const unblock = async (u: BlockedUser) => {
    setBusyId(u.id);
    try {
      await blocksApi.unblock(u.id);
      setUsers((list) => (list ? list.filter((x) => x.id !== u.id) : list));
    } finally {
      setBusyId(null);
    }
  };
  if (users === null) return <Empty text="Carregando..." />;
  if (users.length === 0) return <Empty text="Você não bloqueou ninguém." />;
  return (
    <ul>
      {users.map((u) => (
        <li key={u.id} className="flex items-center gap-3 py-3 border-b border-outline-variant">
          <div className="w-11 h-11 rounded-full bg-surface-container-low flex items-center justify-center overflow-hidden shrink-0 text-sm font-bold">
            {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : u.username.charAt(0).toUpperCase()}
          </div>
          <p className="flex-1 min-w-0 text-sm font-semibold truncate">{u.username}</p>
          <button type="button" disabled={busyId === u.id} onClick={() => void unblock(u)} className="h-9 px-4 rounded-full bg-surface-container text-xs font-semibold hover:bg-surface-container-high cursor-pointer disabled:opacity-50">
            Desbloquear
          </button>
        </li>
      ))}
    </ul>
  );
};

const ReadsPanel: React.FC = () => {
  const [data, setData] = useState<Awaited<ReturnType<typeof activityApi.reads>> | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    activityApi.reads().then(setData).catch(() => {});
  }, []);
  if (!data) return <Empty text="Carregando..." />;
  const minutes = Math.round((data.ms_7d || 0) / 60000);
  const clear = async () => {
    setBusy(true);
    try {
      await activityApi.clearReads();
      setDone(true);
      setData({ ...data, views_7d: 0, views_30d: 0, opens: 0, events: 0, ms_7d: 0 });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-5 pt-4">
      <p className="text-sm text-on-surface-variant">
        {data.personalization
          ? 'O Espectro guarda por 90 dias o que você viu e abriu para ordenar o seu feed. Só você vê estes números.'
          : 'A personalização do feed está desligada: o Espectro não está registrando o que você vê.'}
      </p>
      <dl className="grid grid-cols-2 gap-px bg-outline-variant border border-outline-variant text-center">
        {[
          ['Vistas nos últimos 7 dias', data.views_7d],
          ['Vistas nos últimos 30 dias', data.views_30d],
          ['Publicações abertas', data.opens],
          ['Tempo vendo nos últimos 7 dias', `${minutes} min`],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-surface py-5">
            <dd className="text-2xl font-bold tabular-nums">{value}</dd>
            <dt className="text-xs text-on-surface-variant mt-1 px-2">{label}</dt>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => void clear()} disabled={busy || data.events === 0} className="h-11 rounded-full border border-outline-variant text-sm font-semibold hover:bg-surface-container cursor-pointer disabled:opacity-50">
          {busy ? 'Apagando...' : 'Apagar histórico de leitura'}
        </button>
        {done && <p role="status" className="text-xs text-on-surface-variant text-center">Histórico apagado.</p>}
        <Link to="/settings/profile" className="text-sm text-primary text-center hover:underline py-1">
          Ligar ou desligar a personalização do feed
        </Link>
      </div>
    </div>
  );
};

const Hub: React.FC<{ username: string }> = ({ username }) => {
  const [s, setS] = useState<ActivitySummary | null>(null);
  useEffect(() => {
    activityApi.summary().then(setS).catch(() => {});
  }, []);
  const me = `/perfil/${encodeURIComponent(username)}`;
  const n = (key: keyof ActivitySummary) => (s ? (s[key] as number) : null);
  return (
    <div>
      <div className="text-center pt-2 pb-2">
        <h2 className="text-2xl font-bold leading-tight">Um único lugar para gerenciar sua atividade</h2>
        <p className="text-sm text-on-surface-variant mt-2">Veja e gerencie suas interações, conteúdos e atividades. Só você vê esta página.</p>
      </div>

      <GroupTitle>Interações</GroupTitle>
      <Row to="/atividade/votos" icon="thumbs_up_down" label="Curtidas e votos" count={n('votes')} />
      <Row to="/atividade/comentarios" icon="chat_bubble" label="Comentários" count={n('comments')} />
      <Row to={`${me}/salvos`} icon="bookmark" label="Salvos" count={n('saved')} />

      <GroupTitle>Conteúdo que você compartilhou</GroupTitle>
      <Row to={me} icon="grid_on" label="Publicações" count={n('posts')} />
      <Row to="/atividade/arquivados" icon="history" label="Momentum arquivados" count={n('archived')} />

      <GroupTitle>Pessoas</GroupTitle>
      <Row to={`${me}/seguindo`} icon="person_check" label="Seguindo" count={n('following')} />
      <Row to={`${me}/seguidores`} icon="groups" label="Seguidores" count={n('followers')} />
      <Row to="/amigos" icon="group" label="Amigos" count={n('friends')} />
      <Row to="/melhores-amigos" icon="star" label="Melhores amigos" count={n('close_friends')} />
      <Row to="/atividade/bloqueados" icon="block" label="Contas bloqueadas" count={n('blocked')} />

      <GroupTitle>Comunidades</GroupTitle>
      <Row to="/comunidades" icon="forum" label="Suas comunidades" count={n('communities')} />

      <GroupTitle>Seus dados</GroupTitle>
      <Row to="/atividade/leitura" icon="visibility" label="Publicações vistas (30 dias)" count={n('reads_30d')} />
    </div>
  );
};

// "Sua atividade": painel único com tudo que a pessoa fez no Espectro, no estilo do Instagram
export const Activity: React.FC = () => {
  const { section } = useParams<{ section?: string }>();
  const user = authStorage.getUser();
  if (!user) return <Navigate to="/login" replace />;
  const current = section as Section | undefined;
  if (section && !(section in TITLES)) return <Navigate to="/atividade" replace />;

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />
      <div className="pt-16 md:pt-0 md:pl-20 lg:pl-64">
        <main className="w-full max-w-2xl mx-auto px-4 pt-4 pb-24 md:pb-8">
          <div className="flex items-center gap-3 pb-2">
            <Link to={current ? '/atividade' : `/perfil/${encodeURIComponent(user.username)}`} aria-label="Voltar" className="w-10 h-10 rounded-full border border-outline-variant flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </Link>
            <h1 className="flex-1 text-center text-base font-bold pr-10">{current ? TITLES[current] : 'Sua atividade'}</h1>
          </div>

          {!current && <Hub username={user.username} />}
          {current === 'votos' && <VotesList />}
          {current === 'comentarios' && <CommentsList />}
          {current === 'arquivados' && <ArchivedGrid />}
          {current === 'bloqueados' && <BlockedList />}
          {current === 'leitura' && <ReadsPanel />}
        </main>
      </div>
    </div>
  );
};
