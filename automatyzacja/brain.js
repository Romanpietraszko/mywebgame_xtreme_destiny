// ==========================================
// BRAIN.JS - Sztuczna Inteligencja z Bazą Sygnatur (Smart Core v7.0 AAA)
// Posiada dedykowany rdzeń AI (BrainAiCore) do komunikacji z Ollamą
// ==========================================

// ---------------------------------------------------------
// 🧠 RDZEŃ AI BRAJANA (Komunikacja z lokalnym LLM)
// ---------------------------------------------------------
class BrainAiCore {
    constructor() {
        this.isDevMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        this.OLLAMA_URL = "http://localhost:11434/api/generate";
        this.OLLAMA_MODEL = "phi3:latest"; // Twój model do analizy kodu i zagrożeń
        this.czyZajety = false;

        if (this.isDevMode) {
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
            // Zabezpieczenie przed zaspamowaniem AI: Cooldown 8 sekund
            setTimeout(() => { this.czyZajety = false; }, 8000); 
        }
    }
}

// ---------------------------------------------------------
// GŁÓWNA KLASA MÓZGU (Logika, Heurystyka, Walidacja)
// ---------------------------------------------------------
class GuardianBrain {
    constructor() {
        // Inicjalizacja sub-rdzenia AI
        this.ai = new BrainAiCore();

        this.frameTimes = [];
        this.lastTickTime = Date.now();
        this.droppedFrames = 0;
        this.isLowSpecMode = false;
        this.sredniaFPS = 60; 
        
        this.crashCount = 0;
        this.lastCrashTime = 0;

        this.historiaKlikniec = [];
        this.poziomZagrozenia = 0;
        this.historiaPozycji = new Map();

        // -------------------------------------------------------------
        // GIGANTYCZNY SŁOWNIK ANOMALII I ZAGROŻEŃ (BAZA DANYCH)
        // -------------------------------------------------------------
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
                maxScore: 9999999, maxHP: 50000, maxSpeed: 1000,
                maxDeltaMove: 800 // Anty-Teleport
            }
        };
    }

    // --- 1. MODUŁ WYDAJNOŚCI I SAMOLECZENIA ---
    analizujWydajnosc() {
        if (document.hidden) {
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
            decyzja.stan = 'LOW_SPEC';
        }

        if (now - this.lastTickTime > 2000) decyzja.awariaSerwera = true;

        return decyzja;
    }

    odbierzPuls() {
        const teraz = Date.now();
        const roznica = teraz - this.lastTickTime;
        this.lastTickTime = teraz;

        if (roznica > 150) {
            this.droppedFrames++;
            if (this.droppedFrames % 10 === 0) console.warn(`🧠 [BRAIN] Ostrzeżenie: Opóźnienie węzła ${roznica}ms.`);
        }
    }

    analizujCrash(blad, nazwaModulu = "Ogólny") {
        const teraz = Date.now();
        if (teraz - this.lastCrashTime > 5000) this.crashCount = 0; 
        
        this.crashCount++;
        this.lastCrashTime = teraz;

        // Wysłanie raportu do wbudowanego AI Core
        if (blad) {
            this.ai.zglosAnomalie(`Crash Aplikacji: ${nazwaModulu}`, blad.message || "Unknown Error", blad.stack || {});
        }

        return this.crashCount >= 4; 
    }

    // --- 2. MODUŁ BEHAWIORALNY ---
    wykryjAutoClicker() {
        const teraz = Date.now();
        this.historiaKlikniec.push(teraz);
        if (this.historiaKlikniec.length > 8) this.historiaKlikniec.shift();

        if (this.historiaKlikniec.length === 8) {
            let interwaly = [];
            for (let i = 1; i < this.historiaKlikniec.length; i++) interwaly.push(this.historiaKlikniec[i] - this.historiaKlikniec[i-1]);

            const sredniInterwal = interwaly.reduce((a, b) => a + b) / interwaly.length;
            let wariancja = 0;
            interwaly.forEach(int => wariancja += Math.pow(int - sredniInterwal, 2));
            wariancja = wariancja / interwaly.length;

            const czasTrwania = this.historiaKlikniec[7] - this.historiaKlikniec[0];

            if (czasTrwania < 150 || (sredniInterwal < 50 && wariancja < 2.0)) {
                this.dodajZagrozenie(30, "Auto-Clicker / Nieludzka wariancja wejść");
                this.historiaKlikniec = []; 
                return true; 
            }
        }
        this.chlodzenieZagrozenia();
        return false;
    }

    dodajZagrozenie(punkty, powod) {
        this.poziomZagrozenia += punkty;
        if (this.poziomZagrozenia > 50) {
            console.warn(`⚠️ [BRAIN] THREAT SCORE KRYTYCZNY: ${this.poziomZagrozenia}. Powód: ${powod}`);
            this.ai.zglosAnomalie("Analiza Behawioralna", "Zbyt duża ilość punktów zagrożenia gracza", { powod: powod, aktualnyScore: this.poziomZagrozenia });
        }
    }

    chlodzenieZagrozenia() {
        if (this.poziomZagrozenia > 0 && Math.random() > 0.95) this.poziomZagrozenia--;
    }

    // --- 4. FILTRY GŁĘBOKIEJ STERYLIZACJI (Wykorzystanie Słownika) ---
    wymusLiczbe(wartosc, domyslna, min, max, typTestu = "") {
        let num = Number(wartosc);
        if (!Number.isFinite(num)) {
            this.dodajZagrozenie(10, `Anomalia matematyczna w: ${typTestu}`);
            return domyslna; 
        }
        if (num < min) { this.dodajZagrozenie(2, `Underflow w: ${typTestu}`); return min; }
        if (num > max) { this.dodajZagrozenie(2, `Overflow w: ${typTestu}`); return max; }
        return num;
    }

    wymusTekst(wartosc, domyslna, maxDlugosc = 20) {
        if (typeof wartosc !== 'string' || !wartosc.trim()) return domyslna;
        
        if (this.skanerSygnatur.test(wartosc)) {
            this.dodajZagrozenie(100, `Wykryto sygnaturę ataku w tekście! Treść: ${wartosc}`);
            return domyslna; 
        }

        const czysty = wartosc.replace(/[<>{}[\]"'`;()=&\\]/g, ""); 
        
        if (wartosc.length > maxDlugosc * 1.5) {
            this.dodajZagrozenie(15, "Próba ataku Buffer Overflow");
        }
        
        return czysty.substring(0, maxDlugosc); 
    }

    // --- 5. LOGIKA APLIKACYJNA I FIZYKA ---
    analizujGracza(gracz) {
        if (!gracz || typeof gracz !== 'object' || Array.isArray(gracz)) return null;

        let id = this.wymusTekst(gracz.id, "Ghost", 30);
        let skin = this.wymusTekst(gracz.skin, "standard").toLowerCase();
        if (!this.ZASADY.DOZWOLONE_SKINY.includes(skin)) skin = "standard";

        let team = gracz.team ? this.wymusTekst(gracz.team, "NONE", 10).toUpperCase() : "NONE";
        if (!this.ZASADY.DOZWOLONE_TEAMY.includes(team)) team = "NONE";

        if (this.poziomZagrozenia > 100) {
            console.error(`☠️ [BRAIN] KWARANTANNA: Odrzucono pakiet (Gracz ID: ${id}). Zbyt wysoki Threat Score.`);
            return null; 
        }

        let x = this.wymusLiczbe(gracz.x, 2000, this.ZASADY.LIMITS.minPos, this.ZASADY.LIMITS.maxPos, 'Player.X');
        let y = this.wymusLiczbe(gracz.y, 2000, this.ZASADY.LIMITS.minPos, this.ZASADY.LIMITS.maxPos, 'Player.Y');

        const ostatniaPozycja = this.historiaPozycji.get(id);
        if (ostatniaPozycja) {
            const dystans = Math.hypot(x - ostatniaPozycja.x, y - ostatniaPozycja.y);
            if (dystans > this.ZASADY.LIMITS.maxDeltaMove) {
                this.dodajZagrozenie(25, `Niemożliwy przeskok w przestrzeni. Dystans: ${dystans}px`);
                x = ostatniaPozycja.x; 
                y = ostatniaPozycja.y;
            }
        }
        
        if (this.historiaPozycji.size > 100) this.historiaPozycji.clear();
        this.historiaPozycji.set(id, { x: x, y: y });

        let hp = this.wymusLiczbe(gracz.health, 100, 0, this.ZASADY.LIMITS.maxHP, 'Player.Health');
        let maxHp = this.wymusLiczbe(gracz.maxHealth, 100, 1, this.ZASADY.LIMITS.maxHP, 'Player.MaxHealth');
        if (hp > maxHp) hp = maxHp; 

        return {
            id: id,
            name: this.wymusTekst(gracz.name, "Gracz", 16), 
            x: x, y: y,
            dx: this.wymusLiczbe(gracz.dx, 0, -this.ZASADY.LIMITS.maxSpeed, this.ZASADY.LIMITS.maxSpeed, 'Player.DX'),
            dy: this.wymusLiczbe(gracz.dy, 0, -this.ZASADY.LIMITS.maxSpeed, this.ZASADY.LIMITS.maxSpeed, 'Player.DY'),
            kat: this.wymusLiczbe(gracz.kat, 0, -Math.PI * 4, Math.PI * 4), 
            score: this.wymusLiczbe(gracz.score, 10, 0, this.ZASADY.LIMITS.maxScore, 'Player.Score'),
            health: hp, 
            maxHealth: maxHp,
            skin: skin,
            team: team === "NONE" ? null : team,
            isSafe: Boolean(gracz.isSafe), 
            isShielding: Boolean(gracz.isShielding),
            isBoss: Boolean(gracz.isBoss) 
        };
    }

    analizujPocisk(pocisk) {
        if (!pocisk || typeof pocisk !== 'object' || Array.isArray(pocisk)) return null;

        let type = this.wymusTekst(pocisk.type, "oszczep", 15).toLowerCase();
        if (!this.ZASADY.DOZWOLONE_POCISKI.includes(type)) type = "oszczep";

        let team = pocisk.team ? this.wymusTekst(pocisk.team, "NONE", 10).toUpperCase() : "NONE";

        return {
            x: this.wymusLiczbe(pocisk.x, 0, this.ZASADY.LIMITS.minPos, this.ZASADY.LIMITS.maxPos),
            y: this.wymusLiczbe(pocisk.y, 0, this.ZASADY.LIMITS.minPos, this.ZASADY.LIMITS.maxPos),
            dx: this.wymusLiczbe(pocisk.dx, 0, -2500, 2500), 
            dy: this.wymusLiczbe(pocisk.dy, 0, -2500, 2500),
            type: type,
            mode: this.wymusTekst(pocisk.mode, "FREE", 10).toUpperCase(),
            team: team === "NONE" ? null : team,
            piercing: Boolean(pocisk.piercing)
        };
    }
}

// Udostępnienie instancji w globalnym scope
window.GuardianBrain = GuardianBrain;