import React, { useEffect, useState } from 'react';
import { messageSearchApi, MessageSearchResponse } from '../../lib/api';

interface MessageSearchResultsProps {
  query: string;
  onOpenDirect: (friendId: number) => void;
  onOpenGroup: (groupId: number) => void;
}

// Trecho da mensagem ao redor do que foi procurado, com o termo em destaque
function renderSnippet(content: string, query: string): React.ReactNode {
  const index = content.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return content.slice(0, 90);
  const start = Math.max(0, index - 24);
  const end = Math.min(content.length, index + query.length + 56);
  return (
    <>
      {start > 0 && '…'}
      {content.slice(start, index)}
      <mark className="bg-primary/25 text-on-surface rounded px-0.5">{content.slice(index, index + query.length)}</mark>
      {content.slice(index + query.length, end)}
      {end < content.length && '…'}
    </>
  );
}

function formatWhen(value: string): string {
  const date = new Date(value);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Busca de texto em todas as conversas e grupos (aparece na busca da lista)
export const MessageSearchResults: React.FC<MessageSearchResultsProps> = ({ query, onOpenDirect, onOpenGroup }) => {
  const [results, setResults] = useState<MessageSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const found = await messageSearchApi.messages(trimmed);
        if (active) setResults(found);
      } catch {
        if (active) setResults(null);
      } finally {
        if (active) setLoading(false);
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [trimmed]);

  if (trimmed.length < 2) return null;
  const total = (results?.messages.length ?? 0) + (results?.groups.length ?? 0);
  if (!loading && total === 0) return null;

  return (
    <div className="mt-2 border-t border-outline-variant pt-2">
      <h3 className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Mensagens</h3>
      {loading && <p className="px-3 py-2 text-xs text-on-surface-variant">Procurando...</p>}

      {results?.messages.map((m) => (
        <button
          key={`d-${m.id}`}
          type="button"
          onClick={() => onOpenDirect(m.friend_id)}
          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-surface-container-low/60 cursor-pointer"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold truncate">@{m.friend_username}</span>
            <span className="text-[11px] text-on-surface-variant shrink-0">{formatWhen(m.created_at)}</span>
          </span>
          <span className="block text-xs text-on-surface-variant mt-0.5 break-words">{renderSnippet(m.content, trimmed)}</span>
        </button>
      ))}

      {results?.groups.map((m) => (
        <button
          key={`g-${m.id}`}
          type="button"
          onClick={() => onOpenGroup(m.group_id)}
          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-surface-container-low/60 cursor-pointer"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold truncate">{m.group_name}</span>
            <span className="text-[11px] text-on-surface-variant shrink-0">{formatWhen(m.created_at)}</span>
          </span>
          <span className="block text-xs text-on-surface-variant mt-0.5 break-words">
            {m.sender_username ? `@${m.sender_username}: ` : ''}
            {renderSnippet(m.content, trimmed)}
          </span>
        </button>
      ))}
    </div>
  );
};
