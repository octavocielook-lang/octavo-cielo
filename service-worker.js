const CACHE = 'octavo-cielo-v2';
const ASSETS = [
  '/octavo-cielo-electiva.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Cinzel:wght@400;500&family=Jost:wght@300;400&display=swap'
];

// Instalación: guarda los assets en caché
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activación: limpia cachés viejas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: sirve desde caché si está, si no va a la red
self.addEventListener('fetch', e => {
  // Las llamadas a la API de Anthropic nunca se cachean
  if (e.request.url.includes('anthropic.com') || e.request.url.includes('netlify/functions')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
