const CACHE = 'taskflow-v17';
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
  if (e.data?.type === 'SHOW_REMINDER') showReminderNotif(e.data);
});

// Push מ-Firebase Cloud Functions (כשהאפליקציה סגורה לגמרי)
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() || {}; } catch(err) { data = { title: e.data?.text() || 'תזכורת' }; }
  e.waitUntil(showReminderNotif(data));
});

function showReminderNotif(data) {
  const vibes = {
    default: [200, 100, 200],
    bell:    [100, 50, 100, 50, 100],
    ping:    [50],
    alarm:   [300, 100, 300, 100, 300],
    chime:   [100, 100, 100, 100, 400],
    none:    []
  };
  const sound = data.sound || 'default';
  return self.registration.showNotification(data.title || '⏰ TaskFlow — תזכורת', {
    body: data.body || data.title || 'יש לך משימה!',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: vibes[sound] || vibes.default,
    tag: 'taskflow-' + (data.taskId || Date.now()),
    renotify: true,
    requireInteraction: true,
    silent: sound === 'none',
    actions: [
      { action: 'open', title: '📋 פתח' },
      { action: 'dismiss', title: '✕ סגור' }
    ],
    data: { taskId: data.taskId, sound, url: './' }
  });
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebase.com') ||
      e.request.method !== 'GET') return;
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(res => { caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res; })
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
      return self.clients.openWindow('./');
    })
  );
});
