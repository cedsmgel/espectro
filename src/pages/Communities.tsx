import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { ContactsWidget } from '../components/ContactsWidget';
import { api, authStorage, Community } from '../lib/api';

export const Communities: React.FC = () => {
  const navigate = useNavigate();
  const user = authStorage.getUser();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // New community form
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fetchCommunities = async () => {
    try {
      setLoading(true);
      const data = await api.getCommunities();
      setCommunities(data);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, []);

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    if (!user) {
      setCreateError('Você precisa estar logado para criar uma comunidade!');
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);
      await api.createCommunity({
        name: newName.trim(),
        slug: newSlug.trim() || undefined,
        description: newDescription.trim() || undefined,
      });
      setNewName('');
      setNewSlug('');
      setNewDescription('');
      setShowModal(false);
      setSuccessToast('Comunidade criada com sucesso!');
      await fetchCommunities();
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Erro ao criar comunidade');
    } finally {
      setCreating(false);
    }
  };

  const filtered = communities.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase())) ||
    (c.slug && c.slug.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-brand-blue/30 selection:text-blue-300">
      <Header />

      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column */}
          <aside className="md:col-span-3 lg:col-span-3 sticky top-20">
            <SidebarNav communities={communities} />
          </aside>

          {/* Center Column */}
          <section className="md:col-span-9 lg:col-span-6 space-y-5">
            {successToast && (
              <div className="p-3.5 rounded-2xl bg-neon-green/10 border border-neon-green/30 text-neon-green text-xs flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  {successToast}
                </span>
                <button onClick={() => setSuccessToast(null)} className="text-neutral-400 hover:text-white cursor-pointer">
                  ✕
                </button>
              </div>
            )}

            {/* Header & Search Banner */}
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-brand-blue text-2xl">hub</span>
                    e/Comunidades
                  </h1>
                  <p className="text-xs text-neutral-400 mt-1">
                    Descubra espaços de interesse, fóruns de debate e tópicos da comunidade.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      navigate('/login');
                      return;
                    }
                    setShowModal(true);
                  }}
                  className="btn-primary-blue text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  Nova Comunidade
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar comunidades por nome ou slug..."
                  className="w-full glass-input pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder:text-neutral-500"
                />
                <span className="material-symbols-outlined absolute left-3 top-3 text-neutral-500 text-[18px]">
                  search
                </span>
              </div>
            </div>

            {/* Communities Grid */}
            <div className="space-y-3.5">
              {loading && (
                <div className="glass-panel rounded-2xl p-8 text-center text-neutral-400 flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-brand-blue">sync</span>
                  Carregando catálogo de comunidades...
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <div className="glass-panel rounded-2xl p-10 text-center space-y-2">
                  <p className="font-display font-bold text-base text-white">Nenhuma comunidade encontrada</p>
                  <p className="text-xs text-neutral-400">
                    Crie a primeira comunidade do Espectro agora mesmo!
                  </p>
                </div>
              )}

              {filtered.map((c) => {
                const slug = c.slug || c.id;
                return (
                  <article
                    key={c.id}
                    className="glass-panel rounded-2xl p-5 transition-all hover:border-white/15 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-brand-blue to-neon-cyan flex items-center justify-center font-display font-bold text-lg text-white shadow-sm uppercase shrink-0">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <Link
                            to={`/e/${slug}`}
                            className="font-display font-bold text-base text-white hover:text-blue-400 transition-colors"
                          >
                            e/{c.name}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-400 font-mono">
                            <span>/e/{slug}</span>
                            <span>•</span>
                            <span className="text-neon-green font-semibold">{c.members_count} membros</span>
                          </div>
                        </div>
                      </div>

                      <Link
                        to={`/e/${slug}`}
                        className="btn-glass text-xs font-semibold px-3 py-1.5 rounded-xl hover:text-white"
                      >
                        Acessar »
                      </Link>
                    </div>

                    <p className="text-sm text-neutral-300 leading-relaxed font-sans">
                      {c.description || 'Comunidade acolhedora pronta para novas discussões.'}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Right Column */}
          <aside className="md:col-span-12 lg:col-span-3 sticky top-20">
            <ContactsWidget />
          </aside>
        </div>
      </main>

      {/* Modern Glass Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-panel bg-[#131722]/95 rounded-2xl max-w-lg w-full p-6 space-y-4 border border-white/15 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-brand-blue text-[20px]">add_circle</span>
                Criar Nova Comunidade
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCommunity} className="space-y-3.5">
              {createError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1" htmlFor="com-name">
                  Nome da Comunidade:
                </label>
                <input
                  id="com-name"
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug || newSlug === newName.toLowerCase().replace(/\s+/g, '-')) {
                      setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));
                    }
                  }}
                  placeholder="Ex: Desenvolvedores Cloudflare"
                  className="w-full glass-input px-3.5 py-2 text-sm rounded-xl text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1" htmlFor="com-slug">
                  Slug / URL Amigável:
                </label>
                <div className="flex items-center">
                  <span className="bg-white/[0.05] border border-r-0 border-white/10 px-3 py-2 rounded-l-xl text-xs text-neutral-400 font-mono">
                    /e/
                  </span>
                  <input
                    id="com-slug"
                    type="text"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="devs-cloudflare"
                    className="w-full glass-input px-3 py-2 text-xs rounded-r-xl text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1" htmlFor="com-desc">
                  Descrição:
                </label>
                <textarea
                  id="com-desc"
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Descreva os temas, diretrizes e propósitos desta comunidade..."
                  className="w-full glass-input p-3 text-xs rounded-xl text-white outline-none resize-y"
                />
              </div>

              <div className="flex justify-end items-center gap-2 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-glass text-xs font-medium px-4 py-2 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  className="btn-primary-blue text-xs font-semibold px-5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
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
