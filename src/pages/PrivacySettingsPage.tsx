import React from 'react';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { PrivacySettings } from '../components/PrivacySettings';
import { SettingsTabs } from '../components/SettingsTabs';
import { EmptyState } from '../components/EmptyState';
import { authStorage } from '../lib/api';

// Privacidade da conta: perfil privado, scraps e personalização do feed
export const PrivacySettingsPage: React.FC = () => {
  const loggedUser = authStorage.getUser();

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />

      <div className="pt-16 md:pt-0 min-h-screen flex flex-col pl-0 md:pl-20">
        <main className="w-full bg-surface pt-4 pb-24 md:pb-8">
          {!loggedUser ? (
            <div className="flex items-center justify-center p-6">
              <EmptyState
                icon="lock"
                title="Acesse suas configurações de privacidade"
                description="Entre na sua conta para escolher quem vê suas publicações e seu mural."
                actionLabel="Entrar"
                actionLink="/login"
                className="max-w-md w-full"
              />
            </div>
          ) : (
            <div className="w-full max-w-2xl mx-auto px-4 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[28px]">lock</span>
                    Privacidade
                  </h1>
                  <p className="text-sm text-on-surface-variant mt-1">Quem vê suas publicações, quem escreve no seu mural e como o feed se adapta a você.</p>
                </div>
                <SettingsTabs active="privacy" className="sm:self-auto" />
              </div>
              <PrivacySettings />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default PrivacySettingsPage;
