import React, { useCallback, useEffect, useRef, useState } from 'react';
import { directMessagesApi, MomentGroup, MomentViewer as Viewer, momentsApi } from '../../lib/api';
import { MomentSlide, parseOverlay } from './MomentSlide';

const IMAGE_MS = 5000;

interface MomentViewerProps {
  groups: MomentGroup[];
  startGroup: number;
  meId: number;
  onClose: () => void;
  // Algo mudou (visto, apagado): a barra recarrega
  onChanged: () => void;
}

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h`;
}

export const MomentViewerScreen: React.FC<MomentViewerProps> = ({ groups, startGroup, meId, onClose, onChanged }) => {
  const [gi, setGi] = useState(startGroup);
  const [ii, setIi] = useState(() => {
    const items = groups[startGroup]?.items ?? [];
    const firstNew = items.findIndex((m) => !m.viewed);
    return firstNew >= 0 ? firstNew : 0;
  });
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [reply, setReply] = useState('');
  const [replyFocused, setReplyFocused] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const holdTimerRef = useRef<number | null>(null);
  const heldRef = useRef(false);

  const group = groups[gi];
  const moment = group?.items[ii];
  const isMine = group?.user_id === meId;
  const paused = holding || showViewers || replyFocused;

  const next = useCallback(() => {
    const g = groups[gi];
    if (ii < g.items.length - 1) {
      setIi(ii + 1);
    } else if (gi < groups.length - 1) {
      setGi(gi + 1);
      setIi(0);
    } else {
      onClose();
    }
  }, [groups, gi, ii, onClose]);

  const prev = useCallback(() => {
    if (ii > 0) setIi(ii - 1);
    else if (gi > 0) {
      setGi(gi - 1);
      setIi(0);
    } else setProgress(0);
  }, [gi, ii]);

  // Cada Momentum visto é registrado uma vez
  useEffect(() => {
    if (!moment || isMine || moment.viewed) return;
    moment.viewed = true;
    void momentsApi.markViewed(moment.id).then(onChanged).catch(() => {});
  }, [moment, isMine, onChanged]);

  // Avanço automático de fotos e textos (vídeos avançam quando terminam)
  useEffect(() => {
    setProgress(0);
    setShowViewers(false);
    setReply('');
  }, [gi, ii]);

  useEffect(() => {
    if (!moment || moment.media_type === 'video' || paused) return;
    let raf = 0;
    let last = performance.now();
    let elapsed = progress * IMAGE_MS;
    const tick = (now: number) => {
      elapsed += now - last;
      last = now;
      if (elapsed >= IMAGE_MS) {
        next();
        return;
      }
      setProgress(elapsed / IMAGE_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment, paused, next]);

  // Vídeo: segue a pausa e tenta tocar com som (a pessoa já tocou na tela); sem permissão, toca mudo
  useEffect(() => {
    const video = videoRef.current;
    if (!video || moment?.media_type !== 'video') return;
    if (paused) {
      video.pause();
      return;
    }
    video.muted = muted;
    video.play().catch(() => {
      video.muted = true;
      setMuted(true);
      void video.play().catch(() => {});
    });
  }, [moment, paused, muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || moment?.media_type !== 'video') return;
    const onTime = () => video.duration && setProgress(video.currentTime / video.duration);
    video.addEventListener('timeupdate', onTime);
    return () => video.removeEventListener('timeupdate', onTime);
  }, [moment]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (replyFocused) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [next, prev, onClose, replyFocused]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!group || !moment) return null;

  // Toque curto navega (esquerda volta, direita avança); segurar pausa
  const onPointerDown = () => {
    heldRef.current = false;
    holdTimerRef.current = window.setTimeout(() => {
      heldRef.current = true;
      setHolding(true);
    }, 220);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    setHolding(false);
    if (heldRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.33) prev();
    else next();
  };

  const openViewers = async () => {
    setShowViewers(true);
    try {
      setViewers(await momentsApi.viewers(moment.id));
    } catch {
      setViewers([]);
    }
  };

  const remove = async () => {
    try {
      await momentsApi.remove(moment.id);
      onChanged();
      if (group.items.length === 1) onClose();
      else {
        group.items.splice(ii, 1);
        setIi(Math.min(ii, group.items.length - 1));
      }
    } catch {
      setNotice('Não foi possível apagar.');
    }
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = reply.trim();
    if (!content) return;
    try {
      await directMessagesApi.send({ receiver_id: group.user_id, content: `Respondeu seu Momentum: ${content}` });
      setReply('');
      setNotice('Resposta enviada.');
      window.setTimeout(() => setNotice(null), 2000);
    } catch {
      setNotice('Não foi possível enviar.');
    }
  };

  const circleButton =
    'w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center cursor-pointer hover:bg-black/60 transition-colors';

  return (
    <div className="fixed inset-0 z-[120] bg-black text-white flex items-center justify-center" role="dialog" aria-modal="true" aria-label={`Momentum de @${group.username}`}>
      <div className="relative w-full h-full max-w-[480px] flex flex-col bg-black sm:border-x sm:border-white/10">
        {/* Mídia e áreas de toque */}
        <div
          className="absolute inset-0 touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
            setHolding(false);
          }}
        >
          <MomentSlide
            key={moment.id}
            mediaUrl={moment.media_url}
            mediaType={moment.media_type}
            text={moment.text}
            bg={moment.bg}
            overlay={parseOverlay(moment.overlay)}
            videoRef={videoRef}
            muted={muted}
            onVideoEnded={next}
          />
        </div>
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

        {/* Barras de progresso e cabeçalho */}
        <div className="relative z-10 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none">
          <div className="flex gap-1">
            {group.items.map((m, index) => (
              <div key={m.id} className="flex-1 h-[2px] rounded-full bg-white/30 overflow-hidden">
                <div className="h-full bg-white" style={{ width: index < ii ? '100%' : index === ii ? `${progress * 100}%` : '0%' }} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 pointer-events-auto">
            <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-xs font-bold uppercase overflow-hidden shrink-0">
              {group.avatar_url ? <img loading="lazy" decoding="async" src={group.avatar_url} alt="" className="w-full h-full object-cover" /> : group.username.charAt(0)}
            </div>
            <span className="text-sm font-semibold truncate">{isMine ? 'Seu Momentum' : `@${group.username}`}</span>
            <span className="text-xs text-white/70">{timeAgo(moment.created_at)}</span>
            <div className="flex-1" />
            {moment.media_type === 'video' && (
              <button type="button" onClick={() => setMuted((m) => !m)} className={circleButton} aria-label={muted ? 'Ativar som' : 'Desativar som'}>
                <span className="material-symbols-outlined text-[20px]">{muted ? 'volume_off' : 'volume_up'}</span>
              </button>
            )}
            {isMine && (
              <button type="button" onClick={() => void remove()} className={circleButton} aria-label="Apagar Momentum">
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            )}
            <button type="button" onClick={onClose} className={circleButton} aria-label="Fechar">
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>
        </div>

        <div className="flex-1" />

        {notice && (
          <p className="relative z-10 self-center mb-2 px-3 py-1 rounded-full bg-black/70 text-xs" role="status">
            {notice}
          </p>
        )}

        {/* Rodapé: quem viu (meu) ou resposta (dos amigos) */}
        <div className="relative z-10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6 bg-gradient-to-t from-black/70 to-transparent">
          {isMine ? (
            <button type="button" onClick={() => void openViewers()} className="mx-auto h-10 px-4 rounded-full border border-white/40 text-xs font-semibold flex items-center gap-2 cursor-pointer hover:bg-white/10">
              <span className="material-symbols-outlined text-[18px]">visibility</span>
              {moment.views_count} {moment.views_count === 1 ? 'visualização' : 'visualizações'}
            </button>
          ) : (
            <form onSubmit={sendReply} className="flex items-center gap-2">
              <input
                type="text"
                value={reply}
                maxLength={500}
                onChange={(e) => setReply(e.target.value)}
                onFocus={() => setReplyFocused(true)}
                onBlur={() => setReplyFocused(false)}
                aria-label={`Responder a @${group.username}`}
                className="flex-1 h-11 rounded-full bg-transparent border border-white/50 px-4 text-sm outline-none focus:border-white"
              />
              <button type="submit" disabled={!reply.trim()} className="w-11 h-11 rounded-full border border-white/50 flex items-center justify-center cursor-pointer disabled:opacity-40" aria-label="Enviar resposta">
                <span className="material-symbols-outlined text-[20px]">send</span>
              </button>
            </form>
          )}
        </div>

        {/* Lista de quem viu */}
        {showViewers && (
          <div className="absolute inset-x-0 bottom-0 z-20 max-h-[60%] overflow-y-auto rounded-t-2xl bg-[#111] border-t border-white/15 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Visualizações ({viewers.length})</h3>
              <button type="button" onClick={() => setShowViewers(false)} className={circleButton} aria-label="Fechar lista">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            {viewers.length === 0 ? (
              <p className="text-xs text-white/60 py-4 text-center">Ninguém viu ainda.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {viewers.map((v) => (
                  <li key={v.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center text-xs font-bold uppercase overflow-hidden">
                      {v.avatar_url ? <img loading="lazy" decoding="async" src={v.avatar_url} alt="" className="w-full h-full object-cover" /> : v.username.charAt(0)}
                    </div>
                    <span className="text-sm flex-1 truncate">@{v.username}</span>
                    <span className="text-[11px] text-white/60">{timeAgo(v.viewed_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
