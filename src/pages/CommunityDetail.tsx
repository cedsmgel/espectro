import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { ContactsWidget } from '../components/ContactsWidget';
import { PostCard } from '../components/PostCard';
import { CreatePostForm } from '../components/CreatePostForm';
import { api, authStorage, Community, Post } from '../lib/api';

export const CommunityDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const user = authStorage.getUser();

  const [community, setCommunity] = useState<Community | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  const fetchCommunityAndPosts = async () => {
    if (!slug) return;
    try {
      setLoading(true);
      const com = await api.getCommunityBySlug(slug);
      setCommunity(com);

      setLoadingPosts(true);
      const postList = await api.getPosts({ community_slug: slug });
      setPosts(postList);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingPosts(false);
    }
  };

  const fetchAllCommunities = async () => {
    try {
      const data = await api.getCommunities();
      setCommunities(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCommunityAndPosts();
    fetchAllCommunities();
  }, [slug]);

  const handleJoin = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!slug) return;

    try {
      setJoining(true);
      const res = await api.joinCommunity({ community_slug: slug });
      setJoinSuccess(res.message || 'Você agora é membro desta comunidade!');
      fetchCommunityAndPosts();
      setTimeout(() => setJoinSuccess(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao entrar na comunidade');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="bg-surface-variant text-on-surface antialiased min-h-screen flex flex-col font-body-md text-body-md selection:bg-secondary-container selection:text-primary">
      <Header />

      {/* 3-Column Layout: Esquerda (Navegação) | Centro (Feed da Comunidade) | Direita (Contatos) */}
      <main className="flex-1 w-full max-w-[1180px] mx-auto px-space-md sm:px-space-lg py-space-md">
        {/* Breadcrumb Bar */}
        <div className="mb-space-sm bg-surface-container border border-outline-variant rounded p-space-sm flex items-center justify-between text-body-sm shadow-sm">
          <div className="flex items-center gap-1.5 text-primary">
            <span className="material-symbols-outlined text-[16px]">home</span>
            <Link to="/" className="hover:underline">Início</Link>
            <span className="text-secondary">&gt;</span>
            <Link to="/comunidades" className="hover:underline">e/Comunidades</Link>
            <span className="text-secondary">&gt;</span>
            <span className="font-bold text-on-surface">e/{community ? community.name : slug}</span>
          </div>

          <Link to="/comunidades" className="text-label-sm text-primary hover:underline font-bold">
            ← Ver todas as comunidades
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-space-md items-start">
          {/* ================= COLUNA ESQUERDA: NAVEGAÇÃO ================= */}
          <aside className="md:col-span-3 lg:col-span-3">
            <SidebarNav communities={communities} />
          </aside>

          {/* ================= COLUNA CENTRAL: FEED DA COMUNIDADE ================= */}
          <section className="md:col-span-9 lg:col-span-6 space-y-space-md">
            {/* Banner da Comunidade */}
            {loading ? (
              <div className="p-space-lg bg-surface-container-lowest rounded classic-bevel-border text-center text-secondary">
                Carregando informações da comunidade...
              </div>
            ) : community ? (
              <div className="bg-white rounded classic-bevel-border overflow-hidden">
                <div className="header-bar-gradient px-space-md py-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded bg-primary-container text-white flex items-center justify-center font-bold text-xl uppercase shadow-sm">
                      {community.name.charAt(0)}
                    </div>
                    <div>
                      <h1 className="text-headline-sm font-bold text-primary">
                        e/{community.name}
                      </h1>
                      <span className="text-[11px] text-secondary font-mono">
                        /e/{community.slug || community.id}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className="bg-secondary-container text-on-secondary-fixed text-label-sm font-bold px-2 py-0.5 rounded">
                      {community.members_count} membros
                    </span>
                    <button
                      type="button"
                      onClick={handleJoin}
                      disabled={joining}
                      className="retro-btn-primary text-white text-label-sm px-3 py-1 rounded font-bold shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {joining ? 'Entrando...' : '+ Entrar na Comunidade'}
                    </button>
                  </div>
                </div>

                <div className="p-space-md bg-surface-container-lowest border-t border-outline-variant">
                  <p className="text-body-md text-on-surface leading-relaxed">
                    {community.description || 'Comunidade acolhedora no Espectro. Participe dos tópicos e discussões!'}
                  </p>
                  <div className="mt-2 text-[11px] text-secondary flex flex-wrap gap-x-4 gap-y-1">
                    <span><strong>Fundador:</strong> @{community.owner_name || 'membro'}</span>
                    <span><strong>Criada em:</strong> {new Date(community.created_at).toLocaleDateString('pt-BR')}</span>
                    <span><strong>Fórum:</strong> Aberto para membros</span>
                  </div>

                  {joinSuccess && (
                    <div className="mt-2 p-2 rounded bg-[#e7f7ed] text-[#1e6f3b] text-body-sm border border-[#a3dfb4] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      {joinSuccess}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-space-lg bg-surface-container-lowest rounded classic-bevel-border text-center text-error">
                Comunidade não encontrada.
              </div>
            )}

            {/* Formulário de Criação com a Comunidade pré-selecionada */}
            {community && (
              <CreatePostForm
                communities={communities}
                defaultCommunityId={community.id}
                defaultCommunitySlug={community.slug}
                onPostCreated={fetchCommunityAndPosts}
              />
            )}

            {/* Feed de Discussões da Comunidade */}
            <div className="space-y-space-md">
              <div className="bg-surface-container-high px-space-md py-1.5 border border-outline-variant rounded flex items-center justify-between text-body-sm font-body-sm">
                <span className="text-primary font-bold text-label-sm uppercase">
                  Tópicos e Discussões em e/{community?.name || slug} ({posts.length})
                </span>
                <button
                  type="button"
                  onClick={fetchCommunityAndPosts}
                  disabled={loadingPosts}
                  className="text-[11px] text-primary underline hover:text-primary-container flex items-center gap-1 cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-[12px] ${loadingPosts ? 'animate-spin' : ''}`}>
                    refresh
                  </span>
                  atualizar
                </button>
              </div>

              {loadingPosts && (
                <div className="p-space-lg text-center text-secondary flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                  Carregando tópicos da comunidade...
                </div>
              )}

              {!loadingPosts && posts.length === 0 && (
                <div className="p-space-lg bg-surface-container-lowest rounded classic-bevel-border text-center text-secondary">
                  <p className="font-semibold text-primary mb-1">Nenhum tópico nesta comunidade ainda.</p>
                  <p className="text-body-sm">Seja o primeiro a iniciar uma discussão aqui!</p>
                </div>
              )}

              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          </section>

          {/* ================= COLUNA DIREITA: CONTATOS WIDGET ================= */}
          <aside className="md:col-span-12 lg:col-span-3">
            <ContactsWidget />
          </aside>
        </div>
      </main>
    </div>
  );
};
