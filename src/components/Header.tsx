import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { getCurrentUser, logout } from "../lib/api";

interface HeaderProps {
  onOpenCreatePost?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenCreatePost }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isFeed = location.pathname === "/";
  const isCommunities = location.pathname === "/communities";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/80 backdrop-blur-xl border-b border-outline-variant/30 shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
      <div className="h-16 max-w-[1440px] mx-auto px-4 sm:px-8 flex items-center justify-between gap-space-lg">
        {/* Logo & Busca */}
        <div className="flex items-center gap-space-lg flex-1 max-w-xl">
          <Link to="/" className="flex items-center gap-2 shrink-0 group">
            <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm shadow-sm group-hover:bg-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">blur_on</span>
            </div>
            <span className="font-bold text-lg text-primary tracking-tight font-sans">
              Espectro
            </span>
          </Link>

          <div className="relative w-full max-w-sm hidden md:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar artigos, comunidades e tópicos..."
              className="w-full h-10 pl-9 pr-4 bg-surface-container-low text-xs text-on-surface placeholder:text-outline rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary-container/40 transition-all"
            />
          </div>
        </div>

        {/* Navegação Central */}
        <nav className="hidden lg:flex items-center gap-1">
          <Link
            to="/"
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              isFeed
                ? "text-on-surface bg-surface-container-high"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
            }`}
          >
            Feed
          </Link>
          <Link
            to="/communities"
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              isCommunities
                ? "text-on-surface bg-surface-container-high"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
            }`}
          >
            Comunidades
          </Link>
          <Link
            to="/news"
            className="px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors"
          >
            Tópicos
          </Link>
          <Link
            to="/chat"
            className="px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-lg transition-colors"
          >
            Mensagens
          </Link>
        </nav>

        {/* Ações / Usuário */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {user ? (
            <>
              {onOpenCreatePost && (
                <button
                  type="button"
                  onClick={onOpenCreatePost}
                  className="flex items-center gap-1.5 bg-primary-container text-on-primary text-xs font-semibold px-3 py-2 rounded-lg hover:bg-primary transition-all shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span>Criar</span>
                </button>
              )}

              <button
                type="button"
                aria-label="Notificações"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">notifications</span>
              </button>

              <div className="flex items-center gap-2 pl-1 border-l border-outline-variant/30">
                <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold text-on-surface leading-tight">
                    {user.username}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-[10px] text-outline hover:text-error text-left leading-tight"
                  >
                    Sair
                  </button>
                </div>
              </div>
            </>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 bg-primary-container text-on-primary text-xs font-semibold px-4 py-2 rounded-lg hover:bg-primary transition-all shadow-sm"
            >
              <span>Entrar</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
