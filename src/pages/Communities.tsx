import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { api, authStorage, Community } from '../lib/api';

export const Communities: React.FC = () => {
  const navigate = useNavigate();
  const user = authStorage.getUser();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // New community form state
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

  const filteredCommunities = communities.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="bg-[#d4e2fa] font-body-md text-on-surface antialiased min-h-screen flex flex-col justify-between">
      <Header />

      {/* Main Portal Container */}
      <main className="w-full max-w-[1180px] mx-auto px-space-md py-space-md flex-grow">
        {/* Feedback Toast */}
        {successToast && (
          <div className="mb-space-md p-space-sm bg-[#e7f7ed] text-[#1e6f3b] retro-border rounded flex items-center justify-between border-[#a3dfb4]">
            <span className="flex items-center gap-1 font-bold">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              {successToast}
            </span>
            <button
              onClick={() => setSuccessToast(null)}
              className="text-secondary hover:text-primary font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Masthead Search & Breadcrumb */}
        <div className="bg-surface-container-lowest retro-border rounded mb-space-md p-space-sm flex flex-col md:flex-row justify-between items-center gap-space-md">
          <div className="flex items-center gap-space-xs text-body-sm font-body-sm text-secondary">
            <Link to="/" className="text-primary hover:underline">Início</Link>
            <span className="text-outline">›</span>
            <span className="text-primary font-medium">Comunidades</span>
            <span className="text-outline">›</span>
            <span className="text-on-surface font-label-md">Explorar e Catálogo</span>
          </div>

          <div className="flex items-center gap-space-xs w-full md:w-auto">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="buscar comunidades por nome ou tema..."
                className="w-full pl-7 pr-2 py-1 text-body-sm font-body-sm bg-white border border-[#9bb7e4] rounded focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-secondary-container shadow-inner"
              />
              <span className="material-symbols-outlined absolute left-1.5 top-1.5 text-secondary text-[16px]">
                search
              </span>
            </div>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="retro-btn text-primary text-label-sm px-2 py-1 rounded"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Layout Grid: Center Column (8 cols) + Right Rail (4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
          {/* ================= CENTER COLUMN ================= */}
          <section className="lg:col-span-8 flex flex-col gap-space-md">
            {/* Header Banner & Action Bar */}
            <div className="bg-surface-container-lowest retro-border rounded p-space-md">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-space-sm border-b border-surface-variant gap-space-sm">
                <div>
                  <h1 className="text-headline-sm font-headline-sm text-primary flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-primary-container text-[20px]">groups</span>
                    Catálogo de Comunidades do Espectro
                  </h1>
                  <p className="text-body-sm font-body-sm text-secondary">
                    Encontre fóruns, grupos de afinidade, memórias nostálgicas e debates.
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
                  className="retro-btn-primary text-white font-label-md text-label-md px-space-lg py-1.5 rounded flex items-center gap-1 active:translate-y-px whitespace-nowrap shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  + Criar Nova Comunidade
                </button>
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap gap-1 mt-space-sm border-b border-[#b2ccf7] pt-1">
                <button className="bg-white border-t border-l border-r border-[#b2ccf7] rounded-t px-space-md py-1 text-label-md font-label-md text-primary-container font-bold -mb-px">
                  Todas as Comunidades ({filteredCommunities.length})
                </button>
              </div>
            </div>

            {/* Communities List */}
            <div className="flex flex-col gap-space-sm">
              {loading && (
                <div className="bg-white retro-border rounded p-space-lg text-center text-secondary flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                  Carregando comunidades do banco D1...
                </div>
              )}

              {!loading && filteredCommunities.length === 0 && (
                <div className="bg-white retro-border rounded p-space-lg text-center text-secondary">
                  <p className="font-semibold text-primary mb-1">Nenhuma comunidade cadastrada ainda.</p>
                  <p className="text-body-sm">
                    {user
                      ? 'Clique no botão acima para fundar a primeira comunidade!'
                      : 'Faça login para criar a primeira comunidade do Espectro!'}
                  </p>
                </div>
              )}

              {filteredCommunities.map((community, index) => {
                const memberCount = (community.members_count ?? (community as any).member_count ?? 1);
                const comSlug = community.slug || community.id;
                return (
                  <article key={community.id} className="bg-white retro-border rounded overflow-hidden">
                    <div className="header-bar-gradient px-space-md py-1 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <h2 className="text-label-md font-label-md text-primary font-bold hover:underline cursor-pointer">
                          {index + 1}. {community.name}
                        </h2>
                        <span className="text-[11px] text-secondary font-mono bg-surface-container px-1 py-0.2 rounded">
                          /e/{comSlug}
                        </span>
                      </div>
                      <span className="text-body-sm font-body-sm bg-secondary-container text-on-secondary-fixed px-1.5 py-0.2 rounded font-semibold">
                        {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
                      </span>
                    </div>

                    <div className="p-space-md flex flex-col sm:flex-row gap-space-md items-start">
                      {/* Thumbnail */}
                      <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 bg-primary-container text-white border border-[#9bb7e4] rounded p-1 flex items-center justify-center shadow-inner font-bold text-2xl uppercase">
                        {community.name.charAt(0)}
                      </div>

                      {/* Meta & Description */}
                      <div className="flex-grow flex flex-col justify-between">
                        <p className="text-body-md font-body-md text-on-surface">
                          {community.description || 'Comunidade sem descrição adicional.'}
                        </p>
                        <div className="mt-space-sm flex flex-wrap items-center gap-x-space-md gap-y-1 text-body-sm font-body-sm text-secondary">
                          <span><strong>Slug:</strong> /e/{comSlug}</span>
                          <span><strong>Categoria:</strong> Fórum Nostálgico</span>
                          <span><strong>Tipo:</strong> Pública</span>
                          <span><strong>Fundada em:</strong> {new Date(community.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex sm:flex-col gap-space-xs shrink-0 w-full sm:w-36 mt-2 sm:mt-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (!user) {
                              navigate('/login');
                              return;
                            }
                            alert(`Você agora faz parte da comunidade "${community.name}"!`);
                          }}
                          className="retro-btn-primary text-white font-label-md text-label-md py-1 px-space-sm rounded w-full flex items-center justify-center gap-1 active:translate-y-px cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">group_add</span>
                          Participar
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* ================= RIGHT RAIL ================= */}
          <aside className="lg:col-span-4 flex flex-col gap-space-md">
            {/* Top Comunidades Ranking */}
            <div className="bg-white retro-border rounded overflow-hidden">
              <div className="header-bar-gradient px-space-md py-1 flex justify-between items-center">
                <span className="text-label-md font-label-md text-primary font-bold">top comunidades do banco</span>
                <span className="text-body-sm font-body-sm text-secondary">membros</span>
              </div>
              <div className="p-space-md flex flex-col divide-y divide-surface-container">
                {communities.slice(0, 5).map((c, i) => (
                  <div key={c.id} className="py-1.5 flex justify-between items-center text-body-sm">
                    <span className="text-primary font-medium truncate pr-2">
                      #{i + 1} {c.name}
                    </span>
                    <span className="text-secondary text-label-sm shrink-0">
                      {c.members_count} {c.members_count === 1 ? 'membro' : 'membros'}
                    </span>
                  </div>
                ))}
                {communities.length === 0 && (
                  <p className="py-2 text-secondary text-body-sm text-center">Nenhuma comunidade no ranking.</p>
                )}
              </div>
            </div>

            {/* Dica de Moderação */}
            <div className="bg-[#f5f8fe] retro-border rounded p-space-md border-l-4 border-l-primary-container">
              <div className="flex items-center gap-1 text-primary font-bold text-label-md font-label-md mb-1">
                <span className="material-symbols-outlined text-[18px]">security</span>
                Dica de Convivência
              </div>
              <p className="text-body-sm font-body-sm text-secondary leading-tight">
                Respeite os participantes nos fóruns e tópicos. Mantenha o espírito caloroso e amigável da internet dos anos 2000!
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* CREATE COMMUNITY MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-[#1f3d7a]/60 backdrop-blur-sm z-50 flex items-center justify-center p-space-md">
          <div className="bg-white retro-border rounded-lg max-w-xl w-full shadow-2xl border-4 border-[#c3d9ff] overflow-hidden">
            <div className="header-bar-gradient px-space-md py-2 flex justify-between items-center border-b border-[#b2ccf7]">
              <span className="text-label-md font-label-md text-primary font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">groups</span>
                Criar Nova Comunidade no Espectro
              </span>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-secondary hover:text-error text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCommunity} className="p-space-lg space-y-space-md">
              {createError && (
                <div className="p-2 rounded bg-error-container text-on-error-container text-body-sm border border-error">
                  {createError}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-label-md font-label-md text-primary font-bold" htmlFor="com-name">
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
                  placeholder="Ex: Eu odeio acordar cedo"
                  className="w-full text-body-md font-body-md px-space-sm py-1.5 rounded border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary outline-none shadow-inner"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-label-md font-label-md text-primary font-bold" htmlFor="com-slug">
                  Slug / URL Amigável:
                </label>
                <div className="flex items-center">
                  <span className="bg-surface-container px-2 py-1.5 border border-r-0 border-outline-variant rounded-l text-secondary text-body-sm font-mono">
                    /e/
                  </span>
                  <input
                    id="com-slug"
                    type="text"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="eu-odeio-acordar-cedo"
                    className="w-full text-body-md font-body-md px-space-sm py-1.5 rounded-r border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary outline-none shadow-inner font-mono text-sm"
                  />
                </div>
                <p className="text-[11px] text-secondary">
                  Identificador único na URL (deixe em branco para gerar automaticamente).
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-label-md font-label-md text-primary font-bold" htmlFor="com-desc">
                  Descrição do Fórum:
                </label>
                <textarea
                  id="com-desc"
                  rows={4}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Descreva sobre o que é esta comunidade, regras de convivência e memórias..."
                  className="w-full text-body-md font-body-md px-space-sm py-1.5 rounded border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary outline-none shadow-inner resize-y"
                />
              </div>

              <div className="flex justify-end items-center gap-space-sm pt-space-sm border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="retro-btn text-secondary px-space-md py-1.5 rounded text-label-md font-label-md cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  className="retro-btn-primary text-white px-space-lg py-1.5 rounded text-label-md font-label-md font-bold disabled:opacity-50 active:translate-y-px cursor-pointer"
                >
                  {creating ? 'Criando comunidade...' : 'Criar Comunidade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
