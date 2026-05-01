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
    
    // Zmienne dla HUD i Zrzutu
    let wybranySpawn = 'random'; 
    let czasStart = 0;
    let interwalCzasu = null;

    // NOWE STEROWANIE: Pozycja kursora
    let kursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    // INICJALIZACJA DOPIERO PO ZAŁADOWANIU HTML (BEZPIECZEŃSTWO)
    document.addEventListener('DOMContentLoaded', () => {
        console.log("🛠️ Inicjalizacja interfejsu UI...");

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

        // Referencje nowego menu w grze
        const ingameControls = document.getElementById('ingame-controls');
        const btnLeave = document.getElementById('btn-leave');

        // --- OBSŁUGA NOWEGO PRZYCISKU WYJŚCIA ---
        if (btnLeave) {
            btnLeave.addEventListener('click', () => {
                if (confirm("Czy na pewno chcesz opuścić pole bitwy i wrócić do menu głównego?")) {
                    location.reload(); // Najczystszy reset dla gier .io w przeglądarce
                }
            });
        }

        // 3. OBSŁUGA LOBBY I WYBORU KLAS
        document.getElementById('nextBtn').addEventListener('click', () => {
            if (inputNick.value.trim().length < 2) {
                inputNick.style.borderColor = '#e74c3c';
                return;
            }
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
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
                // BLOKADA ZDJĘTA - Tryb Kampanii jest teraz otwarty!
                if (window.Flagi) window.Flagi.Stan.wybranyTryb = mode;
                step2.classList.add('hidden');
                step3.classList.remove('hidden');
            });
        });

        document.querySelectorAll('.char-card').forEach(card => {
            card.addEventListener('click', (e) => {
                document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                if (window.Flagi) window.Flagi.Stan.wybranaKlasa = e.currentTarget.getAttribute('data-skin');
            });
        });

        // 4. LOGIKA WYBORU ZRZUTU I WEJŚCIA NA ARENĘ
        document.getElementById('btn-enter-arena').addEventListener('click', () => {
            const mode = window.Flagi ? window.Flagi.Stan.wybranyTryb : 'FREE';
            
            if (mode === 'TEAMS') {
                console.log("⚔️ Tryb Teams - wymuszony autospawn w bazie");
                wejdzNaArene('random');
            } else if (mode === 'CAMPAIGN') {
                console.log("👑 Tryb Kampanii - wymuszony autospawn na środku mapy");
                wejdzNaArene('center'); // W kampanii gracz zawsze ląduje w centrum
            } else {
                step3.classList.add('hidden');
                step4.classList.remove('hidden');
            }
        });

        document.querySelectorAll('[data-spawn]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('[data-spawn]').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                wybranySpawn = e.currentTarget.getAttribute('data-spawn');
                console.log("📍 Wybrano sektor:", wybranySpawn);
            });
        });

        document.getElementById('btn-deploy').addEventListener('click', () => {
            console.log("🚀 Rozpoczynamy desant! Sektor:", wybranySpawn);
            wejdzNaArene(wybranySpawn);
        });

        function wejdzNaArene(sektor) {
            const data = {
                name: inputNick.value.trim() || "Gracz",
                mode: window.Flagi ? window.Flagi.Stan.wybranyTryb : 'FREE',
                skin: window.Flagi ? window.Flagi.Stan.wybranaKlasa : 'standard',
                spawnZone: sektor
            };

            socket.emit('joinGame', data);
            
            if (uiLayer) uiLayer.classList.add('hidden');
            if (bgLayer) bgLayer.classList.add('hidden'); 
            if (timerContainer) timerContainer.classList.remove('hidden');
            
            // Odkrywamy przyciski wsparcia i wyjścia z gry
            if (ingameControls) ingameControls.classList.remove('hidden');
            
            czasStart = Date.now();
            if (interwalCzasu) clearInterval(interwalCzasu);
            interwalCzasu = setInterval(aktualizujCzas, 1000);
            
            if (window.Flagi) window.Flagi.ustawStan('PLAYING');
            if (window.Guardian && window.Guardian.odbierzTick) window.Guardian.odbierzTick(); 

            requestAnimationFrame(pętlaGry);
        }

        // 5. FUNKCJE HUD (ZEGAR I KILLFEED)
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

        // 6. NOWY SYSTEM STEROWANIA (Mysz/Touchpad + Umiejętności)
        window.addEventListener('mousemove', (e) => {
            kursor.x = e.clientX;
            kursor.y = e.clientY;
        });

        window.addEventListener('touchmove', (e) => {
            kursor.x = e.touches[0].clientX;
            kursor.y = e.touches[0].clientY;
        }, { passive: true });

        window.addEventListener('keydown', (e) => {
            // Sklep odpalany Spacją tylko w bezpiecznej strefie
            if (e.code === 'Space' && czyWBazie) {
                if (!czyWsklepie) {
                    czyWsklepie = true;
                    if (castleShop) castleShop.classList.remove('hidden');
                } else {
                    zamknijSklep();
                }
            }
            // Rozkaz specjalny dla zwerbowanych botów
            if (e.code === 'KeyE') {
                socket.emit('rozkazSpecjalny');
            }
        });

        // Miotanie Oszczepem
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0 && !czyWsklepie) { 
                // GUARDIAN: Ochrona przed spamem / auto-clickerem
                if (window.Guardian && window.Guardian.rejestrujKlikniecie && !window.Guardian.rejestrujKlikniecie()) return;

                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;
                const katRzutu = Math.atan2(e.clientY - centerY, e.clientX - centerX);
                socket.emit('rzutOszczepem', { kat: katRzutu });
            }
        });

        // 7. SYSTEM SKLEPU I MIDASA
        window.kupBron = function(typ) {
            socket.emit('buyShopItem', typ);
            console.log("💰 Próba zakupu broni/draftu jednostki:", typ);
        };

        window.zamknijSklep = function() {
            czyWsklepie = false;
            if (castleShop) castleShop.classList.add('hidden');
        };

        function obslugaStref(mojGracz) {
            const tryb = window.Flagi ? window.Flagi.Stan.wybranyTryb : 'FREE';
            
            // Dynamiczne ustalanie środka bazy
            srodekBazyX = 2000;
            srodekBazyY = 2000;
            if (tryb === 'TEAMS') {
                if (mojGracz.team === 'RED') { srodekBazyX = 500; srodekBazyY = 3000; }
                else if (mojGracz.team === 'BLUE') { srodekBazyX = 5500; srodekBazyY = 3000; }
            }

            const dystansDoBazy = Math.hypot(mojGracz.x - srodekBazyX, mojGracz.y - srodekBazyY);
            
            // Gracz znajduje się na terenie swojego Zamku
            czyWBazie = dystansDoBazy < 400;

            // Wymuszone zamknięcie sklepu, jeśli gracz ucieknie ze strefy
            if (!czyWBazie && czyWsklepie) {
                zamknijSklep();
            }

            // Midas (Tutorial na starcie)
            if (midasTutorial && midasText) {
                if (tryb === 'CAMPAIGN') {
                    if (mojGracz.score < 50) {
                        midasTutorial.classList.remove('hidden');
                        midasText.innerText = "AKT I: BUNT MASZYN. Przetrwaj hordę i zdobądź 300 masy, by wezwać Bossa!";
                    } else {
                        midasTutorial.classList.add('hidden');
                    }
                } else if (tryb === 'FREE') {
                    if (mojGracz.score < 15) {
                        midasTutorial.classList.remove('hidden');
                        midasText.innerText = "Zbieraj masę. Naciśnij 'M' by odpalić radar, kieruj myszką.";
                    } else if (mojGracz.score >= 30 && mojGracz.score < 50) {
                        midasText.innerText = "LPM rzuca oszczepem kosztem 2 masy! [Spacja] w bazie otwiera Sklep.";
                    } else {
                        midasTutorial.classList.add('hidden');
                    }
                }
            }
        }

        // 8. KOMUNIKACJA Z SERWEREM
        socket.on('init', (data) => { mojeId = data.id; });

        socket.on('serverTick', (data) => {
            stanSerwera = data;
            if (window.Guardian && window.Guardian.odbierzTick) window.Guardian.odbierzTick();
        });

        socket.on('shopSuccess', (data) => {
            alert("Ukończono modyfikację: " + data.item.toUpperCase());
            zamknijSklep();
        });

        socket.on('killEvent', (data) => {
            if (data.zabojca && data.ofiara) {
                dodajDoKillfeedu(data.zabojca, data.ofiara);
            }
        });

        // BIZNES: VIRAL LOOP W EKRANIE KOŃCOWYM
        socket.on('gameOver', (data) => {
            if (window.Flagi) window.Flagi.ustawStan('GAMEOVER');
            
            clearInterval(interwalCzasu);
            if (timerContainer) timerContainer.classList.add('hidden');
            if (ingameControls) ingameControls.classList.add('hidden'); // Ukrywamy menu z powrotem na ekranie śmierci
            if (killfeed) killfeed.innerHTML = '';
            
            const finalTime = timerDisplay ? timerDisplay.innerText : "00:00";
            const tryb = window.Flagi ? window.Flagi.Stan.wybranyTryb : 'FREE';

            if (uiLayer) {
                uiLayer.classList.remove('hidden');
                let tytul = "SYSTEM HALTED";
                let kolorTytulu = "#e74c3c";
                
                // Specjalny ekran zwycięstwa dla Kampanii
                if (data.killerName === "VICTORY") {
                    tytul = "AKT I ZAKOŃCZONY";
                    kolorTytulu = "#2ecc71";
                }

                // Generowanie tekstu do schowka
                let viralText = `Osiągnąłem ${data.finalScore} masy i przetrwałem ${finalTime} w Vibe Noir (Tryb: ${tryb})! Zmierz się ze mną: ${window.location.href}`;

                uiLayer.innerHTML = `
                    <div style="text-align: center; background: rgba(5,5,5,0.95); padding: 50px; border: 3px solid ${kolorTytulu}; border-radius: 15px; box-shadow: 0 0 40px #000; position: relative; z-index: 999; max-width: 500px;">
                        <h1 style="color: ${kolorTytulu}; font-size: 48px; font-family: 'Permanent Marker'; margin-bottom: 0;">${tytul}</h1>
                        <p style="color: #aaa; margin: 20px 0;">"${data.message}"</p>
                        <h2 style="color: #f1c40f;">MASA: ${data.finalScore} | CZAS: ${finalTime}</h2>
                        
                        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 30px;">
                            <button id="btn-share-score" class="main-btn border-blue" style="font-size: 18px; font-weight: bold; margin: 0;">📢 POCHWAL SIĘ WYNIKIEM</button>
                            <button class="main-btn border-red" style="font-size: 18px; font-weight: bold; margin: 0;" onclick="location.reload()">REBOOT SYSTEM</button>
                        </div>
                    </div>
                `;

                // Logika kopiowania do schowka zintegrowana z przyciskiem
                setTimeout(() => {
                    const btnShare = document.getElementById('btn-share-score');
                    if (btnShare) {
                        btnShare.addEventListener('click', () => {
                            navigator.clipboard.writeText(viralText).then(() => {
                                btnShare.innerText = "✔️ SKOPIOWANO DO SCHOWKA!";
                                btnShare.style.background = "#2ecc71";
                                btnShare.style.color = "#000";
                            }).catch(err => {
                                console.error('Błąd kopiowania', err);
                                alert("Twój wynik: \n\n" + viralText);
                            });
                        });
                    }
                }, 100);
            }
        });

        // 9. PĘTLA GRY (RENDER + INPUT WEKTOROWY)
        function pętlaGry() {
            if (window.Flagi && window.Flagi.Stan.aktualny === 'PLAYING') {
                
                // Emisja ruchu myszką tylko wtedy, gdy nie przeglądamy sklepu
                if (!czyWsklepie) {
                    const centerX = window.innerWidth / 2;
                    const centerY = window.innerHeight / 2;
                    const kat = Math.atan2(kursor.y - centerY, kursor.x - centerX);
                    const dystans = Math.hypot(kursor.y - centerY, kursor.x - centerX);
                    
                    socket.emit('ruchGraczaMyszka', { kat: kat, dystans: dystans });
                }

                if (stanSerwera && stanSerwera.players && mojeId) {
                    const mojGracz = stanSerwera.players[mojeId];
                    if (mojGracz) {
                        obslugaStref(mojGracz);
                        if (window.Grafika) window.Grafika.rysujKlatke(stanSerwera, mojGracz);
                    }
                }
            }
            requestAnimationFrame(pętlaGry);
        }

    }); // Koniec blocku DOMContentLoaded
})();