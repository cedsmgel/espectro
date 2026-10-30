import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authStorage } from '../lib/api';
import { ContactsDrawer } from './ContactsDrawer';

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const user = authStorage.getUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => {
    authStorage.clear();
    setShowDropdown(false);
    navigate('/login');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <>
      <header className="sticky top-0 w-full z-40 glass-header">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 w-full max-w-[1440px] mx-auto gap-4">
          {/* Brand Logo with Stitch Glass Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-400 to-indigo-500 p-[1.5px] shadow-[0_0_14px_rgba(76,215,246,0.4)] transition-transform group-hover:scale-105">
                <div className="w-full h-full bg-[#0d0f14] rounded-[10px] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-cyan-300">auto_awesome</span>
                </div>
              </div>
              <span className="text-xl font-display font-bold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-300 to-white bg-clip-text text-transparent">
                espectro.
              </span>
            </Link>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-400/10 text-cyan-300 border border-cyan-400/30 tracking-wider">
              v2.4 GLASS
            </span>
          </div>

          {/* Center Search Input with ⌘K Badge */}
          <div className="flex-1 max-w-md mx-2 sm:mx-6 hidden md:block">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-neutral-400 pointer-events-none text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar comunidades, @pessoas, scraps ou tópicos..."
                className="w-full pl-10 pr-12 py-2 text-xs sm:text-sm rounded-xl glass-recessed text-white placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
              />
              <kbd className="absolute right-3 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 rounded bg-white/5 border border-white/10 pointer-events-none">
                ⌘K
              </kbd>
            </form>
          </div>

          {/* Trailing Action Cluster */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Mensagens (Direct) Button with Red Badge */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="relative p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
              title="Mensagens Diretas (Contatos)"
            >
              <span className="material-symbols-outlined text-[20px]">chat</span>
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-[0_0_8px_#f43f5e] border border-[#0d0f14]">
                3
              </span>
            </button>

            {/* Notifications Button with Glowing Dot */}
            <button
              type="button"
              className="relative p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
              title="Notificações"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#4cd7f6]" />
            </button>

            {/* User Logged In Actions */}
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const composer = document.getElementById('composer-title-input');
                    if (composer) {
                      composer.focus();
                    } else {
                      navigate('/');
                    }
                  }}
                  className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-semibold border border-white/20 shadow-[0_0_16px_rgba(59,130,246,0.35)] hover:shadow-[0_0_24px_rgba(59,130,246,0.55)] active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span>Criar</span>
                </button>

                <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-2 p-1 pl-2 rounded-xl hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
                  >
                    <div className="relative w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-tr from-cyan-400 to-blue-600 shadow-[0_0_10px_rgba(76,215,246,0.3)]">
                      <div className="w-full h-full bg-[#111318] rounded-full flex items-center justify-center text-white text-xs font-bold font-display uppercase">
                        {user.username.charAt(0)}
                      </div>
                    </div>
                    <span className="hidden lg:inline text-xs font-bold text-white font-display">
                      @{user.username}
                    </span>
                    <span className="material-symbols-outlined text-neutral-400 text-[18px]">
                      expand_more
                    </span>
                  </button>

                  {/* Glass Dropdown Menu */}
                  {showDropdown && (
                    <div className="absolute right-0 mt-2 w-48 glass-elevated rounded-2xl p-2 shadow-2xl border border-white/10 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-2 border-b border-white/10 mb-1">
                        <p className="text-xs font-bold text-white font-display">@{user.username}</p>
                        <p className="text-[10px] text-cyan-400">Karma ▲ 4.892</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDropdown(false);
                          setDrawerOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-neutral-300 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">chat</span>
                        <span>Mensagens Diretas</span>
                      </button>
                      <Link
                        to="/?type=scrap"
                        onClick={() => setShowDropdown(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">mark_chat_unread</span>
                        <span>Meus Scraps</span>
                      </Link>
                      <Link
                        to="/comunidades"
                        onClick={() => setShowDropdown(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">forum</span>
                        <span>Comunidades</span>
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 transition-colors mt-1 border-t border-white/5 cursor-pointer text-left"
                      >
                        <span className="material-symbols-outlined text-[16px]">logout</span>
                        <span>Sair</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Visitor / Logged Out: Exactly one Entrar and one Cadastrar button */
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="btn-glass text-xs font-semibold px-3.5 py-1.5 rounded-xl cursor-pointer"
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/login?tab=cadastro')}
                  className="btn-primary-blue text-xs font-semibold px-3.5 py-1.5 rounded-xl cursor-pointer shadow-[0_0_14px_rgba(59,130,246,0.35)]"
                >
                  Cadastrar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Slide-in Contacts Drawer (Direct) */}
      <ContactsDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
};
