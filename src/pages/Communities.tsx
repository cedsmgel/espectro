import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { communitiesApi, Community, authStorage } from '../lib/api';
import { requestAuth } from '../lib/authEvents';
import { useSidebar } from '../context/SidebarContext';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { CreateCommunityModal } from '../components/CreateCommunityModal';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { CommunitySuggestions } from '../components/CommunitySuggestions';

export const Communities: React.FC = () => {
  const navigate = useNavigate();
  const { isExpanded } = useSidebar();
  const user = authStorage.getUser();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'minhas' | 'descobrir'>('descobrir');
  const [tabChosen, setTabChosen] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const loadCommunities = async () => {
    setLoading(true);
    setHasError(false);
    try {
      const data = await communitiesApi.list();
      setCommunities(data);
      // Quem já participa de alguma comunidade abre direto em "Minhas"
      if (!tabChosen && data.some((c) => c.is_member)) setTab('minhas');
      setHasError(false);
    } catch (err) {
      console.error('Erro ao carregar comunidades:', err);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommunities();
  }, []);

  const handleCommunityCreated = (created: Community) => {
    setCommunities((prev) => [created, ...prev]);
  };

  const myCount = communities.filter((c) => c.is_member).length;
  const filtered = communities
    .filter((c) => tab === 'descobrir' || c.is_member)
    .filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.description?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />

      <div
        className={`pt-16 md:pt-0 flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          isExpanded ? 'pl-0 md:pl-20' : 'pl-0 md:pl-20'
        }`}
      >
        <main className="w-full max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-24 md:pb-8 flex-1">
          <section className="flex flex-col gap-6 mx-auto min-w-0">
            {/* Header Banner */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm border border-outline-variant">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2">
                  <span>e/Comunidades</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-medium">
                    Catálogo Oficial
                  </span>
                </h1>
                <p className="text-xs text-on-surface-variant mt-1">
                  Encontre círculos de interesse, clubes retrô e fóruns de tecnologia.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    requestAuth({ mode: 'login', reason: 'Para criar uma comunidade, entre ou crie uma conta.' });
                  } else {
                    setShowModal(true);
                  }
                }}
                className="px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Criar Comunidade</span>
              </button>
            </div>

            {/* Barra de Pesquisa */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar comunidades por nome ou tópicos..."
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-surface-container-lowest border border-outline-variant text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs"
              />
            </div>

            {user && (
              <div role="tablist" aria-label="Comunidades" className="flex border-b border-outline-variant">
                {(
                  [
                    { id: 'minhas', label: 'Minhas', count: myCount },
                    { id: 'descobrir', label: 'Descobrir', count: null },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => {
                      setTab(t.id);
                      setTabChosen(true);
                    }}
                    className={`flex-1 h-12 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-px cursor-pointer transition-colors ${
                      tab === t.id ? 'border-on-surface text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {t.label}
                    {t.count !== null && <span className="tabular-nums text-on-surface-variant">{t.count}</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Recomendadas para a pessoa logada (só em Descobrir e fora da busca) */}
            {user && tab === 'descobrir' && !search.trim() && <CommunitySuggestions onJoined={loadCommunities} />}

            {/* Lista de Comunidades */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant shadow-sm flex flex-col gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-surface-container-high" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-4 w-32 rounded bg-surface-container-high" />
                        <div className="h-3 w-16 rounded bg-surface-container" />
                      </div>
                    </div>
                    <div className="h-3 w-full rounded bg-surface-container mt-2" />
                    <div className="h-3 w-2/3 rounded bg-surface-container" />
                  </div>
                ))}
              </div>
            ) : hasError ? (
              <ErrorState
                title="Não foi possível carregar as comunidades"
                message="Falha de conexão com a rede. Tente carregar novamente."
                onRetry={loadCommunities}
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon="groups"
                title={tab === 'minhas' && !search ? 'Você ainda não participa de nenhuma comunidade' : 'Nenhuma comunidade encontrada'}
                description={
                  tab === 'minhas' && !search
                    ? 'Abra a aba Descobrir e entre em círculos do seu interesse.'
                    : search
                    ? `Nenhuma comunidade com o termo "${search}". Que tal criar uma agora mesmo?`
                    : 'Nenhuma comunidade foi criada ainda. Dê o primeiro passo e crie um novo círculo!'
                }
                actionLabel="Criar Comunidade"
                onAction={() => {
                  if (!user) {
                    requestAuth({ mode: 'login', reason: 'Para criar uma comunidade, entre ou crie uma conta.' });
                  } else {
                    setShowModal(true);
                  }
                }}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filtered.map((comm) => (
                  <div
                    key={comm.id}
                    className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 group"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        {comm.icon_url ? (
                          <img loading="lazy" decoding="async" src={comm.icon_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                        ) : (
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-base flex-shrink-0 shadow-xs"
                            style={{ backgroundColor: comm.icon_color || '#404040' }}
                          >
                            {comm.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <Link
                            to={`/e/${comm.slug || comm.id}`}
                            className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors truncate"
                          >
                            e/{comm.name}
                          </Link>
                          <span className="text-[11px] text-on-surface-variant">
                            {comm.members_count} {comm.members_count === 1 ? 'membro' : 'membros'}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                        {comm.description || 'Comunidade vibrante do Espectro Social.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-outline-variant">
                      <span className="text-[10px] text-on-surface-variant font-medium">
                        Desde 2026
                      </span>
                      <Link
                        to={`/e/${comm.slug || comm.id}`}
                        className="px-3.5 py-1.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <span>Visitar</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Modal Criar Comunidade */}
      <CreateCommunityModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onCommunityCreated={handleCommunityCreated}
      />
    </div>
  );
};
