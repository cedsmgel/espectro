import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { ContactsWidget } from '../components/ContactsWidget';
import { PostCard } from '../components/PostCard';
import { CreatePostForm } from '../components/CreatePostForm';
import { api, Community, Post } from '../lib/api';

export const Feed: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const typeFilter = searchParams.get('type'); // 'scrap' ou undefined

  const [posts, setPosts] = useState<Post[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingCommunities, setLoadingCommunities] = useState(true);

  const fetchPosts = async () => {
    try {
      setLoadingPosts(true);
      const filters = typeFilter ? { post_type: typeFilter } : undefined;
      const data = await api.getPosts(filters);
      setPosts(data);
    } catch (err: unknown) {
      console.error(err);
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
  }, [typeFilter]);

  useEffect(() => {
    fetchCommunities();
  }, []);

  return (
    <div className="bg-surface-variant text-on-surface antialiased min-h-screen flex flex-col font-body-md text-body-md selection:bg-secondary-container selection:text-primary">
      <Header />

      {/* 3-Column Layout: Esquerda (Navegação) | Centro (Feed) | Direita (Contatos) */}
      <main className="flex-1 w-full max-w-[1180px] mx-auto px-space-md sm:px-space-lg py-space-md">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-space-md items-start">
          {/* ================= COLUNA ESQUERDA (3 COLS) ================= */}
          <aside className="md:col-span-3 lg:col-span-3">
            <SidebarNav communities={communities} />
          </aside>

          {/* ================= COLUNA CENTRAL: FEED (6 COLS) ================= */}
          <section className="md:col-span-9 lg:col-span-6 space-y-space-md">
            {/* Formulário de Criação de Post (Alterna entre Discussão e Scrap) */}
            <CreatePostForm
              communities={communities}
              onPostCreated={fetchPosts}
            />

            {/* Cabeçalho da Lista de Posts */}
            <div className="bg-surface-container-high px-space-md py-1.5 border border-outline-variant rounded flex items-center justify-between text-body-sm font-body-sm">
              <span className="text-primary font-bold text-label-sm uppercase">
                {typeFilter === 'scrap' ? 'Scraps Recentes' : 'Feed de Atualizações e Discussões'} ({posts.length})
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

            {/* Lista de Post Cards */}
            <div className="space-y-space-md">
              {loadingPosts && (
                <div className="p-space-lg bg-surface-container-lowest rounded classic-bevel-border text-center text-secondary flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                  Carregando publicações...
                </div>
              )}

              {!loadingPosts && posts.length === 0 && (
                <div className="p-space-lg bg-surface-container-lowest rounded classic-bevel-border text-center text-secondary">
                  <p className="font-semibold text-primary mb-1">Nenhum post encontrado.</p>
                  <p className="text-body-sm">Seja o primeiro a enviar um scrap ou iniciar uma discussão!</p>
                </div>
              )}

              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                />
              ))}
            </div>
          </section>

          {/* ================= COLUNA DIREITA (3 COLS): WIDGET DE CONTATOS ================= */}
          <aside className="md:col-span-12 lg:col-span-3">
            <ContactsWidget />
          </aside>
        </div>
      </main>
    </div>
  );
};
