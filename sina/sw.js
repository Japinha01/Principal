// Service worker do Sina: permite instalar como app e jogar sem internet.
// Ao publicar uma versão nova, mude o número abaixo para os jogadores receberem a atualização.
const VERSAO = 'sina-v17';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // pagamentos, anúncios e fontes sempre pela rede
  if (url.pathname.startsWith('/api/') || url.origin !== location.origin) return;
  // o jogo: tenta a versão nova primeiro; sem internet, usa a guardada
  ev.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(VERSAO).then(c => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
