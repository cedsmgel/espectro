import React, { useEffect, useState } from 'react';

// Avisa quando a conexão cai e quando ela volta, sem atrapalhar o uso
export const OfflineBanner: React.FC = () => {
  const [online, setOnline] = useState(true); // o servidor não sabe: começa online e confere ao montar
  const [justBack, setJustBack] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) setOnline(false);

    const goOffline = () => {
      window.clearTimeout(timer);
      setJustBack(false);
      setOnline(false);
    };
    const goOnline = () => {
      setOnline(true);
      setJustBack(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setJustBack(false), 2500);
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (online && !justBack) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed z-[60] left-1/2 -translate-x-1/2 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-5 max-w-[calc(100vw-2rem)] px-4 py-2 rounded-full text-xs font-semibold shadow-lg flex items-center gap-2 ${
        online
          ? 'bg-primary-container text-on-primary'
          : 'bg-surface-container-highest text-on-surface border border-outline-variant/40'
      }`}
    >
      <span className="material-symbols-outlined text-[16px]">{online ? 'wifi' : 'wifi_off'}</span>
      <span>{online ? 'De volta online' : 'Sem conexão. Algumas coisas podem não funcionar.'}</span>
    </div>
  );
};
