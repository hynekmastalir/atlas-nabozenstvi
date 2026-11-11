/* Service worker pro Časovou osu: aplikace běží i bez internetu.
   Online se vždy bere čerstvá verze (a ukládá se), offline se použije uložená. Při změně seznamu souborů zvyš VERSION. */
const VERSION = 'osa-v1';
const PRECACHE = ['./', 'index.html', 'css/osa.css', 'js/osa.js', 'js/pwa.js', 'data/udalosti.json', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) {                       // písma: nejdřív cache, jinak síť a uložit
    e.respondWith(caches.open(VERSION).then(async c => (await c.match(req)) || fetch(req).then(r => { c.put(req, r.clone()); return r; })));
    return;
  }
  if (url.origin !== location.origin) return;                    // obrázky z cizích webů neukládáme
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    try {
      const r = await fetch(req);
      if (r.ok) c.put(req, r.clone());
      return r;
    } catch {
      return (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await c.match('index.html') : Response.error());
    }
  })());
});
