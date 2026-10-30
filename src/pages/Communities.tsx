import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { communitiesApi, Community, authStorage } from '../lib/api';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { CreateCommunityModal } from '../components/CreateCommunityModal';

export const Communities: React.FC = () => {
  const navigate = useNavigate();
  const user = authStorage.getUser();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const loadCommunities = async () => {
    try {
      const data = await communitiesApi.list();
      setCommunities(data);
    } catch (err) {
      console.error('Erro ao carregar comunidades:', err);
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

  const filtered = communities.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />

      <div className="pl-0 md:pl-[72px] pt-16 flex-1 flex flex-col">
        <main className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 flex-1">
          <section className="flex flex-col gap-6 max-w-5xl mx-auto min-w-0">
            {/* Header Banner */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm border border-outline-variant/30">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2">
                  <span>c/Comunidades</span>
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
                    navigate('/login');
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
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs"
              />
            </div>

            {/* Lista de Comunidades */}
            {loading ? (
              <div className="bg-surface-container-lowest rounded-2xl p-12 text-center text-on-surface-variant border border-outline-variant/30 shadow-sm">
                <span className="material-symbols-outlined text-[36px] text-primary animate-spin">
                  progress_activity
                </span>
                <p className="mt-2 text-xs">Carregando catálogo de comunidades...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-surface-container-lowest rounded-2xl p-12 text-center text-on-surface-variant border border-outline-variant/30 shadow-sm">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40 mb-2">
                  group_off
                </span>
                <p className="font-semibold text-sm text-on-surface">
                  Nenhuma comunidade encontrada
                </p>
                <p className="text-xs text-on-surface-variant mt-1">
                  Crie a primeira comunidade sobre esse tema!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((comm) => (
                  <div
                    key={comm.id}
                    className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 group"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-base flex-shrink-0 shadow-xs"
                          style={{ backgroundColor: comm.icon_color || '#712ae2' }}
                        >
                          {comm.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <Link
                            to={`/c/${comm.slug || comm.id}`}
                            className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors truncate"
                          >
                            c/{comm.name}
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

                    <div className="flex items-center justify-between pt-3 border-t border-outline-variant/20">
                      <span className="text-[10px] text-on-surface-variant font-medium">
                        Desde 2026
                      </span>
                      <Link
                        to={`/c/${comm.slug || comm.id}`}
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
