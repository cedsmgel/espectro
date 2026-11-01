// Service worker do Espectro: notificações push, cache da interface e página offline.
// Vídeo, áudio e demais mídias nunca entram no Cache Storage: passam direto pela rede,
// que já responde a Range requests e usa o cache HTTP do navegador.

const UI_CACHE = 'espectro-ui-v2';
const SHELL_URL = '/index.html';
// O servidor redireciona /offline.html para /offline, e uma resposta redirecionada não pode ser entregue a uma navegação
const OFFLINE_URL = '/offline';
const MAX_UI_ENTRIES = 80;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // A página offline precisa estar guardada antes de a conexão cair
  event.waitUntil(
    caches
      .open(UI_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== UI_CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

function isMediaRequest(request, url) {
  return (
    request.headers.has('range') ||
    request.destination === 'video' ||
    request.destination === 'audio' ||
    url.pathname.startsWith('/api/')
  );
}

async function trimCache(cache) {
  const keys = await cache.keys();
  const excess = keys.filter((key) => !key.url.endsWith(SHELL_URL) && !key.url.endsWith(OFFLINE_URL)).slice(0, Math.max(0, keys.length - MAX_UI_ENTRIES));
  await Promise.all(excess.map((key) => cache.delete(key)));
}

async function storeResponse(cache, key, response, expectedType) {
  // Rotas inexistentes voltam como index.html com status 200: não podem virar um script em cache
  const type = response.headers.get('content-type') || '';
  if (!response.ok || response.type !== 'basic' || type.includes('text/html') !== (expectedType === 'html')) return;
  await cache.put(key, response.clone());
  await trimCache(cache);
}

// Arquivos com hash no nome nunca mudam
async function cacheFirst(event) {
  const cache = await caches.open(UI_CACHE);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  event.waitUntil(storeResponse(cache, event.request, response.clone(), 'asset'));
  return response;
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(UI_CACHE);
  const cached = await cache.match(event.request);
  const refresh = fetch(event.request).then(async (response) => {
    await storeResponse(cache, event.request, response.clone(), 'asset');
    return response;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => {}));
    return cached;
  }
  return refresh;
}

// Páginas sempre vêm da rede; a última versão só é usada quando não há conexão
async function networkFirstPage(event) {
  const cache = await caches.open(UI_CACHE);
  try {
    const response = await fetch(event.request);
    // O HTML de /post/ e /u/ traz a prévia de uma página específica: não serve de app offline
    if (!/^\/(post|u)\//.test(new URL(event.request.url).pathname)) {
      event.waitUntil(storeResponse(cache, SHELL_URL, response.clone(), 'html'));
    }
    return response;
  } catch (err) {
    const cached = await cache.match(SHELL_URL);
    if (cached) return cached;
    // Sem conexão e sem o app guardado: mostra a página offline em vez do erro do navegador
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isMediaRequest(request, url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(event));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(event));
  } else if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(staleWhileRevalidate(event));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Espectro', body: event.data ? event.data.text() : '' };
  }

  const title = typeof data.title === 'string' && data.title ? data.title : 'Espectro';
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/mensagens';

  event.waitUntil(
    (async () => {
      // Se o app já está aberto e em foco, o usuário vê a mensagem na própria tela
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (windows.some((client) => client.visibilityState === 'visible' && client.focused)) return;

      await self.registration.showNotification(title, {
        body: typeof data.body === 'string' ? data.body : '',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: typeof data.tag === 'string' ? data.tag : undefined,
        renotify: Boolean(data.tag),
        data: { url },
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/mensagens';

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if ('navigate' in existing) await existing.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })()
  );
});
