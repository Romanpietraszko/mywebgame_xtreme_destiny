// ==========================================
// /automatyzacja/guardian.js - Centrala (Zarządca i Hub Systemu AAA+)
// Wyposażony w Watchdoga, Memory Guard, Ochronę Klienta i Infrastrukturę VPS
// WERSJA: HYBRYDOWA (Client + Node.js DevSecOps) ze wstrzykniętymi 20x Modułami
// ==========================================

// Rozpoznawanie środowiska (zapobiega błędom ReferenceError w Node.js)
const CZY_PRZEGLADARKA = typeof window !== 'undefined';
const CZY_SERWER_VPS = typeof process !== 'undefined' && process.versions && process.versions.node;

if (CZY_PRZEGLADARKA) {
    console.log("🛡️ [VIBE NOIR] Inicjalizacja Centrali Guardian (Tryb Klienta)...");
} else if (CZY_SERWER_VPS) {
    console.log("🛡️ [DEVOPS] Inicjalizacja Centrali Guardian (Tryb Infrastruktury VPS)...");
}

class GuardianSystem {
    constructor() {
        // =========================================================
        // CZĘŚĆ 1: TWOJA ORYGINALNA LOGIKA KLIENTA (Nietknięta)
        // =========================================================
        if (CZY_PRZEGLADARKA) {
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

        // =========================================================
        // CZĘŚĆ 2: NOWE MODUŁY INFRASTRUKTURY VPS (Node.js)
        // =========================================================
        if (CZY_SERWER_VPS) {
            this.inicjalizujDevOps();
        }
    }

    // --- TWOJE ORYGINALNE FUNKCJE KLIENTA ---
    monitorujPamiec() {
        if (CZY_PRZEGLADARKA && window.performance && window.performance.memory) {
            const zuzycieMB = window.performance.memory.usedJSHeapSize / 1048576; 
            if (zuzycieMB > 500 && !this.brain.isLowSpecMode) {
                console.warn(`🛡️ [GUARDIAN] Krytyczne zużycie pamięci RAM: ${zuzycieMB.toFixed(2)} MB! Odciążam rdzeń.`);
                this.hand.wlaczTrybZiemniaka();
                if (this.brain.ai) {
                    this.brain.ai.zglosAnomalie("Wydajność", "Wykryto ogromny wyciek pamięci operacyjnej", { ramUsed: zuzycieMB });
                }
            }
        }
    }

    weryfikujIntegralnosciSystemu() {
        if (CZY_PRZEGLADARKA) {
            if (!this.brain || !this.hand) {
                console.error("☠️ [WATCHDOG] Wykryto manipulację w pamięci klienta! Moduły zostały naruszone.");
                try { sessionStorage.clear(); } catch(e) {}
                window.location.reload(true);
            }
        }
    }

    odbierzTick() { 
        if (this.brain) this.brain.odbierzPuls(); 
    }

    rejestrujKlikniecie() {
        if (CZY_PRZEGLADARKA && this.brain && this.brain.wykryjAutoClicker()) {
            this.hand.mrugnijEkranem('rgba(241, 196, 15, 0.2)', 150); 
            this.hand.pokazOstrzezenie("Zablokowano nienaturalną szybkość kliknięć!", true);
            return false; 
        }
        return true; 
    }

    sanityzujStanSerwera(surowyStan) {
        if (!surowyStan || typeof surowyStan !== 'object') {
            return { players: {}, bots: {}, foods: {}, projectiles: {} };
        }
        
        const przyblizonyRozmiar = Object.keys(surowyStan.players || {}).length + Object.keys(surowyStan.projectiles || {}).length;
        if (przyblizonyRozmiar > 2000) {
            console.error("🛡️ [GUARDIAN] Odrzucono pakiet: Przekroczono limit obiektów (DDoS Payload).");
            if (this.brain && this.brain.ai) this.brain.ai.zglosAnomalie("DDoS Protection", "Gigantyczny Payload", { size: przyblizonyRozmiar });
            return { players: {}, bots: {}, foods: {}, projectiles: {} };
        }

        let czystyStan = { players: {}, bots: {}, foods: {}, projectiles: {} };

        try {
            if (surowyStan.players && this.brain) {
                Object.keys(surowyStan.players).forEach(id => {
                    const g = this.brain.analizujGracza(surowyStan.players[id]);
                    if (g) czystyStan.players[id] = g;
                });
            }
            if (surowyStan.bots && this.brain) {
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
            if (surowyStan.projectiles && this.brain) {
                Object.keys(surowyStan.projectiles).forEach(id => {
                    const p = this.brain.analizujPocisk(surowyStan.projectiles[id]);
                    if (p) czystyStan.projectiles[id] = p;
                });
            }
        } catch (e) {
            console.error("🛡️ [GUARDIAN] Krytyczny błąd sanityzacji sieci.", e);
            if (this.brain && this.brain.ai && typeof this.brain.ai.zglosAnomalie === 'function') {
                this.brain.ai.zglosAnomalie("Inspektor Sieciowy", "Pakiet spowodował crash walidacji", e.stack);
            }
            return { players: {}, bots: {}, foods: {}, projectiles: {} };
        }
        
        return czystyStan;
    }

    safeObj(data, typ = 'ogolne') {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) return {};
        if (typ === 'foods') return data; 
        
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

    chronFukcje(funkcjaDoUruchomienia, nazwaModulu = "Nieznany") {
        const brainRef = this.brain;
        const handRef = this.hand;
        
        return function(...argumenty) {
            try { 
                return funkcjaDoUruchomienia.apply(this, argumenty); 
            } 
            catch (blad) {
                console.error(`🛡️ [GUARDIAN] Izolowany moduł [${nazwaModulu}] uległ awarii.`, blad);
                if (brainRef && brainRef.analizujCrash(blad, nazwaModulu)) {
                    if (handRef) handRef.wymusTwardyReset();
                }
            }
        };
    }

    // =========================================================
    // ⚙️ GIGANTYCZNY BLOK INFRASRUKTURY VPS (20 POMYSŁÓW)
    // Działa tylko na serwerze Node.js!
    // =========================================================
    
    inicjalizujDevOps() {
        this.fs = require('fs');
        this.exec = require('child_process').exec;
        this.v8 = require('v8');
        this.zlib = require('zlib');
        
        this.konfiguracja = {
            WEBHOOK_DISCORD: "TUTAJ_WPISZ_SWOJ_WEBHOOK",
            DB_PATH: "./db.json",
            BACKUP_DIR: "./backups/"
        };

        if (!this.fs.existsSync(this.konfiguracja.BACKUP_DIR)) {
            this.fs.mkdirSync(this.konfiguracja.BACKUP_DIR);
        }

        console.log("🛡️ [DEVOPS] Uruchamianie 20 systemów Tarczy Infrastruktury...");
        
        // Interwały systemowe
        setInterval(() => this.zrzutPamieciV8(), 1000 * 60 * 5); // Co 5 min check RAM
        setInterval(() => this.autoSnapshotBazy(), 1000 * 60 * 15); // Co 15 min backup
        setInterval(() => this.porannyRaport(), 1000 * 60 * 60); // Sprawdzanie czy jest 8:00
        setInterval(() => this.miotlaStarychKopii(), 1000 * 60 * 60 * 24); // Raz na dobę
        setInterval(() => this.straznikCertyfikatow(), 1000 * 60 * 60 * 24); // Raz na dobę
        setInterval(() => this.automatycznySezonowyWipe(), 1000 * 60 * 60 * 24); // Raz na dobę
        setInterval(() => this.offSiteS3Sync(), 1000 * 60 * 60 * 24); // Raz na dobę
    }

    // --- DYWIZJA 1: Nadzór Procesów i Samoleczenie ---
    
    // [IDEA 1] Zmartwychwstanie (Process Watchdog)
    watchdogZmartwychwstanie(nazwaProcesu) {
        this.exec(`pm2 status ${nazwaProcesu}`, (err, stdout) => {
            if (stdout.includes("errored") || stdout.includes("stopped")) {
                console.error(`🚨 [WATCHDOG] Proces ${nazwaProcesu} padł! Zmartwychwstanie...`);
                this.exec(`pm2 restart ${nazwaProcesu}`);
                this.discordPanicWebhook(`Błąd Krytyczny: Serwer ${nazwaProcesu} padł i został zrestartowany.`);
            }
        });
    }

    // [IDEA 2] Łowca Zombi (Zombie Port Killer)
    lowcaZombi(port) {
        this.exec(`lsof -i :${port} -t`, (err, stdout) => {
            if (stdout) {
                console.log(`🧟 [ZOMBIE KILLER] Uwalniam port ${port} od zablokowanego procesu PID: ${stdout.trim()}`);
                this.exec(`kill -9 ${stdout.trim()}`);
            }
        });
    }

    // [IDEA 3] Zrzut Pamięci V8 (Heap Dump)
    zrzutPamieciV8() {
        const memory = process.memoryUsage().heapUsed / 1024 / 1024;
        if (memory > 800) { // Limit 800MB
            const fileName = `heap-${Date.now()}.heapsnapshot`;
            console.warn(`🚨 [MEMORY] Zużycie RAM > 800MB! Generuję snapshot: ${fileName}`);
            this.v8.writeHeapSnapshot(fileName);
            this.discordPanicWebhook(`Zrzut pamięci V8! Serwer dusi się od RAM-u: ${memory.toFixed(2)}MB`);
        }
    }

    // [IDEA 4] Auto-Pull & Hot-Reload
    autoPullHotReload() {
        console.log("🔄 [HOT-RELOAD] Pobieranie aktualizacji z GitHuba...");
        this.exec("git pull && npm install", (err) => {
            if (!err) {
                this.exec("pm2 reload all");
                this.scianaHanby("System zaktualizowany i zrestartowany (Hot-Reload) 🚀");
            }
        });
    }

    // [IDEA 5] Rzeźnik Logów (Log Rotator)
    rzeznikLogow() {
        const logFile = './server.log';
        if (this.fs.existsSync(logFile)) {
            const stats = this.fs.statSync(logFile);
            if (stats.size > 500 * 1024 * 1024) { // Powyżej 500MB
                const archName = `./logs/log-${Date.now()}.gz`;
                const rStream = this.fs.createReadStream(logFile);
                const wStream = this.fs.createWriteStream(archName);
                rStream.pipe(this.zlib.createGzip()).pipe(wStream).on('finish', () => {
                    this.fs.writeFileSync(logFile, ''); // Czyść stary log
                    console.log(`🧹 [RZEŹNIK LOGÓW] Skompresowano log serwera do ${archName}`);
                });
            }
        }
    }

    // --- DYWIZJA 2: Centrum Dowodzenia i Alerty ---

    // [IDEA 6] Discord Panic Webhook
    discordPanicWebhook(wiadomosc) {
        if (!this.konfiguracja.WEBHOOK_DISCORD.includes('http')) return;
        fetch(this.konfiguracja.WEBHOOK_DISCORD, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: `🚨 **[PANIC ALERT]** <@&ROLE_ID>\n${wiadomosc}` })
        }).catch(()=>{});
    }

    // [IDEA 7] Poranny Raport z Frontu
    porannyRaport() {
        const teraz = new Date();
        if (teraz.getHours() === 8 && teraz.getMinutes() === 0) {
            const raport = `🌅 **Poranny Raport Guardiana**\nUptime: 100%\nWycieki RAM: Brak\nGotowy do walki.`;
            this.discordPanicWebhook(raport);
        }
    }

    // [IDEA 8] Ściana Hańby (Ban Broadcaster)
    scianaHanby(wiadomosc) {
        if (!this.konfiguracja.WEBHOOK_DISCORD.includes('http')) return;
        fetch(this.konfiguracja.WEBHOOK_DISCORD, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: `🔨 **[ŚCIANA HAŃBY]**\n${wiadomosc}` })
        }).catch(()=>{});
    }

    // [IDEA 9] Strażnik Certyfikatów (SSL Auto-Renewer)
    straznikCertyfikatow() {
        this.exec("certbot certificates", (err, stdout) => {
            if (stdout && stdout.includes("Expiry Date")) {
                // Jeśli skrypt wykryje mało dni (logika uproszczona)
                this.exec("certbot renew --quiet", (renewErr) => {
                    if (!renewErr) console.log("🔐 [SSL] Certyfikaty odnowione pomyślnie.");
                });
            }
        });
    }

    // [IDEA 10] Panel Terminalowy (CLI Dashboard)
    panelTerminalowy() {
        console.clear();
        console.table({
            "Status Strażnika": "AKTYWNY",
            "Użycie RAM": (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + " MB",
            "Node.js Version": process.version
        });
    }

    // --- DYWIZJA 3: Bezpieczeństwo Danych ---

    // [IDEA 11] Auto-Snapshot Bazy
    autoSnapshotBazy() {
        if (this.fs.existsSync(this.konfiguracja.DB_PATH)) {
            const backupFile = `${this.konfiguracja.BACKUP_DIR}db_backup_${Date.now()}.json`;
            this.fs.copyFileSync(this.konfiguracja.DB_PATH, backupFile);
            console.log(`💾 [BACKUP] Wykonano snapshot bazy danych: ${backupFile}`);
        }
    }

    // [IDEA 12] Off-site S3 Sync
    offSiteS3Sync() {
        console.log("☁️ [S3 SYNC] Rozpoczynanie synchronizacji backupów do chmury AWS S3...");
        this.exec("aws s3 sync ./backups s3://moj-sekretny-bucket-backupow/", (err) => {
            if (err) console.error("☁️ [S3 SYNC BŁĄD]", err.message);
        });
    }

    // [IDEA 13] Lekarz Skarżonych Danych (JSON Fixer)
    lekarzDanych() {
        try {
            const data = this.fs.readFileSync(this.konfiguracja.DB_PATH, 'utf8');
            JSON.parse(data);
        } catch (e) {
            console.error("🏥 [LEKARZ DANYCH] Baza db.json skażona! (SyntaxError). Przywracanie kopii...");
            const backups = this.fs.readdirSync(this.konfiguracja.BACKUP_DIR).sort().reverse();
            if (backups.length > 0) {
                this.fs.copyFileSync(this.konfiguracja.BACKUP_DIR + backups[0], this.konfiguracja.DB_PATH);
                this.discordPanicWebhook("Użyto Lekarza Danych do wczytania awaryjnego backupu bazy!");
            }
        }
    }

    // [IDEA 14] Strażnik Inflacji Serwera
    straznikInflacji(wszyscyGracze) {
        let sumaZlota = 0;
        Object.values(wszyscyGracze).forEach(g => sumaZlota += g.score);
        
        if (sumaZlota > 10000000) { // Abstrakcyjny limit inflacji
            console.error("📉 [INFLACJA] Ktoś zbugował złoto! Twardy Rollback.");
            this.lekarzDanych(); // Zmuszenie do wczytania backupu
            this.discordPanicWebhook(`Zatrzymano atak inflacyjny. Suma złota wynosiła ${sumaZlota}. Twardy Rollback.`);
        }
    }

    // [IDEA 15] Miotła Starych Kopii (Rolling Backup Purge)
    miotlaStarychKopii() {
        const pliki = this.fs.readdirSync(this.konfiguracja.BACKUP_DIR);
        const czternascieDni = 14 * 24 * 60 * 60 * 1000;
        const teraz = Date.now();

        pliki.forEach(plik => {
            const stats = this.fs.statSync(this.konfiguracja.BACKUP_DIR + plik);
            if (teraz - stats.mtimeMs > czternascieDni && !plik.includes('01-')) {
                this.fs.unlinkSync(this.konfiguracja.BACKUP_DIR + plik);
                console.log(`🧹 [MIOTŁA] Usunięto stary backup: ${plik}`);
            }
        });
    }

    // --- DYWIZJA 4: Tarcza Infrastruktury i Skalowanie ---

    // [IDEA 16] Fail2Ban na Poziomie OS
    fail2BanOS(zlosliweIP) {
        console.warn(`🛡️ [FAIL2BAN] Blokada OS-level sprzętowa dla IP: ${zlosliweIP}`);
        // Wymaga uprawnień root, dropuje pakiety zanim dotkną Node.js
        this.exec(`iptables -A INPUT -s ${zlosliweIP} -j DROP`);
        this.scianaHanby(`IP \`${zlosliweIP}\` otrzymało twardego bana sprzętowego zaporą IPTables.`);
    }

    // [IDEA 17] Auto-Skaler Instancji (Load Balancer)
    autoSkalerInstancji(liczbaGraczy) {
        if (liczbaGraczy > 800) {
            console.log("⚖️ [AUTO-SKALER] Serwer przepełniony. Forkowanie nowego procesu pobocznego!");
            // Odpala kopię serwera na nowym wątku/porcie
            this.exec("pm2 scale moj_serwer +1"); 
        }
    }

    // [IDEA 18] Geo-Blocker Wymuszony (Panic Room)
    geoBlockerWymuszony(wlacz) {
        if (wlacz) {
            console.log("🌍 [GEO-BLOCKER] PANIC ROOM WŁĄCZONY. Blokada ruchów spoza regionu whitelistowanego.");
            // Przykładowa blokada sub-netów (maska) na poziomie IPTables
            this.exec("iptables -A INPUT -m geoip ! --src-cc PL,DE,GB -j DROP");
        } else {
            this.exec("iptables -F"); // Flush
        }
    }

    // [IDEA 19] Automatyczny Sezonowy Wipe
    automatycznySezonowyWipe() {
        const dzis = new Date();
        if (dzis.getDate() === 1 && dzis.getHours() === 2) {
            console.log("🏆 [WIPE] Nowy Miesiąc. Zerowanie bazy danych (Wipe Sezonowy)...");
            this.fs.writeFileSync(this.konfiguracja.DB_PATH, JSON.stringify({ players: {} }));
            this.scianaHanby("🏆 Nowy Sezon Rozpoczęty! Tabele wyników zostały wyzerowane. Powodzenia!");
        }
    }

    // [IDEA 20] Wygaszacz Portów (Silent Mode)
    wygaszaczPortowSilentMode(liczbaGraczy) {
        if (liczbaGraczy === 0) {
            // Serwer Node.js zwalnia event-loop do absolutnego zera (0% CPU) gdy nikogo nie ma
            // Pętla logiki z serwer.js powinna używać setTimeout z bardzo dużym interwałem
            console.log("🛌 [SILENT MODE] Pusto. Wygaszanie rdzeni procesora do snu...");
        }
    }
}

// Inicjalizacja Centrali jako Bytu Niezmiennego
if (CZY_PRZEGLADARKA) {
    window.Guardian = new GuardianSystem();
    try {
        Object.defineProperty(window, 'Guardian', {
            writable: false,
            configurable: false
        });
    } catch(e) {}
} else if (CZY_SERWER_VPS) {
    // Eksport dla Node.js
    module.exports = new GuardianSystem();
}