// ==========================================
// SW.JS - Service Worker PWA (Vibe Noir)
// ==========================================

const CACHE_NAME = 'vibe-noir-cache-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/tryby.js',
    '/grafika.js',
    '/flagi.js',
    '/automatyzacja/guardian.js',
    '/assety/logo.png',
    '/assety/xtreme-destiny-postac(1).png',
    '/assety/ninja-transparent.png',
    '/assety/postac-bez-tla.png'
];

// 1. INSTALACJA I ZAPISYWANIE DO CACHE
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalacja...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Zapisywanie plików bazowych do cache...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// 2. AKTYWACJA I CZYSZCZENIE STARYCH CACHE
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Aktywacja...');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Usuwanie starego cache:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

// 3. OBSŁUGA ZAPYTAŃ (Network First, Cache Fallback)
self.addEventListener('fetch', (event) => {
    // Ignorujemy zapytania do Socket.io i innych zewnętrznych API
    if (event.request.url.includes('socket.io') || event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Jeśli pobranie z sieci się udało, odkładamy to do cache na później
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            })
            .catch(() => {
                // Jeśli brak internetu, oddajemy plik z pamięci podręcznej (Cache)
                return caches.match(event.request);
            })
    );
});