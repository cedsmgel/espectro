// Preferências de mídia neste aparelho (a reprodução automática de vídeo fica em useFeedPrefs)
export interface MediaPrefs {
  // "standard" reduz a foto antes de enviar; "original" envia o arquivo como está
  uploadQuality: 'standard' | 'original';
}

const KEY = 'espectro_media_prefs';
const DEFAULTS: MediaPrefs = { uploadQuality: 'standard' };

export function readMediaPrefs(): MediaPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return { uploadQuality: raw?.uploadQuality === 'original' ? 'original' : 'standard' };
  } catch {
    return DEFAULTS;
  }
}

export function writeMediaPrefs(prefs: MediaPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {}
}
