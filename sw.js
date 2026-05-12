// ==========================================
// SW.JS - Service Worker PWA (Vibe Noir)
// ==========================================

// ZMIANA WERSJI NA V2: Wymusza na przeglądarkach pobranie nowego pakietu audio!
const CACHE_NAME = 'vibe-noir-cache-v2'; 

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/tryby.js',
    '/grafika.js',
    '/flagi.js',
    '/automatyzacja/guardian.js',
    '/manifest.json', // Dodano plik manifestu PWA
    '/assety/logo.png',
    '/assety/icon-192.png', // Dodano ikonę instalacji
    '/assety/favicon.ico', // Dodano favicon
    '/assety/xtreme-destiny-postac(1).png',
    '/assety/ninja-transparent.png',
    '/assety/postac-bez-tla.png',
    
    // === PAKIET AUDIO AAA ===
    '/assety/fire.mp3',
    '/assety/fire_whoosh.mp3',
    '/assety/dark_trap.mp3',
    '/assety/throw.mp3',
    '/assety/hit.mp3',
    '/assety/eat.mp3',
    '/assety/death.mp3',
    '/assety/alert.mp3'
];

// 1. INSTALACJA I ZAPISYWANIE DO CACHE
self.addEventListener('install', (event) => {
    console.log('🛡️ [Service Worker] Instalacja (Pobieranie assetów v2)...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('🛡️ [Service Worker] Zapisywanie plików bazowych i audio do cache...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); // Wymusza natychmiastową aktualizację u graczy
});

// 2. AKTYWACJA I CZYSZCZENIE STARYCH CACHE
self.addEventListener('activate', (event) => {
    console.log('🛡️ [Service Worker] Aktywacja...');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('🛡️ [Service Worker] Usuwanie starego cache:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

// 3. OBSŁUGA ZAPYTAŃ (Network First, Cache Fallback)
self.addEventListener('fetch', (event) => {
    // Ignorujemy zapytania do Socket.io, rozszerzeń Chrome i requesty inne niż GET
    if (event.request.url.includes('socket.io') || event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
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
                // Jeśli brak internetu, oddajemy plik (w tym nasze nowe mp3) z pamięci podręcznej
                return caches.match(event.request);
            })
    );
});