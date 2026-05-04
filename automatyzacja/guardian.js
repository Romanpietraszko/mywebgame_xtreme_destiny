// ==========================================
// /automatyzacja/guardian.js - Centrala (Zarządca i Hub Systemu AAA+)
// Wyposażony w Watchdoga, Memory Guard i ochronę przed manipulacją z zewnątrz
// ==========================================

console.log("🛡️ [VIBE NOIR] Inicjalizacja Centrali Guardian...");

class GuardianSystem {
    constructor() {
        // Zabezpieczenie przed brakiem modułów (wymagana kolejność w HTML)
        if (!window.GuardianBrain || !window.GuardianHand) {
            console.error("☠️ [GUARDIAN] BŁĄD KRYTYCZNY: Brak modułów Brain lub Hand! Sprawdź kolejność w index.html");
            return;
        }

        // Podpięcie Zwojów i Mięśni
        this.brain = new window.GuardianBrain();
        this.hand = new window.GuardianHand();
        
        // --- TARCZA GLOBALNA NA BŁĘDY SILNIKA ---
        window.addEventListener('error', (e) => {
            console.error("🛡️ [KRYTYCZNE] Przechwycono globalny błąd silnika.", e.message);
            if (this.brain.analizujCrash(e, "Global Engine")) {
                this.hand.wymusTwardyReset();
            }
            e.preventDefault();
        });
        
        window.addEventListener('unhandledrejection', (e) => {
            console.warn("🛡️ [GUARDIAN] Przechwycono odrzuconą obietnicę asynchroniczną.");
            e.preventDefault();
        });

        // --- PĘTLA WYDAJNOŚCI I SYSTEMU WATCHDOG ---
        const petlaCentrali = () => {
            if (window.Flagi && window.Flagi.Stan.aktualny === 'PLAYING') {
                
                // 1. Analiza klatek (FPS) i lagów
                const raport = this.brain.analizujWydajnosc();
                if (raport.stan === 'LOW_SPEC') {
                    this.hand.wlaczTrybZiemniaka();
                }
                
                if (raport.awariaSerwera) {
                    this.hand.pokazOstrzezenie("Brak sygnału serwera - Rekonfiguracja węzła");
                } else {
                    this.hand.ukryjOstrzezenie();
                }

                // 2. Memory Guard - Ochrona przed wyciekami RAM (Out-Of-Memory Crash)
                this.monitorujPamiec();

                // 3. Watchdog - Anty-Tamper (Sprawdza czy haker nie usunął mózgu w konsoli F12)
                this.weryfikujIntegralnosciSystemu();
            }
            requestAnimationFrame(petlaCentrali);
        };
        requestAnimationFrame(petlaCentrali);
        
        console.log("🛡️ [VIBE NOIR] System Guardian: WSZYSTKIE MODUŁY ZINTEGROWANE I ZABEZPIECZONE.");
    }

    // --- NOWOŚĆ: MEMORY GUARD ---
    monitorujPamiec() {
        // Działa w przeglądarkach opartych na Chromium (Chrome, Edge, Opera, Brave)
        if (window.performance && window.performance.memory) {
            // Zamiana bajtów na Megabajty
            const zuzycieMB = window.performance.memory.usedJSHeapSize / 1048576; 
            
            // Jeśli JS pożera ponad 500MB RAM-u (potencjalny wyciek / memory leak)
            if (zuzycieMB > 500 && !this.brain.isLowSpecMode) {
                console.warn(`🛡️ [GUARDIAN] Krytyczne zużycie pamięci RAM: ${zuzycieMB.toFixed(2)} MB! Odciążam rdzeń.`);
                this.hand.wlaczTrybZiemniaka();
                if (this.brain.ai) {
                    this.brain.ai.zglosAnomalie("Wydajność", "Wykryto ogromny wyciek pamięci operacyjnej", { ramUsed: zuzycieMB });
                }
            }
        }
    }

    // --- NOWOŚĆ: WATCHDOG (ANTY-TAMPER) ---
    weryfikujIntegralnosciSystemu() {
        // Hakerzy czasem wpisują `window.Guardian.brain = null`, by wyłączyć ochronę
        if (!this.brain || !this.hand) {
            console.error("☠️ [WATCHDOG] Wykryto manipulację w pamięci klienta! Moduły zostały naruszone.");
            // Ratunkowy, twardy reset
            try { sessionStorage.clear(); } catch(e) {}
            window.location.reload(true);
        }
    }

    // --- PUBLICZNE API DLA TRYBY.JS ---

    odbierzTick() { 
        this.brain.odbierzPuls(); 
    }

    rejestrujKlikniecie() {
        if (this.brain.wykryjAutoClicker()) {
            this.hand.mrugnijEkranem('rgba(241, 196, 15, 0.2)', 150); // Żółty błysk ostrzegawczy
            this.hand.pokazOstrzezenie("Zablokowano nienaturalną szybkość kliknięć!", true);
            return false; // Zablokuj akcję
        }
        return true; // Autoryzacja pozytywna
    }

    // --- TARCZA SIECIOWA (Oczyszczanie Danych Serwerowych) ---
    sanityzujStanSerwera(surowyStan) {
        if (!surowyStan || typeof surowyStan !== 'object') {
            return { players: {}, bots: {}, foods: {}, projectiles: {} };
        }
        
        // Zabezpieczenie przed "Zatruciem Ładunku" (Payload Bombing)
        // Jeśli serwer (lub atakujący Man-In-The-Middle) przyśle gigantyczny obiekt
        const przyblizonyRozmiar = Object.keys(surowyStan.players || {}).length + Object.keys(surowyStan.projectiles || {}).length;
        if (przyblizonyRozmiar > 2000) {
            console.error("🛡️ [GUARDIAN] Odrzucono pakiet: Przekroczono limit obiektów (DDoS Payload).");
            if (this.brain.ai) this.brain.ai.zglosAnomalie("DDoS Protection", "Gigantyczny Payload", { size: przyblizonyRozmiar });
            return { players: {}, bots: {}, foods: {}, projectiles: {} };
        }

        let czystyStan = { players: {}, bots: {}, foods: {}, projectiles: {} };

        try {
            if (surowyStan.players) {
                Object.keys(surowyStan.players).forEach(id => {
                    const g = this.brain.analizujGracza(surowyStan.players[id]);
                    if (g) czystyStan.players[id] = g;
                });
            }
            if (surowyStan.bots) {
                Object.keys(surowyStan.bots).forEach(id => {
                    const b = this.brain.analizujGracza(surowyStan.bots[id]);
                    if (b) { 
                        b.ownerId = surowyStan.bots[id].ownerId ? String(surowyStan.bots[id].ownerId) : null; 
                        czystyStan.bots[id] = b; 
                    }
                });
            }
            if (surowyStan.foods) {
                let fArray = Array.isArray(surowyStan.foods) ? surowyStan.foods : Object.values(surowyStan.foods);
                fArray.forEach((f, idx) => {
                    if (f && typeof f === 'object') {
                        let fx = Number(f.x), fy = Number(f.y);
                        if (Number.isFinite(fx) && Number.isFinite(fy)) czystyStan.foods[f.id || idx] = { x: fx, y: fy };
                    }
                });
            }
            if (surowyStan.projectiles) {
                Object.keys(surowyStan.projectiles).forEach(id => {
                    const p = this.brain.analizujPocisk(surowyStan.projectiles[id]);
                    if (p) czystyStan.projectiles[id] = p;
                });
            }
        } catch (e) {
            console.error("🛡️ [GUARDIAN] Krytyczny błąd sanityzacji sieci.", e);
            // Wywołanie sztucznej inteligencji opartej o najnowszego Brain.js (BrainAiCore)
            if (this.brain.ai && typeof this.brain.ai.zglosAnomalie === 'function') {
                this.brain.ai.zglosAnomalie("Inspektor Sieciowy", "Pakiet spowodował crash walidacji", e.stack);
            }
            return { players: {}, bots: {}, foods: {}, projectiles: {} };
        }
        
        return czystyStan;
    }

    // --- KONTROLA PAMIĘCI (Zabezpieczenie przed StackOverflow i wyciekiem obiektów) ---
    safeObj(data, typ = 'ogolne') {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) return {};
        if (typ === 'foods') return data; // Jedzenie przetwarzamy osobno
        
        try {
            const klucze = Object.keys(data);
            let limit = (typ === 'projectiles') ? 150 : (typ === 'bots') ? 80 : 300;
            
            if (klucze.length > limit) {
                let zred = {};
                for (let i = 0; i < limit; i++) zred[klucze[i]] = data[klucze[i]];
                return zred;
            }
            return data;
        } catch(e) { return {}; }
    }

    safeArray(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (typeof data === 'object') { 
            try { return Object.values(data); } 
            catch(e) { return []; } 
        }
        return [];
    }

    // --- KWARANTANNA DLA NIEBEZPIECZNYCH FUNKCJI ---
    chronFukcje(funkcjaDoUruchomienia, nazwaModulu = "Nieznany") {
        const brainRef = this.brain;
        const handRef = this.hand;
        
        return function(...argumenty) {
            try { 
                return funkcjaDoUruchomienia.apply(this, argumenty); 
            } 
            catch (blad) {
                console.error(`🛡️ [GUARDIAN] Izolowany moduł [${nazwaModulu}] uległ awarii.`, blad);
                // Przekazanie błędu do Analizatora Crash-Loops w Mózgu
                if (brainRef && brainRef.analizujCrash(blad, nazwaModulu)) {
                    if (handRef) handRef.wymusTwardyReset();
                }
            }
        };
    }
}

// Inicjalizacja Centrali jako Bytu Niezmiennego
window.Guardian = new GuardianSystem();

// Ostatnia linia obrony: Próba zamrożenia instancji w środowiskach, które to wspierają,
// aby zapobiec nadpisaniu 'window.Guardian' przez cheaterów w konsoli przeglądarki.
try {
    Object.defineProperty(window, 'Guardian', {
        writable: false,
        configurable: false
    });
} catch(e) {}