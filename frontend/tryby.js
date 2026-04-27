// ==========================================
// TRYBY.JS - Główny Mózg Klienta i Kontroler Gry
// ==========================================

(function() {
    // 1. INICJALIZACJA POŁĄCZENIA
    // Dynamiczne pobieranie adresu (Działa i na komputerze, i po wrzuceniu do internetu)
    const SERWER_URL = window.location.origin;
    const socket = typeof io !== 'undefined' ? io(SERWER_URL) : null;

    if (!socket) {
        console.error("[BŁĄD] Nie załadowano biblioteki Socket.IO!");
        return;
    }

    // 2. ZMIENNE LOKALNE
    let mojeId = null;
    let stanSerwera = null; 
    let inputKlawiszy = { up: false, down: false, left: false, right: false, katCelowania: 0, atakuje: false, uzywaTarczy: false };

    // 3. WSKAŹNIKI DO INTERFEJSU
    const uiLayer = document.getElementById('ui-layer');
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const step3 = document.getElementById('step-3');
    const inputNick = document.getElementById('playerName');
    const btnDalej = document.getElementById('nextBtn');
    const btnWejdzNaArene = document.getElementById('btn-enter-arena');

    // 4. OBSŁUGA MENU LOBBY

    btnDalej.addEventListener('click', () => {
        if (inputNick.value.trim().length < 2) {
            inputNick.style.borderColor = '#e74c3c';
            return;
        }
        inputNick.style.borderColor = '#444';
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
    });

    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.getAttribute('data-target');
            e.target.parentElement.classList.add('hidden');
            document.getElementById(targetId).classList.remove('hidden');
        });
    });

    document.querySelectorAll('[data-mode]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const wybranyTryb = e.target.getAttribute('data-mode');
            if (wybranyTryb === 'CAMPAIGN' && (!window.Flagi || !window.Flagi.Tryby.CAMPAIGN)) {
                alert("Ten tryb jest w budowie!");
                return;
            }
            if (window.Flagi) window.Flagi.Stan.wybranyTryb = wybranyTryb;
            step2.classList.add('hidden');
            step3.classList.remove('hidden');
        });
    });

    document.querySelectorAll('.char-card').forEach(card => {
        card.addEventListener('click', (e) => {
            document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
            const clickedCard = e.currentTarget;
            clickedCard.classList.add('selected');
            if (window.Flagi) window.Flagi.Stan.wybranaKlasa = clickedCard.getAttribute('data-skin');
        });
    });

    // WEJŚCIE DO GRY
    btnWejdzNaArene.addEventListener('click', () => {
        const nick = inputNick.value.trim() || "Nieznany";
        const tryb = window.Flagi ? window.Flagi.Stan.wybranyTryb : 'FREE';
        const klasa = window.Flagi ? window.Flagi.Stan.wybranaKlasa : 'standard';

        socket.emit('joinGame', { name: nick, mode: tryb, skin: klasa });

        uiLayer.classList.add('hidden');
        if (window.Flagi) window.Flagi.ustawStan('PLAYING');

        // Zresetowanie stopera Guardiana, żeby nie wyrzucił fałszywego błędu o lagu
        if (window.Guardian) window.Guardian.odbierzTick();

        requestAnimationFrame(pętlaGry);
    });

    // 5. OBSŁUGA STEROWANIA
    window.addEventListener('keydown', (e) => {
        if (window.Flagi && window.Flagi.Stan.aktualny !== 'PLAYING') return;
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
        if (window.Flagi && window.Flagi.Stan.aktualny !== 'PLAYING') return;
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        inputKlawiszy.katCelowania = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    });

    window.addEventListener('mousedown', (e) => { if (e.button === 0) inputKlawiszy.atakuje = true; });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) inputKlawiszy.atakuje = false; });

    // 6. ODBIERANIE DANYCH OD SERWERA
    socket.on('init', (data) => {
        mojeId = data.id;
        console.log("[SERWER] Połączono pomyślnie. Moje ID: ", mojeId);
    });

    socket.on('serverTick', (data) => {
        stanSerwera = data;
        // Poinformowanie Guardiana, że połączenie działa
        if (window.Guardian) window.Guardian.odbierzTick();
    });

    socket.on('gameOver', (dane) => {
        if (window.Flagi) window.Flagi.ustawStan('GAMEOVER');
        
        inputKlawiszy = { up: false, down: false, left: false, right: false, katCelowania: 0, atakuje: false, uzywaTarczy: false };
        
        uiLayer.classList.remove('hidden');
        uiLayer.innerHTML = `
            <div style="text-align: center; background: rgba(10,10,15,0.95); padding: 40px; border: 2px solid #e74c3c; border-radius: 10px;">
                <h1 style="color: #e74c3c; font-size: 50px; margin: 0; text-shadow: 0 0 20px #e74c3c;">ZOSTAŁEŚ POŻARTY</h1>
                <p style="color: #aaa; font-size: 20px;">AI systemu: <strong style="color: #fff;">"${dane.message || 'Zresetuj system i spróbuj ponownie.'}"</strong></p>
                <p style="color: #f1c40f; font-size: 24px; font-weight: bold;">Zdobyta Masa: ${Math.floor(dane.finalScore || 0)}</p>
                <button class="main-btn border-red" style="margin-top: 20px;" onclick="location.reload()">ODRODZENIE</button>
            </div>
        `;
    });

    // 7. GŁÓWNA PĘTLA KLIENTA
    function pętlaGry() {
        if (window.Flagi && window.Flagi.Stan.aktualny === 'PLAYING') {
            socket.emit('playerInput', inputKlawiszy);

            if (stanSerwera && stanSerwera.players && mojeId) {
                const mojGracz = stanSerwera.players[mojeId];
                if (mojGracz && window.Grafika) {
                    window.Grafika.rysujKlatke(stanSerwera, mojGracz);
                }
            }
        }
        requestAnimationFrame(pętlaGry);
    }
})();