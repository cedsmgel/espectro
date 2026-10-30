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
  const typeFilter = searchParams.get('type');

  const [posts, setPosts] = useState<Post[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

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
      const data = await api.getCommunities();
      setCommunities(data);
    } catch (err: unknown) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [typeFilter]);

  useEffect(() => {
    fetchCommunities();
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-brand-blue/30 selection:text-blue-300">
      <Header />

      {/* 3-Column Liquid Glass Grid: 3 cols (Left Nav) | 6 cols (Feed) | 3 cols (Contacts) */}
      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: Navigation & Profile */}
          <aside className="md:col-span-3 lg:col-span-3 sticky top-20">
            <SidebarNav communities={communities} />
          </aside>

          {/* Center Column: Feed Principal */}
          <section className="md:col-span-9 lg:col-span-6 space-y-5">
            <CreatePostForm
              communities={communities}
              onPostCreated={fetchPosts}
            />

            {/* Feed Filter Header */}
            <div className="flex items-center justify-between px-2 pt-1">
              <h2 className="font-display font-bold text-sm text-neutral-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-blue animate-pulse"></span>
                {typeFilter === 'scrap' ? 'Recados (Scraps)' : 'Feed Principal'}
                <span className="text-xs font-mono text-neutral-500 font-normal">({posts.length})</span>
              </h2>

              <button
                type="button"
                onClick={fetchPosts}
                disabled={loadingPosts}
                className="text-xs text-brand-blue hover:text-blue-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span className={`material-symbols-outlined text-[15px] ${loadingPosts ? 'animate-spin' : ''}`}>
                  refresh
                </span>
                Atualizar
              </button>
            </div>

            {/* Posts Stream */}
            <div className="space-y-4">
              {loadingPosts && (
                <div className="glass-panel rounded-2xl p-8 text-center text-neutral-400 flex items-center justify-center gap-2.5">
                  <span className="material-symbols-outlined animate-spin text-brand-blue text-2xl">sync</span>
                  <span className="text-sm font-medium">Carregando feed liquid glass...</span>
                </div>
              )}

              {!loadingPosts && posts.length === 0 && (
                <div className="glass-panel rounded-2xl p-10 text-center space-y-2">
                  <p className="font-display font-bold text-base text-white">Nenhuma publicação por enquanto</p>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                    Seja o pioneiro a inaugurar o novo feed do Espectro com uma discussão ou recado.
                  </p>
                </div>
              )}

              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          </section>

          {/* Right Column: Contacts Widget */}
          <aside className="md:col-span-12 lg:col-span-3 sticky top-20">
            <ContactsWidget />
          </aside>
        </div>
      </main>
    </div>
  );
};
