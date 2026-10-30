import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCurrentUser, logout } from "../lib/api";

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="bg-[#3b5998] border-b border-[#2d4373] text-white shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo / Título Nostálgico */}
        <div className="flex items-center space-x-6">
          <Link to="/" className="text-2xl font-bold tracking-tight text-white hover:opacity-90 flex items-center gap-1">
            <span className="bg-[#ea5b88] text-white px-2 py-0.5 rounded text-lg font-black shadow-inner">e</span>
            <span className="font-sans">espectro</span>
          </Link>
          <nav className="hidden sm:flex space-x-2 text-sm font-semibold">
            <Link
              to="/"
              className="px-3 py-1 rounded hover:bg-[#2d4373] transition-colors"
            >
              Início / Feed
            </Link>
            <Link
              to="/communities"
              className="px-3 py-1 rounded hover:bg-[#2d4373] transition-colors"
            >
              Comunidades
            </Link>
          </nav>
        </div>

        {/* Informações do Usuário / Ações */}
        <div className="flex items-center space-x-3 text-sm">
          {user ? (
            <div className="flex items-center space-x-3">
              <span className="bg-[#2d4373] px-3 py-1 rounded-full text-xs font-medium text-blue-100 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                {user.username}
              </span>
              <button
                onClick={handleLogout}
                className="bg-[#ea5b88] hover:bg-[#d44874] text-white px-3 py-1 rounded text-xs font-bold transition shadow-sm"
              >
                Sair
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="bg-white text-[#3b5998] hover:bg-blue-50 px-3.5 py-1 rounded text-xs font-bold transition shadow-sm"
            >
              Entrar / Cadastrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
