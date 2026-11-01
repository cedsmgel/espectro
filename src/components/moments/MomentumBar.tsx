import React, { useCallback, useEffect, useState } from 'react';
import { authStorage, MomentGroup, momentsApi } from '../../lib/api';
import { MomentCreator } from './MomentCreator';
import { MomentViewerScreen } from './MomentViewer';

// Fileira de Momentum acima do feed: o meu e os dos amigos; o contorno cheio marca o que ainda não vi
export const MomentumBar: React.FC = () => {
  const user = authStorage.getUser();
  const [groups, setGroups] = useState<MomentGroup[]>([]);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setGroups(await momentsApi.list());
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const mine = groups.find((g) => g.user_id === user?.id);
  const friends = groups.filter((g) => g.user_id !== user?.id);
  const viewerGroups = groups;

  const avatar = (username: string, url: string | null, size: string) => (
    <div className={`${size} rounded-full bg-surface-container-low flex items-center justify-center overflow-hidden`}>
      {url ? <img loading="lazy" decoding="async" src={url} alt="" className="w-full h-full object-cover" /> : <span className="text-lg font-bold text-on-surface uppercase">{username.charAt(0)}</span>}
    </div>
  );

  return (
    <>
      <div className="flex items-start gap-4 overflow-x-auto px-3 sm:px-0 py-1 scrollbar-none">
        {/* Seu Momentum: com Momentum ativo abre o visualizador; o + sempre cria */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => (mine ? setViewing(groups.indexOf(mine)) : setCreating(true))}
              aria-label={mine ? 'Ver seu Momentum' : 'Criar Momentum'}
              className={`rounded-full p-[2px] cursor-pointer hover:scale-105 transition-transform ${mine ? 'border-2 border-on-surface' : 'border-2 border-transparent'}`}
            >
              <div className="rounded-full bg-surface p-[2px]">{avatar(user?.username || '?', user?.avatar_url ?? null, 'w-14 h-14')}</div>
            </button>
            <button
              type="button"
              onClick={() => setCreating(true)}
              aria-label="Criar Momentum"
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-xs font-bold ring-2 ring-surface cursor-pointer"
            >
              +
            </button>
          </div>
          <span className="text-[11px] font-medium text-on-surface text-center max-w-[68px] truncate">Seu Momentum</span>
        </div>

        {friends.map((g) => (
          <button
            key={g.user_id}
            type="button"
            onClick={() => setViewing(groups.indexOf(g))}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
            aria-label={`Ver Momentum de @${g.username}`}
          >
            <div className={`rounded-full p-[2px] border-2 group-hover:scale-105 transition-transform ${g.all_viewed ? 'border-outline-variant' : g.items.some((i) => i.audience === 'close_friends' && !i.viewed) ? 'border-emerald-500' : 'border-on-surface'}`}>
              <div className="rounded-full bg-surface p-[2px]">{avatar(g.username, g.avatar_url, 'w-14 h-14')}</div>
            </div>
            <span className={`text-[11px] text-center max-w-[68px] truncate ${g.all_viewed ? 'text-on-surface-variant' : 'font-semibold text-on-surface'}`}>{g.username}</span>
          </button>
        ))}
      </div>

      {creating && (
        <MomentCreator
          onClose={() => setCreating(false)}
          onPublished={() => {
            setCreating(false);
            void load();
          }}
        />
      )}
      {viewing !== null && user && (
        <MomentViewerScreen groups={viewerGroups} startGroup={viewing} meId={user.id} onClose={() => { setViewing(null); void load(); }} onChanged={() => {}} />
      )}
    </>
  );
};
