import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authStorage, Community } from '../lib/api';

interface SidebarNavProps {
  communities?: Community[];
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ communities = [] }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = authStorage.getUser();

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="space-y-4">
      {/* Profile Card / User Masthead */}
      <div className="glass-panel rounded-2xl p-4 transition-all">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative">
            {user ? (
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-blue to-neon-cyan p-0.5 shadow-glow-blue">
                <div className="w-full h-full bg-[#121620] rounded-[14px] flex items-center justify-center text-white font-display font-bold text-lg uppercase">
                  {user.username.charAt(0)}
                </div>
              </div>
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-neutral-400">
                <span className="material-symbols-outlined text-2xl">person</span>
              </div>
            )}
            <span
              className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#121620] ${
                user ? 'bg-neon-green shadow-glow-green' : 'bg-neutral-500'
              }`}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-base text-white truncate">
              {user ? `@${user.username}` : 'Visitante'}
            </h3>
            <p className="text-xs text-neutral-400 truncate">
              {user ? 'Membro ativo' : 'Navegando como visitante'}
            </p>
          </div>
        </div>

        {user ? (
          <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-3 gap-1 text-center">
            <div className="bg-white/[0.03] p-1.5 rounded-xl border border-white/[0.04]">
              <span className="text-[10px] text-neutral-400 block font-medium">Reputação</span>
              <span className="text-xs font-bold text-neon-green">100%</span>
            </div>
            <div className="bg-white/[0.03] p-1.5 rounded-xl border border-white/[0.04]">
              <span className="text-[10px] text-neutral-400 block font-medium">Karma</span>
              <span className="text-xs font-bold text-brand-blue">+42</span>
            </div>
            <div className="bg-white/[0.03] p-1.5 rounded-xl border border-white/[0.04]">
              <span className="text-[10px] text-neutral-400 block font-medium">Vibe</span>
              <span className="text-xs font-bold text-cyan-400">Zen</span>
            </div>
          </div>
        ) : (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full btn-primary-blue text-xs font-semibold py-2 rounded-xl cursor-pointer"
            >
              Fazer Login / Cadastrar
            </button>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <div className="glass-panel rounded-2xl p-2.5">
        <nav className="space-y-1">
          <Link
            to="/"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive('/') && !location.search
                ? 'bg-brand-blue/15 text-blue-400 border border-brand-blue/30 font-semibold'
                : 'text-neutral-300 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">dynamic_feed</span>
            <span>Feed Principal</span>
          </Link>

          <Link
            to="/comunidades"
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive('/comunidades')
                ? 'bg-brand-blue/15 text-blue-400 border border-brand-blue/30 font-semibold'
                : 'text-neutral-300 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <span className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px]">groups</span>
              <span>e/Comunidades</span>
            </span>
            <span className="text-xs bg-white/[0.06] text-neutral-400 px-2 py-0.5 rounded-md font-mono">
              {communities.length}
            </span>
          </Link>

          <Link
            to="/?type=scrap"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              location.search.includes('type=scrap')
                ? 'bg-brand-blue/15 text-blue-400 border border-brand-blue/30 font-semibold'
                : 'text-neutral-300 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">chat_bubble_outline</span>
            <span>Scraps &amp; Recados</span>
          </Link>
        </nav>
      </div>

      {/* Comunidades Rápidas */}
      {communities.length > 0 && (
        <div className="glass-panel rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-display font-bold text-neutral-400 tracking-wider uppercase">
              Comunidades
            </span>
            <Link to="/comunidades" className="text-xs text-brand-blue hover:text-blue-300 font-medium">
              Explorar »
            </Link>
          </div>
          <div className="space-y-1">
            {communities.slice(0, 5).map((c) => {
              const slug = c.slug || c.id;
              return (
                <Link
                  key={c.id}
                  to={`/e/${slug}`}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-neutral-300 hover:text-white hover:bg-white/[0.06] transition-all group"
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-blue/60 group-hover:bg-brand-blue"></span>
                    <span className="truncate font-medium">e/{c.name}</span>
                  </span>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    {c.members_count}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Modern Liquid Mini Player */}
      <div className="glass-panel rounded-2xl p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs text-neutral-400 font-medium">
          <span className="flex items-center gap-1.5 text-blue-400">
            <span className="material-symbols-outlined text-[16px] animate-pulse">equalizer</span>
            Tocando Agora
          </span>
          <span className="text-[10px] font-mono text-neutral-500">320kbps</span>
        </div>
        <p className="text-xs font-display font-semibold text-white truncate">
          CPM 22 — Um Minuto Para o Fim do Mundo
        </p>
        <div className="w-full bg-white/[0.08] h-1.5 rounded-full overflow-hidden">
          <div className="bg-gradient-to-r from-brand-blue to-neon-cyan h-full w-2/3 rounded-full"></div>
        </div>
        <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
          <span>02:14</span>
          <span>03:20</span>
        </div>
      </div>
    </aside>
  );
};
