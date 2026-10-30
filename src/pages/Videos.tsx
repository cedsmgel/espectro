import React, { useState } from 'react';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';

export const Videos: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [likes, setLikes] = useState(12800);
  const [liked, setLiked] = useState(false);

  const categories = [
    'Todos',
    'Tutoriais',
    'Design & UI/UX',
    'Podcasts',
    'Ao Vivo',
    'Games',
    'Música',
    'Ciência & Tecnologia',
  ];

  const shorts = [
    {
      id: 1,
      title: '3 atalhos que salvaram meu workflow de React em 2026 🔥',
      author: '@mari.code',
      authorLetter: 'M',
      views: '240k views',
      gradient: 'from-purple-900 to-indigo-950',
    },
    {
      id: 2,
      title: 'Segredo da Tipografia Fluida no Figma que ninguém te conta',
      author: '@lucas_ui',
      authorLetter: 'L',
      views: '512k views',
      gradient: 'from-blue-900 to-slate-900',
    },
    {
      id: 3,
      title: 'Montando o teclado acústico dos sonhos em menos de 60s ⌨️',
      author: '@tech_craft',
      authorLetter: 'T',
      views: '188k views',
      gradient: 'from-emerald-900 to-teal-950',
    },
    {
      id: 4,
      title: 'Shader com Three.js em 45 linhas de puro código procedural ✨',
      author: '@alessio_dev',
      authorLetter: 'A',
      views: '342k views',
      gradient: 'from-fuchsia-900 to-purple-950',
    },
    {
      id: 5,
      title: '"A IA não vai roubar seu emprego, quem usa IA vai!" 🎙️',
      author: '@cast.front',
      authorLetter: 'C',
      views: '98k views',
      gradient: 'from-rose-900 to-neutral-900',
    },
  ];

  const recommendedVideos = [
    {
      id: 1,
      title: 'Arquitetura de Microsserviços e Event-Driven com Node.js na Prática',
      channel: 'DevOps Brasil',
      views: '48k visualizações • há 3 dias',
      duration: '14:20',
      initials: 'JS',
      bgGradient: 'from-indigo-600 to-blue-800',
    },
    {
      id: 2,
      title: 'Espectro Tech Talk #84: O Futuro da Computação Quântica e IA Generativa',
      channel: 'Espectro Podcasts',
      views: 'Ao vivo agora',
      isLive: true,
      initials: 'EC',
      bgGradient: 'from-purple-700 to-pink-800',
    },
    {
      id: 3,
      title: 'Design System Tokens e Variáveis: Do Figma ao Código em 10 Minutos',
      channel: 'UI/UX Brasil',
      views: '89k visualizações • há 1 semana',
      duration: '18:45',
      initials: 'UX',
      bgGradient: 'from-cyan-600 to-teal-800',
    },
    {
      id: 4,
      title: 'Criando APIs Ultra-rápidas no Edge com Cloudflare Workers e D1',
      channel: 'Cloud Coders',
      views: '32k visualizações • há 4 dias',
      duration: '22:15',
      initials: 'CF',
      bgGradient: 'from-amber-600 to-orange-800',
    },
    {
      id: 5,
      title: 'Construindo o novo Espectro: Análise de UI e Material 3 Design',
      channel: 'Frontend Masters BR',
      views: '115k visualizações • há 2 semanas',
      duration: '31:50',
      initials: 'FM',
      bgGradient: 'from-violet-600 to-indigo-900',
    },
    {
      id: 6,
      title: 'Setup Minimalista de Produtividade para Desenvolvedores 2026',
      channel: 'Desk & Dev',
      views: '64k visualizações • há 5 dias',
      duration: '12:05',
      initials: 'DD',
      bgGradient: 'from-slate-700 to-zinc-900',
    },
  ];

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />

      <div className="pl-0 md:pl-[72px] pt-16 flex-1 flex flex-col">
        {/* Interactive Pill Filter Bar */}
        <section className="sticky top-16 z-30 bg-surface/95 backdrop-blur-md py-3 px-4 md:px-8 border-b border-outline-variant/30">
          <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
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
                {cat === 'Ao Vivo' && (
                  <span className="inline-block w-2 h-2 rounded-full bg-error mr-1.5 animate-pulse" />
                )}
                {cat}
              </button>
            ))}
          </div>
        </section>

        <main className="max-w-7xl mx-auto w-full px-4 md:px-8 py-6 flex flex-col gap-10">
          {/* Vertical Clips Section (Shorts / Reels) */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary-container text-on-secondary flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[20px]">bolt</span>
                </div>
                <div>
                  <h2 className="font-bold text-lg text-on-surface tracking-tight">
                    Clipes & Espectro Shorts
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    Momentos dinâmicos e hacks rápidos da nossa rede
                  </p>
                </div>
              </div>
            </div>

            {/* Shorts Carousel Container */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-x-auto scrollbar-none py-1">
              {shorts.map((short) => (
                <div
                  key={short.id}
                  className={`group relative aspect-[9/16] rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between p-4 cursor-pointer select-none bg-gradient-to-b ${short.gradient}`}
                >
                  <div className="relative z-10 flex justify-between items-start">
                    <span className="px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-white text-[10px] font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-primary">visibility</span>
                      {short.views}
                    </span>
                  </div>

                  <div className="relative z-10 flex flex-col gap-1 text-white">
                    <p className="text-xs font-semibold line-clamp-2 leading-snug drop-shadow-sm">
                      {short.title}
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">
                        {short.authorLetter}
                      </div>
                      <span className="text-[11px] text-white/80 truncate">{short.author}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Featured Video of the Week */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-primary-container/10 text-primary font-bold text-xs uppercase tracking-wider">
                Em Destaque
              </span>
              <span className="text-on-surface-variant text-xs">
                • Seleção Editorial da Semana
              </span>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden flex flex-col">
              {/* 16:9 Custom Widescreen Player */}
              <div className="relative w-full aspect-video bg-inverse-surface overflow-hidden group select-none">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950 via-slate-900 to-purple-950 flex items-center justify-center">
                  <div className="text-center p-6 max-w-lg">
                    <span className="material-symbols-outlined text-[56px] text-primary animate-pulse">
                      play_circle
                    </span>
                    <h3 className="text-white text-lg font-bold mt-2">
                      Masterclass: Arquitetura de Design Tokens e UI Moderna
                    </h3>
                  </div>
                </div>

                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-20 h-20 rounded-full bg-primary/90 text-on-primary flex items-center justify-center shadow-xl hover:scale-110 hover:bg-primary transition-all duration-200 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[44px] ml-1">
                      {isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                  </button>
                </div>

                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <span className="px-3 py-1 rounded-md bg-black/60 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim" />
                    4K Ultra HD • Masterclass
                  </span>
                </div>
              </div>

              {/* Video Metadata & Action Bar */}
              <div className="p-6 flex flex-col gap-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Channel Info & Subscribe */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary to-secondary p-0.5 shrink-0 shadow-xs">
                      <div className="w-full h-full rounded-full bg-surface-container-lowest flex items-center justify-center font-bold text-primary">
                        EA
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-base text-on-surface">Espectro Academy</span>
                        <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                      </div>
                      <span className="text-xs text-on-surface-variant">450k inscritos</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSubscribed(!isSubscribed)}
                      className={`ml-2 h-9 px-5 rounded-full font-semibold text-xs transition-colors shadow-xs cursor-pointer ${
                        isSubscribed
                          ? 'bg-surface-container-high text-on-surface'
                          : 'bg-primary-container text-on-primary hover:bg-primary'
                      }`}
                    >
                      {isSubscribed ? 'Inscrito' : 'Inscrever-se'}
                    </button>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-full bg-surface-container-high p-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLiked(!liked);
                          setLikes((prev) => (liked ? prev - 1 : prev + 1));
                        }}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-l-full hover:bg-surface-container-highest transition-colors text-xs font-semibold cursor-pointer ${
                          liked ? 'text-primary' : 'text-on-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">thumb_up</span>
                        <span>{(likes / 1000).toFixed(1)}k</span>
                      </button>
                      <div className="w-[1px] h-4 bg-outline-variant/40" />
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-r-full hover:bg-surface-container-highest transition-colors text-on-surface flex items-center cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">thumb_down</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-colors text-xs font-semibold text-on-surface cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">share</span>
                      <span className="hidden sm:inline">Compartilhar</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1 bg-surface-container-low p-4 rounded-xl">
                  <h1 className="font-bold text-base sm:text-lg text-on-surface">
                    Como construir um Design System moderno do zero - Masterclass 2026
                  </h1>
                  <div className="flex items-center gap-3 text-xs text-on-surface-variant pt-0.5">
                    <span>94.120 visualizações</span>
                    <span>•</span>
                    <span>Transmitido há 2 dias</span>
                    <span>•</span>
                    <span className="text-primary font-medium">#DesignSystem #Figma #TailwindCSS</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    Nesta masterclass imersiva, destrinchamos a arquitetura de tokens com Material 3, escalabilidade de componentes em React e como manter sincronia perfeita entre código e design.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Recommended Videos Grid */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">recommend</span>
                <h2 className="font-bold text-lg text-on-surface">Recomendados para Você</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendedVideos.map((video) => (
                <div key={video.id} className="flex flex-col gap-2.5 group cursor-pointer">
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-surface-container shadow-xs group-hover:shadow-md transition-all">
                    <div className={`w-full h-full bg-gradient-to-tr ${video.bgGradient} flex items-center justify-center text-white/40 group-hover:scale-105 transition-transform duration-500`}>
                      <span className="material-symbols-outlined text-[48px]">play_circle</span>
                    </div>
                    {video.isLive ? (
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-error text-white text-[10px] font-bold flex items-center gap-1 shadow-xs animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        AO VIVO
                      </div>
                    ) : (
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-sm text-white text-[10px] font-semibold">
                        {video.duration}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {video.initials}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <h3 className="font-semibold text-xs sm:text-sm text-on-surface line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                        {video.title}
                      </h3>
                      <p className="text-[11px] text-on-surface-variant mt-1">{video.channel}</p>
                      <p className="text-[11px] text-on-surface-variant">{video.views}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};
