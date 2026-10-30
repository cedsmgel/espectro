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
    <header className="w-full bg-surface-container-high border-b border-outline-variant shadow-sm sticky top-0 z-30">
      <div className="flex justify-between items-center w-full px-space-lg py-space-sm max-w-[1180px] mx-auto gap-space-md">
        {/* Brand Logo & Motto */}
        <div className="flex items-center gap-space-sm flex-shrink-0">
          <Link to="/" className="flex items-center gap-space-xs group">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shadow-inner border border-primary">
              <span className="text-on-primary font-bold text-headline-sm lowercase tracking-tighter">e</span>
            </div>
            <span className="text-headline-lg font-headline-lg font-bold lowercase tracking-tight text-primary font-retro-brand select-none">
              espectro
            </span>
          </Link>
          <span className="hidden md:inline-block text-outline text-label-md font-label-md pl-space-xs border-l border-outline-variant italic">
            conecta amigos, comunidades e memórias
          </span>
        </div>

        {/* Central Nav Links */}
        <nav className="flex items-center gap-space-sm sm:gap-space-md text-label-md font-label-md">
          <Link
            to="/"
            className={`px-space-xs py-1 transition-colors ${
              isActive('/')
                ? 'text-primary font-bold border-b-2 border-primary'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Início / Recados
          </Link>
          <span className="text-outline-variant">|</span>
          <Link
            to="/comunidades"
            className={`px-space-xs py-1 transition-colors ${
              isActive('/comunidades')
                ? 'text-primary font-bold border-b-2 border-primary'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Comunidades
          </Link>
        </nav>

        {/* User Session / Trailing Controls */}
        <div className="flex items-center gap-space-md flex-shrink-0">
          {user ? (
            <div className="flex items-center gap-space-sm bg-surface-container-lowest border border-outline-variant px-space-sm py-1 rounded shadow-sm">
              <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-label-sm font-bold uppercase">
                {user.username.charAt(0)}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-body-sm text-secondary">Olá,</span>
                <span className="text-label-md font-bold text-primary">{user.username}</span>
              </div>
              <span className="text-secondary text-[11px]">•</span>
              <button
                onClick={handleLogout}
                className="text-label-sm text-error hover:underline flex items-center gap-0.5"
                title="Sair da sua conta"
              >
                <span className="material-symbols-outlined text-[13px]">logout</span>
                Sair
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-space-xs">
              <Link
                to="/login"
                className="retro-btn text-primary font-label-md text-label-md px-space-md py-1 rounded hover:bg-surface-container-highest transition-colors active:translate-y-px"
              >
                Entrar
              </Link>
              <Link
                to="/login?tab=cadastro"
                className="retro-btn-primary text-white font-label-md text-label-md px-space-md py-1 rounded transition-colors active:translate-y-px shadow-sm"
              >
                Criar Conta
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
