// ==========================================
// GUARDIAN.JS - Kwarantanna, Walidator Typów i Tarcza Antykryzysowa (AAA Agent)
// ==========================================
console.log("🛡️ XD Guardian System: ONLINE - Kwarantanna aktywna.");

window.Guardian = (function() {
    // Prywatne zmienne monitorujące
    let lastTickTime = Date.now();
    let frameTimes = [];
    let isLowSpecMode = false;
    let warningElement = null;
    
    // Zmienne Anty-Lag / Anty-Spam
    let historiaKlikniec = [];
    let droppedFrames = 0;

    // --- SŁOWNIK REGUŁ I WARTOŚCI AWARYJNYCH ---
    const BEZPIECZNE_WARTOSCI = {
        liczba: 0,
        pozycja: 2000,
        tekst: "Nieznany",
        kolor: "#ffffff",
        masa: 10,
        boolean: false
    };

    const LIMITS = {
        minX: -1000, maxX: 10000,
        minY: -1000, maxY: 10000,
        maxScore: 999999,
        maxPredkosc: 150
    };

    // --- Inicjalizacja UI Ostrzeżeń ---
    function initUI() {
        if (!document.getElementById('guardian-warning')) {
            warningElement = document.createElement('div');
            warningElement.id = 'guardian-warning';
            warningElement.style.cssText = `
                position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
                background: rgba(231, 76, 60, 0.9); color: white; padding: 5px 15px;
                border-radius: 5px; font-weight: bold; font-family: 'Rajdhani', 'Exo 2', sans-serif;
                z-index: 99999; display: none; box-shadow: 0 0 10px red; pointer-events: none;
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
            
            while (frameTimes.length > 0 && frameTimes[0] <= now - 1000) {
                frameTimes.shift();
            }

            let fps = frameTimes.length;
            
            if (fps < 30 && !isLowSpecMode && fps > 0) {
                console.warn("🛡️ [GUARDIAN] Wykryto spadki FPS (" + fps + "). Włączam tryb optymalnej wydajności!");
                isLowSpecMode = true;
                if (window.Flagi) window.Flagi.Srodowisko.isMobile = true; 
            }

            if (now - lastTickTime > 2000) {
                showWarning("⚠️ UTRACONO POŁĄCZENIE Z SERWEREM...");
            } else {
                hideWarning();
            }
        }
        requestAnimationFrame(monitorWydajnosci);
    }

    window.addEventListener('DOMContentLoaded', () => {
        initUI();
        requestAnimationFrame(monitorWydajnosci);
    });

    // --- 1. GLOBALNA TARCZA ANTY-CRASHOWA ---
    window.addEventListener('blur', function() {
        console.log("🛡️ [GUARDIAN] Utracono ostrość. Wymuszam zatrzymanie postaci.");
        const keysToRelease = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ'];
        keysToRelease.forEach(code => {
            window.dispatchEvent(new KeyboardEvent('keyup', { 'code': code }));
        });
    });

    window.addEventListener('error', function(event) {
        console.error("🛡️ [GUARDIAN] Przechwycono krytyczny błąd! Izolacja w toku:", event.message);
        event.preventDefault(); 
    });
    
    window.addEventListener('unhandledrejection', function(event) {
        console.warn("🛡️ [GUARDIAN] Przechwycono porzuconą obietnicę (Promise). Ignoruję.");
        event.preventDefault();
    });

    // --- 3. SANITYZATOR (CZYSZCZENIE DANYCH WEWNĘTRZNE) ---
    function wymusLiczbe(wartosc, domyslna, min, max) {
        let num = Number(wartosc);
        if (Number.isNaN(num) || num === null || num === undefined) return domyslna;
        if (min !== undefined && num < min) return min;
        if (max !== undefined && num > max) return max;
        return num;
    }

    function wymusTekst(wartosc, domyslna) {
        if (typeof wartosc !== 'string' || wartosc.trim() === '') return domyslna;
        return wartosc.replace(/[<>]/g, ""); 
    }

    // --- 4. KWARANTANNA GŁÓWNYCH OBIEKTÓW ---
    function filtrujGracza(gracz) {
        if (!gracz) return null;
        return {
            id: wymusTekst(gracz.id, "BrakID"),
            name: wymusTekst(gracz.name, "Gracz"),
            x: wymusLiczbe(gracz.x, BEZPIECZNE_WARTOSCI.pozycja, LIMITS.minX, LIMITS.maxX),
            y: wymusLiczbe(gracz.y, BEZPIECZNE_WARTOSCI.pozycja, LIMITS.minY, LIMITS.maxY),
            score: wymusLiczbe(gracz.score, BEZPIECZNE_WARTOSCI.masa, 0, LIMITS.maxScore),
            dx: wymusLiczbe(gracz.dx, 0, -LIMITS.maxPredkosc, LIMITS.maxPredkosc),
            dy: wymusLiczbe(gracz.dy, 0, -LIMITS.maxPredkosc, LIMITS.maxPredkosc),
            skin: wymusTekst(gracz.skin, "standard"),
            team: gracz.team ? wymusTekst(gracz.team, "NONE") : null,
            kat: wymusLiczbe(gracz.kat, 0),
            isSafe: Boolean(gracz.isSafe),
            isShielding: Boolean(gracz.isShielding)
        };
    }

    function filtrujPocisk(pocisk) {
        if (!pocisk) return null;
        return {
            x: wymusLiczbe(pocisk.x, 0),
            y: wymusLiczbe(pocisk.y, 0),
            dx: wymusLiczbe(pocisk.dx, 0),
            dy: wymusLiczbe(pocisk.dy, 0),
            type: wymusTekst(pocisk.type, "oszczep"),
            mode: wymusTekst(pocisk.mode, "FREE"),
            team: pocisk.team ? wymusTekst(pocisk.team, "NONE") : null,
            piercing: Boolean(pocisk.piercing)
        };
    }

    function chronKlatke(funkcjaDoUruchomienia, nazwaModulu = "Nieznany") {
        return function(...argumenty) {
            try {
                return funkcjaDoUruchomienia.apply(this, argumenty);
            } catch (blad) {
                console.error(`🛡️ [GUARDIAN] Moduł [${nazwaModulu}] uległ awarii. Klatka pominięta.`, blad);
            }
        };
    }

    // Publiczne API Guardiana
    return {
        // ZGŁASZANIE PULSU SERWERA
        odbierzTick: function() {
            let teraz = Date.now();
            let roznica = teraz - lastTickTime;
            lastTickTime = teraz;

            if (roznica > 150) {
                droppedFrames++;
                if (droppedFrames % 10 === 0) {
                    console.log(`🐌 [LAG SPIKE] Opóźnienie serwera: ${roznica}ms. System utrzymuje stabilność.`);
                }
            }
        },

        // Ochrona przed spamowaniem kliknięciami
        rejestrujKlikniecie: function() {
            let teraz = Date.now();
            historiaKlikniec.push(teraz);
            
            if (historiaKlikniec.length > 6) historiaKlikniec.shift();

            if (historiaKlikniec.length === 6) {
                let czasTrwania = historiaKlikniec[5] - historiaKlikniec[0];
                if (czasTrwania < 120) {
                    console.warn("🛡️ [GUARDIAN] Zablokowano spam kliknięć (Auto-Clicker wstrzymany).");
                    historiaKlikniec = []; 
                    return false; 
                }
            }
            return true; 
        },

        // BEZPIECZNA MATEMATYKA (Fallback)
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

        // --- GŁÓWNY ZAWÓR BEZPIECZEŃSTWA: STERYLIZACJA PAKIETÓW Z SIECI ---
        sanityzujStanSerwera: function(surowyStan) {
            if (!surowyStan) return { players: {}, bots: {}, foods: {}, projectiles: {} };
            
            let bezpiecznyStan = { players: {}, bots: {}, foods: {}, projectiles: {} };

            // Oczyszczanie Graczy
            if (surowyStan.players) {
                Object.keys(surowyStan.players).forEach(id => {
                    let bezpieczny = filtrujGracza(surowyStan.players[id]);
                    if (bezpieczny) bezpiecznyStan.players[id] = bezpieczny;
                });
            }

            // Oczyszczanie Botów
            if (surowyStan.bots) {
                Object.keys(surowyStan.bots).forEach(id => {
                    let bot = filtrujGracza(surowyStan.bots[id]);
                    if (bot) {
                        bot.isBoss = Boolean(surowyStan.bots[id].isBoss);
                        bot.ownerId = surowyStan.bots[id].ownerId ? String(surowyStan.bots[id].ownerId) : null;
                        bezpiecznyStan.bots[id] = bot;
                    }
                });
            }

            // Oczyszczanie Jedzenia
            if (surowyStan.foods) {
                Object.keys(surowyStan.foods).forEach(id => {
                    let f = surowyStan.foods[id];
                    if (f && typeof f.x === 'number' && !Number.isNaN(f.x) && typeof f.y === 'number' && !Number.isNaN(f.y)) {
                        bezpiecznyStan.foods[id] = { x: f.x, y: f.y };
                    }
                });
            }

            // Oczyszczanie Pocisków
            if (surowyStan.projectiles) {
                Object.keys(surowyStan.projectiles).forEach(id => {
                    let p = filtrujPocisk(surowyStan.projectiles[id]);
                    if (p) bezpiecznyStan.projectiles[id] = p;
                });
            }

            return bezpiecznyStan;
        },

        // KAGANIEC PAMIĘCI (Limitowanie tablic/obiektów dla optymalizacji)
        safeObj: function(data, typ = 'ogolne') {
            if (typeof data !== 'object' || data === null || Array.isArray(data)) return {};

            let klucze = Object.keys(data);
            
            let maxLimit = 300; 
            if (typ === 'projectiles') maxLimit = 150;
            else if (typ === 'foods') maxLimit = 250;
            else if (typ === 'bots') maxLimit = 80;

            if (klucze.length > maxLimit) {
                let zredukowany = {};
                for(let i = 0; i < maxLimit; i++) {
                    zredukowany[klucze[i]] = data[klucze[i]];
                }
                return zredukowany;
            }

            return data;
        },

        safeArray: function(data) {
            if (!data) return [];
            if (Array.isArray(data)) return data;
            if (typeof data === 'object') return Object.values(data);
            return [];
        },

        safeString: function(value, fallback = "") {
            if (typeof value === 'string') return value;
            if (value && typeof value.toString === 'function') return value.toString();
            return fallback;
        },

        // API do owijania groźnych funkcji (Kwarantanna Kodu)
        chronFukcje: chronKlatke
    };
})();