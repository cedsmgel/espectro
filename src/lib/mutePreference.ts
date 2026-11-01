import { useSyncExternalStore } from 'react';

// O navegador só deixa tocar com som depois de uma ação da pessoa, então todo vídeo começa mudo.
// Quando ela liga o som em um vídeo, os próximos (no feed e no Shorts) seguem essa escolha na sessão.
const KEY = 'espectro_video_muted';

function read(): boolean {
  try {
    return sessionStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

let muted = read();
const listeners = new Set<() => void>();

export function setMutedPreference(value: boolean): void {
  muted = value;
  try {
    sessionStorage.setItem(KEY, value ? '1' : '0');
  } catch {}
  listeners.forEach((listener) => listener());
}

export function toggleMutedPreference(): void {
  setMutedPreference(!muted);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMutedPreference(): { muted: boolean; toggleMuted: () => void } {
  const value = useSyncExternalStore(subscribe, () => muted, () => true);
  return { muted: value, toggleMuted: toggleMutedPreference };
}
