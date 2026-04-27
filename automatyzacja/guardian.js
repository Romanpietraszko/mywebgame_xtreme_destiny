// ==========================================
// GUARDIAN.JS - Inteligentny Strażnik Wydajności i Stabilności
// ==========================================
console.log("🛡️ XD Guardian System: ONLINE");

window.Guardian = (function() {
    // Prywatne zmienne monitorujące
    let lastTickTime = Date.now();
    let frameTimes = [];
    let isLowSpecMode = false;
    let warningElement = null;

    // --- Inicjalizacja UI Ostrzeżeń ---
    function initUI() {
        if (!document.getElementById('guardian-warning')) {
            warningElement = document.createElement('div');
            warningElement.id = 'guardian-warning';
            warningElement.style.cssText = `
                position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
                background: rgba(231, 76, 60, 0.9); color: white; padding: 5px 15px;
                border-radius: 5px; font-weight: bold; font-family: 'Rajdhani', sans-serif;
                z-index: 9999; display: none; box-shadow: 0 0 10px red; pointer-events: none;
            `;
            document.body.appendChild(warningElement);
        }
    }

    function showWarning(msg) {
        if (warningElement) {
            warningElement.innerText = msg;
            warningElement.style.display = 'block';
        }
    }

    function hideWarning() {
        if (warningElement) warningElement.style.display = 'none';
    }

    // --- Pętla mierząca FPS ---
    function monitorWydajnosci(timestamp) {
        if (window.Flagi && window.Flagi.Stan.aktualny === 'PLAYING') {
            let now = Date.now();
            frameTimes.push(now);
            // Usuwamy klatki starsze niż 1 sekunda
            while (frameTimes.length > 0 && frameTimes[0] <= now - 1000) {
                frameTimes.shift();
            }

            let fps = frameTimes.length;
            
            // Auto-Downgrade grafiki, jeśli FPS spada poniżej 30 przez dłuższą chwilę
            if (fps < 30 && !isLowSpecMode && fps > 0) {
                console.warn("🛡️ [GUARDIAN] Wykryto spadki FPS (" + fps + "). Włączam tryb optymalnej wydajności!");
                isLowSpecMode = true;
                if (window.Flagi) window.Flagi.Srodowisko.isMobile = true; // Wymusza wyłączenie shadowBlur w grafika.js
            }

            // Watchdog Sieciowy (Zgubione pakiety)
            if (now - lastTickTime > 2000) {
                showWarning("⚠️ UTRACONO POŁĄCZENIE Z SERWEREM...");
            } else {
                hideWarning();
            }
        }
        requestAnimationFrame(monitorWydajnosci);
    }

    // --- Uruchomienie ---
    window.addEventListener('DOMContentLoaded', () => {
        initUI();
        requestAnimationFrame(monitorWydajnosci);
    });

    // --- Globalne zabezpieczenia ---
    window.addEventListener('blur', function() {
        console.log("🛡️ [GUARDIAN] Utracono ostrość. Wymuszam zatrzymanie postaci.");
        // Symulujemy puszczenie wszystkich klawiszy, aby gracz nie biegł w nieskończoność
        const keysToRelease = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ'];
        keysToRelease.forEach(code => {
            window.dispatchEvent(new KeyboardEvent('keyup', { 'code': code }));
        });
    });

    window.addEventListener('error', function(event) {
        console.error("🛡️ [GUARDIAN] Przechwycono krytyczny błąd: ", event.message);
        // Zabezpiecza przed "Białym Ekranem Śmierci" - gra się nie zawiesi, tylko zignoruje uszkodzoną klatkę
        event.preventDefault(); 
    });

    // Publiczne API Guardiana (Do użycia w tryby.js i grafika.js)
    return {
        // 1. ZGŁASZANIE PULSU SERWERA
        odbierzTick: function() {
            lastTickTime = Date.now();
        },

        // 2. BEZPIECZNA MATEMATYKA
        clamp: function(value, min, max) {
            if (isNaN(value)) return min;
            return Math.min(Math.max(value, min), max);
        },

        safeNum: function(value, fallback = 0) {
            return (typeof value === 'number' && !isNaN(value)) ? value : fallback;
        },

        lerp: function(start, end, factor = 0.3) {
            return start + (end - start) * factor;
        },

        // 3. NOWOŚĆ: SANITYZACJA DANYCH (Autonaprawa w locie)
        safeObj: function(data) {
            // Jeśli dane to obiekt i nie jest null, oddaj je. W przeciwnym razie oddaj pusty obiekt.
            if (typeof data === 'object' && data !== null && !Array.isArray(data)) return data;
            return {};
        },

        safeArray: function(data) {
            // Zamienia cokolwiek co przyszło z serwera na bezpieczną tablicę do pętli .forEach()
            if (!data) return [];
            if (Array.isArray(data)) return data;
            if (typeof data === 'object') return Object.values(data);
            return [];
        },

        safeString: function(value, fallback = "") {
            // Zabezpiecza np. Nick gracza przed wywaleniem funkcji renderującej tekst
            if (typeof value === 'string') return value;
            if (value && typeof value.toString === 'function') return value.toString();
            return fallback;
        }
    };
})();