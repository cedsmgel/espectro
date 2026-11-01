import { useEffect, useSyncExternalStore } from 'react';
import { pulseApi } from './api';

// "Pulso" do app aberto: UMA chamada a cada 60 s (POST /api/pulse) que marca presença e traz os números dos selos
// (mensagens não lidas e notificações). Antes cada componente de navegação (Header, SidebarNav, BottomNav) fazia as
// suas próprias chamadas a cada 30 s, o que multiplicava as requisições e as escritas.

const INTERVAL_MS = 60_000;
const MIN_GAP_MS = 15_000; // ao voltar para a aba, só repete se o último pulso for mais antigo que isso
const FORCED_GAP_MS = 1_500; // eventos do app (ler mensagem, marcar notificação) juntam-se em uma chamada

const UNREAD_EVENT = 'espectro:unread-changed';
const NOTIFICATIONS_EVENT = 'espectro:notifications-changed';

let unread = 0;
let badge = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

let owners = 0;
let currentUserId: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let trailing: ReturnType<typeof setTimeout> | null = null;
let inflight = false;
let lastAt = 0;

async function beat() {
  if (inflight) return;
  inflight = true;
  try {
    const res = await pulseApi.beat();
    unread = res.unread_count || 0;
    badge = res.total_badge || 0;
    lastAt = Date.now();
    emit();
  } catch {
    // sem rede ou sessão expirada: o próximo pulso tenta de novo
  } finally {
    inflight = false;
  }
}

function beatIfVisible(minGap: number) {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  if (Date.now() - lastAt < minGap) return;
  void beat();
}

function forced() {
  if (trailing) return;
  const wait = Math.max(0, FORCED_GAP_MS - (Date.now() - lastAt));
  trailing = setTimeout(() => {
    trailing = null;
    void beat();
  }, wait);
}

const onVisible = () => beatIfVisible(MIN_GAP_MS);

function start() {
  void beat();
  timer = setInterval(() => beatIfVisible(INTERVAL_MS - 5_000), INTERVAL_MS);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  window.addEventListener(UNREAD_EVENT, forced);
  window.addEventListener(NOTIFICATIONS_EVENT, forced);
}

function stop() {
  if (timer) clearInterval(timer);
  if (trailing) clearTimeout(trailing);
  timer = null;
  trailing = null;
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('focus', onVisible);
  window.removeEventListener(UNREAD_EVENT, forced);
  window.removeEventListener(NOTIFICATIONS_EVENT, forced);
}

// Quem precisa do pulso (selos, presença) se registra; o primeiro liga, o último desliga
function acquire(userId: number): () => void {
  if (typeof window === 'undefined') return () => {};
  if (currentUserId !== null && currentUserId !== userId) {
    unread = 0;
    badge = 0;
    emit();
    lastAt = 0;
  }
  currentUserId = userId;
  owners += 1;
  if (owners === 1) start();
  else beatIfVisible(MIN_GAP_MS);
  return () => {
    owners -= 1;
    if (owners <= 0) {
      owners = 0;
      stop();
    }
  };
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Mantém o pulso ligado enquanto o componente existir (presença "online")
export function usePulseOwner(userId?: number | null) {
  useEffect(() => {
    if (!userId) return;
    return acquire(userId);
  }, [userId]);
}

export function usePulseUnread(userId?: number | null): number {
  usePulseOwner(userId);
  const value = useSyncExternalStore(subscribe, () => unread, () => 0);
  return userId ? value : 0;
}

export function usePulseBadge(userId?: number | null): number {
  usePulseOwner(userId);
  const value = useSyncExternalStore(subscribe, () => badge, () => 0);
  return userId ? value : 0;
}
