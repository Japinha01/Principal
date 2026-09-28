/* Fundição 7 — service worker: deixa o jogo instalável e jogável sem internet.
   Rede primeiro (sempre pega a versão nova); sem internet, usa a cópia guardada.
   Ao mudar a lista abaixo, troque a VERSAO. */
const VERSAO = 'fundicao7-v2-3';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './src/main.js', './src/sim.js', './src/data.js', './src/render.js', './src/models.js', './src/fx.js', './src/audio.js', './src/i18n.js',
  './vendor/three.module.min.js', './vendor/RoundedBoxGeometry.js', './vendor/BufferGeometryUtils.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => Promise.all(ARQUIVOS.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok && !res.redirected) { const copia = res.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
