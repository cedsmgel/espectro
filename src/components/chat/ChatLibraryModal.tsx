import React, { useEffect, useState } from 'react';
import { chatExtrasApi, LibraryItem } from '../../lib/api';
import { ModalShell } from './ModalShell';
import { ThumbImg } from '../ThumbImg';
import { PosterVideo } from '../PosterVideo';

type Section = 'media' | 'links' | 'docs';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'media', label: 'Mídias', icon: 'photo_library' },
  { id: 'links', label: 'Links', icon: 'link' },
  { id: 'docs', label: 'Docs', icon: 'description' },
];

interface Props {
  onClose: () => void;
  // Conversa atual; sem ela mostra as mídias de todas as conversas
  scope?: { kind: 'dm' | 'group'; id: number; name: string };
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

// Mídias, links e documentos enviados e recebidos, desta conversa ou de todas
export const ChatLibraryModal: React.FC<Props> = ({ onClose, scope }) => {
  const [section, setSection] = useState<Section>('media');
  const [all, setAll] = useState(!scope);
  const [items, setItems] = useState<LibraryItem[] | null>(null);

  useEffect(() => {
    let active = true;
    setItems(null);
    chatExtrasApi
      .library(section, all || !scope ? undefined : { kind: scope.kind, id: scope.id })
      .then((res) => active && setItems(res))
      .catch(() => active && setItems([]));
    return () => {
      active = false;
    };
  }, [section, all, scope]);

  return (
    <ModalShell title="Mídias, links e documentos" onClose={onClose}>
      {scope && (
        <div className="flex gap-1 p-1 mb-3 rounded-full bg-surface-container-low text-xs font-semibold">
          {[
            { v: false, label: scope.name.length > 18 ? `${scope.name.slice(0, 17)}…` : scope.name },
            { v: true, label: 'Todas as conversas' },
          ].map((opt) => (
            <button
              key={String(opt.v)}
              type="button"
              onClick={() => setAll(opt.v)}
              className={`flex-1 h-8 rounded-full cursor-pointer transition-colors ${
                all === opt.v ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div role="tablist" className="flex border-b border-outline-variant mb-3">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={section === s.id}
            onClick={() => setSection(s.id)}
            className={`flex-1 h-10 flex items-center justify-center gap-1.5 text-xs font-semibold border-b-2 -mb-px cursor-pointer transition-colors ${
              section === s.id ? 'border-on-surface text-on-surface' : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {items === null ? (
        <p className="text-xs text-on-surface-variant text-center py-10">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-on-surface-variant text-center py-10">
          {section === 'media' ? 'Nenhuma foto ou vídeo ainda.' : section === 'links' ? 'Nenhum link compartilhado ainda.' : 'Nenhum documento ainda.'}
        </p>
      ) : section === 'media' ? (
        <ul className="grid grid-cols-3 gap-1.5">
          {items.map((item) => (
            <li key={`${item.kind}-${item.message_id}`} className="relative aspect-square rounded-xl overflow-hidden bg-surface-container-low">
              <a href={item.media_url || '#'} target="_blank" rel="noopener noreferrer" title={`${item.chat_name} · ${formatDate(item.created_at)}`}>
                {item.message_type === 'video' ? (
                  <>
                    <PosterVideo src={item.media_url || ""} className="w-full h-full object-cover" />
                    <span className="material-symbols-outlined absolute inset-0 m-auto w-fit h-fit text-white text-[28px] drop-shadow">play_circle</span>
                  </>
                ) : (
                  <ThumbImg src={item.media_url || ""} className="w-full h-full object-cover" />
                )}
              </a>
              {all && (
                <span className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 text-[9px] font-semibold text-white bg-black/50 truncate">{item.chat_name}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item, i) => (
            <li key={`${item.kind}-${item.message_id}-${i}`}>
              <a
                href={section === 'links' ? item.href : item.media_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-container-low transition-colors"
              >
                <span className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                  <span className="material-symbols-outlined text-[20px]">{section === 'links' ? 'link' : 'description'}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-on-surface truncate">
                    {section === 'links' ? item.href : item.content || 'Documento'}
                  </span>
                  <span className="block text-[11px] text-on-surface-variant truncate">
                    {item.chat_name} · @{item.sender_username} · {formatDate(item.created_at)}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
};
