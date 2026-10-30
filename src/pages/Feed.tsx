import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { api, authStorage, Post, Community } from '../lib/api';

export const Feed: React.FC = () => {
  const navigate = useNavigate();
  const user = authStorage.getUser();

  const [posts, setPosts] = useState<Post[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [content, setContent] = useState('');
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingCommunities, setLoadingCommunities] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchPosts = async () => {
    try {
      setLoadingPosts(true);
      setError(null);
      const data = await api.getPosts();
      setPosts(data);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Falha ao carregar recados');
    } finally {
      setLoadingPosts(false);
    }
  };

  const fetchCommunities = async () => {
    try {
      setLoadingCommunities(true);
      const data = await api.getCommunities();
      setCommunities(data);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoadingCommunities(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchCommunities();
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (!user) {
      setError('Você precisa estar logado para enviar recados!');
      return;
    }

    try {
      setPosting(true);
      setError(null);
      setSuccessMsg(null);
      await api.createPost({ content: content.trim() });
      setContent('');
      setSuccessMsg('Recado enviado com sucesso!');
      await fetchPosts();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao publicar recado');
    } finally {
      setPosting(false);
    }
  };

  const addEmoticon = (emo: string) => {
    setContent((prev) => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + emo + ' ');
  };

  // Contagem de recados do usuário conectado
  const userScrapCount = user ? posts.filter((p) => p.author_id === user.id).length : 0;

  return (
    <div className="bg-surface-variant text-on-surface antialiased min-h-screen flex flex-col font-body-md text-body-md selection:bg-secondary-container selection:text-primary">
      <Header />

      {/* Main 3-Column Layout Container */}
      <main className="flex-1 w-full max-w-[1180px] mx-auto px-space-md sm:px-space-lg py-space-md">
        {/* Top Breadcrumb Bar */}
        <div className="mb-space-sm bg-surface-container border border-outline-variant rounded p-space-sm flex items-center justify-between text-body-sm font-body-sm shadow-sm">
          <div className="flex items-center gap-1.5 text-primary">
            <span className="material-symbols-outlined text-primary text-[16px]">home</span>
            <Link to="/" className="hover:underline">Início</Link>
            <span className="text-secondary">&gt;</span>
            <span className="font-bold text-on-surface">
              {user ? `@${user.username}` : 'Perfil Padrão (Visitante)'}
            </span>
            <span className="text-secondary">&gt;</span>
            <span className="font-bold text-on-surface">Página de Recados e Amigos</span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-label-sm font-label-sm text-secondary">
            <span className="material-symbols-outlined text-[14px]">lock_open</span>
            {user ? 'Perfil ativo e conectado' : 'Modo visitante (somente leitura)'}
          </div>
        </div>

        {/* 3-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-space-md items-start">
          {/* ================= LEFT COLUMN: PERFIL ================= */}
          <aside className="md:col-span-3 lg:col-span-3 space-y-space-md">
            {/* Profile Card */}
            <div className="bg-surface-container-lowest rounded classic-bevel-border overflow-hidden">
              <div className="retro-header-strip px-space-sm py-1.5 flex items-center justify-between">
                <span className="text-label-sm font-label-sm text-primary uppercase tracking-wide">
                  {user ? 'meu perfil' : 'perfil padrão'}
                </span>
                <span className="material-symbols-outlined text-primary text-[14px]">account_box</span>
              </div>

              <div className="p-space-md text-center">
                {/* Photo Frame */}
                <div className="relative inline-block mx-auto mb-space-sm">
                  <div className="p-1 bg-surface-container-lowest border-2 border-outline-variant shadow-sm rounded-sm">
                    {user ? (
                      <div className="w-32 h-36 bg-gradient-to-b from-[#3B65BE] to-[#1F3D7A] flex flex-col items-center justify-center text-on-primary font-bold shadow-inner">
                        <span className="text-4xl uppercase tracking-wider">{user.username.charAt(0)}</span>
                        <span className="text-[11px] font-normal opacity-90 mt-1">membro espectro</span>
                      </div>
                    ) : (
                      <div className="w-32 h-36 bg-surface-container-high flex flex-col items-center justify-center text-secondary border border-dashed border-outline-variant">
                        <span className="material-symbols-outlined text-5xl">person</span>
                        <span className="text-[10px] uppercase font-bold mt-1">visitante</span>
                      </div>
                    )}
                  </div>
                  <span
                    className={`absolute bottom-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded shadow ${
                      user ? 'bg-[#62B33C] text-white' : 'bg-secondary text-white'
                    }`}
                  >
                    {user ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                <h1 className="text-headline-sm font-headline-sm text-primary leading-tight">
                  {user ? user.username : 'Visitante'}
                </h1>

                {user ? (
                  <>
                    <p className="text-body-sm font-body-sm text-secondary italic mt-1 bg-surface-container-low p-1.5 rounded border border-outline-variant">
                      &ldquo;ouvindo CPM 22 no Winamp... 🎵&rdquo;
                    </p>
                    <p className="text-label-sm font-label-sm text-secondary mt-1">
                      São Paulo, SP • Brasil • Conectado
                    </p>

                    {/* Medidores de Karma do Usuário */}
                    <div className="mt-space-md pt-space-sm border-t border-dashed border-outline-variant text-left space-y-1.5 bg-surface-bright p-space-sm rounded">
                      <div className="flex items-center justify-between text-body-sm font-body-sm">
                        <span className="text-secondary font-medium flex items-center gap-1">
                          <span className="material-symbols-outlined text-[#E9A825] text-[15px]">star</span>
                          Confiável:
                        </span>
                        <span className="text-[#E9A825] text-label-md">★★★</span>
                      </div>
                      <div className="flex items-center justify-between text-body-sm font-body-sm">
                        <span className="text-secondary font-medium flex items-center gap-1">
                          <span className="material-symbols-outlined text-[#62B33C] text-[15px]">thumb_up</span>
                          Legal:
                        </span>
                        <span className="text-[#62B33C] text-label-md">★★★</span>
                      </div>
                      <div className="flex items-center justify-between text-body-sm font-body-sm">
                        <span className="text-secondary font-medium flex items-center gap-1">
                          <span className="material-symbols-outlined text-[#D94343] text-[15px]">favorite</span>
                          Sexy:
                        </span>
                        <span className="text-[#D94343] text-label-md">★★★</span>
                      </div>
                    </div>

                    <div className="mt-space-sm pt-space-xs text-left">
                      <div className="flex items-center justify-between text-label-sm font-label-sm text-secondary">
                        <span>Meus Recados: <strong className="text-primary">{userScrapCount}</strong></span>
                        <span>ID do Perfil: <strong className="text-primary">#{user.id}</strong></span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-space-sm bg-surface-container p-space-sm rounded border border-outline-variant text-left">
                    <p className="text-body-sm text-secondary">
                      Você ainda não está conectado. Crie sua conta ou faça login para ter seu próprio perfil e scraps.
                    </p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="retro-btn-primary text-white text-label-md py-1 px-space-sm rounded font-bold text-center"
                      >
                        Fazer Login
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/login?tab=cadastro')}
                        className="retro-btn text-primary text-label-md py-1 px-space-sm rounded font-bold text-center"
                      >
                        Criar Conta
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Menu Lateral */}
              <div className="border-t border-outline-variant bg-surface-container-low px-space-sm py-space-sm">
                <ul className="space-y-1 text-body-sm font-body-sm">
                  <li className="bg-surface-container-highest rounded border border-outline-variant">
                    <Link to="/" className="flex items-center justify-between py-1 px-1.5 text-primary font-bold">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-primary">chat</span>
                        <span className="underline">Recados (Scraps)</span>
                      </span>
                      <span className="bg-primary text-on-primary text-[10px] px-1.5 py-0.5 rounded font-bold">
                        {posts.length}
                      </span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/comunidades"
                      className="flex items-center justify-between py-1 px-1.5 text-secondary hover:bg-surface-container rounded transition-colors group"
                    >
                      <span className="flex items-center gap-1.5 group-hover:text-primary">
                        <span className="material-symbols-outlined text-[15px] text-secondary">groups</span>
                        <span className="custom-dotted-link">Comunidades</span>
                      </span>
                      <span className="text-label-sm text-secondary font-medium">({communities.length})</span>
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Tocando no Perfil */}
            <div className="bg-surface-container-lowest rounded classic-bevel-border p-space-sm text-body-sm font-body-sm">
              <div className="flex items-center gap-1.5 text-primary font-bold text-label-sm uppercase mb-1">
                <span className="material-symbols-outlined text-[14px]">headphones</span>
                Tocando no Perfil
              </div>
              <p className="text-on-surface font-semibold truncate">CPM 22 - Um Minuto Para o Fim do Mundo</p>
              <div className="w-full bg-surface-container h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-primary h-full w-2/3"></div>
              </div>
              <div className="flex justify-between text-[9px] text-secondary mt-0.5">
                <span>02:14</span>
                <span>03:20</span>
              </div>
            </div>
          </aside>

          {/* ================= CENTER COLUMN: RECADOS ================= */}
          <section className="md:col-span-9 lg:col-span-6 space-y-space-md">
            <div className="bg-surface-container-lowest rounded classic-bevel-border overflow-hidden">
              <div className="retro-header-strip px-space-md py-space-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">forum</span>
                  <h2 className="text-headline-sm font-headline-sm text-primary">Página de Recados e Amigos</h2>
                </div>
                <span className="text-label-sm font-label-sm text-secondary bg-surface-container px-2 py-0.5 rounded border border-outline-variant">
                  Scrapbook Oficial
                </span>
              </div>

              {/* Caixa de Criação de Recado */}
              <div className="p-space-md bg-surface-container-low border-b border-outline-variant">
                <h3 className="text-label-md font-label-md font-bold text-primary mb-space-xs flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">edit_note</span>
                  Deixe um recado para seus amigos
                </h3>

                {/* Toasts / Alerts de Feedback */}
                {successMsg && (
                  <div className="mb-2 p-2 rounded bg-[#e7f7ed] text-[#1e6f3b] text-body-sm border border-[#a3dfb4] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    {successMsg}
                  </div>
                )}

                {error && (
                  <div className="mb-2 p-2 rounded bg-error-container text-on-error-container text-body-sm border border-error flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    {error}
                  </div>
                )}

                {user ? (
                  <>
                    {/* Toolbar Retrô */}
                    <div className="flex items-center flex-wrap gap-1 mb-1 p-1 bg-surface-container-highest border border-outline-variant rounded-t text-body-sm font-body-sm">
                      <button
                        type="button"
                        onClick={() => addEmoticon(':-)')}
                        className="px-1.5 py-0.5 retro-btn-secondary text-[11px] rounded"
                        title="Sorriso"
                      >
                        :-)
                      </button>
                      <button
                        type="button"
                        onClick={() => addEmoticon(';-)')}
                        className="px-1.5 py-0.5 retro-btn-secondary text-[11px] rounded"
                        title="Piscadela"
                      >
                        ;-)
                      </button>
                      <button
                        type="button"
                        onClick={() => addEmoticon('s2')}
                        className="px-1.5 py-0.5 retro-btn-secondary text-[11px] text-error font-bold rounded"
                        title="Coração"
                      >
                        s2
                      </button>
                      <button
                        type="button"
                        onClick={() => addEmoticon(':-P')}
                        className="px-1.5 py-0.5 retro-btn-secondary text-[11px] rounded"
                        title="Língua"
                      >
                        :-P
                      </button>
                      <div className="h-4 w-px bg-outline-variant mx-1"></div>
                      <span className="text-[11px] text-secondary italic">recado não é chat!</span>
                    </div>

                    <form onSubmit={handleCreatePost}>
                      <textarea
                        rows={3}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Escreva seu recado ou novidade aqui..."
                        disabled={posting}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-b p-space-sm text-body-sm font-body-sm focus:border-primary-container focus:ring-1 focus:ring-secondary-container outline-none transition-all resize-y shadow-inner text-on-surface"
                      />

                      <div className="mt-space-sm flex items-center justify-between">
                        <label className="flex items-center gap-1.5 text-body-sm font-body-sm text-secondary cursor-pointer select-none">
                          <input
                            type="checkbox"
                            defaultChecked
                            className="rounded border-outline-variant text-primary focus:ring-0"
                          />
                          Visível para toda a rede
                        </label>

                        <button
                          type="submit"
                          disabled={posting || !content.trim()}
                          className="px-4 py-1.5 retro-btn-primary text-on-primary rounded text-label-md font-label-md font-bold tracking-wide flex items-center gap-1 shadow active:translate-y-px disabled:opacity-50 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">send</span>
                          {posting ? 'Enviando recado...' : 'Enviar Recado'}
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="p-space-md bg-surface-container rounded border border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-space-sm">
                    <div className="flex items-center gap-2 text-secondary">
                      <span className="material-symbols-outlined text-primary text-[20px]">lock</span>
                      <span className="text-body-sm">
                        Faça login no Espectro para enviar scraps e interagir com amigos.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="retro-btn-primary text-white text-label-md px-space-md py-1 rounded font-bold whitespace-nowrap cursor-pointer shadow"
                    >
                      Entrar no Espectro
                    </button>
                  </div>
                )}
              </div>

              {/* Header da Lista de Recados */}
              <div className="bg-surface-container-high px-space-md py-1.5 border-b border-outline-variant flex items-center justify-between text-body-sm font-body-sm">
                <span className="text-primary font-bold text-label-sm font-label-sm uppercase">
                  Recados Recentes ({posts.length} no total)
                </span>
                <button
                  type="button"
                  onClick={fetchPosts}
                  disabled={loadingPosts}
                  className="text-[11px] text-primary underline hover:text-primary-container flex items-center gap-1 cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-[12px] ${loadingPosts ? 'animate-spin' : ''}`}>
                    refresh
                  </span>
                  atualizar
                </button>
              </div>

              {/* LISTA DE RECADOS DO BANCO D1 */}
              <div className="divide-y divide-outline-variant">
                {loadingPosts && (
                  <div className="p-space-lg text-center text-secondary flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                    Carregando recados do Espectro...
                  </div>
                )}

                {!loadingPosts && posts.length === 0 && (
                  <div className="p-space-lg text-center text-secondary">
                    <p className="font-semibold text-primary mb-1">Nenhum recado encontrado ainda!</p>
                    <p className="text-body-sm">Seja o primeiro a enviar uma mensagem para a rede.</p>
                  </div>
                )}

                {posts.map((post, idx) => (
                  <article
                    key={post.id}
                    className={`p-space-md ${
                      idx % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low'
                    } hover:bg-surface-bright transition-colors`}
                  >
                    <div className="flex items-start gap-space-md">
                      {/* Avatar do Autor */}
                      <div className="flex-shrink-0 text-center">
                        <div className="w-12 h-12 bg-primary-container text-white border border-outline-variant rounded shadow-sm flex items-center justify-center font-bold text-headline-sm uppercase">
                          {post.author_name ? post.author_name.charAt(0) : 'U'}
                        </div>
                        <span className="text-[9px] text-secondary font-bold block mt-1">membro</span>
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-1 border-b border-dashed border-outline-variant pb-1 mb-1.5">
                          <span className="font-bold text-primary text-body-md font-body-md">
                            @{post.author_name || `usuario_${post.author_id}`}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] text-secondary">
                            <span className="material-symbols-outlined text-[13px]">schedule</span>
                            {new Date(post.created_at).toLocaleString('pt-BR')}
                          </div>
                        </div>

                        {post.community_name && (
                          <div className="mb-1 text-[11px] text-secondary">
                            na comunidade:{' '}
                            <span className="bg-surface-container-highest px-1 py-0.5 rounded text-primary font-semibold">
                              {post.community_name}
                            </span>
                          </div>
                        )}

                        <p className="text-body-md font-body-md text-on-surface leading-relaxed whitespace-pre-wrap">
                          {post.content}
                        </p>

                        <div className="mt-2.5 flex items-center justify-between pt-1 border-t border-dotted border-outline-variant">
                          <div className="flex items-center gap-2">
                            {user && (
                              <button
                                type="button"
                                onClick={() => setContent(`@${post.author_name} `)}
                                className="text-label-sm font-label-sm text-primary bg-surface-container px-2 py-0.5 rounded border border-outline-variant hover:bg-surface-container-high transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[12px]">reply</span>
                                [Responder]
                              </button>
                            )}
                          </div>
                          <span className="text-[10px] text-secondary">via Espectro Social</span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* ================= RIGHT COLUMN: COMUNIDADES DO BANCO ================= */}
          <aside className="md:col-span-12 lg:col-span-3 space-y-space-md">
            {/* Bloco de Comunidades Reais do D1 */}
            <div className="bg-surface-container-lowest rounded classic-bevel-border overflow-hidden">
              <div className="retro-header-strip px-space-sm py-1.5 flex items-center justify-between">
                <span className="text-label-sm font-label-sm text-primary uppercase font-bold tracking-wide">
                  comunidades ({communities.length})
                </span>
                <Link to="/comunidades" className="text-label-sm font-label-sm text-primary hover:underline font-bold">
                  ver catálogo
                </Link>
              </div>

              <div className="p-space-sm">
                {loadingCommunities ? (
                  <p className="text-body-sm text-secondary text-center py-2">Carregando...</p>
                ) : communities.length === 0 ? (
                  <div className="text-center py-2 text-body-sm text-secondary">
                    <p>Nenhuma comunidade criada.</p>
                    <Link to="/comunidades" className="text-primary font-bold underline mt-1 block">
                      Criar a primeira
                    </Link>
                  </div>
                ) : (
                  <ul className="space-y-1 text-body-sm">
                    {communities.slice(0, 6).map((c) => (
                      <li key={c.id}>
                        <Link
                          to="/comunidades"
                          className="flex items-center justify-between p-1 rounded hover:bg-surface-container transition-colors group"
                        >
                          <span className="flex items-center gap-1.5 truncate group-hover:text-primary">
                            <span className="material-symbols-outlined text-secondary text-[14px]">groups</span>
                            <span className="truncate">{c.name}</span>
                          </span>
                          <span className="text-[10px] text-secondary font-medium shrink-0">
                            {c.member_count} {c.member_count === 1 ? 'm' : 'm'}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Amigos Nostálgicos */}
            <div className="bg-surface-container-lowest rounded classic-bevel-border overflow-hidden">
              <div className="retro-header-strip px-space-sm py-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-label-sm font-label-sm text-primary uppercase font-bold tracking-wide">amigos</span>
                  <span className="text-label-sm font-label-sm text-secondary">(6)</span>
                </div>
              </div>
              <div className="p-space-sm">
                <div className="grid grid-cols-3 gap-2 text-center">
                  {['Bia', 'Felipe', 'Carol', 'Lucas', 'Mari', 'Diego'].map((name) => (
                    <div key={name} className="p-1 rounded hover:bg-surface-container transition-colors">
                      <div className="w-12 h-12 mx-auto bg-primary-container text-white border border-outline-variant shadow-sm flex items-center justify-center font-bold text-sm uppercase">
                        {name[0]}
                      </div>
                      <span className="text-body-sm font-body-sm text-primary truncate block mt-1">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};
