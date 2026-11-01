import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LOADING_EVENT, startLoading, stopLoading } from '../lib/loadingBar';

// Barra fina no topo, com degradê suave, para trocas de página e carregamentos
export const LoadingBar: React.FC = () => {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const activeRef = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const tick = () => {
      // avança devagar e nunca chega a 100% sozinha
      setProgress((p) => p + (92 - p) * 0.08);
    };
    const onChange = (e: Event) => {
      const count = (e as CustomEvent<number>).detail;
      activeRef.current = count;
      window.clearTimeout(hideTimer.current);
      if (count > 0) {
        setVisible(true);
        setProgress((p) => (p >= 100 || p === 0 ? 8 : p));
        if (!timer.current) timer.current = window.setInterval(tick, 160);
      } else {
        window.clearInterval(timer.current);
        timer.current = undefined;
        setProgress(100);
        hideTimer.current = window.setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 350);
      }
    };
    window.addEventListener(LOADING_EVENT, onChange);
    return () => {
      window.removeEventListener(LOADING_EVENT, onChange);
      window.clearInterval(timer.current);
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  // Toda troca de rota faz um pulso curto, mesmo quando a tela já está carregada
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    startLoading();
    const t = window.setTimeout(stopLoading, 450);
    return () => window.clearTimeout(t);
  }, [location.pathname]);

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 h-[3px] z-[100] pointer-events-none transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="h-full rounded-r-full transition-[width] duration-300 ease-out"
        style={{
          width: `${progress}%`,
          backgroundImage: 'linear-gradient(90deg, #38bdf8, #818cf8, #c084fc, #f472b6, #fb923c)',
          boxShadow: '0 0 10px rgba(129, 140, 248, 0.55), 0 0 4px rgba(244, 114, 182, 0.5)',
        }}
      />
    </div>
  );
};

// Para o fallback do Suspense: mantém a barra ativa enquanto a tela é carregada
export const RouteLoading: React.FC = () => {
  useEffect(() => {
    startLoading();
    return stopLoading;
  }, []);
  return <div className="min-h-dvh" role="status" aria-label="Carregando" />;
};
