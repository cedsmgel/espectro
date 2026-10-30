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
    <aside className="hidden md:flex flex-col gap-5 sticky top-20">
      {/* Navigation Shell Panel (Stitch Specification) */}
      <nav className="glass-surface rounded-2xl p-3 flex flex-col gap-1.5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.4)]">
        {/* Item: Início */}
        <Link
          to="/"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-150 ${
            isActive('/') && !location.search
              ? 'bg-white/10 text-cyan-300 border border-cyan-400/30 shadow-[0_0_12px_rgba(76,215,246,0.15)]'
              : 'text-neutral-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">home</span>
          <span className="text-sm font-semibold">Início</span>
        </Link>

        {/* Item: e/Comunidades */}
        <Link
          to="/comunidades"
          className={`flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-colors duration-150 ${
            isActive('/comunidades')
              ? 'bg-white/10 text-cyan-300 border border-cyan-400/30'
              : 'text-neutral-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[22px]">forum</span>
            <span className="text-sm">e/Comunidades</span>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-400/15 text-cyan-300 border border-cyan-400/30">
            {communities.length > 0 ? `${communities.length} ativas` : '12 novas'}
          </span>
        </Link>

        {/* Item: Scraps */}
        <Link
          to="/?type=scrap"
          className={`flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-colors duration-150 ${
            location.search.includes('type=scrap')
              ? 'bg-white/10 text-cyan-300 border border-cyan-400/30'
              : 'text-neutral-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[22px]">mark_chat_unread</span>
            <span className="text-sm">Scraps</span>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 shadow-[0_0_8px_rgba(251,191,36,0.2)]">
            4
          </span>
        </Link>

        {/* Item: Mensagens */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-neutral-400 font-medium hover:bg-white/5 hover:text-white transition-colors duration-150 cursor-pointer">
          <span className="material-symbols-outlined text-[22px]">mail</span>
          <span className="text-sm">Mensagens</span>
        </div>

        {/* Item: Salvos */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-neutral-400 font-medium hover:bg-white/5 hover:text-white transition-colors duration-150 cursor-pointer">
          <span className="material-symbols-outlined text-[22px]">bookmark</span>
          <span className="text-sm">Salvos</span>
        </div>

        {/* Item: Explorar */}
        <Link
          to="/comunidades"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-neutral-400 font-medium hover:bg-white/5 hover:text-white transition-colors duration-150"
        >
          <span className="material-symbols-outlined text-[22px]">explore</span>
          <span className="text-sm">Explorar</span>
        </Link>
      </nav>

      {/* Nostalgic Reputation & Identity Card (Stitch Exact Component) */}
      <div className="glass-surface rounded-2xl p-4 flex flex-col gap-4 relative overflow-hidden">
        {/* Subtle top cyan rim glow */}
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-cyan-400/15 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3.5">
          <div className="relative w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-400 shadow-[0_0_14px_rgba(76,215,246,0.3)]">
            <div className="w-full h-full bg-[#111318] rounded-full flex items-center justify-center text-white font-display font-bold text-lg uppercase">
              {user ? user.username.charAt(0) : 'E'}
            </div>
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#111318] shadow-[0_0_6px_#10b981]" />
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-sm font-display font-bold text-white truncate">
              {user ? user.username : 'Lucas Vance'}
            </h2>
            <p className="text-xs text-neutral-400 truncate">
              {user ? `@${user.username}` : '@vance'}
            </p>
          </div>
        </div>

        {/* Karma Score Tracker */}
        <div className="glass-recessed rounded-xl p-2.5 flex items-center justify-between border border-white/5">
          <div className="flex items-center gap-1.5 text-cyan-300 text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            <span>4.892 Karma</span>
          </div>
          <span className="text-[10px] text-neutral-400">Top 3% Feed</span>
        </div>

        {/* Nostalgic Orkut-Inspired Badges */}
        <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            Reputação Social
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-amber-300">
                <span className="material-symbols-outlined text-[14px]">star</span>
                ★ 98% Confiável
              </span>
              <span className="text-[10px] text-neutral-400">votos (420)</span>
            </div>
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
                🔥 85% Legal
              </span>
              <span className="text-[10px] text-neutral-400">votos (310)</span>
            </div>
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <span className="material-symbols-outlined text-[14px]">diamond</span>
                💎 Fã de 12
              </span>
              <span className="text-[10px] text-neutral-400">comunidades</span>
            </div>
          </div>
        </div>

        {/* Left Rail Footer Links */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
          <button
            type="button"
            onClick={() => navigate('/comunidades')}
            className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">settings</span>
            <span>Configurações</span>
          </button>
          {user ? (
            <button
              type="button"
              onClick={() => {
                authStorage.clear();
                navigate('/login');
              }}
              className="flex items-center gap-1.5 text-rose-400/80 hover:text-rose-300 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span>Sair</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-cyan-400 hover:underline cursor-pointer font-semibold"
            >
              Entrar
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
