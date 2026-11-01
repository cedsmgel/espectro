import React, { useEffect, useRef, useState } from 'react';
import { MomentOverlay, momentsApi, uploadApi } from '../../lib/api';
import { MOMENT_BACKGROUNDS, MOMENT_FILTERS, MomentSlide } from './MomentSlide';

const MAX_VIDEO_SECONDS = 30;
const MAX_TEXT = 280;

interface MomentCreatorProps {
  onClose: () => void;
  onPublished: () => void;
}

type Mode = 'choose' | 'media' | 'text';

function readVideoDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => resolve(probe.duration);
    probe.onerror = () => resolve(0);
    probe.src = url;
  });
}

export const MomentCreator: React.FC<MomentCreatorProps> = ({ onClose, onPublished }) => {
  const [mode, setMode] = useState<Mode>('choose');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [text, setText] = useState('');
  const [bg, setBg] = useState(MOMENT_BACKGROUNDS[0]);
  const [overlay, setOverlay] = useState<MomentOverlay>({ filter: 'none', text_pos: 'bottom' });
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && progress === null) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, progress]);

  const pickFile = async (picked: File | undefined) => {
    if (!picked) return;
    setError(null);
    const isVideo = picked.type.startsWith('video/');
    const isImage = picked.type.startsWith('image/');
    if (!isVideo && !isImage) {
      setError('Escolha uma foto ou um vídeo.');
      return;
    }
    const url = URL.createObjectURL(picked);
    if (isVideo) {
      const duration = await readVideoDuration(url);
      if (duration > MAX_VIDEO_SECONDS + 0.5) {
        URL.revokeObjectURL(url);
        setError(`O vídeo do Momentum pode ter até ${MAX_VIDEO_SECONDS} segundos.`);
        return;
      }
    }
    setFile(picked);
    setPreviewUrl(url);
    setMediaType(isVideo ? 'video' : 'image');
    setMode('media');
  };

  // Público: todos os amigos ou só os melhores amigos (lista privada)
  const [audience, setAudience] = useState<'friends' | 'close_friends'>('friends');

  const publish = async () => {
    setError(null);
    try {
      if (mode === 'text') {
        if (!text.trim()) {
          setError('Escreva algo para o seu Momentum.');
          return;
        }
        setProgress(0);
        await momentsApi.create({ media_type: 'text', text: text.trim(), bg, audience });
      } else if (file) {
        setProgress(0);
        const uploaded = await uploadApi.upload(file, { context: 'moment', onProgress: setProgress });
        await momentsApi.create({
          media_url: uploaded.url,
          media_type: mediaType,
          text: text.trim() || undefined,
          overlay,
          audience,
        });
      } else {
        return;
      }
      onPublished();
    } catch (err: any) {
      setProgress(null);
      setError(err?.message || 'Não foi possível publicar o Momentum.');
    }
  };

  const publishing = progress !== null;
  const iconButton =
    'w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center cursor-pointer hover:bg-black/70 transition-colors';

  return (
    <div className="fixed inset-0 z-[120] bg-black text-white flex flex-col" role="dialog" aria-modal="true" aria-label="Criar Momentum">
      <div className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 z-10">
        <button type="button" onClick={mode === 'choose' || publishing ? onClose : () => setMode('choose')} className={iconButton} aria-label={mode === 'choose' ? 'Fechar' : 'Voltar'}>
          <span className="material-symbols-outlined text-[22px]">{mode === 'choose' ? 'close' : 'arrow_back'}</span>
        </button>
        <h2 className="text-sm font-semibold tracking-wide">Novo Momentum</h2>
        <div className="w-10" />
      </div>

      {mode === 'choose' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
          <p className="text-sm text-white/70 text-center max-w-xs mb-2">Some em 24 horas e só seus amigos veem.</p>
          <button type="button" onClick={() => cameraInputRef.current?.click()} className="w-full max-w-xs h-12 rounded-full border border-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-white hover:text-black transition-colors">
            <span className="material-symbols-outlined text-[20px]">photo_camera</span>
            Tirar foto ou gravar
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full max-w-xs h-12 rounded-full border border-white/40 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-[20px]">photo_library</span>
            Escolher da galeria
          </button>
          <button type="button" onClick={() => setMode('text')} className="w-full max-w-xs h-12 rounded-full border border-white/40 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-[20px]">text_fields</span>
            Só texto
          </button>
          <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
          <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      )}

      {mode === 'text' && (
        <>
          <div className="flex-1 min-h-0 relative" style={{ backgroundColor: bg }}>
            <textarea
              autoFocus
              value={text}
              maxLength={MAX_TEXT}
              onChange={(e) => setText(e.target.value)}
              aria-label="Texto do Momentum"
              className="absolute inset-0 w-full h-full resize-none bg-transparent outline-none text-center text-2xl sm:text-3xl font-semibold leading-snug p-8 pt-[20%]"
              style={{ color: MomentSlideTextColor(bg) }}
            />
          </div>
          <div className="px-4 py-3 flex items-center justify-center gap-3 bg-black">
            {MOMENT_BACKGROUNDS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setBg(color)}
                aria-label={`Fundo ${color}`}
                aria-pressed={bg === color}
                className={`w-8 h-8 rounded-full border-2 cursor-pointer ${bg === color ? 'border-white scale-110' : 'border-white/30'} transition-transform`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </>
      )}

      {mode === 'media' && previewUrl && (
        <>
          <div className="flex-1 min-h-0 relative">
            <MomentSlide
              mediaUrl={previewUrl}
              mediaType={mediaType}
              text={text.trim() || null}
              bg={null}
              overlay={overlay}
              loopVideo
            />
          </div>
          <div className="bg-black px-4 pt-3 flex flex-col gap-3">
            <input
              type="text"
              value={text}
              maxLength={MAX_TEXT}
              onChange={(e) => setText(e.target.value)}
              aria-label="Legenda do Momentum"
              className="w-full h-11 rounded-full bg-white/10 border border-white/20 px-4 text-sm outline-none focus:border-white"
            />
            <div className="flex gap-2 overflow-x-auto scrollbar-none" role="radiogroup" aria-label="Filtros">
              {MOMENT_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={(overlay.filter || 'none') === f.id}
                  onClick={() => setOverlay((o) => ({ ...o, filter: f.id }))}
                  className={`h-8 px-3 shrink-0 rounded-full text-xs font-semibold cursor-pointer border transition-colors ${
                    (overlay.filter || 'none') === f.id ? 'bg-white text-black border-white' : 'border-white/30 text-white/80 hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-white/70">
              <label className="flex items-center gap-2 flex-1">
                <span className="material-symbols-outlined text-[18px]">brightness_6</span>
                <input type="range" min={60} max={140} value={overlay.brightness ?? 100} onChange={(e) => setOverlay((o) => ({ ...o, brightness: Number(e.target.value) }))} aria-label="Brilho" className="flex-1 accent-white" />
              </label>
              <label className="flex items-center gap-2 flex-1">
                <span className="material-symbols-outlined text-[18px]">contrast</span>
                <input type="range" min={60} max={140} value={overlay.contrast ?? 100} onChange={(e) => setOverlay((o) => ({ ...o, contrast: Number(e.target.value) }))} aria-label="Contraste" className="flex-1 accent-white" />
              </label>
              <button
                type="button"
                onClick={() => setOverlay((o) => ({ ...o, text_pos: o.text_pos === 'top' ? 'center' : o.text_pos === 'center' ? 'bottom' : 'top' }))}
                aria-label="Posição da legenda"
                className="w-9 h-9 rounded-full border border-white/30 flex items-center justify-center cursor-pointer hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {overlay.text_pos === 'top' ? 'vertical_align_top' : overlay.text_pos === 'center' ? 'vertical_align_center' : 'vertical_align_bottom'}
                </span>
              </button>
            </div>
          </div>
        </>
      )}

      {mode !== 'choose' && (
        <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-black flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAudience((a) => (a === 'friends' ? 'close_friends' : 'friends'))}
            aria-pressed={audience === 'close_friends'}
            className={`h-11 px-4 rounded-full text-xs font-semibold cursor-pointer flex items-center gap-1.5 border ${
              audience === 'close_friends' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-transparent border-white/30 text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]" style={audience === 'close_friends' ? { fontVariationSettings: "'FILL' 1" } : undefined}>star</span>
            {audience === 'close_friends' ? 'Melhores amigos' : 'Amigos'}
          </button>
          {error && <p className="flex-1 text-xs text-red-300" role="alert">{error}</p>}
          {!error && <div className="flex-1" />}
          <button
            type="button"
            onClick={() => void publish()}
            disabled={publishing}
            className="h-11 px-6 rounded-full bg-white text-black text-sm font-semibold cursor-pointer disabled:opacity-60 flex items-center gap-2"
          >
            {publishing ? `Publicando${progress ? ` ${progress}%` : '...'}` : 'Publicar Momentum'}
          </button>
        </div>
      )}
      {mode === 'choose' && error && <p className="px-6 pb-6 text-xs text-red-300 text-center" role="alert">{error}</p>}
    </div>
  );
};

function MomentSlideTextColor(bg: string): string {
  const n = parseInt(bg.slice(1), 16);
  const luminance = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return luminance > 150 ? '#111111' : '#ffffff';
}
