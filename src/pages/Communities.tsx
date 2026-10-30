import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { communitiesApi, Community, authStorage } from '../lib/api';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';

export const Communities: React.FC = () => {
  const navigate = useNavigate();
  const user = authStorage.getUser();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('Você precisa estar logado para fundar uma comunidade.');
      return;
    }

    if (!name.trim()) {
      setError('O nome da comunidade é obrigatório.');
      return;
    }

    setCreating(true);
    try {
      const created = await communitiesApi.create({
        name: name.trim(),
        description: description.trim(),
      });
      setCommunities((prev) => [created, ...prev]);
      setShowModal(false);
      setName('');
      setDescription('');
      navigate(`/e/${created.slug || created.id}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar comunidade.');
    } finally {
      setCreating(false);
    }
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
                  <span>e/Comunidades</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-medium">
                    Catálogo
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
                className="px-4 py-2 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Criar Comunidade</span>
              </button>
            </div>

            {/* Search and Filters */}
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por nome ou assunto da comunidade..."
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-xs sm:text-sm placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary-container/20 shadow-xs transition-all"
              />
            </div>

            {/* Communities Grid */}
            {loading ? (
              <div className="bg-surface-container-lowest rounded-2xl p-12 text-center text-on-surface-variant border border-outline-variant/30 shadow-sm">
                <span className="material-symbols-outlined text-[36px] text-primary animate-spin">
                  progress_activity
                </span>
                <p className="mt-2 text-xs">Carregando comunidades do Espectro...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-surface-container-lowest rounded-2xl p-12 text-center text-on-surface-variant border border-outline-variant/30 shadow-sm">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40 mb-2">
                  group_off
                </span>
                <p className="text-sm font-semibold text-on-surface">
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
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary to-secondary p-0.5 flex-shrink-0 shadow-xs">
                          <div className="w-full h-full bg-surface-container-lowest rounded-[10px] flex items-center justify-center font-bold text-primary text-base">
                            {comm.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <Link
                            to={`/e/${comm.slug || comm.id}`}
                            className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors truncate"
                          >
                            e/{comm.name}
                          </Link>
                          <span className="text-[11px] text-on-surface-variant">
                            {comm.members_count} membros
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
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">group_add</span>
                <span>Fundar Nova Comunidade</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-error-container text-error text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">Nome da Comunidade</label>
                <div className="flex items-center rounded-xl bg-surface-container-low border border-outline-variant/30 px-3">
                  <span className="text-xs text-primary font-bold">e/</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="tecnologia, cinema, retro..."
                    className="w-full py-2.5 px-1.5 text-xs bg-transparent text-on-surface focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Qual o propósito deste espaço no Espectro?"
                  rows={3}
                  className="w-full p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container transition-all resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-full text-on-surface-variant hover:bg-surface-container text-xs font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-full bg-primary-container text-on-primary font-semibold text-xs hover:bg-primary shadow-xs transition-all disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Fundar Comunidade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
