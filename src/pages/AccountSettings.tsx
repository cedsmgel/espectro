import React from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { SecurityCenter } from '../components/SecurityCenter';
import { useSidebar } from '../context/SidebarContext';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { authStorage } from '../lib/api';
import { EmptyState } from '../components/EmptyState';

// Central de segurança: senha, sessões, meus dados e exclusão da conta.
// A privacidade do perfil (perfil privado, scraps) fica na edição do perfil.
export const AccountSettings: React.FC = () => {
  const { isExpanded } = useSidebar();
  const isAdmin = useIsAdmin();
  const loggedUser = authStorage.getUser();

  if (!loggedUser) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col">
        <Header />
        <SidebarNav />
        <div className={`pt-16 md:pt-0 flex-1 flex items-center justify-center p-6 ${isExpanded ? 'pl-0 md:pl-20' : 'pl-0 md:pl-20'}`}>
          <EmptyState
            icon="shield"
            title="Acesse a central de segurança"
            description="Entre na sua conta para gerenciar senha, sessões e dados."
            actionLabel="Entrar"
            actionLink="/login"
            className="max-w-md w-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />

      <div className={`pt-16 md:pt-0 min-h-screen flex flex-col ${isExpanded ? 'pl-0 md:pl-20' : 'pl-0 md:pl-20'}`}>
        <main className="w-full bg-surface pt-4 pb-24 md:pb-8">
          <div className="w-full max-w-2xl mx-auto px-4 sm:px-4 flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[28px]">shield</span>
                  Central de segurança
                </h1>
                <p className="text-sm text-on-surface-variant mt-1">Senha, aparelhos conectados, seus dados e exclusão da conta.</p>
                {isAdmin && (
                  <Link to="/admin" className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-error hover:underline">
                    <span className="material-symbols-outlined text-[16px]">gavel</span>
                    Abrir moderação
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-full border border-outline-variant self-start sm:self-auto">
                <Link to="/settings/profile" className="px-4 py-1.5 rounded-full text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors">
                  Perfil
                </Link>
                <span aria-current="page" className="px-4 py-1.5 rounded-full text-xs font-semibold bg-primary-container text-on-primary shadow-xs">
                  Segurança
                </span>
              </div>
            </div>

            <SecurityCenter />
          </div>
        </main>
      </div>
    </div>
  );
};
