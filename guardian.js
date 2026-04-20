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

    // ==========================================
    // 2. MODUŁ ANTY-LAG (Linear Interpolation - LERP)
    // Służy do wygładzania ruchu innych graczy. Zamiast "teleportować"
    // ich co tick serwera, płynnie ich przesuwamy.
    // ==========================================
    lerp: function(start, end, factor = 0.2) {
        return start + (end - start) * factor;
    },

    // ==========================================
    // 3. AUTO-REANIMACJA (Globalny Error Catcher)
    // ==========================================
    initProtection: function() {
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
    }
};

// Uruchamiamy tarczę od razu po załadowaniu pliku
window.Guardian.initProtection();