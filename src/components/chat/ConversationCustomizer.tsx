import React, { useState } from 'react';
import { ConversationSettings, conversationSettingsApi } from '../../lib/api';
import { CHAT_THEMES, CHAT_WALLPAPERS, themeColor, wallpaperStyle } from '../../lib/chatThemes';
import { ModalShell } from './ModalShell';

interface ConversationCustomizerProps {
  friendId: number;
  username: string;
  settings: Pick<ConversationSettings, 'theme' | 'wallpaper' | 'nickname'>;
  onSaved: (settings: ConversationSettings) => void;
  onClose: () => void;
}

export const ConversationCustomizer: React.FC<ConversationCustomizerProps> = ({
  friendId,
  username,
  settings,
  onSaved,
  onClose,
}) => {
  const [theme, setTheme] = useState(settings.theme);
  const [wallpaper, setWallpaper] = useState(settings.wallpaper);
  const [nickname, setNickname] = useState(settings.nickname || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bubbleColor = themeColor(theme);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await conversationSettingsApi.update(friendId, {
        theme,
        wallpaper,
        nickname: nickname.trim() || null,
      });
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title="Personalizar conversa"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-semibold text-on-surface bg-surface-container hover:bg-surface-container-high cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-full text-xs font-semibold bg-primary-container text-on-primary hover:bg-primary disabled:opacity-60 cursor-pointer"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      }
    >
      <div
        className="rounded-2xl border border-outline-variant/40 bg-surface p-4 mb-5 space-y-2"
        style={wallpaperStyle(wallpaper)}
        aria-label="Pré-visualização"
      >
        <div className="max-w-[70%] rounded-2xl rounded-bl-md bg-surface-container px-3 py-2 text-xs text-on-surface">
          Oi! Como ficou?
        </div>
        <div
          className={`ml-auto max-w-[70%] rounded-2xl rounded-br-md px-3 py-2 text-xs ${
            bubbleColor ? 'text-white' : 'bg-primary-container text-on-primary'
          }`}
          style={bubbleColor ? { backgroundColor: bubbleColor } : undefined}
        >
          Ficou ótimo!
        </div>
      </div>

      <div className="mb-5">
        <label htmlFor="conv-nickname" className="text-xs font-semibold text-on-surface">
          Apelido de @{username}
        </label>
        <input
          id="conv-nickname"
          type="text"
          value={nickname}
          maxLength={30}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Só você vê este apelido"
          className="mt-2 w-full h-10 px-3 rounded-xl bg-surface-container-low text-xs text-on-surface placeholder:text-on-surface-variant outline-none focus:ring-1 focus:ring-primary-container"
        />
      </div>

      <div className="mb-5">
        <span className="text-xs font-semibold text-on-surface">Cor das suas mensagens</span>
        <div className="mt-2 flex flex-wrap gap-2.5">
          {CHAT_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.label}
              aria-label={t.label}
              aria-pressed={theme === t.id}
              onClick={() => setTheme(t.id)}
              className={`w-9 h-9 rounded-full flex items-center justify-center border-2 cursor-pointer transition-transform hover:scale-105 ${
                theme === t.id ? 'border-on-surface' : 'border-transparent'
              } ${t.color ? '' : 'bg-primary-container'}`}
              style={t.color ? { backgroundColor: t.color } : undefined}
            >
              {theme === t.id && <span className="material-symbols-outlined text-[18px] text-white">check</span>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs font-semibold text-on-surface">Papel de parede</span>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {CHAT_WALLPAPERS.map((w) => (
            <button
              key={w.id}
              type="button"
              aria-pressed={wallpaper === w.id}
              onClick={() => setWallpaper(w.id)}
              className="flex flex-col items-center gap-1 cursor-pointer"
            >
              <span
                className={`w-full h-12 rounded-xl bg-surface border-2 ${
                  wallpaper === w.id ? 'border-primary' : 'border-outline-variant/40'
                }`}
                style={w.style}
              />
              <span className="text-[10px] text-on-surface-variant">{w.label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-error">{error}</p>}
    </ModalShell>
  );
};
