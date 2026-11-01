// Contador global da barra de carregamento: cada trabalho em andamento chama start() e depois stop()
let active = 0;
const EVENT = 'espectro:loading';

const emit = () => window.dispatchEvent(new CustomEvent(EVENT, { detail: active }));

export function startLoading() {
  if (typeof window === 'undefined') return;
  active += 1;
  emit();
}

export function stopLoading() {
  if (typeof window === 'undefined') return;
  active = Math.max(0, active - 1);
  emit();
}

export const LOADING_EVENT = EVENT;
