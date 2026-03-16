const CACHE = 'taskflow-v2';
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  // Do NOT skipWaiting here — let the app show the update banner first
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', e => {
  // App tells SW to activate the new version
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  // App sends a reminder to show (used when app is backgrounded/hidden)
  if (e.data?.type === 'SHOW_REMINDER') {
    self.registration.showNotification('⏰ TaskFlow — תזכורת', {
      body: e.data.title,
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'taskflow-' + (e.data.taskId || Date.now()),
      renotify: true,
      actions: [
        { action: 'open', title: '📋 פתח' },
        { action: 'dismiss', title: '✕ סגור' }
      ]
    });
  }
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        }).catch(() => cached);
      })
    );
  }
});

// Notification clicked → open app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow('./index.html');
    })
  );
});

// Push notifications (ready for Firebase integration)
self.addEventListener('push', e => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch(err) { data = { title: 'TaskFlow', body: e.data.text() }; }
  e.waitUntil(
    self.registration.showNotification(data.title || 'TaskFlow', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'taskflow-push',
      data
    })
  );
});
