import React from 'react';
import { Link } from 'react-router-dom';

const TABS = [
  { id: 'profile', label: 'Perfil', to: '/settings/profile' },
  { id: 'privacy', label: 'Privacidade', to: '/settings/privacy' },
  { id: 'security', label: 'Segurança', to: '/settings/account' },
] as const;

export type SettingsTab = (typeof TABS)[number]['id'];

// Abas das configurações da conta: Perfil, Privacidade e Segurança
export const SettingsTabs: React.FC<{ active: SettingsTab; className?: string }> = ({ active, className = '' }) => (
  <nav aria-label="Configurações" className={`flex items-center gap-1 bg-surface-container-low p-1 rounded-full border border-outline-variant self-start w-fit ${className}`}>
    {TABS.map((tab) =>
      tab.id === active ? (
        <span key={tab.id} aria-current="page" className="px-4 py-1.5 rounded-full text-xs font-semibold bg-primary-container text-on-primary shadow-xs">
          {tab.label}
        </span>
      ) : (
        <Link key={tab.id} to={tab.to} className="px-4 py-1.5 rounded-full text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors">
          {tab.label}
        </Link>
      )
    )}
  </nav>
);
