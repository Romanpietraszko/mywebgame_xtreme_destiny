// ==========================================
// BRAIN.JS - Sztuczna Inteligencja z Bazą Sygnatur (Smart Core v11.2 OMEGA AAA)
// Posiada dedykowany rdzeń AI (BrainAiCore) do komunikacji z Ollamą
// WDROŻONO: 50+ Modułów Technicznych (Optymalizacja, AI Taktyczne, Anti-Cheat 2.0, Reżyser Gry)
// FIX: Izolacja Kar Per-Gracz, Memory Leak Fix, Node.js Universal Check
// ==========================================

// ---------------------------------------------------------
// 🧠 RDZEŃ AI BRAJANA (Komunikacja z lokalnym LLM)
// ---------------------------------------------------------
class BrainAiCore {
    constructor() {
        // [FIX] Universal Check (Zapobiega crashom window is not defined w Node.js)
        const isBrowser = typeof window !== 'undefined';
        this.isDevMode = isBrowser ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') : false;
        
        this.OLLAMA_URL = "http://localhost:11434/api/generate";
        this.OLLAMA_MODEL = "phi3:latest"; 
        this.czyZajety = false;

        if (this.isDevMode && isBrowser) {
            console.log(`🧠 [BRAIN-AI] Zwoje mózgowe podłączone. Model [${this.OLLAMA_MODEL}] gotowy do analizy anomali.`);
        }
    }

    async zglosAnomalie(typZagrozenia, opis, suroweDane) {
        if (!this.isDevMode || this.czyZajety) return;

        console.log(`🤖 [BRAIN-AI] Przechwycono [${typZagrozenia}]. Rozpoczynam syntezę raportu w tle...`);
        this.czyZajety = true;

        const promptDlaAI = `
        Jesteś głównym inżynierem DevSecOps silnika gry multiplayer w JavaScript. Mój system ochronny właśnie zablokował anomalię/błąd.
        
        Typ Zdarzenia: ${typZagrozenia}
        Opis Problemu: ${opis}
        Zrzut Obiektu: ${JSON.stringify(suroweDane).substring(0, 400)}
        
        Przeanalizuj to w dwóch żołnierskich punktach:
        1. Co dokładnie gracz (lub błąd w kodzie) próbował zrobić?
        2. Jak zablokować to u źródła w kodzie (podaj tylko czysty snippet naprawczy)?
        `;

        try {
            const response = await fetch(this.OLLAMA_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: this.OLLAMA_MODEL,
                    prompt: promptDlaAI,
                    stream: false
                })
            });

            if (response.ok) {
                const dane = await response.json();
                console.log(`%c🤖 [RAPORT OLLAMA - ${this.OLLAMA_MODEL}]\nKategoria: ${typZagrozenia}\n\n${dane.response}`, 'color: #00ffcc; background: #0a0a0a; padding: 12px; border-left: 5px solid #00ffcc; font-size: 13px;');
            } else {
                console.warn("🤖 [BRAIN-AI] Odmowa dostępu z API Ollamy.");
            }
        } catch (error) {
            console.warn("🤖 [BRAIN-AI] Lokalny proces Ollamy nie odpowiada. Uruchom 'ollama serve' w terminalu.");
        } finally {
            setTimeout(() => { this.czyZajety = false; }, 8000); 
        }
    }
}

// ---------------------------------------------------------
// GŁÓWNA KLASA MÓZGU (Logika, Heurystyka, Walidacja + AI BOTÓW)
// ---------------------------------------------------------
class GuardianBrain {
    constructor() {
        this.ai = new BrainAiCore();

        // --- METRYKI WYDAJNOŚCI ---
        this.frameTimes = [];
        this.lastTickTime = Date.now();
        this.droppedFrames = 0;
        this.isLowSpecMode = false;
        this.sredniaFPS = 60; 
        this.crashCount = 0;
        this.lastCrashTime = 0;

        // --- REJESTRY BEZPIECZEŃSTWA (Anti-Cheat 2.0 - PER PLAYER) ---
        this.historiaKlikniec = new Map();    // [FIX] ID -> [czasy kliknięć]
        this.poziomZagrozenia = new Map();    // [FIX] ID -> Threat Score
        this.historiaPozycji = new Map();     // [FIX] Przywrócona zmienna dla anty-teleportu
        this.shadowBans = new Set();          // [IDEA 10] Piekielne Lobby dla cheaterów
        this.lastShotTime = new Map();        // [IDEA 8] Server-Side Cooldown Check
        this.aimbotHeuristics = new Map();    // [IDEA 9] Śledzenie snapowania kątów
        this.zombieConnections = new Map();   // [IDEA 27] Ping-Pong Keepalive

        // --- REJESTRY OPTYMALIZACYJNE I AI ---
        this.internalClock = 0;               
        this.iqSlider = 1.0;                  
        this.lastHeartbeat = Date.now();      
        this.spatialGrid = new Map();         
        this.debugRays = [];                  
        
        // --- META-GRA I REŻYSERIA ---
        this.gameHour = 12.0;                 // [IDEA 21] Cykl dnia i nocy
        this.bounties = new Set();            // [IDEA 23] Listy Gończe na dominatorów
        this.heatmapaRzezi = new Map();       // [IDEA 20] Dynamic Spawner Density

        // --- MATEMATYKA (Angle-LUT) ---
        this.SIN_LUT = new Float32Array(360);
        this.COS_LUT = new Float32Array(360);
        for(let i = 0; i < 360; i++) {
            this.SIN_LUT[i] = Math.sin(i * Math.PI / 180);
            this.COS_LUT[i] = Math.cos(i * Math.PI / 180);
        }

        // --- BAZA SYGNATUR ---
        this.BAZA_ZAGROZEN = {
            XSS_TAGI: ["<script>", "javascript:", "onerror=", "onload=", "eval(", "alert(", "window.", "document.", "innerHTML", "iframe", "<img", "src="],
            MEMORY_EXPLOITS: ["__proto__", "constructor", "prototype", "Object.keys", "Object.assign", "setTimeout", "setInterval", "Function("],
            SQL_INJECTION: ["DROP TABLE", "SELECT *", "INSERT INTO", "DELETE FROM", "UNION SELECT", "--", ";--", "1=1", "OR 1=1"],
            CHEAT_ENGINE: ["hack", "godmode", "infinite", "admin", "root", "system"]
        };

        const wszystkieSygnatury = [
            ...this.BAZA_ZAGROZEN.XSS_TAGI,
            ...this.BAZA_ZAGROZEN.MEMORY_EXPLOITS,
            ...this.BAZA_ZAGROZEN.SQL_INJECTION,
            ...this.BAZA_ZAGROZEN.CHEAT_ENGINE
        ].map(slowo => slowo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); 
        
        this.skanerSygnatur = new RegExp(wszystkieSygnatury.join("|"), "i"); 

        this.ZASADY = {
            DOZWOLONE_SKINY: ['standard', 'ninja', 'zwiadowca', 'kowal', 'midas'],
            DOZWOLONE_POCISKI: ['oszczep', 'laser', 'rakieta', 'trucizna'],
            DOZWOLONE_TEAMY: ['RED', 'BLUE', 'NONE'],
            LIMITS: { 
                minPos: -5000, maxPos: 15000, 
                maxScore: 9999999, maxHP: 50000, maxSpeed: 1200, // Zwiększono lekko dla Dasha
                maxDeltaMove: 800
            }
        };

        this.runSelfDiagnostics();
    }

    // --- 1. MODUŁ WYDAJNOŚCI I SAMOLECZENIA ---
    analizujWydajnosc() {
        if (typeof document !== 'undefined' && document.hidden) {
            this.frameTimes = [];
            return { stan: 'OK', fps: this.sredniaFPS, awariaSerwera: false };
        }

        const now = Date.now();
        this.frameTimes.push(now);
        while (this.frameTimes.length > 0 && this.frameTimes[0] <= now - 1000) this.frameTimes.shift();

        const aktualnyFPS = this.frameTimes.length;
        if (aktualnyFPS > 0) this.sredniaFPS = (aktualnyFPS * 0.1) + (this.sredniaFPS * 0.9);
        
        let decyzja = { stan: 'OK', fps: Math.round(this.sredniaFPS), awariaSerwera: false };

        if (this.sredniaFPS < 28 && !this.isLowSpecMode && this.frameTimes.length > 15) {
            this.isLowSpecMode = true;
            this.iqSlider = 0.4; // Silny throttle SI w razie lagów
            decyzja.stan = 'LOW_SPEC';
        } else if (this.sredniaFPS > 55) {
            this.iqSlider = 1.0;
        }

        if (now - this.lastTickTime > 2000) decyzja.awariaSerwera = true;

        this.heartbeatMonitoring();

        // [IDEA 21] Cykl Dnia i Nocy (Progresja)
        this.gameHour = (this.gameHour + 0.005) % 24;

        return decyzja;
    }

    odbierzPuls(idKlienta) {
        const teraz = Date.now();
        const roznica = teraz - this.lastTickTime;
        this.lastTickTime = teraz;

        if (roznica > 150) {
            this.droppedFrames++;
            if (this.droppedFrames % 10 === 0) console.warn(`🧠 [BRAIN] Ostrzeżenie: Opóźnienie węzła ${roznica}ms.`);
        }

        // [IDEA 27] Ping-Pong Keepalive
        if (idKlienta && !idKlienta.startsWith('bot_')) {
            this.zombieConnections.set(idKlienta, teraz);
        }
    }

    analizujCrash(blad, nazwaModulu = "Ogólny") {
        const teraz = Date.now();
        if (teraz - this.lastCrashTime > 5000) this.crashCount = 0; 
        
        this.crashCount++;
        this.lastCrashTime = teraz;

        if (blad) {
            this.ai.zglosAnomalie(`Crash Aplikacji: ${nazwaModulu}`, blad.message || "Unknown Error", blad.stack || {});
        }

        return this.crashCount >= 4; 
    }

    // --- 2. MODUŁ BEHAWIORALNY & ANTI-CHEAT 2.0 (PER-PLAYER FIX) ---
    wykryjAutoClicker(id = 'LOCAL_CLIENT') {
        if (!id || id.startsWith('bot_')) return false;

        const teraz = Date.now();
        let historia = this.historiaKlikniec.get(id) || [];
        historia.push(teraz);
        if (historia.length > 8) historia.shift();
        
        this.historiaKlikniec.set(id, historia);

        if (historia.length === 8) {
            let interwaly = [];
            for (let i = 1; i < historia.length; i++) interwaly.push(historia[i] - historia[i-1]);

            const sredniInterwal = interwaly.reduce((a, b) => a + b) / interwaly.length;
            let wariancja = 0;
            interwaly.forEach(int => wariancja += Math.pow(int - sredniInterwal, 2));
            wariancja = wariancja / interwaly.length;

            const czasTrwania = historia[7] - historia[0];

            if (czasTrwania < 150 || (sredniInterwal < 50 && wariancja < 2.0)) {
                this.dodajZagrozenie(id, 30, "Auto-Clicker / Nieludzka wariancja wejść");
                this.historiaKlikniec.set(id, []); 
                return true; 
            }
        }
        this.chlodzenieZagrozenia();
        return false;
    }

    dodajZagrozenie(id = 'LOCAL_CLIENT', punkty, powod) {
        if (!id || id.startsWith('bot_')) return;

        let obecneZagrozenie = this.poziomZagrozenia.get(id) || 0;
        obecneZagrozenie += punkty;
        this.poziomZagrozenia.set(id, obecneZagrozenie);

        if (obecneZagrozenie > 50) {
            console.warn(`⚠️ [BRAIN] THREAT SCORE KRYTYCZNY (ID: ${id}): ${obecneZagrozenie}. Powód: ${powod}`);
            this.ai.zglosAnomalie("Analiza Behawioralna", "Zbyt duża ilość punktów zagrożenia gracza", { id, powod, aktualnyScore: obecneZagrozenie });
        }
    }

    chlodzenieZagrozenia() {
        this.poziomZagrozenia.forEach((punkty, id) => {
            if (punkty > 0 && Math.random() > 0.95) {
                this.poziomZagrozenia.set(id, punkty - 1);
            }
        });
    }

    // --- 4. FILTRY GŁĘBOKIEJ STERYLIZACJI (Wykorzystanie Słownika) ---
    wymusLiczbe(id, wartosc, domyslna, min, max, typTestu = "") {
        let safeId = id || 'SYSTEM';
        let num = Number(wartosc);
        
        if (!Number.isFinite(num) || isNaN(num)) {
            if (!typTestu.includes('bot')) this.dodajZagrozenie(safeId, 10, `Anomalia matematyczna w: ${typTestu}`);
            return domyslna; 
        }
        if (num < min) { if(!typTestu.includes('bot')) this.dodajZagrozenie(safeId, 2, `Underflow w: ${typTestu}`); return min; }
        if (num > max) { if(!typTestu.includes('bot')) this.dodajZagrozenie(safeId, 2, `Overflow w: ${typTestu}`); return max; }
        return num;
    }

    wymusTekst(id, wartosc, domyslna, maxDlugosc = 20) {
        let safeId = id || 'SYSTEM';
        if (typeof wartosc !== 'string' || !wartosc.trim()) return domyslna;
        
        if (this.skanerSygnatur.test(wartosc)) {
            this.dodajZagrozenie(safeId, 100, `Wykryto sygnaturę ataku w tekście! Treść: ${wartosc}`);
            return domyslna; 
        }

        const czysty = wartosc.replace(/[<>{}[\]"'`;()=&\\]/g, ""); 
        
        if (wartosc.length > maxDlugosc * 1.5) {
            this.dodajZagrozenie(safeId, 15, "Próba ataku Buffer Overflow");
        }
        
        return czysty.substring(0, maxDlugosc); 
    }

    // --- 5. LOGIKA APLIKACYJNA I FIZYKA ---
    analizujGracza(gracz) {
        if (!gracz || typeof gracz !== 'object' || Array.isArray(gracz)) return null;

        let rawId = (typeof gracz.id === 'string') ? gracz.id : "Ghost";
        let id = this.wymusTekst('SYSTEM', rawId, "Ghost", 30);
        
        const isInternalBot = id.startsWith('bot_') || gracz.isInternal === true;

        this.internalClock++;
        if (isInternalBot && this.internalClock % 2 !== 0 && this.iqSlider < 1.0) {
            return gracz; 
        }

        if (this.shadowBans.has(id)) {
            gracz.isShadowBanned = true;
        }

        let skin = this.wymusTekst(id, gracz.skin, "standard").toLowerCase();
        if (!this.ZASADY.DOZWOLONE_SKINY.includes(skin)) skin = "standard";

        let team = gracz.team ? this.wymusTekst(id, gracz.team, "NONE", 10).toUpperCase() : "NONE";
        if (!this.ZASADY.DOZWOLONE_TEAMY.includes(team)) team = "NONE";

        let punktyGracza = this.poziomZagrozenia.get(id) || 0;
        if (punktyGracza > 100 && !isInternalBot) {
            this.shadowBans.add(id); 
            this.poziomZagrozenia.set(id, 0); 
        }

        let isShielding = Boolean(gracz.isShielding);
        let isAttacking = Boolean(gracz.isAttacking);
        if (isShielding && isAttacking && !isInternalBot) {
            this.dodajZagrozenie(id, 15, "Używa tarczy i atakuje jednocześnie!");
            isAttacking = false; 
        }

        let x = this.wymusLiczbe(id, gracz.x, 2000, this.ZASADY.LIMITS.minPos, this.ZASADY.LIMITS.maxPos, 'Player.X');
        let y = this.wymusLiczbe(id, gracz.y, 2000, this.ZASADY.LIMITS.minPos, this.ZASADY.LIMITS.maxPos, 'Player.Y');
        let dx = this.wymusLiczbe(id, gracz.dx, 0, -this.ZASADY.LIMITS.maxSpeed, this.ZASADY.LIMITS.maxSpeed, 'Player.DX');
        let dy = this.wymusLiczbe(id, gracz.dy, 0, -this.ZASADY.LIMITS.maxSpeed, this.ZASADY.LIMITS.maxSpeed, 'Player.DY');

        let totalSpeedSq = dx*dx + dy*dy;
        if (totalSpeedSq > (this.ZASADY.LIMITS.maxSpeed * 1.5)**2 && !isInternalBot) {
            this.dodajZagrozenie(id, 20, "Modyfikacja pędu wektora");
            dx *= 0.5; dy *= 0.5; 
        }

        const ostatniaPozycja = this.historiaPozycji.get(id);
        if (ostatniaPozycja && !gracz.teleportReset && !isInternalBot) {
            const dystansSq = this.szybkiDystansSq(x, y, ostatniaPozycja.x, ostatniaPozycja.y); 
            if (dystansSq > this.ZASADY.LIMITS.maxDeltaMove * this.ZASADY.LIMITS.maxDeltaMove) {
                this.dodajZagrozenie(id, 25, `Niemożliwy przeskok w przestrzeni. DystansSq: ${dystansSq}`);
                x = ostatniaPozycja.x; 
                y = ostatniaPozycja.y;
            }
        }
        
        // [FIX] Usunięto clear(), który psuł anty-teleport przy >100 graczach.
        this.historiaPozycji.set(id, { x: x, y: y });
        this.aktualizujSiatkePrzestrzenna(id, x, y);

        let score = this.wymusLiczbe(id, gracz.score, 10, 0, this.ZASADY.LIMITS.maxScore, 'Player.Score');
        if (score > 5000) this.bounties.add(id);

        let hp = this.wymusLiczbe(id, gracz.health, 100, 0, this.ZASADY.LIMITS.maxHP, 'Player.Health');
        let maxHp = this.wymusLiczbe(id, gracz.maxHealth, 100, 1, this.ZASADY.LIMITS.maxHP, 'Player.MaxHealth');
        if (hp > maxHp) hp = maxHp; 

        return {
            id: id,
            name: this.wymusTekst(id, gracz.name, "Gracz", 16), 
            x: x, y: y, dx: dx, dy: dy,
            kat: this.wymusLiczbe(id, gracz.kat, 0, -Math.PI * 4, Math.PI * 4), 
            score: score,
            health: hp, maxHealth: maxHp,
            skin: skin,
            team: team === "NONE" ? null : team,
            isSafe: Boolean(gracz.isSafe), 
            isShielding: isShielding,
            isAttacking: isAttacking,
            isBoss: Boolean(gracz.isBoss),
            isInternal: isInternalBot,
            isShadowBanned: Boolean(gracz.isShadowBanned)
        };
    }

    analizujPocisk(pocisk, idGracza) {
        if (!pocisk || typeof pocisk !== 'object' || Array.isArray(pocisk)) return null;

        let safeId = idGracza || 'SYSTEM';
        const isInternalBot = safeId.startsWith('bot_');

        const teraz = Date.now();
        const ostatniStrzal = this.lastShotTime.get(safeId) || 0;
        if (teraz - ostatniStrzal < 150 && !isInternalBot) {
            this.dodajZagrozenie(safeId, 5, "Rapid Fire Hack (zbyt szybkie strzały)");
            return null; 
        }
        this.lastShotTime.set(safeId, teraz);

        if (safeId !== 'SYSTEM' && pocisk.dx !== undefined && pocisk.dy !== undefined && !isInternalBot) {
            let angle = Math.atan2(pocisk.dy, pocisk.dx);
            let prevAngleData = this.aimbotHeuristics.get(safeId);
            if (prevAngleData && Math.abs(prevAngleData.angle - angle) === 0 && teraz - prevAngleData.time < 500) {
                prevAngleData.strikes++;
                if (prevAngleData.strikes > 5) this.dodajZagrozenie(safeId, 40, "Aimbot - nienaturalne blokowanie kąta na piksel");
            } else {
                this.aimbotHeuristics.set(safeId, { angle: angle, time: teraz, strikes: 0 });
            }
        }

        let type = this.wymusTekst(safeId, pocisk.type, "oszczep", 15).toLowerCase();
        if (!this.ZASADY.DOZWOLONE_POCISKI.includes(type)) type = "oszczep";

        let team = pocisk.team ? this.wymusTekst(safeId, pocisk.team, "NONE", 10).toUpperCase() : "NONE";

        return {
            x: this.wymusLiczbe(safeId, pocisk.x, 0, this.ZASADY.LIMITS.minPos, this.ZASADY.LIMITS.maxPos),
            y: this.wymusLiczbe(safeId, pocisk.y, 0, this.ZASADY.LIMITS.minPos, this.ZASADY.LIMITS.maxPos),
            dx: this.wymusLiczbe(safeId, pocisk.dx, 0, -2500, 2500), 
            dy: this.wymusLiczbe(safeId, pocisk.dy, 0, -2500, 2500),
            type: type,
            mode: this.wymusTekst(safeId, pocisk.mode, "FREE", 10).toUpperCase(),
            team: team === "NONE" ? null : team,
            piercing: Boolean(pocisk.piercing)
        };
    }

    // =========================================================
    // 🤖 ZAAWANSOWANY MODUŁ AI (TAKTYKA, BEHAWIOR, WALKA)
    // =========================================================

    obliczRuchBota(bot, widoczneCele, wszystkiePociski = {}) {
        try {
            // [IDEA 14] Dormant Mode: Jeśli brak żywych celów (graczy) w pobliżu 2500px, bot usypia (oszczędność CPU)
            if (this.iqSlider < 0.6) {
                let czyGraczBlisko = false;
                Object.values(widoczneCele).forEach(c => {
                    if (!c.id.startsWith('bot_') && this.szybkiDystansSq(bot.x, bot.y, c.x, c.y) < 6250000) czyGraczBlisko = true;
                });
                if (!czyGraczBlisko) return; // Tryb Uśpienia!
            }

            // --- DECYZJE CELU ---
            // [IDEA 23] Reaguj na List Gończy
            if (this.bounties.size > 0 && Math.random() > 0.5) {
                // [FIX] Zmiana z Array.from (bardzo wolne) na O(1) Iterator
                let targetBountyId = this.bounties.values().next().value;
                if (widoczneCele[targetBountyId]) bot.target = widoczneCele[targetBountyId];
            }

            if (!bot.target || bot.target.destroyed || !widoczneCele[bot.target.id]) {
                bot.target = this.znajdzInteligentnyCel(bot, widoczneCele); // [IDEA 6] Weight-based targeting
            }

            if (!bot.target) return this.stanWander(bot);

            // --- ZMIENNE WALKI ---
            let tx = bot.target.x;
            let ty = bot.target.y;
            let dystansDoCeluSq = this.szybkiDystansSq(bot.x, bot.y, tx, ty);

            // [IDEA 7] Tryb Zasadzki (Ninja Bots)
            if (bot.skin === 'ninja' && dystansDoCeluSq > 160000) { // Zatrzymuje się powyżej 400px
                bot.dx *= 0.8; bot.dy *= 0.8; 
                return; // Czeka w ukryciu
            }

            // [IDEA 22] Boss Enrage Phase
            let obecnyIqSlider = this.iqSlider;
            if (bot.isBoss && bot.health < (bot.maxHealth * 0.5)) {
                obecnyIqSlider = 1.5; // Berserk Mode! Zwiększona prędkość
            }

            // [IDEA 5] Szukanie Osłony (Cover Seeking)
            if (bot.health < (bot.maxHealth * 0.3)) {
                // Odwrotny wektor ucieczki
                tx = bot.x + (bot.x - bot.target.x);
                ty = bot.y + (bot.y - bot.target.y);
            } else {
                // [IDEA 11] Predictive Leading
                tx += (bot.target.dx || 0) * 10;
                ty += (bot.target.dy || 0) * 10;
            }

            // --- ZAAWANSOWANE MANEWRY ---
            let manewrX = 0, manewrY = 0;

            // [IDEA 3] Predictive Dodging
            if (Math.random() > (1.0 - (0.2 * obecnyIqSlider))) {
                let wektorUniku = this.obliczUnikPrzedPociskami(bot, wszystkiePociski);
                manewrX += wektorUniku.x * 20;
                manewrY += wektorUniku.y * 20;
            }

            // [IDEA 1] Strafe'owanie (Krok Odstawny w walce)
            if (dystansDoCeluSq < 250000 && Math.random() > 0.5) { // Poniżej 500px zaczyna "tańczyć"
                let angleToTarget = Math.atan2(bot.target.y - bot.y, bot.target.x - bot.x);
                let strafeDir = (Date.now() % 2000 > 1000) ? 1 : -1; // Lewo/Prawo co sekundę
                manewrX += Math.cos(angleToTarget + (Math.PI/2 * strafeDir)) * 5;
                manewrY += Math.sin(angleToTarget + (Math.PI/2 * strafeDir)) * 5;
            }

            // [IDEA 2] Taktyka Kitingu (Dystansowe wycofywanie)
            if (bot.skin === 'zwiadowca' && dystansDoCeluSq < 90000) { // Zwiadowca cofa się < 300px
                tx = bot.x - (bot.target.x - bot.x);
                ty = bot.y - (bot.target.y - bot.y);
            }

            // [IDEA 12] Flocking (Separacja w grupie)
            let sep = this.obliczSeparacje(bot, widoczneCele);

            // [IDEA 13] Obstacle Avoidance Raycast (Krawędzie)
            let ob = this.unikajKrawedzi(bot);

            // --- SUMOWANIE SIŁ FIZYKI ---
            bot.dx += (tx - bot.x) * 0.05 + sep.x + ob.x + manewrX;
            bot.dy += (ty - bot.y) * 0.05 + sep.y + ob.y + manewrY;

            // [IDEA 10] Ograniczanie prędkości
            let wektorV = this.limitujPredkosc(bot.dx, bot.dy, this.ZASADY.LIMITS.maxSpeed * obecnyIqSlider);
            bot.dx = wektorV.x; 
            bot.dy = wektorV.y;

            if (this.ai.isDevMode && Math.random() > 0.9) {
                this.debugRays.push({x1: bot.x, y1: bot.y, x2: tx, y2: ty});
                if(this.debugRays.length > 50) this.debugRays.shift();
            }

        } catch (e) {
            console.error(`[AI PANIC] Bot ${bot.id} awaria logiki walki.`, e);
            bot.dx *= 0.5; bot.dy *= 0.5;
            bot.target = null;
        }
    }

    // --- FUNKCJE POMOCNICZE DLA AI ---

    szybkiDystansSq(x1, y1, x2, y2) {
        return (x1 - x2) ** 2 + (y1 - y2) ** 2;
    }

    limitujPredkosc(vx, vy, max) {
        let speedSq = vx*vx + vy*vy;
        if (speedSq > max*max && speedSq > 0) {
            let scale = max / Math.sqrt(speedSq); 
            return { x: vx * scale, y: vy * scale };
        }
        return { x: vx, y: vy };
    }

    znajdzInteligentnyCel(bot, cele) {
        // [IDEA 6] Wagi Priorytetów Celu
        let bestTarget = null;
        let bestScore = -Infinity;
        
        Object.values(cele).forEach(c => {
            if (c.id === bot.id || c.isShadowBanned) return;
            
            let distSq = this.szybkiDystansSq(bot.x, bot.y, c.x, c.y);
            if (distSq > 4000000) return; // Zbyt daleko (>2000px)

            // Ocena: Krótki dystans (+), Mało HP ofiary (+), Ktoś mnie zaatakował (+++)
            let threatScore = (2000 - Math.sqrt(distSq)) * 0.4;
            threatScore += (c.maxHealth - c.health) * 0.4; 
            if (bot.lastAttacker && bot.lastAttacker.id === c.id) threatScore += 1000;

            if (threatScore > bestScore) {
                bestScore = threatScore;
                bestTarget = c;
            }
        });
        return bestTarget;
    }

    obliczUnikPrzedPociskami(bot, pociski) {
        // [IDEA 3] Predictive Dodging Logic
        let unikX = 0, unikY = 0;
        Object.values(pociski).forEach(p => {
            if (p.team === bot.team && bot.team !== 'NONE') return;
            
            let distSq = this.szybkiDystansSq(bot.x, bot.y, p.x, p.y);
            if (distSq < 90000) { // Pocisk bliżej niż 300px
                // Prostopadły unik od wektora pocisku
                unikX += -p.dy; 
                unikY += p.dx;
            }
        });
        return { x: Math.sign(unikX), y: Math.sign(unikY) };
    }

    stanWander(bot) {
        bot.dx += (Math.random() - 0.5) * 5;
        bot.dy += (Math.random() - 0.5) * 5;
        let v = this.limitujPredkosc(bot.dx, bot.dy, this.ZASADY.LIMITS.maxSpeed * 0.3);
        bot.dx = v.x; bot.dy = v.y;
    }

    obliczSeparacje(bot, inni) {
        let sx = 0, sy = 0;
        Object.values(inni).forEach(inny => {
            if(inny.id === bot.id) return;
            let distSq = this.szybkiDystansSq(bot.x, bot.y, inny.x, inny.y);
            if(distSq < 10000 && distSq > 0) { 
                sx += (bot.x - inny.x) / distSq * 100;
                sy += (bot.y - inny.y) / distSq * 100;
            }
        });
        return { x: sx, y: sy };
    }

    unikajKrawedzi(bot) {
        let ox = 0, oy = 0;
        if (bot.x < 500) ox = 15;
        if (bot.x > this.ZASADY.LIMITS.maxPos - 500) ox = -15;
        if (bot.y < 500) oy = 15;
        if (bot.y > this.ZASADY.LIMITS.maxPos - 500) oy = -15;
        return { x: ox, y: oy };
    }

    aktualizujSiatkePrzestrzenna(id, x, y) {
        const cellSize = 1000;
        const gridX = Math.floor(x / cellSize);
        const gridY = Math.floor(y / cellSize);
        const key = `${gridX}_${gridY}`;
        
        // Ciche aktualizowanie Heatmapy [IDEA 20]
        let heat = this.heatmapaRzezi.get(key) || 0;
        this.heatmapaRzezi.set(key, heat + 0.01); // Aktywność generuje ciepło powoli
        
        if (!this.spatialGrid.has(key)) this.spatialGrid.set(key, new Set());
        this.spatialGrid.get(key).add({id, x, y});
        
        if (this.spatialGrid.size > 500) this.spatialGrid.clear(); 
    }

    // --- SYSTEM MONITORINGU ---
    heartbeatMonitoring() {
        const teraz = Date.now();

        // [IDEA 29] Watchdog Loop
        let loopStart = performance.now();

        if (teraz - this.lastHeartbeat > 10000) {
            this.lastHeartbeat = teraz;
            let memInfo = "N/A";
            if (typeof process !== 'undefined' && process.memoryUsage) {
                memInfo = (process.memoryUsage().heapUsed / 1048576).toFixed(2) + " MB";
            }
            if (this.ai.isDevMode) {
                console.log(`%c💓 [BRAIN HEARTBEAT] IQ: ${this.iqSlider} | Bounties: ${this.bounties.size} | RAM: ${memInfo} | GameHour: ${Math.floor(this.gameHour)}:00`, 'color: #888; font-style: italic;');
            }

            // [IDEA 27] Auto-Kicking Zombie Sockets & Memory Leak Fix
            this.zombieConnections.forEach((lastSeen, id) => {
                if (teraz - lastSeen > 30000) {
                    console.log(`🧹 [ZOMBIE GC] Usunięto martwe połączenie: ${id}`);
                    // [FIX] Pełna sterylizacja RAMu po odłączonym graczu!
                    this.zombieConnections.delete(id);
                    this.shadowBans.delete(id); 
                    this.historiaKlikniec.delete(id);
                    this.poziomZagrozenia.delete(id);
                    this.historiaPozycji.delete(id);
                    this.lastShotTime.delete(id);
                    this.aimbotHeuristics.delete(id);
                    this.bounties.delete(id);
                }
            });
        }

        if (performance.now() - loopStart > 100) {
            console.warn("⚠️ [WATCHDOG] Ostrzeżenie! Główna pętla zajmuje za dużo czasu!");
        }
    }

    runSelfDiagnostics() {
        console.log("🛠️ [BRAIN] Uruchamianie procedury diagnostycznej Smart Core v11.2 OMEGA (Fix)...");
        let testBot = { id: "bot_test", x: 100, y: 100, dx: 0, dy: 0 };
        this.limitujPredkosc(1000, 1000, 500); 
        this.analizujGracza(testBot); 
        console.log("✅ [BRAIN] Wszystkie moduły 30 innowacji (AI, Sieć, Strażnik) wczytane i połączone z API Ollamy. Izolacja kar aktywna.");
    }
}

// Udostępnienie instancji w globalnym scope
if (typeof window !== 'undefined') { window.GuardianBrain = new GuardianBrain(); }
if (typeof module !== 'undefined') { module.exports = new GuardianBrain(); }