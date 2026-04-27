// ==========================================
// TRYBY.JS - Główny Mózg Klienta i Kontroler Gry
// ==========================================

(function() {
    // 1. INICJALIZACJA POŁĄCZENIA
    // Zastąp url swoim ostatecznym adresem, jeśli zmienisz serwer
    const SERWER_URL = 'https://mywebgame-xtreme-destiny.onrender.com';
    const socket = typeof io !== 'undefined' ? io(SERWER_URL) : null;

    if (!socket) {
        console.error("[BŁĄD] Nie załadowano biblioteki Socket.IO!");
        return;
    }

    // 2. ZMIENNE LOKALNE
    let mojeId = null;
    let stanSerwera = null; // Najświeższa paczka z danymi od Sędziego (Serwera)
    
    // Obiekt wysyłany do serwera 60 razy na sekundę
    let inputKlawiszy = {
        up: false, down: false, left: false, right: false,
        katCelowania: 0, 
        atakuje: false,
        uzywaTarczy: false
    };

    // 3. WSKAŹNIKI DO INTERFEJSU (Z index.html)
    const uiLayer = document.getElementById('ui-layer');
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const step3 = document.getElementById('step-3');
    const inputNick = document.getElementById('playerName');
    const btnDalej = document.getElementById('nextBtn');
    const btnWejdzNaArene = document.getElementById('btn-enter-arena');

    // 4. OBSŁUGA MENU LOBBY (Event Listenery)

    // A. Krok 1 -> Krok 2 (Nick)
    btnDalej.addEventListener('click', () => {
        if (inputNick.value.trim().length < 2) {
            inputNick.style.borderColor = '#e74c3c';
            return;
        }
        inputNick.style.borderColor = '#444';
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
    });

    // B. Przyciski Powrotu (data-target)
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.getAttribute('data-target');
            e.target.parentElement.classList.add('hidden');
            document.getElementById(targetId).classList.remove('hidden');
        });
    });

    // C. Krok 2 -> Krok 3 (Wybór Trybu)
    document.querySelectorAll('[data-mode]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const wybranyTryb = e.target.getAttribute('data-mode');
            
            // Feature Toggle: Blokada kampanii, jeśli flaga jest wyłączona
            if (wybranyTryb === 'CAMPAIGN' && (!window.Flagi || !window.Flagi.Tryby.CAMPAIGN)) {
                alert("Ten tryb jest w budowie!");
                return;
            }

            if (window.Flagi) window.Flagi.Stan.wybranyTryb = wybranyTryb;
            step2.classList.add('hidden');
            step3.classList.remove('hidden');
        });
    });

    // D. Wybór Klasy
    document.querySelectorAll('.char-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Zdejmij zaznaczenie ze wszystkich
            document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
            // Zaznacz klikniętą
            const clickedCard = e.currentTarget;
            clickedCard.classList.add('selected');
            if (window.Flagi) window.Flagi.Stan.wybranaKlasa = clickedCard.getAttribute('data-skin');
        });
    });

    // E. WEJŚCIE DO GRY (Start!)
    btnWejdzNaArene.addEventListener('click', () => {
        const nick = inputNick.value.trim() || "Nieznany";
        const tryb = window.Flagi ? window.Flagi.Stan.wybranyTryb : 'FREE';
        const klasa = window.Flagi ? window.Flagi.Stan.wybranaKlasa : 'standard';

        // Wysyłamy prośbę do Sędziego o dołączenie na arenę
        socket.emit('joinGame', {
            name: nick,
            mode: tryb,
            skin: klasa
        });

        // Ukrywamy Lobby
        uiLayer.classList.add('hidden');
        if (window.Flagi) window.Flagi.ustawStan('PLAYING');

        // Odpalamy pętlę gry, jeśli jeszcze nie działa
        requestAnimationFrame(pętlaGry);
    });

    // 5. OBSŁUGA STEROWANIA (Klawiatura i Mysz)

    window.addEventListener('keydown', (e) => {
        if (window.Flagi && window.Flagi.Stan.aktualny !== 'PLAYING') return;
        if (e.code === 'KeyW' || e.code === 'ArrowUp') inputKlawiszy.up = true;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') inputKlawiszy.down = true;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputKlawiszy.left = true;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') inputKlawiszy.right = true;
        if (e.code === 'KeyQ') inputKlawiszy.uzywaTarczy = true; // Tarcza
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') inputKlawiszy.up = false;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') inputKlawiszy.down = false;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputKlawiszy.left = false;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') inputKlawiszy.right = false;
        if (e.code === 'KeyQ') inputKlawiszy.uzywaTarczy = false;
    });

    // Liczenie kąta myszki (Wymaga środka ekranu, bo tam zawsze jest gracz)
    window.addEventListener('mousemove', (e) => {
        if (window.Flagi && window.Flagi.Stan.aktualny !== 'PLAYING') return;
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        // Zwraca kąt w radianach
        inputKlawiszy.katCelowania = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    });

    window.addEventListener('mousedown', (e) => {
        if (e.button === 0) inputKlawiszy.atakuje = true; // Lewy przycisk myszy
    });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) inputKlawiszy.atakuje = false;
    });

    // 6. ODBIERANIE DANYCH OD SERWERA

    socket.on('init', (data) => {
        mojeId = data.id;
        console.log("[SERWER] Połączono pomyślnie. Moje ID: ", mojeId);
    });

    socket.on('serverTick', (data) => {
        // Zapisujemy ramkę gry do zmiennej lokalnej.
        // Pętla renderująca (grafika.js) narysuje to przy następnej klatce monitora.
        stanSerwera = data;
    });

    socket.on('gameOver', (dane) => {
        if (window.Flagi) window.Flagi.ustawStan('GAMEOVER');
        
        // Zatrzymujemy postać
        inputKlawiszy = { up: false, down: false, left: false, right: false, katCelowania: 0, atakuje: false, uzywaTarczy: false };
        
        // Ekran śmierci (Vibe Noir) - zastępuje chamskiego alert()
        uiLayer.classList.remove('hidden');
        uiLayer.innerHTML = `
            <div style="text-align: center; background: rgba(10,10,15,0.95); padding: 40px; border: 2px solid #e74c3c; border-radius: 10px;">
                <h1 style="color: #e74c3c; font-size: 50px; margin: 0; text-shadow: 0 0 20px #e74c3c;">ZOSTAŁEŚ POŻARTY</h1>
                <p style="color: #aaa; font-size: 20px;">Twój oprawca: <strong style="color: #fff;">${dane.killerName || "Nieznany"}</strong></p>
                <p style="color: #f1c40f; font-size: 24px; font-weight: bold;">Zdobyta Masa: ${Math.floor(dane.finalScore || 0)}</p>
                <button class="main-btn border-red" style="margin-top: 20px;" onclick="location.reload()">ODRODZENIE</button>
            </div>
        `;
    });

    // 7. GŁÓWNA PĘTLA KLIENTA (MÓZG GRY)
    function pętlaGry() {
        if (window.Flagi && window.Flagi.Stan.aktualny === 'PLAYING') {
            
            // A. WYŚLIJ INTENCJE DO SĘDZIEGO
            // Nie ruszamy gracza u nas! Wysyłamy klawisze, a Serwer nam odpowie, gdzie jesteśmy.
            // To całkowicie eliminuje speedhacki.
            socket.emit('playerInput', inputKlawiszy);

            // B. NARYSUJ ŚWIAT
            // Przekazujemy najnowszy zrzut z serwera do naszego Głupiego Pędzla (grafika.js)
            if (stanSerwera && stanSerwera.players && mojeId) {
                const mojGracz = stanSerwera.players[mojeId];
                if (mojGracz && window.Grafika) {
                    window.Grafika.rysujKlatke(stanSerwera, mojGracz);
                }
            }
        }
        
        // Powtarzaj w synchronizacji z odświeżaniem monitora (zazwyczaj 60fps)
        requestAnimationFrame(pętlaGry);
    }

})();