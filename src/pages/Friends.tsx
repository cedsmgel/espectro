import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authStorage, Friend, FriendRequest, FriendSuggestion, friendsApi, suggestionsApi } from '../lib/api';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { EmptyState } from '../components/EmptyState';

type Tab = 'amigos' | 'pedidos' | 'sugestoes';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'amigos', label: 'Amigos', icon: 'group' },
  { id: 'pedidos', label: 'Pedidos', icon: 'person_add' },
  { id: 'sugestoes', label: 'Sugestões', icon: 'auto_awesome' },
];

const Avatar: React.FC<{ username: string; url?: string | null }> = ({ username, url }) => (
  <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center overflow-hidden shrink-0 text-sm font-bold">
    {url ? <img loading="lazy" decoding="async" src={url} alt="" className="w-full h-full object-cover" /> : username.charAt(0).toUpperCase()}
  </div>
);

const Empty: React.FC<{ text: string; icon?: string }> = ({ text, icon = 'group' }) => (
  <div className="flex flex-col items-center gap-2 py-14 text-center">
    <span className="material-symbols-outlined text-[36px] text-on-surface-variant/60" aria-hidden="true">
      {icon}
    </span>
    <p className="text-sm text-on-surface-variant max-w-xs">{text}</p>
  </div>
);

const rowButton =
  'h-9 px-4 rounded-full text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 shrink-0';
const primaryButton = `${rowButton} bg-primary-container text-on-primary hover:bg-primary`;
const outlineButton = `${rowButton} border border-outline-variant text-on-surface hover:bg-surface-container`;

// Central de amizades: lista de amigos, pedidos recebidos e sugestões
export const Friends: React.FC = () => {
  const navigate = useNavigate();
  const user = authStorage.getUser();
  const [params, setParams] = useSearchParams();
  const tab = (['amigos', 'pedidos', 'sugestoes'].includes(params.get('aba') || '') ? params.get('aba') : 'amigos') as Tab;

  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [requests, setRequests] = useState<FriendRequest[] | null>(null);
  const [suggestions, setSuggestions] = useState<FriendSuggestion[] | null>(null);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Awaited<ReturnType<typeof friendsApi.search>> | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [sent, setSent] = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    friendsApi.list().then((list) => setFriends(list.filter((f) => f.status === 'accepted'))).catch(() => setFriends([]));
    friendsApi.pending().then(setRequests).catch(() => setRequests([]));
    suggestionsApi.list().then(setSuggestions).catch(() => setSuggestions([]));
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setFound(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      friendsApi.search(term).then((res) => active && setFound(res)).catch(() => active && setFound([]));
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const act = async (id: number, task: () => Promise<unknown>, after: () => void) => {
    setBusyId(id);
    try {
      await task();
      after();
    } catch {
    } finally {
      setBusyId(null);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col">
        <Header />
        <SidebarNav />
        <div className="pt-16 md:pt-0 md:pl-20 flex-1 flex items-center justify-center p-6">
          <EmptyState icon="group" title="Seus amigos" description="Entre na sua conta para ver e gerenciar seus amigos." actionLabel="Entrar" actionLink="/login" className="max-w-md w-full" />
        </div>
      </div>
    );
  }

  const counts: Record<Tab, number | null> = {
    amigos: friends?.length ?? null,
    pedidos: requests?.length ?? null,
    sugestoes: suggestions?.length ?? null,
  };

  const personRow = (key: React.Key, username: string, avatar: string | null | undefined, subtitle: string | null, action: React.ReactNode) => (
    <li key={key} className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant last:border-b-0 hover:bg-surface-container/50 transition-colors">
      <Link to={`/perfil/${encodeURIComponent(username)}`} className="flex items-center gap-3 min-w-0 flex-1">
        <Avatar username={username} url={avatar} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-on-surface truncate">@{username}</p>
          {subtitle && <p className="text-xs text-on-surface-variant truncate">{subtitle}</p>}
        </div>
      </Link>
      {action}
    </li>
  );

  const body = () => {
    if (query.trim().length >= 2) {
      if (found === null) return <Empty text="Buscando..." />;
      if (found.length === 0) return <Empty icon="search_off" text="Ninguém encontrado." />;
      return (
        <ul className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xs overflow-hidden">
          {found.map((p) =>
            personRow(
              p.id,
              p.username,
              p.avatar_url,
              p.friendship_status === 'accepted' ? 'Amigo' : p.friendship_status === 'pending' ? 'Pedido pendente' : null,
              !p.friendship_status && !sent.has(p.id) ? (
                <button type="button" disabled={busyId === p.id} className={primaryButton} onClick={() => void act(p.id, () => friendsApi.add(p.id, p.username), () => setSent((s) => new Set(s).add(p.id)))}>
                  Adicionar
                </button>
              ) : sent.has(p.id) ? (
                <span className="text-xs text-on-surface-variant shrink-0">Pedido enviado</span>
              ) : null
            )
          )}
        </ul>
      );
    }

    if (tab === 'amigos') {
      if (friends === null) return <Empty text="Carregando..." />;
      if (friends.length === 0) return <Empty text="Você ainda não tem amigos. Veja as sugestões ou busque pelo nome." />;
      return (
        <ul className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xs overflow-hidden">
          {friends.map((f) =>
            personRow(
              f.friend_id,
              f.username,
              f.avatar_url,
              null,
              <button type="button" className={outlineButton} onClick={() => navigate(`/mensagens?u=${encodeURIComponent(f.username)}`)}>
                Mensagem
              </button>
            )
          )}
        </ul>
      );
    }

    if (tab === 'pedidos') {
      if (requests === null) return <Empty text="Carregando..." />;
      if (requests.length === 0) return <Empty icon="person_add" text="Nenhum pedido de amizade no momento." />;
      return (
        <ul className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xs overflow-hidden">
          {requests.map((r) =>
            personRow(
              r.friendship_id,
              r.username,
              r.avatar_url,
              'quer ser seu amigo',
              <div className="flex gap-2 shrink-0">
                <button type="button" disabled={busyId === r.friend_id} className={primaryButton} onClick={() => void act(r.friend_id, () => friendsApi.add(r.friend_id, r.username), load)}>
                  Aceitar
                </button>
                <button type="button" disabled={busyId === r.friend_id} className={outlineButton} onClick={() => void act(r.friend_id, () => friendsApi.remove(r.friend_id), load)}>
                  Recusar
                </button>
              </div>
            )
          )}
        </ul>
      );
    }

    if (suggestions === null) return <Empty text="Carregando..." />;
    if (suggestions.length === 0) return <Empty icon="auto_awesome" text="Sem sugestões por enquanto." />;
    return (
      <ul className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-xs overflow-hidden">
        {suggestions.map((p) =>
          personRow(
            p.id,
            p.username,
            p.avatar_url,
            p.mutual_friends > 0 ? `${p.mutual_friends} ${p.mutual_friends === 1 ? 'amigo' : 'amigos'} em comum` : p.shared_communities > 0 ? 'Comunidade em comum' : 'Sugestão para você',
            <div className="flex gap-2 shrink-0">
              {sent.has(p.id) ? (
                <span className="text-xs text-on-surface-variant self-center">Pedido enviado</span>
              ) : (
                <button type="button" disabled={busyId === p.id} className={primaryButton} onClick={() => void act(p.id, () => friendsApi.add(p.id, p.username), () => setSent((s) => new Set(s).add(p.id)))}>
                  Adicionar
                </button>
              )}
              <button
                type="button"
                aria-label={`Dispensar @${p.username}`}
                className="w-9 h-9 rounded-full text-on-surface-variant hover:text-on-surface flex items-center justify-center cursor-pointer"
                onClick={() => {
                  setSuggestions((prev) => (prev ? prev.filter((s) => s.id !== p.id) : prev));
                  void suggestionsApi.dismiss(p.id).catch(() => {});
                }}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          )
        )}
      </ul>
    );
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />
      <div className="pt-16 md:pt-0 md:pl-20">
        <main className="w-full max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-24 md:pb-8">
          <section className="flex flex-col gap-6 min-w-0">
            <div className="bg-surface-container-lowest rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm border border-outline-variant">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2">
                  <span>Amigos</span>
                  {counts.amigos !== null && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-medium tabular-nums">
                      {counts.amigos}
                    </span>
                  )}
                </h1>
                <p className="text-xs text-on-surface-variant mt-1">Suas conexões, pedidos de amizade e pessoas que você talvez conheça.</p>
              </div>
              <Link
                to="/melhores-amigos"
                className="px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">favorite</span>
                <span>Melhores amigos</span>
              </Link>
            </div>

            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar pessoas"
                placeholder="Buscar pessoas pelo nome de usuário..."
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-surface-container-lowest border border-outline-variant text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs"
              />
            </div>

            <nav role="tablist" aria-label="Amizades" className="flex border-b border-outline-variant -mb-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id && query.trim().length < 2}
                  onClick={() => {
                    setQuery('');
                    setParams(t.id === 'amigos' ? {} : { aba: t.id }, { replace: true });
                  }}
                  className={`flex-1 h-12 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-px cursor-pointer transition-colors ${
                    tab === t.id ? 'border-on-surface text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="hidden sm:inline material-symbols-outlined text-[18px]">{t.icon}</span>
                  <span>{t.label}</span>
                  {counts[t.id] !== null && counts[t.id]! > 0 && <span className="tabular-nums text-on-surface-variant">{counts[t.id]}</span>}
                </button>
              ))}
            </nav>

            {body()}
          </section>
        </main>
      </div>
    </div>
  );
};
