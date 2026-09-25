// Kassenzählprotokoll – Service Worker (bei Updates VERSION erhöhen)
const VERSION = 'kasse-v1.1';
const SHELL = ["./", "./index.html", "./app.jsx", "./app.css", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./o2-aalen", "./o2-sindelfingen", "./o2-crailsheim", "./o2-schwaebisch-hall", "./o2-stuttgart-vaihingen", "./telekom-crailsheim", "./o2-aalen.webmanifest", "./o2-sindelfingen.webmanifest", "./o2-crailsheim.webmanifest", "./o2-schwaebisch-hall.webmanifest", "./o2-stuttgart-vaihingen.webmanifest", "./telekom-crailsheim.webmanifest"];
const CDN = ['cdnjs.cloudflare.com', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.includes('googleapis.com') && !url.hostname.startsWith('fonts.')) return;   // Firestore/Auth nie cachen
  if (url.hostname.includes('firebaseapp.com')) return;

  if (req.mode === 'navigate') {   // Seiten: Netz zuerst, offline aus Cache
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); return r; })
      .catch(() => caches.match(req, { ignoreSearch:true }).then(h => h || caches.match('./index.html'))));
    return;
  }
  if (url.origin === location.origin || CDN.includes(url.hostname)) {   // Dateien: Cache zuerst
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); }
      return r;
    })));
  }
});
