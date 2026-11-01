import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { requestAuth } from '../lib/authEvents';
import { SidebarNav } from '../components/SidebarNav';
import { ShareButton } from '../components/ShareButton';
import { api, authStorage, Post } from '../lib/api';
import { parseScrap } from '../lib/scrapStyle';
import { useMutedPreference } from '../lib/mutePreference';

const PAGE_SIZE = 10;
function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')} mi`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.0', '')} mil`;
  return String(Math.max(0, value));
}

interface ShortItemProps {
  post: Post;
  index: number;
  active: boolean;
  // Só os vídeos perto do que está na tela existem de fato; os outros são descartados
  mounted: boolean;
  muted: boolean;
  voted: boolean;
  onToggleMute: () => void;
  onVote: (post: Post) => void;
  registerRef: (index: number, element: HTMLElement | null) => void;
}

const ShortItem = React.memo<ShortItemProps>(
  ({ post, index, active, mounted, muted, voted, onToggleMute, onVote, registerRef }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const flashTimer = useRef<number>();
    const [progress, setProgress] = useState(0);
    const [paused, setPaused] = useState(false);
    const [flash, setFlash] = useState<'play' | 'pause' | null>(null);
    // Vídeo em pé preenche a tela; vídeo deitado aparece inteiro com barras
    const [fill, setFill] = useState(true);
    const [failed, setFailed] = useState(false);

    // Ao sair de cena, solta o arquivo e o decodificador
    useEffect(() => {
      const video = videoRef.current;
      return () => {
        window.clearTimeout(flashTimer.current);
        if (video) {
          video.pause();
          video.removeAttribute('src');
          video.load();
        }
      };
    }, [mounted]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      if (active) {
        video.muted = muted;
        void video.play().then(() => setPaused(false)).catch(() => setPaused(true));
      } else {
        video.pause();
        video.currentTime = 0;
        setPaused(false);
        setProgress(0);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, mounted]);

    useEffect(() => {
      if (videoRef.current) videoRef.current.muted = muted;
    }, [muted]);

    const togglePlay = () => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        void video.play();
        setPaused(false);
        setFlash('play');
      } else {
        video.pause();
        setPaused(true);
        setFlash('pause');
      }
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), 700);
    };

    const caption = post.title?.trim() || parseScrap(post.content || '').body.trim();

    return (
      <section
        ref={(element) => registerRef(index, element)}
        data-index={index}
        className="h-full w-full snap-start snap-always flex justify-center bg-surface"
      >
        <div className="relative h-full w-full md:w-auto md:aspect-[9/16] bg-black overflow-hidden">
          {mounted && (
            <video
              ref={videoRef}
              src={post.media_url || undefined}
              loop
              playsInline
              muted={muted}
              preload={active ? 'auto' : 'metadata'}
              onError={() => setFailed(true)}
              onLoadedMetadata={(e) => {
                const { videoWidth, videoHeight } = e.currentTarget;
                if (videoWidth && videoHeight) setFill(videoWidth / videoHeight < 0.8);
              }}
              onTimeUpdate={(e) => {
                const { currentTime, duration } = e.currentTarget;
                if (duration > 0) setProgress(currentTime / duration);
              }}
              className={`absolute inset-0 w-full h-full ${fill ? 'object-cover' : 'object-contain'}`}
            />
          )}

          {/* Toque em qualquer ponto do vídeo: pausa ou retoma */}
          <button
            type="button"
            data-tap
            onClick={togglePlay}
            aria-label={paused ? 'Reproduzir vídeo' : 'Pausar vídeo'}
            className="absolute inset-0 w-full h-full cursor-pointer"
          />

          {failed && (
            <p className="absolute inset-0 m-auto h-fit px-8 text-center text-sm text-white/80 pointer-events-none" role="alert">
              Não foi possível reproduzir este vídeo.
            </p>
          )}

          {flash && (
            <span
              className="absolute inset-0 m-auto w-16 h-16 flex items-center justify-center text-white pointer-events-none animate-in fade-in zoom-in-95"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-[56px] drop-shadow">{flash === 'play' ? 'play_arrow' : 'pause'}</span>
            </span>
          )}

          {/* Topo: nome da seção e som */}
          <div className="absolute top-0 inset-x-0 z-10 pt-[max(0.75rem,env(safe-area-inset-top))] px-4 pb-8 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent text-white pointer-events-none">
            <span className="text-sm font-semibold tracking-tight">Shorts</span>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Ativar som' : 'Desativar som'}
              className="w-10 h-10 flex items-center justify-center cursor-pointer pointer-events-auto"
            >
              <span className="material-symbols-outlined text-[24px] drop-shadow">{muted ? 'volume_off' : 'volume_up'}</span>
            </button>
          </div>

          {/* Base: autor e legenda à esquerda, ações à direita */}
          <div className="absolute bottom-0 inset-x-0 z-10 pt-24 pb-5 px-4 flex items-end gap-4 bg-gradient-to-t from-black/75 to-transparent text-white pointer-events-none">
            <div className="flex-1 min-w-0 flex flex-col gap-2 pointer-events-auto">
              <Link
                to={`/perfil/${encodeURIComponent(post.author_name)}`}
                className="flex items-center gap-2 min-w-0 w-fit"
              >
                <span className="w-9 h-9 border border-white/70 bg-white/10 flex items-center justify-center text-sm font-bold uppercase overflow-hidden shrink-0 rounded-full">
                  {post.author_avatar ? (
                    <img src={post.author_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    post.author_name.charAt(0)
                  )}
                </span>
                <span className="text-sm font-semibold truncate">@{post.author_name}</span>
              </Link>
              {caption && (
                <Link to={`/post/${post.id}`} className="text-[13px] leading-snug line-clamp-2 break-words">
                  {caption}
                </Link>
              )}
            </div>

            <div className="flex flex-col items-center gap-5 pointer-events-auto">
              <button
                type="button"
                onClick={() => onVote(post)}
                aria-label="Curtir"
                aria-pressed={voted}
                className="flex flex-col items-center gap-1 cursor-pointer"
              >
                <span
                  className="material-symbols-outlined text-[28px] drop-shadow"
                  style={voted ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  favorite
                </span>
                <span className="text-[11px] font-semibold tabular-nums">{formatCount(post.upvotes)}</span>
              </button>

              <Link to={`/post/${post.id}`} aria-label="Ver comentários" className="flex flex-col items-center gap-1">
                <span className="material-symbols-outlined text-[28px] drop-shadow">chat_bubble_outline</span>
                <span className="text-[11px] font-semibold tabular-nums">{formatCount(post.comments_count)}</span>
              </Link>

              <ShareButton
                url={`${window.location.origin}/post/${post.id}`}
                title={post.title?.trim() || `Vídeo de @${post.author_name}`}
              />
            </div>
          </div>

          {/* Progresso: uma linha fina, sem controles */}
          <div className="absolute bottom-0 inset-x-0 z-10 h-[2px] bg-white/25 pointer-events-none">
            <div className="h-full bg-white" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      </section>
    );
  }
);
ShortItem.displayName = 'ShortItem';

export const Shorts: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startId = Number(searchParams.get('id')) || null;

  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const { muted, toggleMuted: toggleMute } = useMutedPreference();
  const [voted, setVoted] = useState<Record<number, boolean>>({});

  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());
  const positionedRef = useRef(false);

  const registerRef = useCallback((index: number, element: HTMLElement | null) => {
    if (element) itemRefs.current.set(index, element);
    else itemRefs.current.delete(index);
  }, []);

  // Primeira página; se veio de um link (?id=), garante que esse vídeo está na lista
  useEffect(() => {
    let alive = true;
    positionedRef.current = false;
    (async () => {
      try {
        const first = await api.getPosts({ media: 'video', limit: PAGE_SIZE });
        let list = first;
        if (startId && !first.some((p) => p.id === startId)) {
          const res = await fetch(`/api/posts/${startId}`, {
            headers: authStorage.getToken() ? { Authorization: `Bearer ${authStorage.getToken()}` } : undefined,
          });
          if (res.ok) {
            const one = (await res.json()) as Post;
            if (one?.media_type === 'video') list = [one, ...first];
          }
        }
        if (!alive) return;
        setItems(list);
        setDone(first.length < PAGE_SIZE);
      } catch {
        if (alive) setError('Não foi possível carregar os vídeos.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [startId]);

  // Posiciona no vídeo do link, uma única vez
  useEffect(() => {
    if (items.length === 0 || positionedRef.current) return;
    positionedRef.current = true;
    const index = startId ? Math.max(0, items.findIndex((p) => p.id === startId)) : 0;
    if (index > 0) {
      itemRefs.current.get(index)?.scrollIntoView({ block: 'start' });
      setActive(index);
    }
  }, [items, startId]);

  // Qual vídeo ocupa a tela: o que estiver visível em pelo menos 60%
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            setActive(Number((entry.target as HTMLElement).dataset.index));
          }
        }
      },
      { root, threshold: [0.6] }
    );
    itemRefs.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [items.length]);

  // Carrega mais quando faltam poucos vídeos para o fim
  useEffect(() => {
    if (done || loadingMore || items.length === 0 || active < items.length - 3) return;
    setLoadingMore(true);
    api
      .getPosts({ media: 'video', limit: PAGE_SIZE, before_id: items[items.length - 1].id })
      .then((rows) => {
        setItems((prev) => [...prev, ...rows.filter((row) => !prev.some((p) => p.id === row.id))]);
        if (rows.length < PAGE_SIZE) setDone(true);
      })
      .catch(() => setDone(true))
      .finally(() => setLoadingMore(false));
  }, [active, items, done, loadingMore]);

  const step = useCallback((direction: 1 | -1) => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollBy({ top: direction * scroller.clientHeight, behavior: 'smooth' });
  }, []);

  // Teclado: setas trocam de vídeo, espaço pausa, M liga e desliga o som
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        step(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        step(-1);
      } else if (event.key === ' ') {
        event.preventDefault();
        document.querySelector<HTMLButtonElement>(`[data-index="${active}"] [data-tap]`)?.click();
      } else if (event.key.toLowerCase() === 'm') {
        toggleMute();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, step, toggleMute]);

  const handleVote = useCallback(
    (post: Post) => {
      if (!authStorage.getToken()) {
        requestAuth({ mode: 'login', reason: 'Para curtir, entre ou crie uma conta.' });
        return;
      }
      if (voted[post.id]) return;
      setVoted((prev) => ({ ...prev, [post.id]: true }));
      setItems((prev) => prev.map((p) => (p.id === post.id ? { ...p, upvotes: p.upvotes + 1 } : p)));
      api.votePost(post.id, 'up').catch(() => {
        setVoted((prev) => ({ ...prev, [post.id]: false }));
        setItems((prev) => prev.map((p) => (p.id === post.id ? { ...p, upvotes: Math.max(0, p.upvotes - 1) } : p)));
      });
    },
    [voted, navigate]
  );

  return (
    <div className="h-dvh w-full bg-surface text-on-surface flex overflow-hidden">
      <SidebarNav />
      <main className="flex-1 min-w-0 relative h-full">
        {loading ? (
          <p className="h-full flex items-center justify-center text-xs text-on-surface-variant" role="status">
            Carregando...
          </p>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm font-semibold">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2 border border-on-surface text-xs font-semibold cursor-pointer active:bg-on-surface active:text-surface"
            >
              Tentar de novo
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant">play_circle</span>
            <p className="text-sm font-semibold">Ainda não há vídeos</p>
            <p className="text-xs text-on-surface-variant max-w-xs">Os vídeos publicados no Espectro aparecem aqui, um por vez.</p>
          </div>
        ) : (
          <>
            <div
              ref={scrollerRef}
              className="h-[calc(100dvh-4rem-env(safe-area-inset-bottom,0px))] md:h-dvh overflow-y-scroll snap-y snap-mandatory overscroll-contain scrollbar-none"
            >
              {items.map((post, index) => (
                <ShortItem
                  key={post.id}
                  post={post}
                  index={index}
                  active={index === active}
                  mounted={Math.abs(index - active) <= 1}
                  muted={muted}
                  voted={Boolean(voted[post.id])}
                  onToggleMute={toggleMute}
                  onVote={handleVote}
                  registerRef={registerRef}
                />
              ))}
            </div>

            {/* No computador: setas para trocar de vídeo (no celular o gesto basta) */}
            <div className="hidden md:flex flex-col gap-3 absolute right-6 top-1/2 -translate-y-1/2 z-20">
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={active === 0}
                aria-label="Vídeo anterior"
                className="w-11 h-11 border border-outline-variant bg-surface-container-lowest flex items-center justify-center cursor-pointer disabled:opacity-30 hover:bg-surface-container active:bg-on-surface active:text-surface"
              >
                <span className="material-symbols-outlined text-[24px]">keyboard_arrow_up</span>
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={active >= items.length - 1}
                aria-label="Próximo vídeo"
                className="w-11 h-11 border border-outline-variant bg-surface-container-lowest flex items-center justify-center cursor-pointer disabled:opacity-30 hover:bg-surface-container active:bg-on-surface active:text-surface"
              >
                <span className="material-symbols-outlined text-[24px]">keyboard_arrow_down</span>
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};
