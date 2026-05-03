// ==========================================
// TRYBY.JS - Główny Mózg Klienta i Kontroler Gry
// ==========================================

(function() {
    // 1. POŁĄCZENIE I ZMIENNE SYSTEMOWE
    const SERWER_URL = window.location.origin;
    const socket = typeof io !== 'undefined' ? io(SERWER_URL) : null;

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

    // NOWE STEROWANIE: Hybryda Mysz + WASD
    let kursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let klawiszeKierunku = { w: false, a: false, s: false, d: false };
    let ostatniaWysylkaRuchu = 0; 
    let aktywnaFormacja = 4; // Domyślnie manualna
    
    // Progresja Kampanii i Statystyki
    let etapKampanii = 0;
    let ostatniaMasa = 0; // Śledzenie masy do efektu Hit Flash
    let ostatniCzasJedzenia = 0; // Zapobiega "strzelaniu z karabinu" dźwiękiem jedzenia

    document.addEventListener('DOMContentLoaded', () => {
        console.log("🛠️ Inicjalizacja interfejsu UI i Silnika Audio...");

        // === ZARZĄDZANIE AUDIO (AMBIENT I MUZYKA) ===
        let isMuted = false;
        
        // 1. Dźwięk w Lobby (Menu)
        const dzwiekOgnia = new Audio('./assety/fire.mp3');
        dzwiekOgnia.loop = true;
        dzwiekOgnia.volume = 0.4;

        // 2. Dźwięk przejścia (Whoosh)
        const dzwiekWhoosh = new Audio('./assety/fire_whoosh.mp3');
        dzwiekWhoosh.volume = 0.8;

        // 3. Główny podkład muzyczny na mapie (Dark Trap)
        const muzykaGra = new Audio('./assety/dark_trap.mp3');
        muzykaGra.loop = true;
        muzykaGra.volume = 0.15; // Cicho, żeby SFX grały pierwsze skrzypce!

        // === SILNIK SFX (DŹWIĘKI REAKTYWNE) ===
        const SFX = {
            throw: new Audio('./assety/throw.mp3'),
            hit: new Audio('./assety/hit.mp3'),
            eat: new Audio('./assety/eat.mp3'),
            death: new Audio('./assety/death.mp3'),
            alert: new Audio('./assety/alert.mp3')
        };

        // Wstępne ładowanie do pamięci
        Object.values(SFX).forEach(audio => { audio.preload = 'auto'; });

        function odpalDzwiek(nazwa, glosnosc = 0.5) {
            if (isMuted || !SFX[nazwa]) return;
            let dzwiek = SFX[nazwa].cloneNode(); 
            dzwiek.volume = glosnosc;
            dzwiek.play().catch(e => console.warn(`Nie można odtworzyć SFX: ${nazwa}`, e));
        }

        // Próba odtworzenia dźwięku (Autoplay bypass)
        let pierwszaInterakcja = false;
        
        let sprobujOdtworzyc = dzwiekWhoosh.play();
        if (sprobujOdtworzyc !== undefined) {
            sprobujOdtworzyc.then(() => {
                dzwiekOgnia.play().catch(e => console.log(e));
            }).catch(error => {
                console.log("🛡️ Przeglądarka zablokowała Autoplay. Dźwięk odpali się przy pierwszej interakcji.");
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

        // --- GLOBALNY PRZYCISK MUTE (ZINTEGROWANY) ---
        const btnMute = document.createElement('button');
        btnMute.innerHTML = '🔊';
        btnMute.style.cssText = 'position: fixed; bottom: 20px; left: 20px; background: rgba(5,5,5,0.8); border: 2px solid #e74c3c; border-radius: 50%; width: 45px; height: 45px; color: #fff; font-size: 20px; cursor: pointer; z-index: 9999; box-shadow: 0 0 10px rgba(0,0,0,0.8); transition: transform 0.2s;';
        btnMute.onmouseenter = () => btnMute.style.transform = 'scale(1.1)';
        btnMute.onmouseleave = () => btnMute.style.transform = 'scale(1)';
        btnMute.onclick = () => {
            isMuted = !isMuted;
            dzwiekOgnia.muted = isMuted;
            dzwiekWhoosh.muted = isMuted;
            muzykaGra.muted = isMuted;
            btnMute.innerHTML = isMuted ? '🔇' : '🔊';
            btnMute.style.borderColor = isMuted ? '#555' : '#e74c3c';
        };
        document.body.appendChild(btnMute);

        // --- LEADERBOARD (Tabela Wyników UI) ---
        const leaderboard = document.createElement('div');
        leaderboard.id = 'leaderboard';
        leaderboard.style.cssText = 'position: absolute; top: 20px; right: 20px; background: rgba(10,10,15,0.85); border: 2px solid #f1c40f; padding: 12px; border-radius: 8px; color: #fff; font-family: "Exo 2", sans-serif; width: 200px; z-index: 10; pointer-events: none; transition: opacity 0.3s; box-shadow: 0 0 15px rgba(241, 196, 15, 0.2);';
        leaderboard.classList.add('hidden');
        document.getElementById('in-game-ui').appendChild(leaderboard);

        // --- MOBILNY PRZYCISK AKCJI ---
        window.addEventListener('touchstart', function addTouchBtn() {
            const mobileBtn = document.createElement('button');
            mobileBtn.innerHTML = '🎯';
            mobileBtn.style.cssText = 'position: absolute; bottom: 80px; right: 20px; width: 70px; height: 70px; border-radius: 50%; background: rgba(231, 76, 60, 0.4); border: 3px solid #e74c3c; color: white; font-size: 28px; font-weight: bold; z-index: 999; box-shadow: 0 0 15px rgba(231,76,60,0.6); pointer-events: auto;';
            
            mobileBtn.ontouchstart = (e) => {
                e.preventDefault(); 
                if (!czyWsklepie && window.Flagi && window.Flagi.Stan.aktualny === 'PLAYING') {
                    const centerX = window.innerWidth / 2;
                    const centerY = window.innerHeight / 2;
                    const katRzutu = Math.atan2(kursor.y - centerY, kursor.x - centerX);
                    socket.emit('rzutOszczepem', { kat: katRzutu });
                    odpalDzwiek('throw', 0.6);
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

        // Referencje UI Trybu TEAMS
        const teamPowerBar = document.getElementById('team-power-bar');
        const barRed = document.getElementById('bar-red');
        const barBlue = document.getElementById('bar-blue');
        const formationPanel = document.getElementById('formation-panel');

        if (btnLeave) {
            btnLeave.addEventListener('click', () => {
                if (confirm("Czy na pewno chcesz opuścić pole bitwy i wrócić do menu głównego?")) location.reload(); 
            });
        }

        // 3. OBSŁUGA LOBBY I WYBORU KLAS
        document.getElementById('nextBtn').addEventListener('click', () => {
            if (inputNick.value.trim().length < 2) { inputNick.style.borderColor = '#e74c3c'; return; }
            
            dzwiekWhoosh.currentTime = 0;
            if (!isMuted) dzwiekWhoosh.play().catch(e => console.warn("Whoosh zablokowany:", e));
            
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
                step2.classList.add('hidden'); step3.classList.remove('hidden');
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

            socket.emit('joinGame', data);
            
            if (uiLayer) uiLayer.classList.add('hidden');
            if (bgLayer) bgLayer.classList.add('hidden'); 
            if (timerContainer) timerContainer.classList.remove('hidden');
            if (ingameControls) ingameControls.classList.remove('hidden');

            // Aktywacja UI zależnie od trybu
            if (mode === 'TEAMS') {
                if (teamPowerBar) teamPowerBar.classList.remove('hidden');
                if (formationPanel) formationPanel.classList.remove('hidden');
            }
            
            // --- ZMIANA AUDIO NA TRYB WALKI ---
            dzwiekOgnia.pause();
            if (!isMuted) {
                muzykaGra.currentTime = 0;
                muzykaGra.play().catch(e => console.warn("Muzyka zablokowana:", e));
            }
            
            czasStart = Date.now();
            etapKampanii = 0; 
            ostatniaMasa = 0; 
            ostatniCzasJedzenia = 0;
            
            if (interwalCzasu) clearInterval(interwalCzasu);
            interwalCzasu = setInterval(aktualizujCzas, 1000);
            
            if (window.Flagi) window.Flagi.ustawStan('PLAYING');
            if (window.Guardian && window.Guardian.odbierzTick) window.Guardian.odbierzTick(); 
            
            if (mode === 'CAMPAIGN') {
                setTimeout(() => {
                    pokazNapisKinowy("SYSTEM PODTRZYMYWANIA ŻYCIA AKTYWNY. BĄDŹ OSTROŻNY...", 5000);
                }, 1500);
            }

            requestAnimationFrame(pętlaGry);
        }

        function aktualizujCzas() {
            if (!timerDisplay) return;
            let roznica = Math.floor((Date.now() - czasStart) / 1000);
            let min = String(Math.floor(roznica / 60)).padStart(2, '0');
            let sek = String(roznica % 60).padStart(2, '0');
            timerDisplay.innerText = `${min}:${sek}`;
        }

        function dodajDoKillfeedu(zabojca, ofiara) {
            if (!killfeed) return;
            const wpis = document.createElement('div');
            wpis.style.background = 'rgba(20,20,25,0.85)';
            wpis.style.borderLeft = '3px solid #e74c3c';
            wpis.style.padding = '5px 10px';
            wpis.style.color = '#fff';
            wpis.style.fontFamily = "'Exo 2', sans-serif";
            wpis.style.fontSize = '13px';
            wpis.style.borderRadius = '3px';
            wpis.innerHTML = `<span style="color:#e74c3c; font-weight:bold;">${zabojca}</span> zniszczył <span style="color:#aaa;">${ofiara}</span>`;
            killfeed.appendChild(wpis);
            setTimeout(() => {
                wpis.style.opacity = '0';
                wpis.style.transition = 'opacity 0.5s ease';
                setTimeout(() => wpis.remove(), 500);
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

        // 5. HYBRYDOWY SYSTEM STEROWANIA
        window.addEventListener('mousemove', (e) => {
            kursor.x = e.clientX; kursor.y = e.clientY;
        });
        window.addEventListener('touchmove', (e) => {
            kursor.x = e.touches[0].clientX; kursor.y = e.touches[0].clientY;
        }, { passive: true });

        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (['w', 'arrowup'].includes(key)) klawiszeKierunku.w = true;
            if (['a', 'arrowleft'].includes(key)) klawiszeKierunku.a = true;
            if (['s', 'arrowdown'].includes(key)) klawiszeKierunku.s = true;
            if (['d', 'arrowright'].includes(key)) klawiszeKierunku.d = true;

            if (['1','2','3','4'].includes(key) && window.Flagi && window.Flagi.Stan.wybranyTryb === 'TEAMS') {
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
            if (['w', 'arrowup'].includes(key)) klawiszeKierunku.w = false;
            if (['a', 'arrowleft'].includes(key)) klawiszeKierunku.a = false;
            if (['s', 'arrowdown'].includes(key)) klawiszeKierunku.s = false;
            if (['d', 'arrowright'].includes(key)) klawiszeKierunku.d = false;
        });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0 && !czyWsklepie) { 
                if (window.Guardian && window.Guardian.rejestrujKlikniecie && !window.Guardian.rejestrujKlikniecie()) return;
                const katRzutu = Math.atan2(e.clientY - window.innerHeight / 2, e.clientX - window.innerWidth / 2);
                socket.emit('rzutOszczepem', { kat: katRzutu });
                odpalDzwiek('throw', 0.6);
            }
        });
        window.addEventListener('touchstart', (e) => {
            if (!czyWsklepie && e.touches.length > 1) {
                if (window.Guardian && window.Guardian.rejestrujKlikniecie && !window.Guardian.rejestrujKlikniecie()) return;
                const touch = e.touches[e.touches.length - 1];
                const katRzutu = Math.atan2(touch.clientY - window.innerHeight / 2, touch.clientX - window.innerWidth / 2);
                socket.emit('rzutOszczepem', { kat: katRzutu });
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
                odpalDzwiek('alert', 0.7);
                etapKampanii = 1;
            }
            if (masa >= 150 && etapKampanii === 1) {
                pokazNapisKinowy("AKTYWNOŚĆ ROJU WZRASTA. ZBIERAJ MASĘ, ABY EWOLUOWAĆ PANCERZ.", 5000);
                etapKampanii = 2;
            }
            if (masa >= 280 && etapKampanii === 2) {
                pokazNapisKinowy("⚠️ WYKRYTO POTĘŻNE DRGANIA SEJSMICZNE... ANOMALIA OMEGA ZBLIŻA SIĘ DO SEKTORA!", 7000);
                odpalDzwiek('alert', 0.8);
                if (window.Grafika && window.Grafika.wywolajWstrzas) window.Grafika.wywolajWstrzas(10);
                etapKampanii = 3;
            }

            let bossAlive = false;
            if (stanSerwera && stanSerwera.bots) {
                Object.values(stanSerwera.bots).forEach(b => { if (b.isBoss || b.skin === 'ninja') bossAlive = true; });
            }

            if (bossAlive && etapKampanii === 3) {
                pokazNapisKinowy("TYTAN OMEGA ZESPAWNOWANY! ZNISZCZ GO, ABY PRZETRWAĆ!", 6000);
                odpalDzwiek('alert', 1.0);
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
            stanSerwera = data;
            if (window.Guardian && window.Guardian.odbierzTick) window.Guardian.odbierzTick();
            aktualizujSileDruzyn(); 
            
            if (stanSerwera.players && window.Flagi && window.Flagi.Stan.aktualny === 'PLAYING') {
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
                odpalDzwiek('death', 0.3);
            }
        });
        
        socket.on('cinematicEvent', (tekst) => { 
            pokazNapisKinowy(tekst, 5000); 
            odpalDzwiek('alert', 0.6); 
        });
        socket.on('wstrzasKamery', (moc) => { if (window.Grafika && window.Grafika.wywolajWstrzas) window.Grafika.wywolajWstrzas(moc); });

        socket.on('disconnect', () => {
            console.warn("⚠️ Serwer przerwał połączenie.");
            if (window.Flagi && window.Flagi.Stan.aktualny === 'PLAYING') {
                if (uiLayer) {
                    uiLayer.classList.remove('hidden');
                    uiLayer.innerHTML = `
                        <div style="text-align: center; background: rgba(5,5,5,0.95); padding: 50px; border: 3px solid #e74c3c; border-radius: 15px; box-shadow: 0 0 40px red; position: relative; z-index: 999;">
                            <h1 style="color: #e74c3c; font-size: 42px; font-family: 'Permanent Marker';">⚠️ UTRACONO POŁĄCZENIE</h1>
                            <p style="color: #aaa; margin: 20px 0;">Zerwano łączność z centralą serwera.</p>
                            <button class="main-btn border-blue" onclick="location.reload()">ODŚWIEŻ STRONĘ</button>
                        </div>
                    `;
                }
            }
        });

        socket.on('gameOver', (data) => {
            if (window.Flagi) window.Flagi.ustawStan('GAMEOVER');
            clearInterval(interwalCzasu);
            if (timerContainer) timerContainer.classList.add('hidden');
            if (ingameControls) ingameControls.classList.add('hidden'); 
            if (teamPowerBar) teamPowerBar.classList.add('hidden');
            if (formationPanel) formationPanel.classList.add('hidden');
            if (document.getElementById('leaderboard')) document.getElementById('leaderboard').classList.add('hidden');
            
            muzykaGra.pause(); 
            odpalDzwiek('death', 0.8);

            const finalTime = timerDisplay ? timerDisplay.innerText : "00:00";
            const tryb = window.Flagi ? window.Flagi.Stan.wybranyTryb : 'FREE';

            if (uiLayer) {
                uiLayer.classList.remove('hidden');
                let tytul = data.killerName === "VICTORY" ? "AKT I ZAKOŃCZONY" : "SYSTEM HALTED";
                let kolor = data.killerName === "VICTORY" ? "#2ecc71" : "#e74c3c";
                let viralText = `Osiągnąłem ${data.finalScore} masy i przetrwałem ${finalTime} w Vibe Noir (Tryb: ${tryb})! Zmierz się ze mną: ${window.location.href}`;

                uiLayer.innerHTML = `
                    <div style="text-align: center; background: rgba(5,5,5,0.95); padding: 50px; border: 3px solid ${kolor}; border-radius: 15px; box-shadow: 0 0 40px #000; position: relative; z-index: 999;">
                        <h1 style="color: ${kolor}; font-size: 48px; font-family: 'Permanent Marker';">${tytul}</h1>
                        <p style="color: #aaa;">"${data.message}"</p>
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

        // 9. PĘTLA GRY Z HYBRYDOWYM STEROWANIEM
        function pętlaGry() {
            let teraz = Date.now();

            if (window.Flagi && window.Flagi.Stan.aktualny === 'PLAYING') {
                
                if (!czyWsklepie) {
                    if (teraz - ostatniaWysylkaRuchu > 33) {
                        const centerX = window.innerWidth / 2;
                        const centerY = window.innerHeight / 2;
                        
                        let kat = 0;
                        let dystans = 0;
                        let ruszKlawiatura = klawiszeKierunku.w || klawiszeKierunku.s || klawiszeKierunku.a || klawiszeKierunku.d;

                        if (ruszKlawiatura) {
                            let dx = 0; let dy = 0;
                            if (klawiszeKierunku.w) dy -= 1;
                            if (klawiszeKierunku.s) dy += 1;
                            if (klawiszeKierunku.a) dx -= 1;
                            if (klawiszeKierunku.d) dx += 1;
                            
                            kat = Math.atan2(dy, dx);
                            dystans = 100; 
                        } else {
                            kat = Math.atan2(kursor.y - centerY, kursor.x - centerX);
                            dystans = Math.hypot(kursor.y - centerY, kursor.x - centerX);
                        }
                        
                        socket.emit('ruchGraczaMyszka', { kat: kat, dystans: dystans });
                        ostatniaWysylkaRuchu = teraz;
                    }
                }

                if (stanSerwera && stanSerwera.players && mojeId) {
                    const mojGracz = stanSerwera.players[mojeId];
                    if (mojGracz) {
                        obslugaStref(mojGracz);
                        obslugaFabułyKampanii(mojGracz); 
                        
                        // LOGIKA DŹWIĘKÓW I WIZUALIZACJI ZMIAN MASY
                        if (ostatniaMasa > 0) {
                            let roznica = mojGracz.score - ostatniaMasa;
                            
                            if (roznica <= -1) {
                                odpalDzwiek('hit', 0.8);
                                let flash = document.createElement('div');
                                flash.style.cssText = 'position: fixed; inset: 0; background: rgba(231, 76, 60, 0.4); z-index: 900; pointer-events: none; transition: opacity 0.2s ease-out;';
                                document.body.appendChild(flash);
                                setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), 200); }, 50);
                                if (window.Grafika && window.Grafika.wywolajWstrzas) window.Grafika.wywolajWstrzas(15);
                            } 
                            else if (roznica >= 1 && (teraz - ostatniCzasJedzenia > 100)) {
                                odpalDzwiek('eat', 0.2);
                                ostatniCzasJedzenia = teraz;
                            }
                        }
                        ostatniaMasa = mojGracz.score;

                        if (window.Grafika) window.Grafika.rysujKlatke(stanSerwera, mojGracz);
                    }
                }
            }
            requestAnimationFrame(pętlaGry); 
        }

    }); 
})();