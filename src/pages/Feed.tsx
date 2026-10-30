import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Post, Community, getPosts, createPost, getCommunities, getCurrentUser, joinCommunity } from "../lib/api";
import { PostCard } from "../components/PostCard";

interface FeedProps {
  isCreateModalOpen?: boolean;
  onCloseCreateModal?: () => void;
}

export const Feed: React.FC<FeedProps> = ({ isCreateModalOpen = false, onCloseCreateModal }) => {
  const currentUser = getCurrentUser();

  const [posts, setPosts] = useState<Post[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("Para Você");

  // Novo post
  const [content, setContent] = useState("");
  const [selectedCommunity, setSelectedCommunity] = useState<string>("");
  const [posting, setPosting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedPosts, fetchedComms] = await Promise.all([
        getPosts().catch(() => []),
        getCommunities().catch(() => []),
      ]);
      setPosts(fetchedPosts);
      setCommunities(fetchedComms);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (!currentUser) {
      setErrorMsg("Você precisa fazer login para criar publicações.");
      return;
    }

    setPosting(true);
    setErrorMsg(null);

    try {
      const commId = selectedCommunity ? Number(selectedCommunity) : null;
      await createPost(content, commId);
      setContent("");
      setSelectedCommunity("");
      if (onCloseCreateModal) onCloseCreateModal();
      const updated = await getPosts();
      setPosts(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar publicação.";
      setErrorMsg(msg);
    } finally {
      setPosting(false);
    }
  };

  const heroPost = posts[0];
  const regularPosts = posts.slice(1);

  return (
    <div className="w-full pt-20 pb-16 bg-background">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
        {/* Top Bar Filters & Live Status Summary (Exato do Stitch) */}
        <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg">
          <div className="flex items-center gap-space-xs overflow-x-auto pb-1 scrollbar-none">
            {["Para Você", "Design", "Tecnologia", "Mercado", "Comunidade"].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-space-md py-space-xs rounded-full text-xs font-semibold shadow-sm transition-all ${
                  activeFilter === filter
                    ? "bg-primary-container text-on-primary hover:opacity-90"
                    : "bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-space-md shrink-0">
            <div className="flex items-center gap-space-xs px-3 py-1 rounded-full bg-secondary-container/50 text-secondary text-xs">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span className="font-medium">Rede Sincronizada</span>
            </div>
            <span className="text-xs text-outline hidden lg:inline">
              Edição Ativa • Espectro D1
            </span>
          </div>
        </div>

        {/* Modal de Criação de Post */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40 backdrop-blur-sm">
            <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-6 shadow-2xl border border-outline-variant/30">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-outline-variant/20">
                <h3 className="font-bold text-base text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">edit_square</span>
                  Nova Publicação no Feed
                </h3>
                {onCloseCreateModal && (
                  <button
                    onClick={onCloseCreateModal}
                    className="text-outline hover:text-on-surface text-lg font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {errorMsg && (
                <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleCreatePost} className="space-y-4">
                <textarea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Compartilhe uma tese, reflexão ou novidade com a sua rede..."
                  className="w-full text-sm p-3 bg-surface-container-low rounded-lg border border-outline-variant/30 focus:outline-none focus:ring-1 focus:ring-primary-container"
                />

                <div className="flex items-center gap-2">
                  <label className="text-xs text-outline font-semibold">Comunidade:</label>
                  <select
                    value={selectedCommunity}
                    onChange={(e) => setSelectedCommunity(e.target.value)}
                    className="text-xs bg-surface-container-low border border-outline-variant/30 rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="">(Feed Geral)</option>
                    {communities.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                  {onCloseCreateModal && (
                    <button
                      type="button"
                      onClick={onCloseCreateModal}
                      className="px-3 py-1.5 text-xs text-on-surface-variant font-semibold hover:bg-surface-container-low rounded-lg"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={posting || !content.trim()}
                    className="bg-primary-container hover:bg-primary text-on-primary text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm disabled:opacity-50"
                  >
                    {posting ? "Publicando..." : "Publicar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Primary 3-Column Bento Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
          {/* ==================== LEFT COLUMN: Network & Circle ==================== */}
          <div className="lg:col-span-3 flex flex-col gap-gutter">
            {/* Bento 1: User Profile Compact Snapshot */}
            <div className="rounded-xl p-space-lg bg-surface-container-lowest/80 backdrop-blur-xl border border-outline-variant/30 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between mb-space-md">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-primary-container text-white flex items-center justify-center font-bold text-lg shadow-sm">
                    {currentUser ? currentUser.username.charAt(0).toUpperCase() : "👤"}
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-secondary rounded-full ring-2 ring-surface-container-lowest"></span>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-secondary text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  {currentUser ? "Online" : "Visitante"}
                </div>
              </div>
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-on-surface">
                  {currentUser ? currentUser.username : "Conectar-se"}
                </h2>
                <p className="text-xs text-on-surface-variant mb-space-md">
                  {currentUser ? "Membro Ativo · Rede Espectro" : "Faça login para publicar e interagir"}
                </p>
              </div>

              {currentUser ? (
                <div className="pt-space-sm flex items-center justify-between bg-surface-container-low rounded-lg p-space-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline uppercase tracking-wider font-semibold">
                      Publicações
                    </span>
                    <span className="text-base font-bold text-primary">
                      {posts.filter((p) => p.author_name === currentUser.username).length} posts
                    </span>
                  </div>
                  <div className="h-8 w-px bg-surface-dim"></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline uppercase tracking-wider font-semibold">
                      Comunidades
                    </span>
                    <span className="text-base font-bold text-primary">
                      {communities.length} ativas
                    </span>
                  </div>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="w-full block text-center py-2 bg-primary-container text-on-primary text-xs font-semibold rounded-lg hover:bg-primary transition-colors"
                >
                  Entrar no Espectro →
                </Link>
              )}
            </div>

            {/* Bento 2: Active Friends & Connections */}
            <div className="rounded-xl p-space-lg bg-surface-container-lowest/80 backdrop-blur-xl border border-outline-variant/30 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[20px] text-primary">group</span>
                  <h3 className="font-bold text-sm text-on-surface">Círculo Ativo</h3>
                </div>
                <span className="text-xs text-outline">6 online</span>
              </div>

              <div className="flex flex-col gap-2">
                {[
                  { name: "Marina Dias", status: "Lendo: IA Cognitiva", role: "Design Systems" },
                  { name: "Felipe Braga", status: "Publicou há 12m", role: "Arquitetura Edge" },
                  { name: "Camila Vilela", status: "Ausente há 30m", role: "UX Researcher" },
                ].map((friend) => (
                  <div
                    key={friend.name}
                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-container-low transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-lg bg-surface-container-high text-primary flex items-center justify-center font-bold text-xs">
                          {friend.name.charAt(0)}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-secondary rounded-full ring-2 ring-surface-container-lowest"></span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-on-surface truncate group-hover:text-primary">
                          {friend.name}
                        </span>
                        <span className="text-[10px] text-outline truncate flex items-center gap-1">
                          <span className="material-symbols-outlined text-[10px] text-primary">
                            menu_book
                          </span>
                          {friend.status}
                        </span>
                      </div>
                    </div>
                    <Link
                      to="/chat"
                      aria-label={`Mensagem para ${friend.name}`}
                      className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-outline hover:text-primary hover:bg-surface-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">chat_bubble</span>
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Bento 3: Reading Rooms / Group Circles (Comunidades Reais) */}
            <div className="rounded-xl p-space-lg bg-surface-container-lowest/80 backdrop-blur-xl border border-outline-variant/30 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[20px] text-primary">forum</span>
                  <h3 className="font-bold text-sm text-on-surface">Salas & Comunidades</h3>
                </div>
                <Link
                  to="/communities"
                  className="px-2 py-0.5 rounded bg-primary-fixed text-primary text-[10px] font-semibold hover:underline"
                >
                  Ver todas
                </Link>
              </div>

              <div className="flex flex-col gap-2">
                {communities.slice(0, 3).map((comm) => (
                  <div
                    key={comm.id}
                    className="p-2.5 rounded-lg bg-surface-container-low/70 flex flex-col gap-1 hover:bg-surface-container-high transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary">#{comm.name}</span>
                      <span className="text-[10px] font-semibold text-secondary">
                        {comm.members_count || 1} membros
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant line-clamp-1">
                      {comm.description || "Tópicos e discussões ativas da comunidade"}
                    </p>
                  </div>
                ))}
                {communities.length === 0 && (
                  <p className="text-xs text-outline py-2 text-center">Nenhuma sala ainda.</p>
                )}
              </div>
            </div>
          </div>

          {/* ==================== CENTER COLUMN: Bento Feed Stream ==================== */}
          <div className="lg:col-span-6 flex flex-col gap-gutter">
            {/* Bloco de Post Rápido */}
            {currentUser && (
              <div className="rounded-xl p-4 bg-surface-container-lowest/90 backdrop-blur-xl border border-outline-variant/30 shadow-sm flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-xs">
                    {currentUser.username.charAt(0).toUpperCase()}
                  </div>
                  <input
                    type="text"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Compartilhar uma reflexão ou artigo no feed..."
                    className="w-full text-xs p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/20 focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary-container"
                  />
                  <button
                    onClick={handleCreatePost}
                    disabled={posting || !content.trim()}
                    className="bg-primary-container hover:bg-primary text-on-primary text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm shrink-0 disabled:opacity-50"
                  >
                    {posting ? "..." : "Publicar"}
                  </button>
                </div>
              </div>
            )}

            {/* Hero Bento Tile: Lead Story Showcase */}
            {heroPost ? (
              <PostCard post={heroPost} isHero={true} />
            ) : (
              <article className="relative overflow-hidden rounded-xl bg-surface-container-lowest/90 backdrop-blur-xl border border-outline-variant/30 p-8 text-center shadow-md">
                <span className="material-symbols-outlined text-[40px] text-primary mb-2">auto_awesome</span>
                <h2 className="text-lg font-bold text-primary">Bem-vindo ao Feed do Espectro</h2>
                <p className="text-xs text-on-surface-variant max-w-md mx-auto mt-1">
                  Ainda não há publicações cadastradas. Seja o primeiro a inaugurar a rede postando pelo formulário acima!
                </p>
              </article>
            )}

            {/* Bento Grid Multi-Module: 2 Columns of Curated Formats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              {/* Bento Card: Quick Byte (Em 3 Minutos) */}
              <article className="rounded-xl p-5 bg-surface-container-lowest/80 backdrop-blur-xl border border-outline-variant/30 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-tertiary text-[11px] font-semibold">
                      Em 3 minutos
                    </span>
                    <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors text-[20px]">
                      bolt
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">
                    Microtipografia em Displays OLED: 3 Ajustes Essenciais
                  </h3>
                  <p className="text-xs text-on-surface-variant line-clamp-3">
                    Guia condensado sobre contraste dinâmico de subpixel, kerning adaptativo por densidade de tela e redução de fadiga óptica.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-3 mt-2 text-outline text-[11px]">
                  <span>Canal #TypographyLab</span>
                  <span className="text-primary font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    Ler síntese →
                  </span>
                </div>
              </article>

              {/* Bento Card: Community Spotlight */}
              <article className="rounded-xl p-5 bg-surface-container-lowest/80 backdrop-blur-xl border border-outline-variant/30 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-secondary text-[11px] font-semibold">
                      Tendências
                    </span>
                    <span className="material-symbols-outlined text-outline group-hover:text-secondary transition-colors text-[20px]">
                      trending_up
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">
                    O Retorno das Estruturas Modulares: A Estética Bento
                  </h3>
                  <p className="text-xs text-on-surface-variant line-clamp-3">
                    Por que painéis isolados de informação tornaram-se o antídoto padrão contra a sobrecarga sensorial em redes de conhecimento.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-3 mt-2 text-outline text-[11px]">
                  <span>Por Rodrigo Mendes</span>
                  <span className="text-primary font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    4 min · Ver →
                  </span>
                </div>
              </article>
            </div>

            {/* Demais posts dinâmicos do banco D1 */}
            {regularPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}

            {/* Bento Tile: Editorial Daily Insights Visualizer (Gráficos do Stitch) */}
            <section className="rounded-xl p-5 bg-gradient-to-br from-surface-container-lowest via-surface-container-lowest/90 to-surface-container-low backdrop-blur-xl border border-outline-variant/30 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[22px] text-primary">insights</span>
                  <div>
                    <h3 className="font-bold text-sm text-on-surface">Curadoria & Pulso Editorial</h3>
                    <p className="text-[11px] text-outline">
                      Análise agregada de leituras e trocas no Espectro hoje
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface text-xs font-medium">
                  Tempo Real
                </span>
              </div>

              {/* Data Visualizer Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg bg-surface-container-low/60 flex flex-col justify-between">
                  <span className="text-[10px] text-outline uppercase tracking-wider font-semibold">
                    Tópico Dominante
                  </span>
                  <div className="my-2">
                    <div className="text-lg font-bold text-primary tracking-tight">Sistemas Edge</div>
                    <div className="flex items-center gap-1 text-[11px] text-secondary font-semibold">
                      <span className="material-symbols-outlined text-[13px]">arrow_upward</span>
                      <span>+42% engajamento</span>
                    </div>
                  </div>
                  <svg className="w-full h-7 text-secondary" fill="none" viewBox="0 0 100 25">
                    <path
                      d="M0 20 L20 18 L40 12 L60 15 L80 6 L100 2"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    ></path>
                  </svg>
                </div>

                <div className="p-3.5 rounded-lg bg-surface-container-low/60 flex flex-col justify-between">
                  <span className="text-[10px] text-outline uppercase tracking-wider font-semibold">
                    Densidade Média
                  </span>
                  <div className="my-2">
                    <div className="text-lg font-bold text-primary tracking-tight">6.4 min</div>
                    <div className="flex items-center gap-1 text-[11px] text-on-surface-variant font-medium">
                      <span className="material-symbols-outlined text-[13px]">timer</span>
                      <span>Foco sustentado</span>
                    </div>
                  </div>
                  <div className="w-full bg-surface-dim h-2 rounded-full overflow-hidden">
                    <div className="bg-primary h-full rounded-full" style={{ width: "78%" }}></div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-surface-container-low/60 flex flex-col justify-between">
                  <span className="text-[10px] text-outline uppercase tracking-wider font-semibold">
                    Discussões Abertas
                  </span>
                  <div className="my-2">
                    <div className="text-lg font-bold text-primary tracking-tight">{posts.length} fios</div>
                    <div className="flex items-center gap-1 text-[11px] text-secondary font-semibold">
                      <span className="material-symbols-outlined text-[13px]">forum</span>
                      <span>Ativos no D1</span>
                    </div>
                  </div>
                  <svg className="w-full h-7 text-primary" fill="none" viewBox="0 0 100 25">
                    <path
                      d="M0 15 L25 12 L50 18 L75 8 L100 4"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    ></path>
                  </svg>
                </div>
              </div>
            </section>
          </div>

          {/* ==================== RIGHT COLUMN: Recommendations & Discovery ==================== */}
          <div className="lg:col-span-3 flex flex-col gap-gutter">
            {/* Bento 1: Trending Topics (Em Alta) */}
            <div className="rounded-xl p-space-lg bg-surface-container-lowest/80 backdrop-blur-xl border border-outline-variant/30 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[20px] text-primary">
                    local_fire_department
                  </span>
                  <h3 className="font-bold text-sm text-on-surface">Em Alta</h3>
                </div>
                <span className="text-xs text-outline">Tempo real</span>
              </div>

              <div className="flex flex-col gap-2">
                {[
                  { id: "01", title: "Spatial Audio UX", meta: "18.4k leituras · Design" },
                  { id: "02", title: "LLMs On-Device", meta: "14.2k leituras · IA" },
                  { id: "03", title: "Bento Design Rules", meta: "9.8k leituras · UI/UX" },
                  { id: "04", title: "CSS Subgrid em Escala", meta: "7.1k leituras · Dev" },
                ].map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-lg hover:bg-surface-container-low transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-sm text-outline group-hover:text-primary transition-colors">
                        {item.id}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-on-surface group-hover:text-primary">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-outline">{item.meta}</span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-secondary">
                      trending_up
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bento 2: Recommended Authors & Publications */}
            <div className="rounded-xl p-space-lg bg-surface-container-lowest/80 backdrop-blur-xl border border-outline-variant/30 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[20px] text-primary">auto_awesome</span>
                  <h3 className="font-bold text-sm text-on-surface">Para Você Seguir</h3>
                </div>
                <span className="text-xs text-outline">Sugestões</span>
              </div>

              <div className="flex flex-col gap-2.5">
                {[
                  { name: "Carla Montenegro", role: "Design Ops · Nubank" },
                  { name: "Eduardo Queiroz", role: "Distributed Systems · USP" },
                ].map((author) => (
                  <div
                    key={author.name}
                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-container-low transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary-container/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {author.name.charAt(0)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-on-surface truncate">
                          {author.name}
                        </span>
                        <span className="text-[10px] text-outline truncate">{author.role}</span>
                      </div>
                    </div>
                    <button className="shrink-0 px-2.5 py-1 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-on-surface text-xs font-semibold transition-all">
                      Seguir
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Bento 3: Curated Newsletter Box */}
            <div className="rounded-xl p-space-lg bg-primary-container text-on-primary shadow-sm hover:shadow-md transition-all duration-300 flex flex-col gap-space-md relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-secondary-container/20 blur-2xl pointer-events-none"></div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[20px] text-primary-fixed">
                  mark_email_read
                </span>
                <span className="text-[10px] font-semibold text-primary-fixed uppercase tracking-wider">
                  Edição Semanal
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-bold text-sm text-on-primary">O Boletim Espectro</h3>
                <p className="text-xs text-on-primary-container leading-relaxed">
                  Toda sexta-feira: 5 teses essenciais de tecnologia, 3 estudos de interface e discussões de destaque da rede.
                </p>
              </div>
              <form
                className="flex flex-col gap-1.5 mt-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  alert("Inscrição confirmada no Boletim Espectro!");
                }}
              >
                <input
                  type="email"
                  required
                  placeholder="seu.email@empresa.com"
                  className="w-full h-9 px-3 rounded-lg bg-surface-container-lowest text-on-surface text-xs placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary-fixed"
                />
                <button
                  type="submit"
                  className="w-full h-9 rounded-lg bg-primary-fixed text-on-primary-fixed text-xs font-bold hover:bg-surface-container-lowest transition-all shadow-sm"
                >
                  Assinar Gratuitamente
                </button>
              </form>
            </div>

            {/* Bento 4: Reading Metrics Habit Widget (Rhythm bars) */}
            <div className="rounded-xl p-space-lg bg-surface-container-lowest/80 backdrop-blur-xl border border-outline-variant/30 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-secondary">
                    donut_large
                  </span>
                  <span className="text-[10px] font-semibold text-outline uppercase tracking-wider">
                    Hábito da Rede
                  </span>
                </div>
                <span className="text-xs font-semibold text-secondary">Meta 85%</span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-lg font-bold text-primary">{posts.length + 12} artigos</span>
                <span className="text-xs text-outline">4h acumuladas</span>
              </div>

              {/* Weekly visual rhythm bars */}
              <div className="grid grid-cols-7 gap-1 pt-2 items-end h-14">
                {[
                  { day: "S", h: "40%", bg: "bg-primary-container/20" },
                  { day: "T", h: "60%", bg: "bg-primary-container/20" },
                  { day: "Q", h: "90%", bg: "bg-primary-container" },
                  { day: "Q", h: "100%", bg: "bg-primary-container" },
                  { day: "S", h: "75%", bg: "bg-secondary" },
                  { day: "S", h: "20%", bg: "bg-surface-dim" },
                  { day: "D", h: "10%", bg: "bg-surface-dim" },
                ].map((bar, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 h-full justify-end">
                    <div className={`w-full rounded-sm ${bar.bg}`} style={{ height: bar.h }}></div>
                    <span className="text-[10px] text-outline font-medium">{bar.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
