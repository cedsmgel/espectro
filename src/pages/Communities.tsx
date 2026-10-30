import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { communitiesApi, Community, authStorage } from '../lib/api';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { ContactsWidget } from '../components/ContactsWidget';

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
    <div className="min-h-screen bg-[#0d0f14] text-neutral-100 flex flex-col relative overflow-x-hidden">
      {/* Ambient Spectral Glow Orbs from Stitch */}
      <div className="orb-glow-1" />
      <div className="orb-glow-2" />

      <Header />

      <main className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6 relative z-10 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_320px] gap-6 items-start">
          {/* Left Navigation */}
          <SidebarNav communities={communities} />

          {/* Center Column: Communities Catalog */}
          <section className="flex flex-col gap-6 w-full min-w-0">
            {/* Header Banner */}
            <div className="glass-surface rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.4)]">
              <div>
                <h1 className="text-xl sm:text-2xl font-display font-bold text-white flex items-center gap-2">
                  <span>e/Comunidades</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-400/10 text-cyan-300 border border-cyan-400/30">
                    Catálogo
                  </span>
                </h1>
                <p className="text-xs text-neutral-400 mt-1">
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
                className="btn-primary-blue text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-[0_0_16px_rgba(59,130,246,0.35)] shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Fundar Comunidade</span>
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-neutral-400 text-[20px]">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar comunidades por nome ou tema..."
                className="w-full pl-11 pr-4 py-3 rounded-2xl glass-surface text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-400 transition-all"
              />
            </div>

            {/* Communities Grid */}
            {loading ? (
              <div className="glass-surface rounded-2xl p-8 text-center text-neutral-400 text-sm animate-pulse">
                Carregando catálogo de comunidades...
              </div>
            ) : filtered.length === 0 ? (
              <div className="glass-surface rounded-2xl p-10 text-center space-y-3">
                <span className="material-symbols-outlined text-4xl text-neutral-400">groups</span>
                <h3 className="text-base font-display font-semibold text-white">
                  Nenhuma comunidade encontrada
                </h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Que tal fundar a primeira comunidade sobre esse assunto?
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filtered.map((comm) => (
                  <div
                    key={comm.id}
                    className="glass-surface rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all duration-200 hover:border-white/20 hover:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.6)] group"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#111318] p-1 border border-white/10 shrink-0">
                          <div className="w-full h-full rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center text-white font-display font-bold text-lg">
                            {comm.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <span className="text-[10px] text-cyan-300 font-semibold bg-cyan-400/10 px-2 py-0.5 rounded-full border border-cyan-400/20">
                          {comm.members_count || 1}{' '}
                          {comm.members_count === 1 ? 'membro' : 'membros'}
                        </span>
                      </div>

                      <Link
                        to={`/e/${comm.slug || comm.id}`}
                        className="text-base font-display font-bold text-white group-hover:text-cyan-300 transition-colors block truncate"
                      >
                        e/{comm.name}
                      </Link>

                      <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                        {comm.description || 'Comunidade aberta do Espectro.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                      <span className="text-neutral-500 text-[11px]">
                        Por @{comm.owner_name || 'criador'}
                      </span>
                      <Link
                        to={`/e/${comm.slug || comm.id}`}
                        className="btn-glass text-xs font-semibold px-3.5 py-1.5 rounded-xl hover:bg-cyan-400 hover:text-[#001f26] transition-all"
                      >
                        Acessar »
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Right Utility Contacts */}
          <ContactsWidget communities={communities} />
        </div>
      </main>

      {/* Modal Criar Comunidade */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="glass-surface rounded-3xl p-6 sm:p-8 max-w-md w-full border border-white/15 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400">group_add</span>
                <span>Fundar Nova Comunidade</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {error && (
              <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs px-3.5 py-2.5 rounded-xl mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Nome da Comunidade
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Anos 2000 & Nostalgia"
                  className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl glass-recessed text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Descrição e Propósito
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Conte para os membros sobre o que é esta comunidade..."
                  className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl glass-recessed text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-400 transition-all resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-glass text-xs font-semibold px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary-blue text-xs font-semibold px-5 py-2 rounded-xl disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Criar Comunidade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
