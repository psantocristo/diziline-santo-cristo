// Diziline PWA Service Worker
// Push notifications + minimal navigation cache (network-first).

const VERSION = 'diziline-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-first for navigations; never cache aggressively (avoids stale app).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const accept = req.headers.get('accept') || '';
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(fetch(req).catch(() => caches.match('/')));
  }
});

// ====== PUSH ======
self.addEventListener('push', (event) => {
  let data = { title: 'Diziline', body: 'Você tem uma nova notificação.', url: '/paroquiano' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    try { data.body = event.data?.text() || data.body; } catch {}
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'diziline',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/paroquiano', ...(data.data || {}) },
    actions: data.actions || [
      { action: 'open', title: 'Abrir' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/paroquiano';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if ('focus' in client) {
        try { client.navigate(url); } catch {}
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
