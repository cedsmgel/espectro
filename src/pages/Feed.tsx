import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Post, Community, getPosts, createPost, getCommunities, getCurrentUser } from "../lib/api";
import { PostCard } from "../components/PostCard";

export const Feed: React.FC = () => {
  const currentUser = getCurrentUser();

  const [posts, setPosts] = useState<Post[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulário de novo post
  const [content, setContent] = useState("");
  const [selectedCommunity, setSelectedCommunity] = useState<string>("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [fetchedPosts, fetchedComms] = await Promise.all([
        getPosts(),
        getCommunities().catch(() => []),
      ]);
      setPosts(fetchedPosts);
      setCommunities(fetchedComms);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar dados do feed.";
      setError(msg);
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

    setPosting(true);
    setPostError(null);

    try {
      const commId = selectedCommunity ? Number(selectedCommunity) : null;
      await createPost(content, commId);
      setContent("");
      setSelectedCommunity("");
      // Recarrega lista de posts
      const updated = await getPosts();
      setPosts(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar publicação.";
      setPostError(msg);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Barra Lateral Esquerda: Perfil / Atalhos estilo Orkut */}
        <aside className="md:col-span-1 space-y-4">
          <div className="bg-white border border-[#bfd4f2] rounded-lg p-4 text-center shadow-sm">
            <div className="w-20 h-20 rounded bg-[#e8eef7] border-2 border-[#3b5998] mx-auto flex items-center justify-center text-3xl font-bold text-[#3b5998] shadow-inner mb-3">
              {currentUser ? currentUser.username.charAt(0).toUpperCase() : "👤"}
            </div>
            <h2 className="font-bold text-[#2d4373] text-base truncate">
              {currentUser ? currentUser.username : "Visitante"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {currentUser ? "Membro do Espectro" : "Faça login para postar"}
            </p>

            <div className="mt-4 pt-3 border-t border-gray-100 text-left text-xs space-y-1.5 font-medium text-[#3b5998]">
              <Link to="/" className="block hover:underline">
                📄 Meu Feed
              </Link>
              <Link to="/communities" className="block hover:underline">
                👥 Minhas Comunidades
              </Link>
            </div>
          </div>

          {/* Card Nostálgico de Estatísticas */}
          <div className="bg-white border border-[#bfd4f2] rounded-lg p-3 text-xs shadow-sm">
            <h3 className="font-bold text-[#2d4373] border-b border-gray-100 pb-1 mb-2">
              Status Nostálgico
            </h3>
            <ul className="space-y-1 text-gray-600">
              <li>⭐ Confiável: <strong>100%</strong></li>
              <li>🧊 Legal: <strong>100%</strong></li>
              <li>🔥 Sexy: <strong>100%</strong></li>
            </ul>
          </div>
        </aside>

        {/* Coluna Central: Feed Social */}
        <main className="md:col-span-3 space-y-4">
          {/* Caixa de Criação de Post (Apenas se autenticado) */}
          {currentUser ? (
            <div className="bg-white border-2 border-[#bfd4f2] rounded-lg p-4 shadow-sm">
              <h3 className="text-xs font-bold text-[#2d4373] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>✏️</span> O que você está pensando hoje?
              </h3>

              {postError && (
                <div className="mb-3 p-2 bg-red-50 text-red-600 border border-red-200 text-xs rounded">
                  {postError}
                </div>
              )}

              <form onSubmit={handleCreatePost} className="space-y-3">
                <textarea
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escreva um recado ou pensamento para o feed..."
                  className="w-full text-sm p-3 border border-gray-300 rounded focus:outline-none focus:border-[#3b5998] focus:ring-1 focus:ring-[#3b5998]"
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <label className="text-xs text-gray-600 font-semibold">
                      Comunidade:
                    </label>
                    <select
                      value={selectedCommunity}
                      onChange={(e) => setSelectedCommunity(e.target.value)}
                      className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:border-[#3b5998]"
                    >
                      <option value="">(Geral / Sem comunidade)</option>
                      {communities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={posting || !content.trim()}
                    className="bg-[#3b5998] hover:bg-[#2d4373] text-white text-xs font-bold px-4 py-2 rounded transition shadow-sm disabled:opacity-50"
                  >
                    {posting ? "Publicando..." : "Publicar Recado"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-[#e8eef7] border border-[#bfd4f2] rounded-lg p-4 text-center">
              <p className="text-sm text-[#2d4373] font-medium">
                Deseja interagir e compartilhar recados no feed?
              </p>
              <Link
                to="/login"
                className="inline-block mt-2 bg-[#3b5998] hover:bg-[#2d4373] text-white text-xs font-bold px-4 py-1.5 rounded transition"
              >
                Fazer Login ou Criar Conta
              </Link>
            </div>
          )}

          {/* Lista de Postagens */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#bfd4f2] pb-1">
              <h2 className="text-sm font-bold text-[#2d4373] uppercase tracking-wide">
                Últimos Recados e Atualizações
              </h2>
              <button
                onClick={loadData}
                className="text-xs text-[#3b5998] hover:underline font-semibold"
              >
                🔄 Atualizar
              </button>
            </div>

            {loading ? (
              <div className="bg-white p-8 rounded-lg border border-[#bfd4f2] text-center text-sm text-gray-500">
                Carregando publicações do Espectro...
              </div>
            ) : error ? (
              <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-xs text-red-600 text-center">
                {error}
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-white p-8 rounded-lg border border-[#bfd4f2] text-center text-sm text-gray-500">
                Nenhum recado ainda. Seja o primeiro a postar!
              </div>
            ) : (
              posts.map((post) => <PostCard key={post.id} post={post} />)
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
