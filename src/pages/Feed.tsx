import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { api, authStorage, Post } from '../lib/api';

export const Feed: React.FC = () => {
  const user = authStorage.getUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const data = await api.getPosts();
      setPosts(data);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (!user) {
      setError('Faça login para enviar recados!');
      return;
    }

    try {
      setPosting(true);
      setError(null);
      await api.createPost({ content: content.trim() });
      setContent('');
      await fetchPosts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao publicar recado');
    } finally {
      setPosting(false);
    }
  };

  const addEmoticon = (emo: string) => {
    setContent((prev) => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + emo + ' ');
  };

  return (
    <div className="bg-surface-variant text-on-surface antialiased min-h-screen flex flex-col font-body-md text-body-md selection:bg-secondary-container selection:text-primary">
      <Header />

      {/* Main 3-Column Layout */}
      <main className="flex-1 w-full max-w-[1180px] mx-auto px-space-md sm:px-space-lg py-space-md">
        {/* Top Breadcrumb Bar */}
        <div className="mb-space-sm bg-surface-container border border-outline-variant rounded p-space-sm flex items-center justify-between text-body-sm font-body-sm shadow-sm">
          <div className="flex items-center gap-1.5 text-primary">
            <span className="material-symbols-outlined text-primary text-[16px]">home</span>
            <Link to="/" className="hover:underline">Início</Link>
            <span className="text-secondary">&gt;</span>
            <span className="font-bold text-on-surface">{user ? user.username : 'Visitante'}</span>
            <span className="text-secondary">&gt;</span>
            <span className="font-bold text-on-surface">Página de Recados e Amigos</span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-label-sm font-label-sm text-secondary">
            <span className="material-symbols-outlined text-[14px]">lock_open</span>
            Perfil público para amigos
          </div>
        </div>

        {/* 3-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-space-md items-start">
          {/* ================= LEFT COLUMN ================= */}
          <aside className="md:col-span-3 lg:col-span-3 space-y-space-md">
            {/* Profile Card */}
            <div className="bg-surface-container-lowest rounded classic-bevel-border overflow-hidden">
              <div className="retro-header-strip px-space-sm py-1.5 flex items-center justify-between">
                <span className="text-label-sm font-label-sm text-primary uppercase tracking-wide">meu perfil</span>
                <span className="material-symbols-outlined text-primary text-[14px]">account_box</span>
              </div>
              <div className="p-space-md text-center">
                {/* Vintage Frame Photo */}
                <div className="relative inline-block mx-auto mb-space-sm">
                  <div className="p-1 bg-surface-container-lowest border-2 border-outline-variant shadow-sm rounded-sm">
                    <div className="w-32 h-36 bg-surface-container-high flex items-center justify-center text-primary font-bold text-headline-xl uppercase">
                      {user ? user.username.charAt(0) : 'E'}
                    </div>
                  </div>
                  <span className="absolute bottom-2 right-2 bg-[#62B33C] text-on-primary text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                    ONLINE
                  </span>
                </div>

                <h1 className="text-headline-sm font-headline-sm text-primary leading-tight">
                  {user ? user.username : 'Visitante Nostálgico'}
                </h1>
                <p className="text-body-sm font-body-sm text-secondary italic mt-1 bg-surface-container-low p-1.5 rounded border border-outline-variant">
                  &ldquo;ouvindo CPM 22 no Winamp... 🎵&rdquo;
                </p>
                <p className="text-label-sm font-label-sm text-secondary mt-1">Brasil • Solteiro</p>

                {/* Medidores Clássicos do Orkut */}
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
                    <span>Fãs: <strong className="text-primary">18</strong></span>
                    <span>Visualizações: <strong className="text-primary">1.240</strong></span>
                  </div>
                </div>
              </div>

              {/* Menu Lateral Clássico */}
              <div className="border-t border-outline-variant bg-surface-container-low px-space-sm py-space-sm">
                <ul className="space-y-1 text-body-sm font-body-sm">
                  <li className="bg-surface-container-highest rounded border border-outline-variant">
                    <Link to="/" className="flex items-center justify-between py-1 px-1.5 text-primary font-bold">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-primary">chat</span>
                        <span className="underline">Recados</span>
                      </span>
                      <span className="bg-primary text-on-primary text-[10px] px-1.5 py-0.5 rounded font-bold">
                        {posts.length}
                      </span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/comunidades" className="flex items-center justify-between py-1 px-1.5 text-secondary hover:bg-surface-container rounded transition-colors group">
                      <span className="flex items-center gap-1.5 group-hover:text-primary">
                        <span className="material-symbols-outlined text-[15px] text-secondary">groups</span>
                        <span className="custom-dotted-link">Comunidades</span>
                      </span>
                    </Link>
                  </li>
                </ul>
              </div>
            </div>

            {/* Mini Bloco: Música no Perfil */}
            <div className="bg-surface-container-lowest rounded classic-bevel-border p-space-sm text-body-sm font-body-sm">
              <div className="flex items-center gap-1.5 text-primary font-bold text-label-sm font-label-sm uppercase mb-1">
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

          {/* ================= CENTER COLUMN (FEED) ================= */}
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

                {error && (
                  <div className="mb-2 p-1.5 rounded bg-error-container text-on-error-container text-body-sm">
                    {error}
                  </div>
                )}

                {/* Toolbar */}
                <div className="flex items-center flex-wrap gap-1 mb-1 p-1 bg-surface-container-highest border border-outline-variant rounded-t text-body-sm font-body-sm">
                  <button type="button" onClick={() => addEmoticon(':-)')} className="px-1.5 py-0.5 retro-btn-secondary text-[11px] rounded" title="Sorriso">
                    :-)
                  </button>
                  <button type="button" onClick={() => addEmoticon(';-)')} className="px-1.5 py-0.5 retro-btn-secondary text-[11px] rounded" title="Piscadela">
                    ;-)
                  </button>
                  <button type="button" onClick={() => addEmoticon('s2')} className="px-1.5 py-0.5 retro-btn-secondary text-[11px] text-error font-bold rounded" title="Coração">
                    s2
                  </button>
                  <button type="button" onClick={() => addEmoticon(':-P')} className="px-1.5 py-0.5 retro-btn-secondary text-[11px] rounded" title="Língua">
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
                    placeholder={user ? "Escreva seu recado ou novidade aqui..." : "Faça login para deixar um recado..."}
                    disabled={!user || posting}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-b p-space-sm text-body-sm font-body-sm focus:border-primary-container focus:ring-1 focus:ring-secondary-container outline-none transition-all resize-y shadow-inner text-on-surface"
                  />

                  <div className="mt-space-sm flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-body-sm font-body-sm text-secondary cursor-pointer select-none">
                      <input type="checkbox" defaultChecked className="rounded border-outline-variant text-primary focus:ring-0" />
                      Visível para todos os amigos
                    </label>

                    <button
                      type="submit"
                      disabled={!user || posting || !content.trim()}
                      className="px-4 py-1.5 retro-btn-primary text-on-primary rounded text-label-md font-label-md font-bold tracking-wide flex items-center gap-1 shadow active:translate-y-px disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[14px]">send</span>
                      {posting ? 'Enviando...' : 'Enviar Recado'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Feed List Header */}
              <div className="bg-surface-container-high px-space-md py-1.5 border-b border-outline-variant flex items-center justify-between text-body-sm font-body-sm">
                <span className="text-primary font-bold text-label-sm font-label-sm uppercase">
                  Recados Recentes ({posts.length} no total)
                </span>
                <button onClick={fetchPosts} className="text-[11px] text-primary underline hover:text-primary-container">
                  atualizar
                </button>
              </div>

              {/* FEED POSTS */}
              <div className="divide-y divide-outline-variant">
                {loading && (
                  <div className="p-space-lg text-center text-secondary">
                    Carregando recados...
                  </div>
                )}

                {!loading && posts.length === 0 && (
                  <div className="p-space-lg text-center text-secondary">
                    Nenhum recado encontrado. Seja o primeiro a deixar um scrap!
                  </div>
                )}

                {posts.map((post, idx) => (
                  <article
                    key={post.id}
                    className={`p-space-md ${idx % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low'} hover:bg-surface-bright transition-colors`}
                  >
                    <div className="flex items-start gap-space-md">
                      {/* Avatar */}
                      <div className="flex-shrink-0 text-center">
                        <div className="w-12 h-12 bg-surface-container-high border border-outline-variant rounded shadow-sm flex items-center justify-center font-bold text-primary text-headline-sm uppercase">
                          {post.author_name ? post.author_name.charAt(0) : 'U'}
                        </div>
                        <span className="text-[9px] text-secondary font-bold block mt-1">amigo</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-1 border-b border-dashed border-outline-variant pb-1 mb-1.5">
                          <span className="font-bold text-primary text-body-md font-body-md">
                            {post.author_name || `Usuário #${post.author_id}`}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] text-secondary">
                            <span className="material-symbols-outlined text-[13px]">schedule</span>
                            {new Date(post.created_at).toLocaleString('pt-BR')}
                          </div>
                        </div>

                        {post.community_name && (
                          <div className="mb-1 text-[11px] text-secondary">
                            na comunidade: <span className="bg-surface-container-highest px-1 py-0.5 rounded text-primary font-semibold">{post.community_name}</span>
                          </div>
                        )}

                        <p className="text-body-md font-body-md text-on-surface leading-relaxed whitespace-pre-wrap">
                          {post.content}
                        </p>

                        <div className="mt-2.5 flex items-center justify-between pt-1 border-t border-dotted border-outline-variant">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setContent(`@${post.author_name} `)}
                              className="text-label-sm font-label-sm text-primary bg-surface-container px-2 py-0.5 rounded border border-outline-variant hover:bg-surface-container-high transition-colors flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[12px]">reply</span>
                              [Responder]
                            </button>
                          </div>
                          <span className="text-[10px] text-secondary">via Espectro Web</span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* ================= RIGHT COLUMN ================= */}
          <aside className="md:col-span-12 lg:col-span-3 space-y-space-md">
            {/* Friends 3x3 */}
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
                      <div className="w-12 h-12 mx-auto bg-surface-container-high border border-outline-variant shadow-sm flex items-center justify-center font-bold text-primary text-sm uppercase">
                        {name[0]}
                      </div>
                      <span className="text-body-sm font-body-sm text-primary truncate block mt-1">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Communities Widget */}
            <div className="bg-surface-container-lowest rounded classic-bevel-border overflow-hidden">
              <div className="retro-header-strip px-space-sm py-1.5 flex items-center justify-between">
                <span className="text-label-sm font-label-sm text-primary uppercase font-bold tracking-wide">comunidades</span>
                <Link to="/comunidades" className="text-label-sm font-label-sm text-primary hover:underline">ver todas</Link>
              </div>
              <div className="p-space-sm space-y-2 text-body-sm">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm">alarm</span>
                  <span className="truncate">Eu odeio acordar cedo</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm">call</span>
                  <span className="truncate">Discada só depois da 00h</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm">directions_run</span>
                  <span className="truncate">Tocava campainha e corria</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};
