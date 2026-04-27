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

    // Obiekt wejściowy (Input) wysyłany do Sędziego
    let inputKlawiszy = {
        up: false, down: false, left: false, right: false,
        katCelowania: 0,
        atakuje: false,
        uzywaTarczy: false
    };

    // 2. REFERENCJE UI
    const uiLayer = document.getElementById('ui-layer');
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const step3 = document.getElementById('step-3');
    const inputNick = document.getElementById('playerName');
    const castleShop = document.getElementById('castle-shop');
    const midasTutorial = document.getElementById('midas-tutorial');
    const midasText = document.getElementById('midas-text');

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

    // 4. WEJŚCIE NA ARENĘ (START)
    document.getElementById('btn-enter-arena').addEventListener('click', () => {
        const data = {
            name: inputNick.value.trim() || "Gracz",
            mode: window.Flagi ? window.Flagi.Stan.wybranyTryb : 'FREE',
            skin: window.Flagi ? window.Flagi.Stan.wybranaKlasa : 'standard'
        };

        socket.emit('joinGame', data);
        uiLayer.classList.add('hidden');
        
        if (window.Flagi) window.Flagi.ustawStan('PLAYING');
        if (window.Guardian) window.Guardian.odbierzTick(); // Reset strażnika na start

        requestAnimationFrame(pętlaGry);
    });

    // 5. SYSTEM STEROWANIA (Klawiatura + Mysz)
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

    // 6. SYSTEM SKLEPU I MIDASA (API GLOBALNE DLA HTML)
    window.kupBron = function(typ) {
        socket.emit('buyShopItem', typ);
        console.log("💰 Próba zakupu broni:", typ);
    };

    window.zamknijSklep = function() {
        czyWsklepie = false;
        castleShop.classList.add('hidden');
    };

    function obslugaStref(mojGracz) {
        // Sprawdzenie czy gracz jest w Zamku (Monolit 2000, 2000, radius 300)
        const dystansDoZamku = Math.hypot(mojGracz.x - 2000, mojGracz.y - 2000);
        
        if (dystansDoZamku < 300) {
            if (!czyWsklepie) {
                czyWsklepie = true;
                castleShop.classList.remove('hidden');
            }
        } else {
            if (czyWsklepie) {
                zamknijSklep();
            }
        }

        // Prosty Midas (Tutorial na starcie)
        if (mojGracz.score < 15) {
            midasTutorial.classList.remove('hidden');
            midasText.innerText = "Zbieraj żółte punkty masy, aby ewoluować. Unikaj większych!";
        } else if (mojGracz.score >= 30 && mojGracz.score < 50) {
            midasText.innerText = "Odblokowałeś broń! Klikaj LPM, aby atakować kosztem 2 masy.";
        } else {
            midasTutorial.classList.add('hidden');
        }
    }

    // 7. KOMUNIKACJA Z SERWEREM
    socket.on('init', (data) => { mojeId = data.id; });

    socket.on('serverTick', (data) => {
        stanSerwera = data;
        if (window.Guardian) window.Guardian.odbierzTick();
    });

    socket.on('shopSuccess', (data) => {
        alert("Pomyślnie zakupiono: " + data.item.toUpperCase());
        zamknijSklep();
    });

    socket.on('gameOver', (data) => {
        if (window.Flagi) window.Flagi.ustawStan('GAMEOVER');
        uiLayer.classList.remove('hidden');
        uiLayer.innerHTML = `
            <div style="text-align: center; background: rgba(5,5,5,0.95); padding: 50px; border: 3px solid #e74c3c; border-radius: 15px; box-shadow: 0 0 40px #000;">
                <h1 style="color: #e74c3c; font-size: 48px; font-family: 'Permanent Marker';">SYSTEM HALTED</h1>
                <p style="color: #aaa; margin: 20px 0;">"${data.message}"</p>
                <h2 style="color: #f1c40f;">MASA: ${data.finalScore}</h2>
                <button class="main-btn border-red" style="margin-top: 30px;" onclick="location.reload()">REBOOT SYSTEM</button>
            </div>
        `;
    });

    // 8. PĘTLA GRY (RENDER + INPUT)
    function pętlaGry() {
        if (window.Flagi && window.Flagi.Stan.aktualny === 'PLAYING') {
            // Wyślij dane do Sędziego
            socket.emit('playerInput', inputKlawiszy);

            // Pobierz dane o sobie i narysuj świat
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

})();