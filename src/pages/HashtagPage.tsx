import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { hashtagsApi, Post, postsApi } from '../lib/api';
import { tagKey } from '../lib/hashtags';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { PostCard } from '../components/PostCard';
import { PostSkeleton } from '../components/PostSkeleton';

// Página de uma hashtag: /tag/musica (pública; respeita a privacidade dos perfis)
export const HashtagPage: React.FC = () => {
  const { tag: rawTag } = useParams<{ tag: string }>();
  const tag = tagKey(rawTag || '');
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [trending, setTrending] = useState<Array<{ tag: string; posts: number }>>([]);

  useEffect(() => {
    let active = true;
    setPosts(null);
    setTotal(null);
    postsApi.list({ tag, limit: 50 }).then((list) => active && setPosts(list)).catch(() => active && setPosts([]));
    hashtagsApi.info(tag).then((info) => active && setTotal(info.posts)).catch(() => {});
    return () => {
      active = false;
    };
  }, [tag]);

  useEffect(() => {
    hashtagsApi.trending(8).then(setTrending).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />
      <div className="pt-16 md:pt-0 md:pl-20 lg:pl-64">
        <main className="w-full max-w-2xl mx-auto px-4 pt-4 pb-24 md:pb-8">
          <div className="flex items-center gap-2 pb-3 border-b border-outline-variant">
            <Link to="/" aria-label="Voltar" className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate">#{tag}</h1>
              {total !== null && (
                <p className="text-xs text-on-surface-variant">
                  {total} {total === 1 ? 'publicação' : 'publicações'}
                </p>
              )}
            </div>
          </div>

          {trending.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none py-3 border-b border-outline-variant" aria-label="Hashtags em alta">
              {trending.map((t) => (
                <Link
                  key={t.tag}
                  to={`/tag/${encodeURIComponent(t.tag)}`}
                  className={`shrink-0 h-8 px-3 rounded-full border text-xs font-semibold flex items-center ${
                    t.tag === tag ? 'bg-on-surface text-surface border-on-surface' : 'border-outline-variant text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  #{t.tag}
                </Link>
              ))}
            </div>
          )}

          <div className="pt-4">
            {posts === null ? (
              <PostSkeleton />
            ) : posts.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-16">Ninguém usou #{tag} ainda. Seja a primeira pessoa: escreva uma publicação com essa hashtag.</p>
            ) : (
              <div className="flex flex-col gap-5">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} onVote={() => {}} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
