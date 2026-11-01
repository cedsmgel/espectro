import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatExtrasApi, StarredItem } from '../../lib/api';
import { ModalShell } from './ModalShell';

const LABEL: Record<string, string> = { image: 'Foto', video: 'Vídeo', gif: 'GIF', sticker: 'Figurinha', audio: 'Mensagem de voz', file: 'Documento' };

// Mensagens favoritas de todas as conversas; tocar abre a conversa
export const StarredModal: React.FC<{ onClose: () => void; onOpenDirect: (friendId: number, username: string) => void }> = ({ onClose, onOpenDirect }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<StarredItem[] | null>(null);

  useEffect(() => {
    chatExtrasApi.starred().then(setItems).catch(() => setItems([]));
  }, []);

  const unstar = (item: StarredItem) => {
    setItems((prev) => (prev ? prev.filter((i) => !(i.kind === item.kind && i.message_id === item.message_id)) : prev));
    void chatExtrasApi.setStarred(item.kind, item.message_id, false).catch(() => {});
  };

  const open = (item: StarredItem) => {
    onClose();
    if (item.kind === 'group') navigate(`/grupos/${item.chat_id}`);
    else onOpenDirect(item.chat_id, item.chat_name);
  };

  return (
    <ModalShell title="Mensagens favoritas" onClose={onClose}>
      {items === null ? (
        <p className="text-xs text-on-surface-variant text-center py-10">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-10">
          <span className="material-symbols-outlined text-[36px] text-on-surface-variant/60">star</span>
          <p className="text-xs text-on-surface-variant mt-2">Nenhuma mensagem favorita. Use o menu de uma mensagem para favoritar.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={`${item.kind}-${item.message_id}`} className="rounded-2xl bg-surface-container-low p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <button type="button" onClick={() => open(item)} className="text-[11px] font-bold text-primary truncate cursor-pointer hover:underline text-left">
                  {item.kind === 'group' ? item.chat_name : `@${item.chat_name}`} · @{item.sender_username}
                </button>
                <button type="button" onClick={() => unstar(item)} aria-label="Remover dos favoritos" className="text-amber-500 cursor-pointer shrink-0">
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                </button>
              </div>
              {item.message_type === 'image' || item.message_type === 'gif' || item.message_type === 'sticker' ? (
                item.media_url ? <img src={item.media_url} alt="" className="max-h-40 rounded-xl" /> : <p className="text-xs italic">{LABEL[item.message_type]}</p>
              ) : (
                <p className="text-xs text-on-surface whitespace-pre-wrap break-words">{item.content || LABEL[item.message_type] || 'Mensagem'}</p>
              )}
              <p className="text-[10px] text-on-surface-variant mt-1">{new Date(item.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
};
