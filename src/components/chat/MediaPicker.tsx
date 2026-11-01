import React, { useEffect, useState } from 'react';
import { authStorage } from '../../lib/api';

export interface MediaChoice {
  type: 'gif' | 'sticker';
  url: string;
}

interface MediaPickerProps {
  onSelect: (choice: MediaChoice) => void;
  onClose: () => void;
}

interface GifItem {
  id: string;
  title: string;
  preview: string;
  url: string;
}

interface Category {
  name: string;
  query: string;
  preview: string | null;
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${authStorage.getToken() || ''}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Falha ao carregar.');
  return data as T;
}

// Seletor de GIFs e figurinhas (GIPHY) com categorias, busca e aba própria de figurinhas
export const MediaPicker: React.FC<MediaPickerProps> = ({ onSelect, onClose }) => {
  const [tab, setTab] = useState<'gifs' | 'stickers'>('gifs');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string>(''); // categoria/termo atual
  const [items, setItems] = useState<GifItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ categories: Category[] }>('/api/gifs?categories=1')
      .then((d) => setCategories(d.categories))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      const q = query.trim() || active;
      api<{ results: GifItem[] }>(`/api/gifs?type=${tab}&q=${encodeURIComponent(q)}`)
        .then((d) => {
          if (!cancelled) setItems(d.results);
        })
        .catch((err: Error) => {
          if (!cancelled) {
            setItems([]);
            setError(err.message);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, query ? 350 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tab, query, active]);

  return (
    <div className="w-[min(92vw,22rem)] rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-2xl overflow-hidden flex flex-col">
      <div className="flex items-center gap-1 p-2 border-b border-outline-variant">
        {(['gifs', 'stickers'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setQuery('');
            }}
            className={`flex-1 h-8 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
              tab === t ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {t === 'gifs' ? 'GIFs' : 'Figurinhas'}
          </button>
        ))}
        <button type="button" onClick={onClose} aria-label="Fechar" className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container cursor-pointer">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div className="p-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive('');
          }}
          placeholder={tab === 'gifs' ? 'Buscar GIFs' : 'Buscar figurinhas'}
          className="w-full h-8 px-3 rounded-full bg-surface-container-low text-xs text-on-surface placeholder:text-on-surface-variant outline-none"
        />
      </div>

      {!query && categories.length > 0 && (
        <div className="flex gap-1.5 px-2 pb-2 overflow-x-auto scrollbar-none">
          {categories.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => setActive(c.query)}
              className={`shrink-0 px-2.5 h-7 rounded-full text-[11px] font-medium cursor-pointer whitespace-nowrap ${
                active === c.query ? 'bg-primary-container text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5 p-2 h-64 overflow-y-auto content-start">
        {loading && <p className="col-span-2 text-center text-xs text-on-surface-variant py-8">Carregando...</p>}
        {!loading && error && <p className="col-span-2 text-center text-xs text-on-surface-variant py-8">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="col-span-2 text-center text-xs text-on-surface-variant py-8">Nada encontrado.</p>
        )}
        {!loading &&
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect({ type: tab === 'gifs' ? 'gif' : 'sticker', url: item.url })}
              className="rounded-xl overflow-hidden bg-surface-container aspect-square cursor-pointer hover:opacity-80 transition-opacity"
              title={item.title}
            >
              <img decoding="async" src={item.preview} alt={item.title} loading="lazy" className="w-full h-full object-contain" />
            </button>
          ))}
      </div>

      <p className="text-[10px] text-on-surface-variant text-right px-3 pb-2">Powered by GIPHY</p>
    </div>
  );
};
