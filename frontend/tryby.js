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
    let czyWsklepie = false;
    
    // Zmienne dla HUD i Zrzutu
    let wybranySpawn = 'random'; 
    let czasStart = 0;
    let interwalCzasu = null;

    // Obiekt wejściowy (Input) wysyłany do Sędziego
    let inputKlawiszy = {
        up: false, down: false, left: false, right: false,
        katCelowania: 0,
        atakuje: false,
        uzywaTarczy: false
    };

    // INICJALIZACJA DOPIERO PO ZAŁADOWANIU HTML (BEZPIECZEŃSTWO)
    document.addEventListener('DOMContentLoaded', () => {
        console.log("🛠️ Inicjalizacja interfejsu UI...");

        // 2. REFERENCJE UI
        const uiLayer = document.getElementById('ui-layer');
        const step1 = document.getElementById('step-1');
        const step2 = document.getElementById('step-2');
        const step3 = document.getElementById('step-3');
        const step4 = document.getElementById('step-4'); // Wybór sektora zrzutu
        const inputNick = document.getElementById('playerName');
        const castleShop = document.getElementById('castle-shop');
        const midasTutorial = document.getElementById('midas-tutorial');
        const midasText = document.getElementById('midas-text');
        
        // Referencje nowego HUD
        const killfeed = document.getElementById('killfeed');
        const timerDisplay = document.getElementById('time-display');
        const timerContainer = document.getElementById('survival-timer');

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
                if (mode === 'CAMPAIGN') {
                    alert("Tryb Kampanii: AKT I - W BUDOWIE. Zapraszamy wkrótce!");
                    return;
                }
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
            
            // W trybie drużynowym omijamy wybór spawnu (Serwer sam dzieli na bazy)
            if (mode === 'TEAMS') {
                console.log("⚔️ Tryb Teams - wymuszony autospawn w bazie");
                wejdzNaArene('random');
            } else {
                step3.classList.add('hidden');
                step4.classList.remove('hidden');
            }
        });

        // Obsługa przycisków wyboru sektora (NAPRAWIONE)
        document.querySelectorAll('[data-spawn]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('[data-spawn]').forEach(b => b.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
                wybranySpawn = e.currentTarget.getAttribute('data-spawn');
                console.log("📍 Wybrano sektor:", wybranySpawn);
            });
        });

        // Ostateczny start po wybraniu sektora (NAPRAWIONE)
        document.getElementById('btn-deploy').addEventListener('click', () => {
            console.log("🚀 Rozpoczynamy desant! Sektor:", wybranySpawn);
            wejdzNaArene(wybranySpawn);
        });

        // Główna funkcja startowa
        function wejdzNaArene(sektor) {
            const data = {
                name: inputNick.value.trim() || "Gracz",
                mode: window.Flagi ? window.Flagi.Stan.wybranyTryb : 'FREE',
                skin: window.Flagi ? window.Flagi.Stan.wybranaKlasa : 'standard',
                spawnZone: sektor
            };

            socket.emit('joinGame', data);
            
            // Zarządzanie interfejsem
            if (uiLayer) uiLayer.classList.add('hidden');
            if (timerContainer) timerContainer.classList.remove('hidden');
            
            // Start Zegara Przetrwania
            czasStart = Date.now();
            if (interwalCzasu) clearInterval(interwalCzasu);
            interwalCzasu = setInterval(aktualizujCzas, 1000);
            
            if (window.Flagi) window.Flagi.ustawStan('PLAYING');
            if (window.Guardian) window.Guardian.odbierzTick(); 

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
            
            // Usuwanie wiadomości po 5 sekundach
            setTimeout(() => {
                wpis.style.opacity = '0';
                wpis.style.transition = 'opacity 0.5s ease';
                setTimeout(() => wpis.remove(), 500);
            }, 5000);
        }

        // 6. SYSTEM STEROWANIA (Klawiatura + Mysz)
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyW' || e.code === 'ArrowUp') inputKlawiszy.up = true;
            if (e.code === 'KeyS' || e.code === 'ArrowDown') inputKlawiszy.down = true;
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputKlawiszy.left = true;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') inputKlawiszy.right = true;
            if (e.code === 'KeyQ') inputKlawiszy.uzywaTarczy = true;
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'KeyW' || e.code === 'ArrowUp') inputKlawiszy.up = false;
            if (e.code === 'KeyS' || e.code === 'ArrowDown') inputKlawiszy.down = false;
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputKlawiszy.left = false;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') inputKlawiszy.right = false;
            if (e.code === 'KeyQ') inputKlawiszy.uzywaTarczy = false;
        });

        window.addEventListener('mousemove', (e) => {
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            inputKlawiszy.katCelowania = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        });

        window.addEventListener('mousedown', (e) => { if (e.button === 0) inputKlawiszy.atakuje = true; });
        window.addEventListener('mouseup', (e) => { if (e.button === 0) inputKlawiszy.atakuje = false; });

        // 7. SYSTEM SKLEPU I MIDASA
        window.kupBron = function(typ) {
            socket.emit('buyShopItem', typ);
            console.log("💰 Próba zakupu broni:", typ);
        };

        window.zamknijSklep = function() {
            czyWsklepie = false;
            if (castleShop) castleShop.classList.add('hidden');
        };

        function obslugaStref(mojGracz) {
            const tryb = window.Flagi ? window.Flagi.Stan.wybranyTryb : 'FREE';
            
            // Zamek i sklep na środku mapy
            const dystansDoZamku = Math.hypot(mojGracz.x - 2000, mojGracz.y - 2000);
            
            if (dystansDoZamku < 300 && tryb === 'FREE') {
                if (!czyWsklepie) {
                    czyWsklepie = true;
                    if (castleShop) castleShop.classList.remove('hidden');
                }
            } else {
                if (czyWsklepie) zamknijSklep();
            }

            // Midas (Tutorial na starcie)
            if (tryb === 'FREE' && midasTutorial && midasText) {
                if (mojGracz.score < 15) {
                    midasTutorial.classList.remove('hidden');
                    midasText.innerText = "Zbieraj masę, by ewoluować. Naciśnij 'M' by uruchomić skaner taktyczny.";
                } else if (mojGracz.score >= 30 && mojGracz.score < 50) {
                    midasText.innerText = "Odblokowałeś miecz! Klikaj LPM, by atakować kosztem 2 masy.";
                } else {
                    midasTutorial.classList.add('hidden');
                }
            }
        }

        // 8. KOMUNIKACJA Z SERWEREM
        socket.on('init', (data) => { mojeId = data.id; });

        socket.on('serverTick', (data) => {
            stanSerwera = data;
            if (window.Guardian) window.Guardian.odbierzTick();
        });

        socket.on('shopSuccess', (data) => {
            alert("Pomyślnie zakupiono: " + data.item.toUpperCase());
            zamknijSklep();
        });

        // Odbiór wiadomości dla Killfeedu
        socket.on('killEvent', (data) => {
            if (data.zabojca && data.ofiara) {
                dodajDoKillfeedu(data.zabojca, data.ofiara);
            }
        });

        socket.on('gameOver', (data) => {
            if (window.Flagi) window.Flagi.ustawStan('GAMEOVER');
            
            // Zatrzymanie czasu i czyszczenie HUD
            clearInterval(interwalCzasu);
            if (timerContainer) timerContainer.classList.add('hidden');
            if (killfeed) killfeed.innerHTML = '';
            
            const finalTime = timerDisplay ? timerDisplay.innerText : "00:00";

            if (uiLayer) {
                uiLayer.classList.remove('hidden');
                uiLayer.innerHTML = `
                    <div style="text-align: center; background: rgba(5,5,5,0.95); padding: 50px; border: 3px solid #e74c3c; border-radius: 15px; box-shadow: 0 0 40px #000; position: relative; z-index: 999;">
                        <h1 style="color: #e74c3c; font-size: 48px; font-family: 'Permanent Marker'; margin-bottom: 0;">SYSTEM HALTED</h1>
                        <p style="color: #aaa; margin: 20px 0;">"${data.message}"</p>
                        <h2 style="color: #f1c40f;">MASA: ${data.finalScore} | CZAS: ${finalTime}</h2>
                        <button class="main-btn border-red" style="margin-top: 30px; font-size: 20px; font-weight: bold;" onclick="location.reload()">REBOOT SYSTEM</button>
                    </div>
                `;
            }
        });

        // 9. PĘTLA GRY (RENDER + INPUT)
        function pętlaGry() {
            if (window.Flagi && window.Flagi.Stan.aktualny === 'PLAYING') {
                socket.emit('playerInput', inputKlawiszy);

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