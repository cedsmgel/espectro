import { authStorage } from './api';

export type PushPermission = 'unsupported' | 'default' | 'granted' | 'denied';

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// No iPhone/iPad as notificações só funcionam com o site instalado na tela inicial
export function needsHomeScreenInstall(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIos && !standalone;
}

export function getPushPermission(): PushPermission {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission as PushPermission;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = authStorage.getToken();
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('Não foi possível registrar o service worker:', err);
    return null;
  }
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

// Pede permissão, cria a assinatura neste aparelho e registra no servidor
export async function enablePush(showPreview: boolean): Promise<PushSubscription> {
  if (!isPushSupported()) throw new Error('Este navegador não suporta notificações push.');
  if (needsHomeScreenInstall()) {
    throw new Error('No iPhone, instale o Espectro na tela inicial (Compartilhar > Adicionar à Tela de Início) para receber notificações.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permissão negada. Libere as notificações nas configurações do navegador.');
  }

  const keyRes = await authFetch('/api/push/key');
  if (!keyRes.ok) throw new Error('Notificações push ainda não estão disponíveis neste servidor.');
  const { public_key } = (await keyRes.json()) as { public_key: string };

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key) as BufferSource,
    }));

  const res = await authFetch('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription: subscription.toJSON(), show_preview: showPreview }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Não foi possível ativar as notificações.');
  }
  return subscription;
}

export async function disablePush(): Promise<void> {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;
  await authFetch('/api/push/subscribe', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {});
  await subscription.unsubscribe().catch(() => {});
}

export async function updatePushPreview(showPreview: boolean): Promise<void> {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;
  await authFetch('/api/push/subscribe', {
    method: 'PUT',
    body: JSON.stringify({ endpoint: subscription.endpoint, show_preview: showPreview }),
  });
}
