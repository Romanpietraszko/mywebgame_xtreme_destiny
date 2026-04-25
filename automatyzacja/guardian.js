// ==========================================
// GUARDIAN.JS - Centralny System Anty-Bug i Anty-Lag
// ==========================================
console.log("🛡️ XD Guardian System: ONLINE");

window.Guardian = {
    // ==========================================
    // 1. MODUŁ ANTY-BUG (Sanityzacja Danych)
    // Zabezpiecza przed wysypaniem się gry, gdy serwer wyśle śmieci
    // ==========================================
    
    // Używamy tego zamiast ufać, że serwer przysłał idealną tablicę
    safeArray: function(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (typeof data === 'object') return Object.values(data);
        return [];
    },

    // Upewnia się, że masa gracza nigdy nie zmieni się w "NaN" (Not a Number)
    safeNum: function(value, fallback = 0) {
        if (typeof value === 'number' && !isNaN(value)) return value;
        return fallback;
    },

    // Bezpieczny String (Zapobiega błędom przy renderowaniu tekstów)
    safeString: function(value, fallback = "") {
        if (typeof value === 'string') return value;
        if (value && typeof value.toString === 'function') return value.toString();
        return fallback;
    },

    // Bezpieczny Obiekt (Zapobiega błędom "Cannot read property of undefined")
    safeObj: function(value) {
        if (typeof value === 'object' && value !== null) return value;
        return {};
    },

    // ==========================================
    // 2. MODUŁ ANTY-LAG (Zarządzanie Pamięcią i Ruchem)
    // ==========================================
    
    // Płynne przesuwanie graczy zamiast teleportacji
    lerp: function(start, end, factor = 0.2) {
        return start + (end - start) * factor;
    },

    // Strażnik Pamięci RAM (Memory Leak Protector)
    // Ucina stare obiekty (cząsteczki, logi), jeśli przekroczą bezpieczny limit
    limitArray: function(arr, maxLimit) {
        if (arr && arr.length > maxLimit) {
            arr.splice(0, arr.length - maxLimit);
        }
    },

    // Przepustnica (Throttle)
    // Zabezpiecza przed spamowaniem serwera (np. 100 kliknięć na sekundę)
    throttle: function(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    },

    // ==========================================
    // 3. AUTO-REANIMACJA (Globalny Catcher i UX)
    // ==========================================
    initProtection: function() {
        // Tarcza przeciw awariom pętli
        window.addEventListener('error', function(event) {
            console.warn("🛡️ [GUARDIAN] Zablokowano krytyczny błąd silnika!");
            console.warn("Treść błędu:", event.message);
            
            // Gra nie wysypie się na czerwono w przeglądarce
            event.preventDefault(); 
            
            // Jeśli pętla gry umarła, Guardian próbuje ją zrestartować
            if (typeof gameLoop === 'function' && window.gameState === 'PLAYING') {
                console.log("🛠️ Guardian reanimuje pętlę gry...");
                requestAnimationFrame(gameLoop);
            }
        });

        // Anty-Ghost Walking (Reset Klawiszy po kliknięciu poza grę)
        window.addEventListener('blur', function() {
            console.log("🛡️ [GUARDIAN] Utracono ostrość okna. Wyłączam blokadę ruchu.");
            // Reset dla klawiatury
            if (typeof keys !== 'undefined') {
                for (let k in keys) keys[k] = false;
            }
            // Reset dla wirtualnych klawiszy (Gesty AI)
            if (typeof window.virtualKeys !== 'undefined') {
                for (let vk in window.virtualKeys) window.virtualKeys[vk] = false;
            }
            // Reset dla mobilnego joysticka
            if (typeof window.mobileJoy !== 'undefined') {
                window.mobileJoy.active = false;
                window.mobileJoy.dx = 0;
                window.mobileJoy.dy = 0;
            }
        });

        // Ochrona Graficzna dla urządzeń mobilnych (Zgubiony Canvas)
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            canvas.addEventListener('webglcontextlost', function(e) {
                console.warn("🛡️ [GUARDIAN] Silnik zgubił kontekst graficzny (brak RAMu na telefonie).");
                e.preventDefault(); 
            }, false);
            
            canvas.addEventListener('webglcontextrestored', function() {
                console.log("🛡️ [GUARDIAN] Kontekst graficzny odzyskany. Gramy dalej.");
            }, false);
        }
    }
};

// Uruchamiamy tarczę od razu po załadowaniu pliku
window.Guardian.initProtection();