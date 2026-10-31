// Service worker do Espectro: só trata notificações push (não faz cache de páginas).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
