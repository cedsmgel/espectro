import { visibleInterval } from '../lib/visibleInterval';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { useSidebar } from '../context/SidebarContext';
import {
  AppNotification,
  authStorage,
  Community,
  communitiesApi,
  FriendRequest,
  friendsApi,
  FriendSuggestion,
  notificationsApi,
  NotificationSummary,
  suggestionsApi,
} from '../lib/api';
import { EmptyState } from '../components/EmptyState';
import { CommunitySuggestions } from '../components/CommunitySuggestions';
import { usePush } from '../hooks/usePush';
import { notifyNotificationsChanged } from '../hooks/useNotificationCount';
import { notifyUnreadChanged } from '../hooks/useUnreadDms';

type Tab = 'todas' | 'amigos' | 'respostas' | 'votos';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'todas', label: 'Todas', icon: 'notifications' },
  { id: 'amigos', label: 'Amigos', icon: 'group' },
  { id: 'respostas', label: 'Respostas', icon: 'forum' },
  { id: 'votos', label: 'Votos', icon: 'favorite' },
];

const EMPTY_SUMMARY: NotificationSummary = { unread: 0, pending_requests: 0, unread_messages: 0, total_badge: 0 };

function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function dayGroup(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86400000;
  if (date.getTime() >= startOfToday) return 'Hoje';
  if (date.getTime() >= startOfToday - day) return 'Ontem';
  if (date.getTime() >= startOfToday - 6 * day) return 'Esta semana';
  return 'Anteriores';
}

const GROUP_ORDER = ['Hoje', 'Ontem', 'Esta semana', 'Anteriores'];

function suggestionReason(s: FriendSuggestion): string {
  if (s.mutual_friends > 0) return `${s.mutual_friends} ${s.mutual_friends === 1 ? 'amigo' : 'amigos'} em comum`;
  if (s.shared_communities > 0) {
    return `${s.shared_communities} ${s.shared_communities === 1 ? 'comunidade' : 'comunidades'} em comum`;
  }
  if ((s.interactions ?? 0) > 0) return 'Interagiu com suas publicações';
  return 'Novo no Espectro';
}

export const Notifications: React.FC = () => {
  const { isExpanded } = useSidebar();
  const user = authStorage.getUser();
  const push = usePush();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const tab: Tab = (['todas', 'amigos', 'respostas', 'votos'] as Tab[]).includes(tabParam as Tab)
    ? (tabParam as Tab)
    : 'todas';

  const [items, setItems] = useState<AppNotification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [summary, setSummary] = useState<NotificationSummary>(EMPTY_SUMMARY);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [sentTo, setSentTo] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3500);
  };

  const loadFeed = useCallback(async () => {
    try {
      const res = await notificationsApi.list();
      setItems(res.notifications);
      setHasMore(res.has_more);
      setSummary(res.summary);
    } catch {
      showToast('Não foi possível carregar as notificações.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      setRequests(await friendsApi.pending());
    } catch {}
    try {
      setSuggestions(await suggestionsApi.list());
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void loadFeed();
    void loadFriends();
    communitiesApi.list().then(setCommunities).catch(() => {});

    return visibleInterval(() => {
      void loadFeed();
      void loadFriends();
    }, 45000);
  }, [user?.id, loadFeed, loadFriends]);

  const applySummary = (next: NotificationSummary) => {
    setSummary(next);
    notifyNotificationsChanged();
  };

  const changeTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'todas') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  const handleOpen = async (item: AppNotification) => {
    if (item.read) return;
    setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    try {
      applySummary((await notificationsApi.markRead([item.id])).summary);
    } catch {}
  };

  const handleToggleRead = async (item: AppNotification) => {
    setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: !item.read } : n)));
    try {
      const res = item.read ? await notificationsApi.markUnread([item.id]) : await notificationsApi.markRead([item.id]);
      applySummary(res.summary);
    } catch {}
  };

  const handleDelete = async (item: AppNotification) => {
    setItems((prev) => prev.filter((n) => n.id !== item.id));
    try {
      applySummary((await notificationsApi.remove(item.id)).summary);
    } catch {}
  };

  const handleMarkAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      applySummary((await notificationsApi.markAllRead()).summary);
      showToast('Todas as notificações foram marcadas como lidas.');
    } catch {
      showToast('Não foi possível marcar como lidas.');
    }
  };

  const handleLoadMore = async () => {
    const last = items[items.length - 1];
    if (!last) return;
    setLoadingMore(true);
    try {
      const res = await notificationsApi.list(last.id);
      setItems((prev) => [...prev, ...res.notifications]);
      setHasMore(res.has_more);
    } finally {
      setLoadingMore(false);
    }
  };

  const respondToRequest = async (request: FriendRequest, accept: boolean) => {
    setBusyId(request.friend_id);
    try {
      if (accept) await friendsApi.add(request.friend_id, request.username);
      else await friendsApi.remove(request.friend_id);
      setRequests((prev) => prev.filter((r) => r.friend_id !== request.friend_id));
      showToast(accept ? `Agora você e @${request.username} são amigos.` : 'Pedido recusado.');
      notifyNotificationsChanged();
      notifyUnreadChanged();
      void loadFeed();
    } catch (err: any) {
      showToast(err?.message || 'Não foi possível concluir a ação.');
    } finally {
      setBusyId(null);
    }
  };

  const addSuggestion = async (person: FriendSuggestion) => {
    setBusyId(person.id);
    try {
      await friendsApi.add(person.id, person.username);
      setSentTo((prev) => new Set(prev).add(person.id));
      showToast(`Pedido enviado para @${person.username}.`);
    } catch (err: any) {
      showToast(err?.message || 'Não foi possível enviar o pedido.');
    } finally {
      setBusyId(null);
    }
  };

  const dismissSuggestion = async (person: FriendSuggestion) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== person.id));
    await suggestionsApi.dismiss(person.id).catch(() => {});
  };

  const visibleItems = useMemo(() => {
    if (tab === 'respostas') return items.filter((n) => n.type === 'post_comment' || n.type === 'comment_reply');
    if (tab === 'votos') return items.filter((n) => n.type === 'post_upvote');
    if (tab === 'amigos') return items.filter((n) => n.type === 'friend_accepted');
    return items;
  }, [items, tab]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppNotification[]>();
    for (const item of visibleItems) {
      const group = dayGroup(item.created_at);
      map.set(group, [...(map.get(group) || []), item]);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, list: map.get(g)! }));
  }, [visibleItems]);

  const unreadInTab = visibleItems.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-surface px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          <span>{toast}</span>
        </div>
      )}

      <div
        className={`pt-16 md:pt-0 min-h-screen flex flex-col justify-between transition-all duration-300 ease-in-out ${
          isExpanded ? 'pl-0 md:pl-20' : 'pl-0 md:pl-20'
        }`}
      >
        <main className="w-full bg-surface pt-4 pb-24 md:pb-8 flex-1">
          <div className="w-full max-w-4xl mx-auto px-3 sm:px-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[24px]">notifications</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">Notificações</h1>
                  {summary.total_badge > 0 && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary text-xs font-semibold shadow-xs">
                      {summary.total_badge} {summary.total_badge === 1 ? 'nova' : 'novas'}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleMarkAll}
                disabled={summary.unread === 0}
                className="h-9 px-4 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-40 cursor-pointer self-start sm:self-auto"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">done_all</span>
                <span>Marcar todas como lidas</span>
              </button>
            </div>

            {!user ? (
              <EmptyState
                icon="notifications_off"
                title="Entre para ver suas notificações"
                description="Pedidos de amizade, respostas e votos aparecem aqui."
                actionLabel="Entrar ou Cadastrar"
                actionLink="/login"
              />
            ) : (
              <>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none" role="tablist">
                  {TABS.map((t) => {
                    const badge = t.id === 'amigos' ? summary.pending_requests : t.id === 'todas' ? summary.unread : 0;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => changeTab(t.id)}
                        className={`h-8 px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                          tab === t.id
                            ? 'bg-primary text-on-primary shadow-xs'
                            : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                        <span>{t.label}</span>
                        {badge > 0 && (
                          <span className="px-1.5 rounded-full bg-primary-container text-on-primary text-[10px] font-bold">
                            {badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-8 flex flex-col gap-6 min-w-0 w-full max-w-2xl mx-auto">
                    {tab === 'todas' && (summary.pending_requests > 0 || summary.unread_messages > 0) && (
                      <div className="flex flex-col gap-3">
                        {summary.pending_requests > 0 && (
                          <SummaryCard
                            icon="person_add"
                            title={`${summary.pending_requests} ${
                              summary.pending_requests === 1 ? 'pedido de amizade' : 'pedidos de amizade'
                            }`}
                            subtitle="Aceite ou recuse na aba Amigos."
                            actionLabel="Ver pedidos"
                            onAction={() => changeTab('amigos')}
                          />
                        )}
                        {summary.unread_messages > 0 && (
                          <SummaryCard
                            icon="chat_bubble"
                            title={`${summary.unread_messages} ${
                              summary.unread_messages === 1 ? 'mensagem não lida' : 'mensagens não lidas'
                            }`}
                            subtitle="Suas conversas privadas têm novidades."
                            actionLabel="Abrir mensagens"
                            to="/mensagens"
                          />
                        )}
                      </div>
                    )}

                    {tab === 'amigos' && (
                      <>
                        <section className="flex flex-col gap-3" aria-label="Pedidos de amizade">
                          <SectionTitle title="Pedidos de amizade" count={requests.length} />
                          {requests.length === 0 ? (
                            <p className="text-xs text-on-surface-variant px-1">Nenhum pedido pendente.</p>
                          ) : (
                            requests.map((r) => (
                              <PersonRow
                                key={r.friendship_id}
                                username={r.username}
                                subtitle={`quer ser seu amigo · ${relativeTime(r.created_at.replace(' ', 'T') + 'Z')}`}
                                actions={
                                  <>
                                    <button
                                      type="button"
                                      disabled={busyId === r.friend_id}
                                      onClick={() => respondToRequest(r, true)}
                                      className="h-8 px-4 rounded-full bg-primary-container text-on-primary text-[11px] font-semibold hover:bg-primary disabled:opacity-60 cursor-pointer"
                                    >
                                      Aceitar
                                    </button>
                                    <button
                                      type="button"
                                      disabled={busyId === r.friend_id}
                                      onClick={() => respondToRequest(r, false)}
                                      className="h-8 px-4 rounded-full bg-surface-container text-on-surface text-[11px] font-semibold hover:bg-surface-container-high disabled:opacity-60 cursor-pointer"
                                    >
                                      Recusar
                                    </button>
                                  </>
                                }
                              />
                            ))
                          )}
                        </section>

                        <section className="flex flex-col gap-3" aria-label="Pessoas que você talvez conheça">
                          <SectionTitle title="Pessoas que você talvez conheça" count={suggestions.length} />
                          {suggestions.length === 0 ? (
                            <p className="text-xs text-on-surface-variant px-1">
                              Sem recomendações por enquanto. Participe de comunidades para encontrar mais gente.
                            </p>
                          ) : (
                            suggestions.map((s) => (
                              <PersonRow
                                key={s.id}
                                username={s.username}
                                subtitle={suggestionReason(s)}
                                actions={
                                  <>
                                    {sentTo.has(s.id) ? (
                                      <span className="h-8 px-4 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-semibold flex items-center">
                                        Pedido enviado
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={busyId === s.id}
                                        onClick={() => addSuggestion(s)}
                                        className="h-8 px-4 rounded-full bg-primary-container text-on-primary text-[11px] font-semibold hover:bg-primary disabled:opacity-60 cursor-pointer"
                                      >
                                        Adicionar
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => dismissSuggestion(s)}
                                      title="Dispensar recomendação"
                                      aria-label="Dispensar recomendação"
                                      className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-[18px]">close</span>
                                    </button>
                                  </>
                                }
                              />
                            ))
                          )}
                        </section>

                        {visibleItems.length > 0 && <SectionTitle title="Atividade" count={unreadInTab} unread />}
                      </>
                    )}

                    {loading ? (
                      <p className="text-center text-xs text-on-surface-variant py-8">Carregando...</p>
                    ) : visibleItems.length === 0 ? (
                      tab === 'amigos' ? null : (
                        <EmptyState
                          icon="notifications_off"
                          title="Nenhuma notificação por aqui"
                          description="Avisaremos assim que alguém comentar, responder ou curtir suas publicações."
                          actionLabel="Explorar o Feed"
                          actionLink="/"
                        />
                      )
                    ) : (
                      <>
                        {grouped.map(({ group, list }) => (
                          <section key={group} className="flex flex-col gap-3">
                            <div className="flex items-center justify-between px-1">
                              <span className="text-xs font-bold text-on-surface uppercase tracking-wider">{group}</span>
                              <span className="text-[11px] text-on-surface-variant">
                                {list.filter((n) => !n.read).length} novas
                              </span>
                            </div>
                            {list.map((item) => (
                              <NotificationCard
                                key={item.id}
                                item={item}
                                onOpen={() => handleOpen(item)}
                                onToggleRead={() => handleToggleRead(item)}
                                onDelete={() => handleDelete(item)}
                              />
                            ))}
                          </section>
                        ))}
                        {hasMore && (
                          <button
                            type="button"
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="self-center h-9 px-5 rounded-full bg-surface-container-high text-on-surface text-xs font-semibold hover:bg-surface-container-highest disabled:opacity-60 cursor-pointer"
                          >
                            {loadingMore ? 'Carregando...' : 'Carregar mais'}
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <aside className="lg:col-span-4 w-72 max-w-xs justify-self-end hidden lg:flex flex-col gap-4 sticky top-20">
                    <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">notifications_active</span>
                        <h2 className="font-bold text-sm text-on-surface">Alertas neste aparelho</h2>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        {!push.supported
                          ? 'Este navegador não suporta notificações push.'
                          : push.permission === 'denied'
                          ? 'Bloqueadas no navegador. Libere nas configurações do site.'
                          : push.subscribed
                          ? 'Você recebe mensagens, pedidos de amizade, respostas e votos mesmo com o app fechado.'
                          : 'Ative para ser avisado de mensagens, pedidos de amizade, respostas e votos com o app fechado.'}
                      </p>
                      {push.iosInstallNeeded && (
                        <p className="text-[11px] text-on-surface-variant">
                          No iPhone, adicione o Espectro à Tela de Início para ativar.
                        </p>
                      )}
                      {push.supported && push.permission !== 'denied' && (
                        <button
                          type="button"
                          disabled={push.busy}
                          onClick={push.subscribed ? push.disable : push.enable}
                          className={`h-9 rounded-full text-xs font-semibold cursor-pointer disabled:opacity-60 ${
                            push.subscribed
                              ? 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                              : 'bg-primary-container text-on-primary hover:bg-primary'
                          }`}
                        >
                          {push.busy ? 'Aguarde...' : push.subscribed ? 'Desativar push' : 'Ativar push'}
                        </button>
                      )}
                      {push.subscribed && (
                        <label className="flex items-center justify-between gap-3 cursor-pointer pt-1">
                          <span className="text-[11px] text-on-surface">Mostrar texto nas notificações</span>
                          <input
                            type="checkbox"
                            checked={push.showPreview}
                            onChange={(e) => push.changePreview(e.target.checked)}
                            className="w-4 h-4 accent-primary cursor-pointer"
                          />
                        </label>
                      )}
                      {push.error && <p className="text-[11px] text-error">{push.error}</p>}
                    </div>

                    <CommunitySuggestions onJoined={() => communitiesApi.list().then(setCommunities).catch(() => {})} />

                    <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-[20px]">groups</span>
                          <h2 className="font-bold text-sm text-on-surface">Comunidades Ativas</h2>
                        </div>
                        <Link to="/comunidades" className="text-xs text-primary font-semibold hover:underline">
                          Ver todas
                        </Link>
                      </div>
                      <div className="flex flex-col gap-2 pt-1">
                        {communities.slice(0, 4).map((c) => (
                          <Link
                            key={c.id}
                            to={`/e/${c.slug || c.id}`}
                            className="flex items-center justify-between p-2 rounded-xl hover:bg-surface-container transition-colors group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs flex-shrink-0 shadow-xs"
                                style={{ backgroundColor: c.icon_color || '#404040' }}
                              >
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs font-semibold text-on-surface truncate group-hover:text-primary">
                                e/{c.name}
                              </span>
                            </div>
                            <span className="text-[11px] text-on-surface-variant">{c.members_count} mem.</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </aside>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{ title: string; count: number; unread?: boolean }> = ({ title, count, unread }) => (
  <div className="flex items-center justify-between px-1">
    <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">{title}</h2>
    {count > 0 && (
      <span className="text-[11px] text-on-surface-variant">{unread ? `${count} novas` : count}</span>
    )}
  </div>
);

interface SummaryCardProps {
  icon: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction?: () => void;
  to?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, title, subtitle, actionLabel, onAction, to }) => {
  const button = (
    <span className="h-8 px-4 rounded-full bg-primary-container text-on-primary text-[11px] font-semibold flex items-center hover:bg-primary">
      {actionLabel}
    </span>
  );
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-surface-container-lowest border border-primary/25 shadow-xs">
      <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface">{title}</p>
        <p className="text-[11px] text-on-surface-variant">{subtitle}</p>
      </div>
      {to ? (
        <Link to={to}>{button}</Link>
      ) : (
        <button type="button" onClick={onAction} className="cursor-pointer">
          {button}
        </button>
      )}
    </div>
  );
};

const PersonRow: React.FC<{ username: string; subtitle: string; actions: React.ReactNode }> = ({
  username,
  subtitle,
  actions,
}) => (
  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/25">
    <Link
      to={`/perfil/${encodeURIComponent(username)}`}
      className="w-11 h-11 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary flex items-center justify-center font-bold text-sm uppercase flex-shrink-0"
    >
      {username.charAt(0)}
    </Link>
    <div className="flex-1 min-w-0">
      <Link
        to={`/perfil/${encodeURIComponent(username)}`}
        className="block text-sm font-semibold text-on-surface truncate hover:underline"
      >
        @{username}
      </Link>
      <span className="block text-[11px] text-on-surface-variant truncate">{subtitle}</span>
    </div>
    <div className="flex items-center gap-1.5 flex-shrink-0">{actions}</div>
  </div>
);

interface NotificationCardProps {
  item: AppNotification;
  onOpen: () => void;
  onToggleRead: () => void;
  onDelete: () => void;
}

const TYPE_COPY: Record<
  AppNotification['type'],
  { text: string; icon: string; badge: string; action: string }
> = {
  security_login: {
    text: 'Novo acesso à sua conta',
    icon: 'shield',
    badge: 'bg-error text-white',
    action: 'Ver sessões',
  },
  friend_accepted: {
    text: 'aceitou seu pedido de amizade',
    icon: 'how_to_reg',
    badge: 'bg-emerald-600 text-white',
    action: 'Ver perfil',
  },
  post_comment: {
    text: 'comentou na sua publicação',
    icon: 'forum',
    badge: 'bg-secondary-container text-on-secondary-container',
    action: 'Ver publicação',
  },
  comment_reply: {
    text: 'respondeu ao seu comentário',
    icon: 'reply',
    badge: 'bg-secondary-container text-on-secondary-container',
    action: 'Ver conversa',
  },
  post_upvote: {
    text: 'curtiu sua publicação',
    icon: 'arrow_upward',
    badge: 'bg-primary-container text-on-primary',
    action: 'Ver publicação',
  },
};

const NotificationCard: React.FC<NotificationCardProps> = ({ item, onOpen, onToggleRead, onDelete }) => {
  const copy = TYPE_COPY[item.type];
  const username = item.actor_username || 'alguém';
  const isSecurity = item.type === 'security_login';
  const target = isSecurity
    ? '/settings/account'
    : item.type === 'friend_accepted'
    ? `/perfil/${encodeURIComponent(username)}`
    : item.post_id
    ? `/post/${item.post_id}`
    : null;

  return (
    <article
      className={`group relative rounded-2xl p-4 transition-all duration-200 border ${
        !item.read
          ? 'bg-surface-container-lowest border-primary/25 shadow-xs hover:shadow-md'
          : 'bg-surface-container-lowest/80 border-outline-variant hover:border-outline-variant/40'
      }`}
    >
      {!item.read && (
        <span className="absolute left-2.5 top-5 w-2 h-2 rounded-full bg-primary ring-2 ring-surface-container-lowest" />
      )}

      <div className={`flex items-start gap-3.5 ${!item.read ? 'pl-2' : ''}`}>
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary flex items-center justify-center font-bold text-sm uppercase shadow-xs">
            {username.charAt(0)}
          </div>
          <div
            className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-xs ${copy.badge}`}
          >
            <span className="material-symbols-outlined text-[12px]">{copy.icon}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs sm:text-sm text-on-surface leading-snug">
              {isSecurity ? (
                <span className="font-bold">{copy.text}</span>
              ) : (
                <>
                  <Link to={`/perfil/${encodeURIComponent(username)}`} className="font-bold hover:underline">
                    @{username}
                  </Link>{' '}
                  {copy.text}
                </>
              )}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[11px] text-on-surface-variant whitespace-nowrap">{relativeTime(item.created_at)}</span>
              <button
                type="button"
                onClick={onDelete}
                title="Remover notificação"
                aria-label="Remover notificação"
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-on-surface-variant hover:text-error rounded-lg hover:bg-surface-container transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </div>

          {item.content && (
            <div className="mt-2 p-3 rounded-xl bg-surface-container-low text-on-surface-variant text-xs leading-relaxed border border-outline-variant/15 break-words">
              {item.content}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {target && (
              <Link
                to={target}
                onClick={onOpen}
                className="h-7 px-3.5 rounded-full bg-primary-container text-on-primary text-[11px] font-semibold flex items-center gap-1 hover:bg-primary shadow-xs transition-colors"
              >
                <span>{copy.action}</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            )}
            <button
              type="button"
              onClick={onToggleRead}
              className="h-7 px-3 rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high text-[11px] font-medium transition-colors cursor-pointer"
            >
              {item.read ? 'Marcar não lida' : 'Marcar como lida'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
