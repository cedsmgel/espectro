import { useEffect, useState } from 'react';

// Celular de verdade: tela estreita com toque como principal forma de entrada.
// Desktop (mesmo com a janela estreita) e tablets grandes não entram.
const PHONE_QUERY = '(max-width: 767px) and (pointer: coarse)';

function matchesPhone(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;
}

// Usado para mostrar a câmera só em celular
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(matchesPhone);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(PHONE_QUERY);
    const update = () => setIsPhone(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isPhone;
}
