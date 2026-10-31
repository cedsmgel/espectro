import { useCallback, useState } from 'react';

export type ChatFontSize = 'sm' | 'md' | 'lg';

export interface ChatPrefs {
  fontSize: ChatFontSize;
  showPreviews: boolean;
}

const STORAGE_KEY = 'espectro_chat_prefs';
const DEFAULTS: ChatPrefs = { fontSize: 'sm', showPreviews: true };

function read(): ChatPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      fontSize: ['sm', 'md', 'lg'].includes(parsed.fontSize) ? parsed.fontSize : DEFAULTS.fontSize,
      showPreviews: typeof parsed.showPreviews === 'boolean' ? parsed.showPreviews : DEFAULTS.showPreviews,
    };
  } catch {
    return DEFAULTS;
  }
}

// Preferências do chat neste aparelho (tamanho do texto e prévias na lista)
export function useChatPrefs() {
  const [prefs, setPrefs] = useState<ChatPrefs>(read);

  const update = useCallback((patch: Partial<ChatPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return { prefs, update };
}
