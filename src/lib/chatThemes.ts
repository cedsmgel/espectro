import type { CSSProperties } from 'react';

export interface ChatTheme {
  id: string;
  label: string;
  color: string | null;
}

export interface ChatWallpaper {
  id: string;
  label: string;
  style: CSSProperties;
}

// Cor das mensagens enviadas por mim (null = cor padrão do tema do site)
export const CHAT_THEMES: ChatTheme[] = [
  { id: 'default', label: 'Padrão', color: null },
  { id: 'violet', label: 'Violeta', color: '#7c3aed' },
  { id: 'rose', label: 'Rosa', color: '#e11d48' },
  { id: 'amber', label: 'Âmbar', color: '#d97706' },
  { id: 'emerald', label: 'Esmeralda', color: '#059669' },
  { id: 'sky', label: 'Céu', color: '#0284c7' },
  { id: 'slate', label: 'Grafite', color: '#475569' },
  { id: 'orange', label: 'Laranja', color: '#ea580c' },
];

// Papéis de parede translúcidos: funcionam tanto no tema claro quanto no escuro
export const CHAT_WALLPAPERS: ChatWallpaper[] = [
  { id: 'none', label: 'Nenhum', style: {} },
  {
    id: 'dots',
    label: 'Pontos',
    style: {
      backgroundImage: 'radial-gradient(rgba(128,128,128,0.22) 1px, transparent 1px)',
      backgroundSize: '18px 18px',
    },
  },
  {
    id: 'grid',
    label: 'Grade',
    style: {
      backgroundImage:
        'linear-gradient(rgba(128,128,128,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.14) 1px, transparent 1px)',
      backgroundSize: '28px 28px',
    },
  },
  {
    id: 'aurora',
    label: 'Aurora',
    style: { backgroundImage: 'linear-gradient(135deg, rgba(124,58,237,0.22), rgba(14,165,233,0.18))' },
  },
  {
    id: 'sunset',
    label: 'Pôr do sol',
    style: { backgroundImage: 'linear-gradient(160deg, rgba(251,146,60,0.24), rgba(236,72,153,0.2))' },
  },
  {
    id: 'ocean',
    label: 'Oceano',
    style: { backgroundImage: 'linear-gradient(160deg, rgba(14,165,233,0.22), rgba(20,184,166,0.2))' },
  },
  {
    id: 'forest',
    label: 'Floresta',
    style: { backgroundImage: 'linear-gradient(160deg, rgba(34,197,94,0.2), rgba(132,204,22,0.16))' },
  },
];

export function themeColor(themeId: string | undefined | null): string | null {
  return CHAT_THEMES.find((t) => t.id === themeId)?.color ?? null;
}

export function wallpaperStyle(wallpaperId: string | undefined | null): CSSProperties {
  return CHAT_WALLPAPERS.find((w) => w.id === wallpaperId)?.style ?? {};
}
