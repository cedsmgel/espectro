import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { useSidebar } from '../context/SidebarContext';
import { Post, authStorage } from '../lib/api';
import { VideoPlayer } from '../components/VideoPlayer';
import { VideoSkeleton } from '../components/VideoSkeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';

export const Videos: React.FC = () => {
  const { isExpanded } = useSidebar();
  const [videos, setVideos] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Todos');

  const categories = [
    'Todos',
    'Tutoriais',
    'Design & UI/UX',
    'Podcasts',
    'Games',
    'Música',
    'Tecnologia',
  ];

  const loadVideos = async () => {
    setLoading(true);
    setHasError(false);
    try {
      const res = await fetch('/api/posts');
      if (!res.ok) {
        throw new Error(`Falha ao buscar vídeos [status: ${res.status}]`);
      }
      const allPosts: Post[] = await res.json();
      const videoList = (allPosts || []).filter(
        (p) =>
          p.media_url &&
          (p.media_type === 'video' || /\.(mp4|webm|mov|ogg)$/i.test(p.media_url))
      );
      setVideos(videoList);
      setHasError(false);
    } catch (err) {
      console.error('Erro ao carregar vídeos do D1:', err);
      setHasError(true);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  const featuredVideo = videos[0];
  const gridVideos = videos.slice(1);

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />

      <div
        className={`pt-16 flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          isExpanded ? 'pl-0 md:pl-64' : 'pl-0 md:pl-[72px]'
        }`}
      >
        {/* Interactive Pill Filter Bar */}
        <section className="sticky top-16 z-30 bg-surface/95 backdrop-blur-md py-3 px-4 md:px-8 border-b border-outline-variant/30">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <span className="text-xs text-on-surface-variant font-medium shrink-0 hidden sm:inline">
              {videos.length} {videos.length === 1 ? 'vídeo' : 'vídeos'} no Espectro Play
            </span>
          </div>
        </section>

        <main className="max-w-7xl mx-auto w-full px-4 md:px-8 py-6 flex flex-col gap-10">
          {/* Header Title Section */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[24px]">movie</span>
              </div>
              <div>
                <h1 className="font-bold text-xl sm:text-2xl text-on-surface tracking-tight">
                  Espectro Play & Clipes
                </h1>
                <p className="text-xs text-on-surface-variant">
                  Vídeos, tutoriais e memórias compartilhadas pela comunidade
                </p>
              </div>
            </div>
          </div>

          {/* Loading Skeletons State */}
          {loading ? (
            <div className="flex flex-col gap-8">
              {/* Featured Skeleton */}
              <div className="w-full max-w-3xl mx-auto flex flex-col gap-4 animate-pulse">
                <div className="w-full aspect-video rounded-3xl bg-surface-container-high border border-outline-variant/20 shadow-sm flex items-center justify-center">
                  <span className="material-symbols-outlined text-outline-variant/40 text-[56px]">
                    play_circle
                  </span>
                </div>
                <div className="h-6 w-3/4 rounded-md bg-surface-container-high" />
                <div className="h-4 w-1/2 rounded-md bg-surface-container" />
              </div>

              {/* Grid Skeletons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                <VideoSkeleton />
                <VideoSkeleton />
                <VideoSkeleton />
              </div>
            </div>
          ) : hasError ? (
            /* Error State */
            <ErrorState
              title="A conexão com os vídeos falhou"
              message="Não foi possível sincronizar os vídeos com o servidor D1. Pode ser uma oscilação na rede."
              onRetry={loadVideos}
            />
          ) : videos.length === 0 ? (
            /* Empty State */
            <EmptyState
              icon="videocam_off"
              title="A tela está em branco."
              description="Nenhum vídeo foi enviado ainda. Compartilhe um clipe do seu dia ou uma memória antiga."
              actionLabel="Enviar vídeo"
              actionLink="/"
            />
          ) : (
            /* Real Video Content */
            <div className="flex flex-col gap-10">
              {/* Featured Video */}
              {featuredVideo && (
                <section className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-on-primary font-bold text-xs uppercase tracking-wider">
                      Mais Recente
                    </span>
                    <span className="text-on-surface-variant text-xs">
                      • Publicado por @{featuredVideo.author_name}
                    </span>
                  </div>

                  <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-4 max-w-4xl mx-auto w-full">
                    <div className="w-full max-w-2xl mx-auto">
                      <VideoPlayer src={featuredVideo.media_url!} />
                    </div>

                    <div className="flex flex-col gap-1.5 pt-2">
                      <h2 className="font-bold text-base sm:text-lg text-on-surface">
                        {featuredVideo.title || featuredVideo.content.slice(0, 80) || 'Vídeo no Espectro'}
                      </h2>
                      <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                        <span>@{featuredVideo.author_name}</span>
                        <span>•</span>
                        <span>{new Date(featuredVideo.created_at).toLocaleDateString('pt-BR')}</span>
                        {featuredVideo.community_name && (
                          <>
                            <span>•</span>
                            <span className="text-primary font-medium">c/{featuredVideo.community_name}</span>
                          </>
                        )}
                      </div>
                      {featuredVideo.content && (
                        <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                          {featuredVideo.content}
                        </p>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Grid of Other Videos */}
              {gridVideos.length > 0 && (
                <section className="flex flex-col gap-4">
                  <h3 className="font-bold text-base text-on-surface">
                    Mais Vídeos da Comunidade
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {gridVideos.map((video) => (
                      <div
                        key={video.id}
                        className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-sm flex flex-col gap-3 group"
                      >
                        <VideoPlayer src={video.media_url!} />
                        <div className="flex flex-col min-w-0">
                          <h4 className="font-semibold text-xs sm:text-sm text-on-surface line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                            {video.title || video.content.slice(0, 60) || 'Vídeo compartilhado'}
                          </h4>
                          <span className="text-[11px] text-on-surface-variant mt-1">
                            @{video.author_name} • {new Date(video.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
