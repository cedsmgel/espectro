import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { SidebarNav } from '../components/SidebarNav';
import { useFeedPrefs } from '../hooks/useFeedPrefs';
import { MediaPrefs, readMediaPrefs, writeMediaPrefs } from '../lib/mediaPrefs';

// Preferências de mídia deste aparelho: reprodução automática de vídeo e qualidade das fotos enviadas
export const MediaSettingsPage: React.FC = () => {
  const { prefs: feedPrefs, update: updateFeed } = useFeedPrefs();
  const [media, setMedia] = useState<MediaPrefs>(readMediaPrefs);

  const setQuality = (uploadQuality: MediaPrefs['uploadQuality']) => {
    const next = { ...media, uploadQuality };
    setMedia(next);
    writeMediaPrefs(next);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      <Header />
      <SidebarNav />
      <div className="pt-16 md:pt-0 md:pl-20">
        <main className="w-full max-w-xl mx-auto px-3 sm:px-4 pt-4 pb-28 md:pb-10 flex flex-col gap-5">
          <div>
            <Link to="/menu" className="inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Configurações e atividade
            </Link>
            <h1 className="text-xl font-bold mt-2">Configurações de mídia</h1>
            <p className="text-xs text-on-surface-variant mt-1">Valem só para este aparelho.</p>
          </div>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
            <label className="flex items-start justify-between gap-4 cursor-pointer">
              <span>
                <span className="block text-sm font-semibold">Reproduzir vídeos sozinhos</span>
                <span className="block text-xs text-on-surface-variant mt-0.5">Os vídeos do feed tocam sem som quando aparecem na tela. Desligado, só tocam quando você toca neles.</span>
              </span>
              <input
                type="checkbox"
                checked={feedPrefs.autoplay}
                onChange={(e) => updateFeed({ autoplay: e.target.checked })}
                className="w-5 h-5 mt-0.5 shrink-0 accent-[var(--color-primary,#2563eb)]"
              />
            </label>
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4">
            <p className="text-sm font-semibold">Qualidade das fotos enviadas</p>
            <p className="text-xs text-on-surface-variant mt-0.5 mb-3">Padrão reduz a foto antes de enviar (mais rápido e leve). Original envia o arquivo como está, até o limite de cada tela.</p>
            <div role="radiogroup" aria-label="Qualidade das fotos enviadas" className="flex gap-2">
              {(
                [
                  { id: 'standard', label: 'Padrão' },
                  { id: 'original', label: 'Original' },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={media.uploadQuality === o.id}
                  onClick={() => setQuality(o.id)}
                  className={`flex-1 h-10 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
                    media.uploadQuality === o.id ? 'bg-primary-container text-on-primary border-transparent' : 'border-outline-variant text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default MediaSettingsPage;
