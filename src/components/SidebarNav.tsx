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
    <aside className="space-y-space-md">
      {/* Profile Card / User Masthead */}
      <div className="bg-surface-container-lowest rounded classic-bevel-border overflow-hidden">
        <div className="retro-header-strip px-space-sm py-1.5 flex items-center justify-between">
          <span className="text-label-sm font-label-sm text-primary uppercase tracking-wide">
            {user ? 'meu perfil' : 'visitante'}
          </span>
          <span className="material-symbols-outlined text-primary text-[14px]">account_box</span>
        </div>

        <div className="p-space-md text-center">
          <div className="relative inline-block mx-auto mb-space-sm">
            <div className="p-1 bg-surface-container-lowest border-2 border-outline-variant shadow-sm rounded-sm">
              {user ? (
                <div className="w-24 h-28 bg-gradient-to-b from-[#3B65BE] to-[#1F3D7A] flex flex-col items-center justify-center text-on-primary font-bold shadow-inner">
                  <span className="text-3xl uppercase tracking-wider">{user.username.charAt(0)}</span>
                  <span className="text-[10px] font-normal opacity-90 mt-1">membro</span>
                </div>
              ) : (
                <div className="w-24 h-28 bg-surface-container-high flex flex-col items-center justify-center text-secondary border border-dashed border-outline-variant">
                  <span className="material-symbols-outlined text-4xl">person</span>
                  <span className="text-[10px] uppercase font-bold mt-1">visitante</span>
                </div>
              )}
            </div>
            <span
              className={`absolute bottom-1.5 right-1.5 text-[8px] font-bold px-1 py-0.5 rounded shadow ${
                user ? 'bg-[#62B33C] text-white' : 'bg-secondary text-white'
              }`}
            >
              {user ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <h2 className="text-headline-sm font-headline-sm text-primary leading-tight">
            {user ? `@${user.username}` : 'Visitante'}
          </h2>

          {user ? (
            <div className="mt-2 text-left bg-surface-bright p-2 rounded border border-outline-variant space-y-1 text-body-sm">
              <div className="flex justify-between items-center text-label-sm text-secondary">
                <span>Confiável:</span>
                <span className="text-[#E9A825]">★★★</span>
              </div>
              <div className="flex justify-between items-center text-label-sm text-secondary">
                <span>Legal:</span>
                <span className="text-[#62B33C]">★★★</span>
              </div>
              <div className="flex justify-between items-center text-label-sm text-secondary">
                <span>Sexy:</span>
                <span className="text-[#D94343]">★★★</span>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-center">
              <p className="text-[11px] text-secondary mb-2">Conecte-se para postar e entrar em comunidades</p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full retro-btn-primary text-white text-label-sm py-1 rounded font-bold cursor-pointer shadow"
              >
                Entrar / Cadastrar
              </button>
            </div>
          )}
        </div>

        {/* Navigation Links: Início, e/Comunidades, Scraps */}
        <div className="border-t border-outline-variant bg-surface-container-low px-space-sm py-space-sm">
          <ul className="space-y-1 text-body-sm font-body-sm">
            <li className={isActive('/') && !location.search ? 'bg-surface-container-highest rounded border border-outline-variant font-bold' : ''}>
              <Link to="/" className="flex items-center gap-2 py-1 px-1.5 text-primary hover:bg-surface-container rounded transition-colors">
                <span className="material-symbols-outlined text-[16px]">home</span>
                <span>Início</span>
              </Link>
            </li>
            <li className={isActive('/comunidades') ? 'bg-surface-container-highest rounded border border-outline-variant font-bold' : ''}>
              <Link to="/comunidades" className="flex items-center justify-between py-1 px-1.5 text-primary hover:bg-surface-container rounded transition-colors">
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">groups</span>
                  <span>e/Comunidades</span>
                </span>
                <span className="text-[11px] text-secondary">({communities.length})</span>
              </Link>
            </li>
            <li className={location.search.includes('type=scrap') ? 'bg-surface-container-highest rounded border border-outline-variant font-bold' : ''}>
              <Link to="/?type=scrap" className="flex items-center gap-2 py-1 px-1.5 text-primary hover:bg-surface-container rounded transition-colors">
                <span className="material-symbols-outlined text-[16px]">chat</span>
                <span>Scraps (Recados)</span>
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Comunidades em Destaque */}
      {communities.length > 0 && (
        <div className="bg-surface-container-lowest rounded classic-bevel-border overflow-hidden">
          <div className="retro-header-strip px-space-sm py-1.5 flex items-center justify-between">
            <span className="text-label-sm font-label-sm text-primary uppercase font-bold tracking-wide">
              e/comunidades
            </span>
            <Link to="/comunidades" className="text-[11px] text-primary hover:underline font-bold">
              ver todas
            </Link>
          </div>
          <div className="p-2 space-y-1 text-body-sm">
            {communities.slice(0, 5).map((c) => {
              const slug = c.slug || c.id;
              return (
                <Link
                  key={c.id}
                  to={`/e/${slug}`}
                  className="flex items-center justify-between p-1 rounded hover:bg-surface-container transition-colors group"
                >
                  <span className="flex items-center gap-1.5 truncate group-hover:text-primary">
                    <span className="material-symbols-outlined text-secondary text-[14px]">groups</span>
                    <span className="truncate">e/{c.name}</span>
                  </span>
                  <span className="text-[10px] text-secondary font-mono">
                    {c.members_count}m
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Winamp Audio Widget */}
      <div className="bg-surface-container-lowest rounded classic-bevel-border p-space-sm text-body-sm font-body-sm">
        <div className="flex items-center gap-1.5 text-primary font-bold text-label-sm uppercase mb-1">
          <span className="material-symbols-outlined text-[14px]">headphones</span>
          Tocando no Perfil
        </div>
        <p className="text-on-surface font-semibold truncate text-[12px]">CPM 22 - Um Minuto Para o Fim do Mundo</p>
        <div className="w-full bg-surface-container h-1.5 rounded-full mt-1.5 overflow-hidden">
          <div className="bg-primary h-full w-2/3"></div>
        </div>
        <div className="flex justify-between text-[9px] text-secondary mt-0.5">
          <span>02:14</span>
          <span>03:20</span>
        </div>
      </div>
    </aside>
  );
};
