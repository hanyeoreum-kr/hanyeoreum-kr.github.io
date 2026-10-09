/* 한여름 서비스워커 — 항상 최신 화면을 먼저 받고, 인터넷이 끊겼을 때만 저장본을 보여줘요. */
const CACHE = 'hy-v39';
const CDN = ['cdn.tailwindcss.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const CORE = ['./', 'index.html', 'app.js?v=39', 'config.js?v=13', 'manifest.json', 'icon-192.png', 'icon-512.png', 'terms.html', 'privacy.html', 'refund.html', 'legal.css', 'delete-account.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (CDN.includes(url.hostname)) { // 디자인·라이브러리 파일: 저장본으로 빨리 열고 뒤에서 새로 받아 둠
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit || Response.error());
      return hit || net;
    })));
    return;
  }
  if (url.origin !== self.location.origin) return; // Supabase·토스 등 데이터는 건드리지 않음
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(r => r || caches.match('index.html')))
  );
});
// 서버에서 보낸 푸시 알림 (앱을 닫아 두어도 와요)
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  const title = d.title ? '한여름 · ' + d.title : '한여름';
  e.waitUntil(self.registration.showNotification(title, { body: d.body || '새 소식이 있어요', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'hy-' + Date.now(), data: { url: d.url || './' }, vibrate: [120, 60, 120] }));
});
// 알림을 누르면 열려 있는 한여름 화면으로, 없으면 새로 열어요
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const w = list.find(c => c.url.startsWith(self.registration.scope));
    return w ? w.focus() : self.clients.openWindow(url);
  }));
});
