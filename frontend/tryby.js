// ==========================================
// TRYBY.JS - Główny Mózg Klienta, Sieć i Kontroler Gry (Wersja AAA+ Reżyserska)
// WDROŻONO: 20 Koncepcji Inżynieryjnych (FSM, Hooki, Mutatory, Spectator, Sudden Death)
// NOWOŚCI AAA: Predykcja Kolizji, Audio Pooling, Kalkulator Formacji, System Osiągnięć, MENU STEROWANIA
// FIX AAA: Natychmiastowe zjadanie kropek + bezbłędny eat.mp3 i muzyka dark_trap.mp3 na mapie, Agresywny Event Banner
// ==========================================

(function() {
    // 1. POŁĄCZENIE I ZMIENNE SYSTEMOWE
    const SERWER_URL = window.location.origin;
    
    // (AAA) AUTO-RECONNECTION: Ciche wznawianie połączenia przy utracie pakietów
    const socket = typeof io !== 'undefined' ? io(SERWER_URL, {
        reconnection: true,             
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
    }) : null;

    if (!socket) {
        console.error("🛡️ [GUARDIAN] Krytyczny błąd: Brak Socket.io! Gra nie ruszy.");
        return;
    }

    let mojeId = null;
    let stanSerwera = null;
    
    // Zmienne Sklepu i Stref
    let czyWsklepie = false;
    let czyWBazie = false;
    let srodekBazyX = 2000;
    let srodekBazyY = 2000;
    
    let wybranySpawn = 'random'; 
    let czasStart = 0;
    let interwalCzasu = null;

    // NOWE STEROWANIE: Wybór Systemu
    let wybraneSterowanie = 'HYBRID'; // Domyślnie Hybryda
    let kursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let klawiszeKierunku = { w: false, a: false, s: false, d: false };
    let ostatniaWysylkaRuchu = 0; 
    let aktywnaFormacja = 4; // Domyślnie manualna
    
    // Progresja Kampanii i Statystyki
    let etapKampanii = 0;
    let ostatniaMasa = null; // [POPRAWKA] Śledzenie masy startuje od null, by łapać zera!
    let ostatniCzasJedzenia = 0; 

    // --- ZMIENNE LIGI AAA ---
    let ping = 0;
    let ostatniCzasInputu = Date.now(); // Detekcja AFK
    let buforRzutuCzas = 0; // Coyote Time (Buforowanie kliknięć)
    let czyDucking = false; // Audio Ducking (Zarządzanie tłem)

    // --- NOWE ZMIENNE PREDYKCJI I OPTYMALIZACJI ---
    const LokalnyBuforZjedzonychKropek = new Set(); // Przechowuje ID zjedzonych kropek zanim serwer je usunie
    let StatystykiLokalne = {
        zjedzoneKropki: 0,
        rzuconeOszczepy: 0,
        zabojstwaZrzedu: 0,
        czasWGrze: 0
    };

    // ==========================================
    // [IDEA 1 & 2] MASZYNA STANÓW (FSM) I EVENT BUS
    // ==========================================
    const EventBus = {
        listeners: {},
        on(event, callback) { if(!this.listeners[event]) this.listeners[event] = []; this.listeners[event].push(callback); },
        emit(event, data) { if(this.listeners[event]) this.listeners[event].forEach(cb => cb(data)); }
    };

    const GameFSM = {
        zmienStan(nowyStan) {
            if (window.Flagi) window.Flagi.Stan.aktualny = nowyStan;
            EventBus.emit('stateChanged', nowyStan);
            console.log(`🎬 [REŻYSER] Zmiana stanu gry na: ${nowyStan}`);
        }
    };

    // ==========================================
    // [MODUŁ AAA] LOKALNY SYSTEM OSIĄGNIĘĆ I QUESTÓW
    // ==========================================
    const SystemOsiagniec = {
        odblokowane: new Set(),
        sprawdz: function(statystyki) {
            this.weryfikuj(statystyki.zjedzoneKropki >= 50, "ZARŁOK", "Zjedz 50 kropek materii.");
            this.weryfikuj(statystyki.rzuconeOszczepy >= 20, "SNIPER", "Wykonaj 20 rzutów oszczepem.");
            this.weryfikuj(statystyki.czasWGrze >= 300, "WETERAN", "Przetrwaj 5 minut na arenie.");
            this.weryfikuj(statystyki.zabojstwaZrzedu >= 3, "MORDERCA", "Zdobądź Triple Kill!");
        },
        weryfikuj: function(warunek, id, opis) {
            if (warunek && !this.odblokowane.has(id)) {
                this.odblokowane.add(id);
                this.pokazPowiadomienie(id, opis);
            }
        },
        pokazPowiadomienie: function(tytul, opis) {
            const achContainer = document.createElement('div');
            achContainer.style.cssText = `
                position: fixed; top: -100px; left: 50%; transform: translateX(-50%);
                background: linear-gradient(135deg, rgba(46, 204, 113, 0.9), rgba(39, 174, 96, 0.9));
                color: #fff; font-family: 'Exo 2', sans-serif; padding: 15px 30px;
                border-radius: 10px; border: 2px solid #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                text-align: center; z-index: 10000; transition: top 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                pointer-events: none; text-shadow: 1px 1px 2px #000;
            `;
            achContainer.innerHTML = `<h3 style="margin:0; font-size:18px;">🏆 OSIĄGNIĘCIE: ${tytul}</h3><p style="margin:5px 0 0 0; font-size:13px; color:#ddd;">${opis}</p>`;
            document.body.appendChild(achContainer);
            
            // Dźwięk osiągnięcia
            let audioAch = new Audio('./assety/alert.mp3'); 
            audioAch.volume = 0.5; audioAch.play().catch(e=>{});

            setTimeout(() => { achContainer.style.top = '20px'; }, 100);
            setTimeout(() => { achContainer.style.top = '-100px'; }, 4000);
            setTimeout(() => { achContainer.remove(); }, 5000);
        }
    };

    // ==========================================
    // [MODUŁ AAA] TAKTYCZNY KALKULATOR FORMACJI BOTÓW
    // ==========================================
    const MenadzerFormacji = {
        obliczPozycje: function(gracz, typFormacji) {
            if (!gracz) return [];
            let pozycje = [];
            const iloscDronow = 6; 
            const rozstaw = 80;
            const katGracza = gracz.kat || 0;

            switch(typFormacji) {
                case 1: // Formacja V (Atak)
                    for(let i = 1; i <= iloscDronow; i++) {
                        let strona = i % 2 === 0 ? 1 : -1;
                        let rzad = Math.ceil(i / 2);
                        let offsetKat = katGracza + (strona * Math.PI * 0.75);
                        let dystans = rzad * rozstaw;
                        pozycje.push({
                            x: gracz.x + Math.cos(offsetKat) * dystans,
                            y: gracz.y + Math.sin(offsetKat) * dystans
                        });
                    }
                    break;
                case 2: // Mur Obrony (Linia przed graczem)
                    let startX = gracz.x + Math.cos(katGracza) * rozstaw;
                    let startY = gracz.y + Math.sin(katGracza) * rozstaw;
                    let liniaKat = katGracza + Math.PI / 2; 
                    for(let i = 0; i < iloscDronow; i++) {
                        let offset = (i - (iloscDronow-1)/2) * rozstaw;
                        pozycje.push({
                            x: startX + Math.cos(liniaKat) * offset,
                            y: startY + Math.sin(liniaKat) * offset
                        });
                    }
                    break;
                case 3: // Okrąg Obronny (Żółw)
                    for(let i = 0; i < iloscDronow; i++) {
                        let kat = (i / iloscDronow) * Math.PI * 2 + (performance.now()/1000); 
                        pozycje.push({
                            x: gracz.x + Math.cos(kat) * rozstaw * 1.5,
                            y: gracz.y + Math.sin(kat) * rozstaw * 1.5
                        });
                    }
                    break;
                case 4: // Formacja Luźna
                default:
                    break;
            }
            return pozycje;
        }
    };

    // ==========================================
    // [IDEA 11] OBJECT POOLING WIZUALIZACJI
    // ==========================================
    const DOMElementsPool = {
        pool: [],
        get() { return this.pool.length > 0 ? this.pool.pop() : document.createElement('div'); },
        release(el) { el.remove(); el.className = ''; el.innerHTML = ''; this.pool.push(el); }
    };

    // ==========================================
    // [FIX AAA] GLOBALNY SILNIK AUDIO (FILTR ANTY-SPAMOWY)
    // ==========================================
    const SilnikAudio = {
        muzykaTla: new Audio('./assety/dark_trap.mp3'),
        bazaEat: new Audio('./assety/eat.mp3'),
        ostatniZgryz: 0,
        
        startMuzyki: function() {
            this.muzykaTla.loop = true;
            this.muzykaTla.volume = 0.3; // Ciszej, by budować klimat Noir
            // Odpalamy! (Działa w 100%, bo wywołane kliknięciem przycisku DESANT)
            this.muzykaTla.play().catch(e => console.warn("[Audio] Przeglądarka zablokowała muzykę tła. Wymagane kliknięcie."));
        },
        
        grajMniam: function(glosnosc = 0.4) {
            let teraz = Date.now();
            // Filtr 50ms - ratuje RAM przed zacinającym się dźwiękiem i trzaskami!
            if (teraz - this.ostatniZgryz > 50) {
                this.ostatniZgryz = teraz;
                let dzwiek = this.bazaEat.cloneNode(); // Dźwięki nakładają się płynnie, zamiast ucinać
                dzwiek.volume = glosnosc;
                dzwiek.play().catch(e => {}); 
            }
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        console.log("🛠️ Inicjalizacja interfejsu UI i Silnika Audio...");

        if (!window.Flagi) window.Flagi = { Stan: { aktualny: 'LOBBY' } };

        // === ZARZĄDZANIE AUDIO (AMBIENT I MUZYKA) ===
        let isMuted = false;
        
        const dzwiekOgnia = new Audio('./assety/fire.mp3');
        dzwiekOgnia.loop = true;
        dzwiekOgnia.volume = 0.4;

        const dzwiekWhoosh = new Audio('./assety/fire_whoosh.mp3');
        dzwiekWhoosh.volume = 0.8;

        // === SILNIK SFX (DŹWIĘKI REAKTYWNE) ===
        const SFX = {
            throw: new Audio('./assety/throw.mp3'),
            hit: new Audio('./assety/hit.mp3'),
            death: new Audio('./assety/hit.mp3'), 
            alert: new Audio('./assety/alert.mp3'),
            heartbeat: new Audio('./assety/heartbeat.mp3') 
        };
        if(SFX.heartbeat) { SFX.heartbeat.loop = true; SFX.heartbeat.volume = 0.6; }

        Object.values(SFX).forEach(audio => { if(audio) audio.preload = 'auto'; });

        function odpalDzwiek(nazwa, glosnosc = 0.5) {
            if (isMuted || !SFX[nazwa]) return;
            let dzwiek = SFX[nazwa].cloneNode(); 
            dzwiek.volume = glosnosc;
            dzwiek.play().catch(e => console.warn(`Nie można odtworzyć SFX: ${nazwa}`, e));
        }

        function odpalDzwiek3D(nazwa, glosnoscDocelowa = 0.5, zrodloX = null, zrodloY = null) {
            if (isMuted || !SFX[nazwa]) return;
            let vol = glosnoscDocelowa;

            if (zrodloX !== null && zrodloY !== null && stanSerwera && stanSerwera.players && mojeId) {
                let ja = stanSerwera.players[mojeId];
                if (ja) {
                    let dystans = Math.hypot(ja.x - zrodloX, ja.y - zrodloY);
                    let maxDystans = 1500;
                    if (dystans > maxDystans) return; 
                    let mnoznik = 1 - (dystans / maxDystans);
                    vol = glosnoscDocelowa * mnoznik;
                }
            }
            let dzwiek = SFX[nazwa].cloneNode(); 
            dzwiek.volume = Math.max(0, Math.min(1, vol));
            dzwiek.play().catch(e => console.warn(`Nie można odtworzyć SFX: ${nazwa}`, e));
        }

        function zrobAudioDucking() {
            if (isMuted || czyDucking) return;
            czyDucking = true;
            let orgGlosnosc = SilnikAudio.muzykaTla.volume;
            SilnikAudio.muzykaTla.volume = orgGlosnosc * 0.3; 
            setTimeout(() => {
                let volInterval = setInterval(() => {
                    if (SilnikAudio.muzykaTla.volume < orgGlosnosc) {
                        SilnikAudio.muzykaTla.volume = Math.min(orgGlosnosc, SilnikAudio.muzykaTla.volume + 0.02);
                    } else {
                        czyDucking = false;
                        clearInterval(volInterval);
                    }
                }, 100);
            }, 3000);
        }

        function wibruj(wzorzec) {
            if (window.Flagi && window.Flagi.Srodowisko && window.Flagi.Srodowisko.isMobile && navigator.vibrate) {
                try { navigator.vibrate(wzorzec); } catch(e){}
            }
        }

        // Próba odtworzenia dźwięku (Autoplay bypass)
        let pierwszaInterakcja = false;
        let sprobujOdtworzyc = dzwiekWhoosh.play();
        if (sprobujOdtworzyc !== undefined) {
            sprobujOdtworzyc.then(() => {
                dzwiekOgnia.play().catch(e => console.log(e));
            }).catch(error => {
                console.log("🛡️ Przeglądarka zablokowała Autoplay.");
                const odblokujAudio = () => {
                    if (!pierwszaInterakcja) {
                        pierwszaInterakcja = true;
                        dzwiekWhoosh.currentTime = 0;
                        dzwiekWhoosh.play().catch(e => console.log(e));
                        if (!isMuted && (!window.Flagi || window.Flagi.Stan.aktualny !== 'PLAYING')) {
                            dzwiekOgnia.play().catch(e => console.log(e));
                        }
                    }
                    document.removeEventListener('click', odblokujAudio);
                    document.removeEventListener('keydown', odblokujAudio);
                    document.removeEventListener('touchstart', odblokujAudio);
                };
                document.addEventListener('click', odblokujAudio);
                document.addEventListener('keydown', odblokujAudio);
                document.addEventListener('touchstart', odblokujAudio);
            });
        }
        
        document.body.addEventListener('click', () => {
            if (dzwiekOgnia.paused && !isMuted && (!window.Flagi || window.Flagi.Stan.aktualny !== 'PLAYING')) {
                dzwiekOgnia.play().catch(e => console.log(e));
            }
        }, { once: true });

        // --- GLOBALNY PRZYCISK MUTE ---
        const btnMute = document.createElement('button');
        btnMute.innerHTML = '🔊';
        btnMute.style.cssText = 'position: fixed; bottom: 20px; left: 20px; background: rgba(5,5,5,0.8); border: 2px solid #e74c3c; border-radius: 50%; width: 45px; height: 45px; color: #fff; font-size: 20px; cursor: pointer; z-index: 9999; box-shadow: 0 0 10px rgba(0,0,0,0.8); transition: transform 0.2s;';
        btnMute.onmouseenter = () => btnMute.style.transform = 'scale(1.1)';
        btnMute.onmouseleave = () => btnMute.style.transform = 'scale(1)';
        btnMute.onclick = () => {
            isMuted = !isMuted;
            dzwiekOgnia.muted = isMuted;
            dzwiekWhoosh.muted = isMuted;
            SilnikAudio.muzykaTla.muted = isMuted;
            SilnikAudio.bazaEat.muted = isMuted;
            if(SFX.heartbeat) SFX.heartbeat.muted = isMuted;
            btnMute.innerHTML = isMuted ? '🔇' : '🔊';
            btnMute.style.borderColor = isMuted ? '#555' : '#e74c3c';
        };
        document.body.appendChild(btnMute);

        // (AAA) PING & NET-GRAPH MONITOR
        const netGraph = document.createElement('div');
        netGraph.id = 'net-graph';
        netGraph.style.cssText = 'position: fixed; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: #0f0; font-family: monospace; font-size: 11px; padding: 6px; border-radius: 4px; z-index: 9999; display: none; text-align: right; border: 1px solid #333; pointer-events: none; text-shadow: 0 0 5px #0f0;';
        document.body.appendChild(netGraph);

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                netGraph.style.display = netGraph.style.display === 'none' ? 'block' : 'none';
            }
        });

        const leaderboard = document.createElement('div');
        leaderboard.id = 'leaderboard';
        leaderboard.style.cssText = 'position: absolute; top: 20px; right: 20px; background: rgba(10,10,15,0.85); border: 2px solid #f1c40f; padding: 12px; border-radius: 8px; color: #fff; font-family: "Exo 2", sans-serif; width: 200px; z-index: 10; pointer-events: none; transition: opacity 0.3s; box-shadow: 0 0 15px rgba(241, 196, 15, 0.2);';
        leaderboard.classList.add('hidden');
        document.getElementById('in-game-ui').appendChild(leaderboard);

        const mutatorDisplay = document.createElement('div');
        mutatorDisplay.style.cssText = 'position: absolute; top: 20px; left: 50%; transform: translateX(-50%); color: #3498db; font-family: "Exo 2", sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 5px #3498db; z-index: 10; pointer-events: none;';
        document.getElementById('in-game-ui').appendChild(mutatorDisplay);

        window.addEventListener('touchstart', function addTouchBtn() {
            const mobileBtn = document.createElement('button');
            mobileBtn.innerHTML = '🎯';
            mobileBtn.style.cssText = 'position: absolute; bottom: 80px; right: 20px; width: 70px; height: 70px; border-radius: 50%; background: rgba(231, 76, 60, 0.4); border: 3px solid #e74c3c; color: white; font-size: 28px; font-weight: bold; z-index: 999; box-shadow: 0 0 15px rgba(231,76,60,0.6); pointer-events: auto;';
            
            mobileBtn.ontouchstart = (e) => {
                e.preventDefault(); 
                if (!czyWsklepie && window.Flagi && window.Flagi.Stan.aktualny === 'PLAYING') {
                    buforRzutuCzas = Date.now(); 
                }
            };
            document.getElementById('in-game-ui').appendChild(mobileBtn);
            window.removeEventListener('touchstart', addTouchBtn);
        }, { once: true });


        // 2. REFERENCJE UI
        const uiLayer = document.getElementById('ui-layer');
        const bgLayer = document.getElementById('css-arena-bg'); 
        const step1 = document.getElementById('step-1');
        const step2 = document.getElementById('step-2');
        const step3 = document.getElementById('step-3');
        const step4 = document.getElementById('step-4'); 
        const inputNick = document.getElementById('playerName');
        const castleShop = document.getElementById('castle-shop');
        const midasTutorial = document.getElementById('midas-tutorial');
        const midasText = document.getElementById('midas-text');
        
        const killfeed = document.getElementById('killfeed');
        const timerDisplay = document.getElementById('time-display');
        const timerContainer = document.getElementById('survival-timer');

        const ingameControls = document.getElementById('ingame-controls');
        const btnLeave = document.getElementById('btn-leave');

        const teamPowerBar = document.getElementById('team-power-bar');
        const barRed = document.getElementById('bar-red');
        const barBlue = document.getElementById('bar-blue');
        const formationPanel = document.getElementById('formation-panel');

        // [MODUŁ AAA] EKRAN WYBORU STEROWANIA
        const stepControls = document.createElement('div');
        stepControls.id = 'step-controls';
        stepControls.classList.add('hidden');
        stepControls.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(10, 10, 15, 0.95); padding: 40px; border: 3px solid #3498db; border-radius: 15px; text-align: center; z-index: 1000; width: 85%; max-width: 550px; box-shadow: 0 0 40px rgba(52, 152, 219, 0.3);';
        stepControls.innerHTML = `
            <h2 style="color: #3498db; text-shadow: 0 0 10px #3498db; margin-bottom: 25px; font-family: 'Permanent Marker', sans-serif; font-size: 28px;">WYBIERZ STEROWANIE</h2>
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <button class="main-btn ctrl-btn" data-ctrl="HYBRID" style="background: rgba(241, 196, 15, 0.15); border-color: #f1c40f;">🔥 HYBRYDA (Myszka podąża + WASD overrides)</button>
                <button class="main-btn ctrl-btn" data-ctrl="MOUSE" style="background: rgba(52, 152, 219, 0.15); border-color: #3498db;">🖱️ TYLKO MYSZKA (Bezwzględne podążanie)</button>
                <button class="main-btn ctrl-btn" data-ctrl="WASD" style="background: rgba(231, 76, 60, 0.15); border-color: #e74c3c;">⌨️ KLASYCZNE WASD (Ruch klawisze, Cel Myszka)</button>
                <button class="main-btn ctrl-btn" data-ctrl="ARROWS" style="background: rgba(231, 76, 60, 0.15); border-color: #e74c3c;">⬆️ STRZAŁKI (Ruch klawisze, Cel Myszka)</button>
                <button class="main-btn ctrl-btn" data-ctrl="MOBILE" style="background: rgba(46, 204, 113, 0.15); border-color: #2ecc71;">📱 MOBILE (Ekran Dotykowy Optymalizacja)</button>
            </div>
        `;
        if(uiLayer) uiLayer.appendChild(stepControls);

        if (btnLeave) {
            btnLeave.addEventListener('click', () => {
                EventBus.emit('gameTeardown');
                if (confirm("Czy na pewno chcesz opuścić pole bitwy i wrócić do menu głównego?")) location.reload(); 
            });
        }

        // 3. OBSŁUGA LOBBY I WYBORU KLAS
        document.getElementById('nextBtn').addEventListener('click', () => {
            if (inputNick.value.trim().length < 2) { inputNick.style.borderColor = '#e74c3c'; return; }
            dzwiekWhoosh.currentTime = 0;
            if (!isMuted) dzwiekWhoosh.play().catch(e => console.warn("Whoosh:", e));
            step1.classList.add('hidden'); step2.classList.remove('hidden');
        });

        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.getAttribute('data-target');
                e.target.parentElement.classList.add('hidden');
                document.getElementById(target).classList.remove('hidden');
            });
        });

        document.querySelectorAll('[data-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.getAttribute('data-mode');
                if (window.Flagi) window.Flagi.Stan.wybranyTryb = mode;
                step2.classList.add('hidden'); 
                
                if (document.getElementById('step-controls')) {
                    document.getElementById('step-controls').classList.remove('hidden');
                } else {
                    step3.classList.remove('hidden'); 
                }
            });
        });

        // Nasłuchiwacze dla panelu sterowania
        document.querySelectorAll('.ctrl-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                wybraneSterowanie = e.target.getAttribute('data-ctrl');
                document.getElementById('step-controls').classList.add('hidden');
                step3.classList.remove('hidden'); 
                
                dzwiekWhoosh.currentTime = 0;
                if (!isMuted) dzwiekWhoosh.play().catch(e=>{});
            });
        });

        document.querySelectorAll('.char-card').forEach(card => {
            card.addEventListener('click', (e) => {
                document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                if (window.Flagi) window.Flagi.Stan.wybranaKlasa = e.currentTarget.getAttribute('data-skin');
            });
        });

        // 4. LOGIKA WEJŚCIA NA ARENĘ
        document.getElementById('btn-enter-arena').addEventListener('click', () => {
            const mode = window.Flagi ? window.Flagi.Stan.wybranyTryb : 'FREE';
            if (mode === 'TEAMS') wejdzNaArene('random');
            else if (mode === 'CAMPAIGN') wejdzNaArene('center'); 
            else { step3.classList.add('hidden'); step4.classList.remove('hidden'); }
        });

        document.querySelectorAll('[data-spawn]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('[data-spawn]').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                wybranySpawn = e.currentTarget.getAttribute('data-spawn');
            });
        });

        document.getElementById('btn-deploy').addEventListener('click', () => wejdzNaArene(wybranySpawn));

        function wejdzNaArene(sektor) {
            const mode = window.Flagi ? window.Flagi.Stan.wybranyTryb : 'FREE';
            const data = {
                name: inputNick.value.trim() || "Gracz",
                mode: mode,
                skin: window.Flagi ? window.Flagi.Stan.wybranaKlasa : 'standard',
                spawnZone: sektor
            };

            EventBus.emit('arenaSweep');
            LokalnyBuforZjedzonychKropek.clear(); 

            socket.emit('joinGame', data);
            
            if (uiLayer) uiLayer.classList.add('hidden');
            if (bgLayer) {
                bgLayer.style.display = 'none';
                bgLayer.innerHTML = ''; 
            }
            
            if (timerContainer) timerContainer.classList.remove('hidden');
            if (ingameControls) ingameControls.classList.remove('hidden');

            if (mode === 'TEAMS') {
                if (teamPowerBar) teamPowerBar.classList.remove('hidden');
                if (formationPanel) formationPanel.classList.remove('hidden');
            }
            
            dzwiekOgnia.pause();
            
            // [FIX AAA] TWARDE WYMUSZENIE STARTU MUZYKI W MOMENCIE KLIKNIĘCIA!
            if (!isMuted) {
                SilnikAudio.startMuzyki();
            }
            
            czasStart = Date.now();
            etapKampanii = 0; 
            ostatniaMasa = null; 
            ostatniCzasInputu = Date.now();
            
            if (interwalCzasu) clearInterval(interwalCzasu);
            interwalCzasu = setInterval(aktualizujCzas, 1000);
            
            GameFSM.zmienStan('PLAYING');
            if (window.Guardian && window.Guardian.odbierzTick) window.Guardian.odbierzTick(); 
            
            if (mode === 'CAMPAIGN') {
                setTimeout(() => { pokazNapisKinowy("SYSTEM PODTRZYMYWANIA ŻYCIA AKTYWNY. BĄDŹ OSTROŻNY...", 5000); }, 1500);
            }

            requestAnimationFrame(pętlaGry);
        }

        // [IDEA 5 & 16] Time-Drift Sync & Sudden Death
        let isSuddenDeath = false;
        function aktualizujCzas() {
            if (!timerDisplay) return;
            
            let roznica = 0;
            if (stanSerwera && stanSerwera.serverEndTime) {
                roznica = Math.max(0, Math.floor((stanSerwera.serverEndTime - Date.now()) / 1000));
            } else {
                roznica = Math.floor((Date.now() - czasStart) / 1000); 
            }

            StatystykiLokalne.czasWGrze = roznica; 
            SystemOsiagniec.sprawdz(StatystykiLokalne);

            let min = String(Math.floor(roznica / 60)).padStart(2, '0');
            let sek = String(roznica % 60).padStart(2, '0');
            timerDisplay.innerText = `${min}:${sek}`;

            if (stanSerwera && stanSerwera.serverEndTime && roznica <= 30 && roznica > 0) {
                if (!isSuddenDeath) {
                    isSuddenDeath = true;
                    timerDisplay.style.color = '#e74c3c';
                    timerDisplay.style.textShadow = '0 0 10px #e74c3c';
                    pokazNapisKinowy("NAGŁA ŚMIERĆ!", 2000);
                    if (!isMuted && SFX.heartbeat) SFX.heartbeat.play().catch(e=>console.log(e));
                }
            } else if (isSuddenDeath && roznica > 30) {
                isSuddenDeath = false;
                timerDisplay.style.color = '#fff';
                timerDisplay.style.textShadow = 'none';
                if(SFX.heartbeat) SFX.heartbeat.pause();
            }

            socket.emit('pingTest', Date.now());
        }

        socket.on('pongTest', (klientWyslano) => {
            ping = Date.now() - klientWyslano;
            if (netGraph) netGraph.innerHTML = `PING: <span style="color:${ping > 120 ? '#e74c3c' : '#2ecc71'}">${ping}ms</span>`;
        });

        function dodajDoKillfeedu(zabojca, ofiara) {
            if (!killfeed) return;
            const wpis = DOMElementsPool.get();
            wpis.style.background = 'rgba(20,20,25,0.85)';
            wpis.style.borderLeft = '3px solid #e74c3c';
            wpis.style.padding = '5px 10px';
            wpis.style.color = '#fff';
            wpis.style.fontFamily = "'Exo 2', sans-serif";
            wpis.style.fontSize = '13px';
            wpis.style.borderRadius = '3px';
            wpis.style.opacity = '1';
            wpis.innerHTML = `<span style="color:#e74c3c; font-weight:bold;">${zabojca}</span> zniszczył <span style="color:#aaa;">${ofiara}</span>`;
            killfeed.appendChild(wpis);
            setTimeout(() => {
                wpis.style.opacity = '0';
                wpis.style.transition = 'opacity 0.5s ease';
                setTimeout(() => { DOMElementsPool.release(wpis); }, 500);
            }, 5000);
        }

        function pokazNapisKinowy(tekst, czas = 4000) {
            let container = document.getElementById('cinematic-subtitles');
            if (!container) {
                container = document.createElement('div');
                container.id = 'cinematic-subtitles';
                container.style.cssText = `
                    position: fixed; bottom: 12%; left: 50%; transform: translateX(-50%);
                    width: 90%; text-align: center; z-index: 999; pointer-events: none;
                    opacity: 0; transition: opacity 0.5s ease;
                `;
                let textEl = document.createElement('h2');
                textEl.id = 'cinematic-text';
                textEl.style.cssText = `
                    color: #fff; font-family: 'Exo 2', sans-serif; font-size: 22px;
                    text-transform: uppercase; letter-spacing: 4px; font-style: italic;
                    text-shadow: 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0px 4px 15px rgba(231, 76, 60, 0.8);
                    background: rgba(5, 5, 5, 0.85); display: inline-block; padding: 12px 35px; border-radius: 8px;
                    border-bottom: 3px solid #e74c3c;
                `;
                container.appendChild(textEl);
                document.body.appendChild(container);
            }

            let textEl = document.getElementById('cinematic-text');
            textEl.innerText = tekst;
            container.style.opacity = '1';

            if (container.timeoutId) clearTimeout(container.timeoutId);
            container.timeoutId = setTimeout(() => {
                container.style.opacity = '0';
            }, czas);
        }

        // [FIX AAA] AGRESYWNY TELEGRAPHING DLA EVENTÓW (Brak opóźnień)
        function pokazAgresywnyNapisEventu(tekst) {
            const warstwaGracza = document.getElementById('in-game-ui');
            let banner = document.getElementById('cinematic-banner-fast');
            
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'cinematic-banner-fast';
                banner.style.cssText = `
                    position: absolute; top: 25%; left: 50%; transform: translateX(-50%);
                    color: #e74c3c; font-family: 'Permanent Marker', cursive; font-size: clamp(25px, 4vw, 45px);
                    text-shadow: 0 0 15px #e74c3c, 0 0 30px #000, 2px 2px 0 #000;
                    text-align: center; z-index: 1000; pointer-events: none; width: 100%;
                `;
                if(warstwaGracza) warstwaGracza.appendChild(banner);
            }
            
            banner.innerHTML = tekst;
            banner.style.display = 'block';
            
            if (window.Grafika) window.Grafika.wywolajWstrzas(15);
            
            if (banner.timoutId) clearTimeout(banner.timoutId);
            banner.timoutId = setTimeout(() => { banner.style.display = 'none'; }, 4000);
        }

        // 5. HYBRYDOWY SYSTEM STEROWANIA Z DETEKCJĄ AFK
        function zglosInput() { ostatniCzasInputu = Date.now(); }

        window.addEventListener('mousemove', (e) => {
            kursor.x = e.clientX; kursor.y = e.clientY;
            zglosInput();
        });
        window.addEventListener('touchmove', (e) => {
            kursor.x = e.touches[0].clientX; kursor.y = e.touches[0].clientY;
            zglosInput();
        }, { passive: true });

        window.addEventListener('keydown', (e) => {
            if (window.Flagi && !['PLAYING', 'SPECTATOR'].includes(window.Flagi.Stan.aktualny)) return; 
            zglosInput();
            const key = e.key.toLowerCase();
            
            if (['wasd', 'hybrid'].includes(wybraneSterowanie.toLowerCase())) {
                if (key === 'w') klawiszeKierunku.w = true;
                if (key === 'a') klawiszeKierunku.a = true;
                if (key === 's') klawiszeKierunku.s = true;
                if (key === 'd') klawiszeKierunku.d = true;
            }
            if (['arrows', 'hybrid'].includes(wybraneSterowanie.toLowerCase())) {
                if (key === 'arrowup') klawiszeKierunku.w = true;
                if (key === 'arrowleft') klawiszeKierunku.a = true;
                if (key === 'arrowdown') klawiszeKierunku.s = true;
                if (key === 'arrowright') klawiszeKierunku.d = true;
            }

            if (['1','2','3','4'].includes(key) && window.Flagi.Stan.wybranyTryb === 'TEAMS') {
                aktywnaFormacja = parseInt(key);
                socket.emit('zmianaFormacji', aktywnaFormacja);
                document.querySelectorAll('#formation-panel span').forEach(el => el.remove());
                const li = document.querySelector(`#formation-panel ul li:nth-child(${aktywnaFormacja})`);
                if(li) li.innerHTML += ` <span style="color:#2ecc71; margin-left: 5px;">[Aktywny]</span>`;
            }

            if (e.code === 'Space' && czyWBazie) {
                if (!czyWsklepie) { czyWsklepie = true; if (castleShop) castleShop.classList.remove('hidden'); } 
                else zamknijSklep();
            }
            if (e.code === 'KeyE') socket.emit('rozkazSpecjalny');
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (['wasd', 'hybrid'].includes(wybraneSterowanie.toLowerCase())) {
                if (key === 'w') klawiszeKierunku.w = false;
                if (key === 'a') klawiszeKierunku.a = false;
                if (key === 's') klawiszeKierunku.s = false;
                if (key === 'd') klawiszeKierunku.d = false;
            }
            if (['arrows', 'hybrid'].includes(wybraneSterowanie.toLowerCase())) {
                if (key === 'arrowup') klawiszeKierunku.w = false;
                if (key === 'arrowleft') klawiszeKierunku.a = false;
                if (key === 'arrowdown') klawiszeKierunku.s = false;
                if (key === 'arrowright') klawiszeKierunku.d = false;
            }
        });

        window.addEventListener('mousedown', (e) => {
            if (window.Flagi && window.Flagi.Stan.aktualny === 'PLAYING' && e.button === 0 && !czyWsklepie) { 
                zglosInput();
                buforRzutuCzas = Date.now(); 
            }
        });
        window.addEventListener('touchstart', (e) => {
            if (window.Flagi && window.Flagi.Stan.aktualny === 'PLAYING' && !czyWsklepie && e.touches.length > 1) {
                zglosInput();
                buforRzutuCzas = Date.now(); 
            }
        }, { passive: false });

        // 6. SYSTEM SKLEPU I FABUŁY
        window.kupBron = function(typ) { socket.emit('buyShopItem', typ); };
        window.zamknijSklep = function() { czyWsklepie = false; if (castleShop) castleShop.classList.add('hidden'); };

        function obslugaFabułyKampanii(mojGracz) {
            if (!window.Flagi || window.Flagi.Stan.wybranyTryb !== 'CAMPAIGN') return;
            let masa = mojGracz.score;

            if (masa >= 50 && etapKampanii === 0) {
                pokazNapisKinowy("ZAAKTYWOWANO PROTOKÓŁ OBRONNY. RÓJ MASZYN OBUDZIŁ SIĘ Z UŚPIENIA.", 6000);
                odpalDzwiek3D('alert', 0.7, srodekBazyX, srodekBazyY);
                zrobAudioDucking();
                etapKampanii = 1;
            }
            if (masa >= 150 && etapKampanii === 1) {
                pokazNapisKinowy("AKTYWNOŚĆ ROJU WZRASTA. ZBIERAJ MASĘ, ABY EWOLUOWAĆ PANCERZ.", 5000);
                etapKampanii = 2;
            }
            if (masa >= 280 && etapKampanii === 2) {
                pokazNapisKinowy("⚠️ WYKRYTO POTĘŻNE DRGANIA SEJSMICZNE... ANOMALIA OMEGA ZBLIŻA SIĘ DO SEKTORA!", 7000);
                odpalDzwiek3D('alert', 0.8, mojGracz.x, mojGracz.y);
                zrobAudioDucking();
                wibruj([100,50,100,50,200]);
                if (window.Grafika && window.Grafika.wywolajWstrzas) window.Grafika.wywolajWstrzas(10);
                etapKampanii = 3;
            }

            let bossAlive = false;
            if (stanSerwera && stanSerwera.bots) {
                Object.values(stanSerwera.bots).forEach(b => { if (b.isBoss || b.skin === 'ninja') bossAlive = true; });
            }

            if (bossAlive && etapKampanii === 3) {
                pokazNapisKinowy("TYTAN OMEGA ZESPAWNOWANY! ZNISZCZ GO, ABY PRZETRWAĆ!", 6000);
                odpalDzwiek3D('alert', 1.0, mojGracz.x, mojGracz.y);
                zrobAudioDucking();
                wibruj([300,100,300,100,500]);
                if (window.Grafika && window.Grafika.wywolajWstrzas) window.Grafika.wywolajWstrzas(25);
                etapKampanii = 4;
            }
        }

        function obslugaStref(mojGracz) {
            const tryb = window.Flagi ? window.Flagi.Stan.wybranyTryb : 'FREE';
            srodekBazyX = 2000; srodekBazyY = 2000;
            if (tryb === 'TEAMS') {
                if (mojGracz.team === 'RED') { srodekBazyX = 500; srodekBazyY = 3000; }
                else if (mojGracz.team === 'BLUE') { srodekBazyX = 5500; srodekBazyY = 3000; }
            }

            const dystansDoBazy = Math.hypot(mojGracz.x - srodekBazyX, mojGracz.y - srodekBazyY);
            czyWBazie = dystansDoBazy < 400;

            if (!czyWBazie && czyWsklepie) zamknijSklep();

            if (midasTutorial && midasText) {
                if (tryb === 'CAMPAIGN' && mojGracz.score < 50) {
                    midasTutorial.classList.remove('hidden');
                    midasText.innerText = "AKT I: BUNT MASZYN. Przetrwaj hordę i zdobądź 300 masy, by wezwać Bossa!";
                } else if (tryb === 'FREE' && mojGracz.score < 15) {
                    midasTutorial.classList.remove('hidden');
                    midasText.innerText = "Zbieraj masę. Naciśnij 'M' by odpalić radar, kieruj myszką lub WASD.";
                } else {
                    midasTutorial.classList.add('hidden');
                }
            }
        }

        function aktualizujSileDruzyn() {
            if (!stanSerwera || window.Flagi.Stan.wybranyTryb !== 'TEAMS') return;
            let redScore = 0; let blueScore = 0;
            Object.values(stanSerwera.players).forEach(p => {
                if (p.team === 'RED') redScore += p.score;
                if (p.team === 'BLUE') blueScore += p.score;
            });
            Object.values(stanSerwera.bots).forEach(b => {
                if (b.ownerId && b.team === 'RED') redScore += b.score;
                if (b.ownerId && b.team === 'BLUE') blueScore += b.score;
            });

            let total = redScore + blueScore;
            if (total === 0) total = 1; 

            let redPercent = (redScore / total) * 100;
            let bluePercent = (blueScore / total) * 100;
            if (barRed) barRed.style.width = `${redPercent}%`;
            if (barBlue) barBlue.style.width = `${bluePercent}%`;
        }

        // 8. KOMUNIKACJA Z SERWEREM
        socket.on('init', (data) => { mojeId = data.id; });
        socket.on('serverTick', (data) => {
            stanSerwera = window.Guardian && window.Guardian.sanityzujStanSerwera ? window.Guardian.sanityzujStanSerwera(data) : data;
            
            // <--- WERYFIKACJA LOKALNEGO BUFORA ŻARCIA --->
            if (stanSerwera.foods) {
                let przefiltrowane = {};
                Object.keys(stanSerwera.foods).forEach(id => {
                    if (!LokalnyBuforZjedzonychKropek.has(String(id)) && !LokalnyBuforZjedzonychKropek.has(Number(id))) {
                        przefiltrowane[id] = stanSerwera.foods[id];
                    }
                });
                stanSerwera.foods = przefiltrowane;
            }

            if (data.serverEndTime) stanSerwera.serverEndTime = data.serverEndTime;
            if (data.mutators && mutatorDisplay) {
                mutatorDisplay.innerText = "Aktywne Modyfikacje: " + data.mutators.join(' | ');
            }

            if (window.Flagi && window.Flagi.Stan.aktualny === 'PLAYING' && !stanSerwera.players[mojeId] && data.isSpectator) {
                GameFSM.zmienStan('SPECTATOR');
                pokazNapisKinowy("JESTEŚ WIDZEM", 3000);
            }
            
            if (window.Guardian && window.Guardian.odbierzTick) window.Guardian.odbierzTick();
            aktualizujSileDruzyn(); 
            
            if (stanSerwera.players && window.Flagi && ['PLAYING', 'SPECTATOR'].includes(window.Flagi.Stan.aktualny)) {
                const tryb = window.Flagi.Stan.wybranyTryb;
                if (tryb === 'FREE' || tryb === 'CAMPAIGN') { 
                    const gracze = Object.values(stanSerwera.players)
                                         .sort((a, b) => b.score - a.score)
                                         .slice(0, 5); 
                    
                    let lbHTML = '<h3 style="margin: 0 0 10px 0; color: #f1c40f; font-size: 15px; text-align: center; border-bottom: 1px solid #555; padding-bottom: 5px;">TOP W SEKTORZE</h3><ol style="margin: 0; padding-left: 25px; font-size: 13px; line-height: 1.8;">';
                    gracze.forEach(p => {
                        let isMe = p.id === mojeId;
                        let color = isMe ? '#f1c40f' : '#fff';
                        let fw = isMe ? 'bold' : 'normal';
                        lbHTML += `<li style="color: ${color}; font-weight: ${fw}"><span>${p.name.substring(0, 10)}</span>: <span style="float: right; padding-right: 10px;">${Math.floor(p.score)}</span></li>`;
                    });
                    lbHTML += '</ol>';
                    if (document.getElementById('leaderboard')) {
                        document.getElementById('leaderboard').innerHTML = lbHTML;
                        document.getElementById('leaderboard').classList.remove('hidden');
                    }
                } else {
                    if (document.getElementById('leaderboard')) document.getElementById('leaderboard').classList.add('hidden');
                }
            }
        });
        socket.on('shopSuccess', (data) => { alert("Ukończono modyfikację: " + data.item.toUpperCase()); zamknijSklep(); });
        
        socket.on('killEvent', (data) => { 
            if (data.zabojca && data.ofiara) {
                dodajDoKillfeedu(data.zabojca, data.ofiara);
                
                let mojeImie = inputNick.value.trim() || "Gracz";
                if (data.zabojca === mojeImie) {
                    StatystykiLokalne.zabojstwaZrzedu++;
                    if (StatystykiLokalne.zabojstwaZrzedu === 2) pokazNapisKinowy("DOUBLE KILL!", 2000);
                    if (StatystykiLokalne.zabojstwaZrzedu >= 3) pokazNapisKinowy("DOMINACJA!", 2500);
                }

                let zrodloX = 2000, zrodloY = 2000;
                if (stanSerwera && stanSerwera.players) {
                    let ulozysko = Object.values(stanSerwera.players).find(p => p.name === data.ofiara);
                    if (ulozysko) { zrodloX = ulozysko.x; zrodloY = ulozysko.y; }
                }
                odpalDzwiek3D('death', 0.5, zrodloX, zrodloY);
            }
        });
        
        socket.on('cinematicEvent', (tekst) => { 
            // [FIX AAA] Wypuszczamy potężny, agresywny napis, by od razu ostrzec przed wydarzeniem
            pokazAgresywnyNapisEventu(tekst); 
            odpalDzwiek3D('alert', 0.6); 
            zrobAudioDucking();
        });
        socket.on('wstrzasKamery', (moc) => { 
            if (window.Grafika && window.Grafika.wywolajWstrzas) window.Grafika.wywolajWstrzas(moc); 
            wibruj(moc > 15 ? 100 : 30);
        });

        // (AAA) AUTO-RECONNECTION UI
        socket.on('disconnect', () => {
            console.warn("⚠️ Serwer przerwał połączenie.");
            if (window.Flagi && window.Flagi.Stan.aktualny === 'PLAYING') {
                pokazNapisKinowy("⚠️ ZERWANO ŁĄCZNOŚĆ. PRÓBA REKONFIGURACJI...", 3000);
                wibruj([200, 200, 200]);
            }
        });

        socket.on('connect', () => {
            if (window.Flagi && window.Flagi.Stan.aktualny === 'PLAYING' && czasStart > 0) {
                pokazNapisKinowy("🟢 ŁĄCZNOŚĆ PRZYWRÓCONA. WRACASZ DO AKCJI.", 2000);
            }
        });

        socket.on('gameOver', (data) => {
            GameFSM.zmienStan('GAMEOVER');
            clearInterval(interwalCzasu);
            if (timerContainer) timerContainer.classList.add('hidden');
            if (ingameControls) ingameControls.classList.add('hidden'); 
            if (teamPowerBar) teamPowerBar.classList.add('hidden');
            if (formationPanel) formationPanel.classList.add('hidden');
            if (document.getElementById('leaderboard')) document.getElementById('leaderboard').classList.add('hidden');
            if (netGraph) netGraph.style.display = 'none';
            if (SFX.heartbeat) SFX.heartbeat.pause();
            
            zrobAudioDucking();
            odpalDzwiek('death', 0.8);
            wibruj([500]);

            const finalTime = timerDisplay ? timerDisplay.innerText : "00:00";
            const tryb = window.Flagi ? window.Flagi.Stan.wybranyTryb : 'FREE';

            if (uiLayer) {
                uiLayer.classList.remove('hidden');
                let tytul = data.killerName === "VICTORY" ? "AKT I ZAKOŃCZONY" : "SYSTEM HALTED";
                let kolor = data.killerName === "VICTORY" ? "#2ecc71" : "#e74c3c";
                let viralText = `Osiągnąłem ${data.finalScore} masy i przetrwałem ${finalTime} w Vibe Noir (Tryb: ${tryb})! Zmierz się ze mną: ${window.location.href}`;

                let mvpData = data.mvpStats ? `<h3 style="color:#3498db;">MVP: ${data.mvpStats.name} (Assists: ${data.mvpStats.assists})</h3>` : '';

                uiLayer.innerHTML = `
                    <div style="text-align: center; background: rgba(5,5,5,0.95); padding: 50px; border: 3px solid ${kolor}; border-radius: 15px; box-shadow: 0 0 40px #000; position: relative; z-index: 999; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: ${kolor}; font-size: 48px; font-family: 'Permanent Marker';">${tytul}</h1>
                        <p style="color: #aaa;">"${data.message}"</p>
                        ${mvpData}
                        <h2 style="color: #f1c40f;">MASA: ${data.finalScore} | CZAS: ${finalTime}</h2>

                        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 30px;">
                            <button id="btn-share-score" class="main-btn border-blue" style="font-size: 18px;">📢 POCHWAL SIĘ WYNIKIEM</button>
                            <button class="main-btn border-red" style="font-size: 18px;" onclick="location.reload()">REBOOT SYSTEM</button>
                        </div>
                    </div>
                `;
                setTimeout(() => {
                    const btnShare = document.getElementById('btn-share-score');
                    if (btnShare) {
                        btnShare.addEventListener('click', () => {
                            navigator.clipboard.writeText(viralText).then(() => {
                                btnShare.innerText = "✔️ SKOPIOWANO!"; btnShare.style.background = "#2ecc71"; btnShare.style.color = "#000";
                            });
                        });
                    }
                }, 100);
            }
        });

        // 9. PĘTLA GRY Z HYBRYDOWYM STEROWANIEM I PREDICTION
        function pętlaGry() {
            let teraz = Date.now();
            const stanAktualny = window.Flagi ? window.Flagi.Stan.aktualny : 'LOBBY';

            if (stanAktualny === 'SPECTATOR') {
                if (stanSerwera && window.Grafika) {
                    let najbogatszy = null;
                    if(stanSerwera.players) {
                        najbogatszy = Object.values(stanSerwera.players).sort((a,b)=>b.score-a.score)[0];
                    }
                    if(window.Guardian && window.Guardian.chronFukcje) {
                        window.Guardian.chronFukcje(() => window.Grafika.rysujKlatke(stanSerwera, najbogatszy), "GrafikaRender")();
                    } else window.Grafika.rysujKlatke(stanSerwera, najbogatszy);
                }
                return requestAnimationFrame(pętlaGry);
            }

            if (stanAktualny === 'PLAYING') {
                if (teraz - ostatniCzasInputu > 120000) { 
                    if (teraz % 5000 < 50) pokazNapisKinowy("ZBYT DŁUGI BRAK RUCHU. TRYB OSZCZĘDZANIA ENERGII.", 2000);
                    if (teraz - ostatniaWysylkaRuchu < 200) return requestAnimationFrame(pętlaGry);
                }

                if (!czyWsklepie) {
                    if (teraz - ostatniaWysylkaRuchu > 33) {
                        const centerX = window.innerWidth / 2;
                        const centerY = window.innerHeight / 2;
                        
                        let ruszKlawiatura = klawiszeKierunku.w || klawiszeKierunku.s || klawiszeKierunku.a || klawiszeKierunku.d;
                        let kat = 0;
                        let dystans = 0;
                        let dx = 0; let dy = 0;

                        if (wybraneSterowanie === 'MOUSE' || wybraneSterowanie === 'MOBILE') {
                            ruszKlawiatura = false;
                        }

                        if (ruszKlawiatura) {
                            if (klawiszeKierunku.w) dy -= 1;
                            if (klawiszeKierunku.s) dy += 1;
                            if (klawiszeKierunku.a) dx -= 1;
                            if (klawiszeKierunku.d) dx += 1;
                            kat = Math.atan2(dy, dx);
                            dystans = 100; 
                        } else {
                            if (wybraneSterowanie === 'WASD' || wybraneSterowanie === 'ARROWS') {
                                dystans = 0;
                                kat = Math.atan2(kursor.y - centerY, kursor.x - centerX);
                            } else {
                                kat = Math.atan2(kursor.y - centerY, kursor.x - centerX);
                                dystans = Math.hypot(kursor.y - centerY, kursor.x - centerX);
                            }
                        }
                        
                        socket.emit('ruchGraczaMyszka', { kat: kat, dystans: dystans });

                        if (stanSerwera && stanSerwera.players && mojeId) {
                            let mojGracz = stanSerwera.players[mojeId];
                            if (mojGracz && (dx !== 0 || dy !== 0 || dystans > 20)) {
                                let predkoscKorekty = 4; 
                                mojGracz.x += Math.cos(kat) * predkoscKorekty;
                                mojGracz.y += Math.sin(kat) * predkoscKorekty;
                                
                                let limit = window.Flagi.Stan.wybranyTryb === 'TEAMS' ? 6000 : 4000;
                                if (mojGracz.x < 10) mojGracz.x = 10;
                                if (mojGracz.x > limit - 10) mojGracz.x = limit - 10;
                                if (mojGracz.y < 10) mojGracz.y = 10;
                                if (mojGracz.y > limit - 10) mojGracz.y = limit - 10;
                            }

                            // <--- SYSTEM AAA: NATYCHMIASTOWA PREDYKCJA JEDZENIA KROPEK + DŹWIĘK --->
                            if (stanSerwera.foods) {
                                let zasiegZjadania = Math.min(20 + Math.sqrt(Math.max(10, mojGracz.score)) * 2, 65) + 15;
                                if (mojGracz.skin === 'arystokrata') zasiegZjadania += 15;

                                Object.keys(stanSerwera.foods).forEach(fid => {
                                    if (LokalnyBuforZjedzonychKropek.has(String(fid)) || LokalnyBuforZjedzonychKropek.has(Number(fid))) return; 
                                    let kropka = stanSerwera.foods[fid];
                                    let odlegloscX = kropka.x - mojGracz.x;
                                    let odlegloscY = kropka.y - mojGracz.y;
                                    
                                    if ((odlegloscX * odlegloscX + odlegloscY * odlegloscY) < (zasiegZjadania * zasiegZjadania)) {
                                        // Lokalnie "zjadamy" by nie mrugało
                                        LokalnyBuforZjedzonychKropek.add(String(fid));
                                        LokalnyBuforZjedzonychKropek.add(Number(fid));
                                        
                                        // Lokalna punktacja natychmiastowo do góry
                                        let zdobytaMasa = (window.Flagi.Stan.wybranyTryb === 'TEAMS' ? 2 : 1) * (mojGracz.massMultiplier || 1);
                                        mojGracz.score += zdobytaMasa; 
                                        StatystykiLokalne.zjedzoneKropki++;
                                        
                                        socket.emit('zgłośZjedzenieKropki', fid); 
                                    }
                                });
                            }
                            SystemOsiagniec.sprawdz(StatystykiLokalne);
                        }
                        ostatniaWysylkaRuchu = teraz;
                    }

                    if (buforRzutuCzas > 0 && (teraz - buforRzutuCzas < 250)) { 
                        let doRzutu = true;
                        if (window.Guardian && window.Guardian.rejestrujKlikniecie) {
                            doRzutu = window.Guardian.rejestrujKlikniecie();
                        }
                        
                        if (doRzutu) {
                            const centerX = window.innerWidth / 2;
                            const centerY = window.innerHeight / 2;
                            let celKat = Math.atan2(kursor.y - centerY, kursor.x - centerX);
                            socket.emit('rzutOszczepem', { kat: celKat });
                            
                            StatystykiLokalne.rzuconeOszczepy++;
                            
                            let posX = 2000, posY = 2000;
                            if (stanSerwera && stanSerwera.players && stanSerwera.players[mojeId]) {
                                posX = stanSerwera.players[mojeId].x; posY = stanSerwera.players[mojeId].y;
                            }
                            odpalDzwiek3D('throw', 0.6, posX, posY);
                            wibruj(15); 
                            buforRzutuCzas = 0; 
                        }
                    } else if (teraz - buforRzutuCzas >= 250) {
                        buforRzutuCzas = 0; 
                    }
                }

                if (stanSerwera && stanSerwera.players && mojeId) {
                    const mojGracz = stanSerwera.players[mojeId];
                    if (mojGracz) {
                        obslugaStref(mojGracz);
                        obslugaFabułyKampanii(mojGracz); 
                        
                        if (window.Flagi.Stan.wybranyTryb === 'TEAMS') {
                            mojGracz.pozycjeFormacji = MenadzerFormacji.obliczPozycje(mojGracz, aktywnaFormacja);
                        }
                        
                        if (ostatniaMasa !== null) {
                            let roznica = mojGracz.score - ostatniaMasa;
                            
                            if (roznica <= -1) { // Hit od obrażeń
                                odpalDzwiek3D('hit', 0.8, mojGracz.x, mojGracz.y);
                                wibruj(50);
                                StatystykiLokalne.zabojstwaZrzedu = 0; 
                                
                                let flash = document.createElement('div');
                                flash.style.cssText = 'position: fixed; inset: 0; background: rgba(231, 76, 60, 0.4); z-index: 900; pointer-events: none; transition: opacity 0.2s ease-out;';
                                document.body.appendChild(flash);
                                setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), 200); }, 50);
                                if (window.Grafika && window.Grafika.wywolajWstrzas) window.Grafika.wywolajWstrzas(15);
                            } 
                            // [FIX AAA] DŹWIĘK JEDZENIA ODPALANY NA PODSTAWIE PRZYROSTU MASY
                            else if (roznica > 0) {
                                if (!isMuted) SilnikAudio.grajMniam(roznica >= 5 ? 0.6 : 0.4); 
                            }
                        }
                        ostatniaMasa = mojGracz.score;

                        if (window.Grafika && window.Guardian && window.Guardian.chronFukcje) {
                            window.Guardian.chronFukcje(() => {
                                window.Grafika.rysujKlatke(stanSerwera, mojGracz);
                            }, "GrafikaRender")();
                        } else if (window.Grafika) {
                            window.Grafika.rysujKlatke(stanSerwera, mojGracz);
                        }
                    }
                }
            }
            requestAnimationFrame(pętlaGry); 
        }
    }); 
})();