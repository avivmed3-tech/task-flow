const CACHE = 'taskflow-v16';
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
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
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();

  if (e.data?.type === 'SHOW_REMINDER') {
    const sound = e.data.sound || 'default';
    // Vibration pattern based on sound type
    const vibes = {
      default: [200, 100, 200],
      bell:    [100, 50, 100, 50, 100],
      ping:    [50],
      alarm:   [300, 100, 300, 100, 300],
      chime:   [100, 100, 100, 100, 400],
      none:    [0]
    };
    self.registration.showNotification('⏰ TaskFlow — תזכורת', {
      body: e.data.title,
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: vibes[sound] || vibes.default,
      tag: 'taskflow-' + (e.data.taskId || Date.now()),
      renotify: true,
      silent: sound === 'none',
      actions: [
        { action: 'open', title: '📋 פתח' },
        { action: 'dismiss', title: '✕ סגור' }
      ],
      data: { taskId: e.data.taskId, sound }
    });
  }
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // אל תיירט בקשות Firebase, API חיצוני, או בקשות שאינן GET
  if (url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebase.com') ||
      e.request.method !== 'GET') {
    return;
  }

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
  }
});

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
