import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authStorage } from '../lib/api';

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = authStorage.getUser();

  const handleLogout = () => {
    authStorage.clear();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="w-full glass-header sticky top-0 z-40 transition-colors">
      <div className="flex justify-between items-center w-full px-4 sm:px-6 py-3.5 max-w-[1240px] mx-auto gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-blue to-neon-cyan flex items-center justify-center shadow-glow-blue transition-transform group-hover:scale-105">
              <span className="text-white font-display font-bold text-lg lowercase">e</span>
            </div>
            <span className="text-xl font-display font-bold tracking-tight text-white group-hover:text-blue-400 transition-colors">
              espectro
            </span>
          </Link>

          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-xs text-neutral-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse"></span>
            liquid network
          </span>
        </div>

        {/* Central Nav Links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/"
            className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
              isActive('/')
                ? 'bg-white/[0.1] text-white shadow-sm border border-white/10'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            Feed
          </Link>
          <Link
            to="/comunidades"
            className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
              isActive('/comunidades')
                ? 'bg-white/[0.1] text-white shadow-sm border border-white/10'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            e/Comunidades
          </Link>
        </nav>

        {/* User Session / Trailing Controls */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2.5 bg-white/[0.04] border border-white/10 px-3 py-1.5 rounded-2xl shadow-glass">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-brand-blue to-purple-500 text-white flex items-center justify-center text-xs font-bold font-display uppercase shadow-sm">
                {user.username.charAt(0)}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-white leading-tight font-display">
                  @{user.username}
                </span>
                <span className="text-[10px] text-neutral-400 leading-tight">conectado</span>
              </div>
              <button
                onClick={handleLogout}
                className="text-neutral-400 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-white/[0.05] ml-1 cursor-pointer"
                title="Sair"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="btn-glass text-xs sm:text-sm font-medium px-4 py-1.5 rounded-xl cursor-pointer"
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => navigate('/login?tab=cadastro')}
                className="btn-primary-blue text-xs sm:text-sm font-medium px-4 py-1.5 rounded-xl cursor-pointer shadow-glow-blue"
              >
                Criar Conta
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
