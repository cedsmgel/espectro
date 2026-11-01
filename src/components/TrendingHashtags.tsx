import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { hashtagsApi } from '../lib/api';

// Hashtags mais usadas na última semana (aba "Em Alta" do feed)
export const TrendingHashtags: React.FC = () => {
  const [tags, setTags] = useState<Array<{ tag: string; posts: number }> | null>(null);

  useEffect(() => {
    hashtagsApi.trending(10).then(setTags).catch(() => setTags([]));
  }, []);

  if (!tags || tags.length === 0) return null;

  return (
    <section aria-label="Hashtags em alta" className="flex flex-col gap-2 py-3 border-b border-outline-variant">
      <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Hashtags em alta</h2>
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {tags.map((t) => (
          <Link
            key={t.tag}
            to={`/tag/${encodeURIComponent(t.tag)}`}
            className="shrink-0 h-9 px-4 rounded-full border border-outline-variant text-sm font-semibold flex items-center gap-2 hover:border-on-surface transition-colors"
          >
            #{t.tag}
            <span className="text-xs font-normal text-on-surface-variant">{t.posts}</span>
          </Link>
        ))}
      </div>
    </section>
  );
};
