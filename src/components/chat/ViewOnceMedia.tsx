import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { chatExtrasApi } from '../../lib/api';

interface Props {
  kind: 'dm' | 'group';
  messageId: number;
  type: 'image' | 'video';
  mine: boolean;
  viewed: boolean;
  onOpened: () => void;
}

// Foto ou vídeo de visualização única: cada destinatário abre uma vez; quem enviou só vê o aviso
export const ViewOnceMedia: React.FC<Props> = ({ kind, messageId, type, mine, viewed, onOpened }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = type === 'video' ? 'Vídeo temporário' : 'Foto temporária';

  const open = async () => {
    if (mine || viewed || busy || messageId <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await chatExtrasApi.openViewOnce(kind, messageId);
      setUrl(res.media_url);
      onOpened();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível abrir.');
      onOpened();
    } finally {
      setBusy(false);
    }
  };

  const close = () => setUrl(null);

  return (
    <>
      <button
        type="button"
        onClick={() => void open()}
        disabled={mine || viewed || busy}
        className="flex items-center gap-2.5 min-w-[150px] text-left cursor-pointer disabled:cursor-default"
      >
        <span className="w-9 h-9 rounded-full border-2 border-dashed border-current flex items-center justify-center shrink-0 opacity-80">
          <span className="material-symbols-outlined text-[18px]">{viewed || mine ? 'timer' : type === 'video' ? 'videocam' : 'photo_camera'}</span>
        </span>
        <span className="text-xs font-semibold">
          {mine ? `${label} enviada` : viewed ? 'Aberta' : busy ? 'Abrindo...' : `${label} · toque para ver`}
        </span>
      </button>
      {error && <span className="block text-[10px] mt-1 opacity-80">{error}</span>}
      {url &&
        createPortal(
          <div className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4" onClick={close}>
            <button type="button" onClick={close} aria-label="Fechar" className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
            {type === 'video' ? (
              <video src={url} controls autoPlay playsInline controlsList="nodownload" onClick={(e) => e.stopPropagation()} className="max-h-[85vh] max-w-full rounded-2xl" />
            ) : (
              <img src={url} alt="" draggable={false} onContextMenu={(e) => e.preventDefault()} className="max-h-[85vh] max-w-full object-contain rounded-2xl select-none" />
            )}
            <p className="absolute bottom-6 text-xs text-white/70">Você só pode ver esta mídia uma vez.</p>
          </div>,
          document.body
        )}
    </>
  );
};
