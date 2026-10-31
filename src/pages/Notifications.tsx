import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { useSidebar } from '../context/SidebarContext';
import { authStorage, communitiesApi, Community } from '../lib/api';
import { EmptyState } from '../components/EmptyState';

export interface NotificationItem {
  id: string;
  type: 'mention' | 'upvote' | 'video' | 'follow' | 'reaction' | 'community';
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  communityName?: string;
  communitySlug?: string;
  title: string;
  content?: string;
  timestamp: string;
  group: 'hoje' | 'ontem' | 'esta_semana';
  read: boolean;
  actionUrl?: string;
  videoDuration?: string;
}

export const Notifications: React.FC = () => {
  const { isExpanded } = useSidebar();
  const user = authStorage.getUser();

  const [activeFilter, setActiveFilter] = useState<'all' | 'mentions' | 'communities' | 'reactions' | 'videos'>('all');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(false);

  // Preferências rápidas
  const [prefDesktop, setPrefDesktop] = useState(true);
  const [prefSound, setPrefSound] = useState(true);
  const [prefEmail, setPrefEmail] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Notificações dinâmicas da plataforma (carregadas limpas sem mock)
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    // Carrega comunidades reais do D1
    communitiesApi.list().then(setCommunities).catch(() => {});
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    showToast('Todas as notificações foram marcadas como lidas.');
  };

  const handleToggleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const handleDeleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Filtragem dos itens
  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'mentions') return n.type === 'mention';
    if (activeFilter === 'communities') return n.type === 'community' || Boolean(n.communityName);
    if (activeFilter === 'reactions') return n.type === 'reaction' || n.type === 'upvote';
    if (activeFilter === 'videos') return n.type === 'video';
    return true;
  });

  const hojeList = filteredNotifications.filter((n) => n.group === 'hoje');
  const ontemList = filteredNotifications.filter((n) => n.group === 'ontem');
  const semanaList = filteredNotifications.filter((n) => n.group === 'esta_semana');

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />

      {/* Toast Notifier */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-on-surface text-surface px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Container Principal que empurra o feed suavemente */}
      <div
        className={`pt-16 min-h-screen flex flex-col justify-between transition-all duration-300 ease-in-out ${
          isExpanded ? 'pl-0 md:pl-64' : 'pl-0 md:pl-[72px]'
        }`}
      >
        <main className="w-full bg-surface pt-4 pb-24 md:pb-8 flex-1">
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            {/* Top Bar: Title & Global Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[24px]">notifications</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
                    Notificações
                  </h1>
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary text-xs font-semibold shadow-xs">
                      {unreadCount} novas
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  disabled={unreadCount === 0}
                  className="h-9 px-4 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-40 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">done_all</span>
                  <span>Marcar todas como lidas</span>
                </button>
              </div>
            </div>

            {/* Filter Chips Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`h-8 px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                }`}
              >
                <span>Todas</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-primary-container text-on-primary text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('mentions')}
                className={`h-8 px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                  activeFilter === 'mentions'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">alternate_email</span>
                <span>Menções & Respostas</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('communities')}
                className={`h-8 px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                  activeFilter === 'communities'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">groups</span>
                <span>Comunidades c/</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('reactions')}
                className={`h-8 px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                  activeFilter === 'reactions'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">favorite</span>
                <span>Reações & Votos</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('videos')}
                className={`h-8 px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                  activeFilter === 'videos'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">smart_display</span>
                <span>Vídeos & Clipes</span>
              </button>
            </div>

            {/* Grid Layout: Stream (8 cols) + Right Rail (4 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Notifications Stream (8 colunas) */}
              <div className="lg:col-span-8 flex flex-col gap-6 min-w-0">
                {filteredNotifications.length === 0 ? (
                  <EmptyState
                    icon="notifications_off"
                    title="Nenhuma notificação por aqui"
                    description="Você está em dia com todas as novidades! Avisaremos assim que alguém interagir com suas publicações ou comunidade."
                    actionLabel="Explorar o Feed"
                    actionLink="/"
                  />
                ) : (
                  <>
                    {/* Grupo: HOJE */}
                    {hojeList.length > 0 && (
                      <section className="flex flex-col gap-3">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                              Hoje
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          </div>
                          <span className="text-[11px] text-on-surface-variant">
                            {hojeList.filter((n) => !n.read).length} novas
                          </span>
                        </div>

                        <div className="flex flex-col gap-3">
                          {hojeList.map((item) => (
                            <NotificationCard
                              key={item.id}
                              item={item}
                              onToggleRead={() => handleToggleRead(item.id)}
                              onDelete={(e) => handleDeleteNotification(item.id, e)}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Grupo: ONTEM */}
                    {ontemList.length > 0 && (
                      <section className="flex flex-col gap-3">
                        <div className="flex items-center justify-between px-1 pt-2">
                          <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                            Ontem
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            {ontemList.length} notificações
                          </span>
                        </div>

                        <div className="flex flex-col gap-3">
                          {ontemList.map((item) => (
                            <NotificationCard
                              key={item.id}
                              item={item}
                              onToggleRead={() => handleToggleRead(item.id)}
                              onDelete={(e) => handleDeleteNotification(item.id, e)}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Grupo: ESTA SEMANA */}
                    {semanaList.length > 0 && (
                      <section className="flex flex-col gap-3">
                        <div className="flex items-center justify-between px-1 pt-2">
                          <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                            Esta Semana
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            {semanaList.length} notificação
                          </span>
                        </div>

                        <div className="flex flex-col gap-3">
                          {semanaList.map((item) => (
                            <NotificationCard
                              key={item.id}
                              item={item}
                              onToggleRead={() => handleToggleRead(item.id)}
                              onDelete={(e) => handleDeleteNotification(item.id, e)}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>

              {/* Right Contextual Rail: Controls & Insights (4 colunas) */}
              <aside className="lg:col-span-4 flex flex-col gap-6 sticky top-20 hidden lg:flex">
                {/* Card 1: Preferências Rápidas de Alerta */}
                <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">notifications_active</span>
                      <h2 className="font-bold text-sm text-on-surface">Preferências Rápidas</h2>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {/* Push no Desktop */}
                    <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-container transition-colors cursor-pointer">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-on-surface">Push no Desktop</span>
                        <span className="text-[11px] text-on-surface-variant">Avisos imediatos no navegador</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefDesktop}
                        onChange={(e) => {
                          setPrefDesktop(e.target.checked);
                          showToast(e.target.checked ? 'Notificações push ativadas.' : 'Notificações push desativadas.');
                        }}
                        className="w-4 h-4 accent-primary cursor-pointer"
                      />
                    </label>

                    {/* Sons de Alerta */}
                    <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-container transition-colors cursor-pointer">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-on-surface">Sons de Alerta</span>
                        <span className="text-[11px] text-on-surface-variant">Bipe suave em menções</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefSound}
                        onChange={(e) => {
                          setPrefSound(e.target.checked);
                          showToast(e.target.checked ? 'Efeitos sonoros ativados.' : 'Efeitos sonoros silenciados.');
                        }}
                        className="w-4 h-4 accent-primary cursor-pointer"
                      />
                    </label>

                    {/* Resumo por E-mail */}
                    <label className="flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-container transition-colors cursor-pointer">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-on-surface">Resumo por E-mail</span>
                        <span className="text-[11px] text-on-surface-variant">Digest semanal de interações</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefEmail}
                        onChange={(e) => {
                          setPrefEmail(e.target.checked);
                          showToast(e.target.checked ? 'Inscrito no digest semanal.' : 'Digest por e-mail desativado.');
                        }}
                        className="w-4 h-4 accent-primary cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* Card 2: Resumo Semanal de Engajamento (Design Stitch) */}
                <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-[20px]">insights</span>
                      <h2 className="font-bold text-sm text-on-surface">Resumo de Atividade</h2>
                    </div>
                    <span className="text-xs text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full">
                      Tempo Real
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 rounded-xl bg-surface-container-low flex flex-col">
                      <span className="text-[11px] text-on-surface-variant">Notificações</span>
                      <span className="text-lg font-bold text-primary mt-1">{notifications.length}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container-low flex flex-col">
                      <span className="text-[11px] text-on-surface-variant">Não lidas</span>
                      <span className="text-lg font-bold text-secondary mt-1">{unreadCount}</span>
                    </div>
                  </div>

                  {/* Sparkline SVG do Stitch */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <span className="text-[11px] font-medium text-on-surface-variant">
                      Ritmo de Interações Diárias
                    </span>
                    <div className="w-full h-16 bg-surface-container-low rounded-xl p-2 flex items-center justify-center">
                      <svg className="w-full h-full text-primary" fill="none" viewBox="0 0 280 48">
                        <path
                          d="M5 38 L45 28 L90 32 L135 12 L180 22 L225 6 L275 14"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                        />
                        <circle cx="225" cy="6" fill="currentColor" r="3.5" />
                        <path
                          d="M5 38 L45 28 L90 32 L135 12 L180 22 L225 6 L275 14 L275 48 L5 48 Z"
                          fill="currentColor"
                          fillOpacity="0.08"
                        />
                      </svg>
                    </div>
                    <div className="flex justify-between text-[10px] text-on-surface-variant px-1 font-medium">
                      <span>Seg</span>
                      <span>Ter</span>
                      <span>Qua</span>
                      <span>Qui</span>
                      <span>Sex</span>
                      <span>Sáb</span>
                      <span>Dom</span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Comunidades Mais Ativas do D1 */}
                <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-3">
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
                        to={`/c/${c.slug || c.id}`}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-surface-container transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs flex-shrink-0 shadow-xs"
                            style={{ backgroundColor: c.icon_color || '#712ae2' }}
                          >
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-semibold text-on-surface truncate group-hover:text-primary">
                            c/{c.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-on-surface-variant">
                          {c.members_count} mem.
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

// Componente do Card de Notificação
interface NotificationCardProps {
  item: NotificationItem;
  onToggleRead: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

const NotificationCard: React.FC<NotificationCardProps> = ({ item, onToggleRead, onDelete }) => {
  const getSubBadge = () => {
    switch (item.type) {
      case 'mention':
        return { icon: 'alternate_email', bg: 'bg-secondary-container text-on-secondary-container' };
      case 'upvote':
        return { icon: 'arrow_upward', bg: 'bg-primary-container text-on-primary' };
      case 'video':
        return { icon: 'smart_display', bg: 'bg-indigo-600 text-white' };
      case 'reaction':
        return { icon: 'favorite', bg: 'bg-rose-500 text-white' };
      case 'follow':
        return { icon: 'person_add', bg: 'bg-primary-container text-on-primary' };
      case 'community':
      default:
        return { icon: 'groups', bg: 'bg-purple-600 text-white' };
    }
  };

  const badge = getSubBadge();

  return (
    <article
      onClick={onToggleRead}
      className={`group relative rounded-2xl p-4 transition-all duration-200 border cursor-pointer ${
        !item.read
          ? 'bg-surface-container-lowest border-primary/25 shadow-xs hover:shadow-md'
          : 'bg-surface-container-lowest/80 border-outline-variant/20 hover:bg-surface-container-lowest hover:border-outline-variant/40'
      }`}
    >
      {/* Ponto indicador de não lida */}
      {!item.read && (
        <span className="absolute left-2.5 top-5 w-2 h-2 rounded-full bg-primary ring-2 ring-surface-container-lowest" />
      )}

      <div className={`flex items-start gap-3.5 ${!item.read ? 'pl-2' : ''}`}>
        {/* Avatar com Sub-badge */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary flex items-center justify-center font-bold text-sm uppercase shadow-xs">
            {item.authorName.charAt(0)}
          </div>
          <div
            className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-xs ${badge.bg}`}
          >
            <span className="material-symbols-outlined text-[12px]">{badge.icon}</span>
          </div>
        </div>

        {/* Corpo da Notificação */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs sm:text-sm text-on-surface leading-snug">
              <strong className="font-bold text-on-surface">@{item.authorUsername}</strong>{' '}
              {item.title}{' '}
              {item.communityName && (
                <Link
                  to={`/c/${item.communitySlug || item.communityName}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary hover:text-on-primary transition-colors ml-1"
                >
                  c/{item.communityName}
                </Link>
              )}
            </p>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-on-surface-variant whitespace-nowrap">
                {item.timestamp}
              </span>
              <button
                type="button"
                onClick={onDelete}
                title="Remover notificação"
                className="opacity-0 group-hover:opacity-100 p-1 text-on-surface-variant hover:text-error rounded-lg hover:bg-surface-container transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </div>

          {/* Citação / Caixa de Preview */}
          {item.content && (
            <div className="mt-2 p-3 rounded-xl bg-surface-container-low text-on-surface-variant text-xs leading-relaxed border border-outline-variant/15">
              {item.content}
            </div>
          )}

          {/* Ações Rápidas */}
          <div className="mt-3 flex items-center gap-2">
            {item.actionUrl && (
              <Link
                to={item.actionUrl}
                onClick={(e) => e.stopPropagation()}
                className="h-7 px-3.5 rounded-full bg-primary-container text-on-primary text-[11px] font-semibold flex items-center gap-1 hover:bg-primary shadow-xs transition-colors"
              >
                <span>Ver publicação</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleRead();
              }}
              className="h-7 px-3 rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high text-[11px] font-medium transition-colors"
            >
              {item.read ? 'Marcar não lida' : 'Marcar como lida'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
