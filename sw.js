const CACHE = 'taskflow-v15';
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

  // אל תיירט בקשות Firebase או API חיצוני
  if (url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebase.com') ||
      e.request.method !== 'GET') {
    return; // תן לדפדפן לטפל בזה ישירות
  }

  // רק GET מהאתר עצמו — שמור בקאש
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
