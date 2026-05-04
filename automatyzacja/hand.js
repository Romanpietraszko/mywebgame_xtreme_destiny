// ==========================================
// HAND.JS - "Mięśnie" i Egzekutor Akcji Guardiana (Pełna Wersja AAA+)
// Odpowiada za UI, DOM, Klawiaturę, Efekty Wizualne i Awaryjny Reset
// ==========================================

class GuardianHand {
    constructor() {
        this.uiWarning = null;
        this.uiCritical = null; // Nowa warstwa wizualna na krytyczne błędy
        this.ostrzezenieTimeout = null;
        
        // Inicjalizacja przy starcie
        this.zbudujInterfejs();
        this.aktywujTarczeSystemowe();
        
        console.log("🦾 [HAND] Moduł Egzekucyjny podłączony do macierzy. Gotowy do uderzenia.");
    }

    // --- 1. ZARZĄDZANIE INTERFEJSEM (Wstrzykiwanie DOM) ---
    zbudujInterfejs() {
        // 1A. Standardowy, mroczny alert u góry ekranu
        if (!document.getElementById('guardian-warning')) {
            this.uiWarning = document.createElement('div');
            this.uiWarning.id = 'guardian-warning';
            
            // Styl Vibe Noir - Mroczny, neonowy alert
            this.uiWarning.style.cssText = `
                position: fixed; 
                top: 20px; 
                left: 50%; 
                transform: translateX(-50%) translateY(-20px);
                background: rgba(5, 5, 5, 0.95); 
                color: #fff; 
                padding: 10px 25px;
                border: 2px solid #e74c3c;
                border-radius: 6px; 
                font-weight: bold; 
                font-family: 'Exo 2', 'Rajdhani', sans-serif;
                z-index: 99999; 
                opacity: 0;
                pointer-events: none;
                text-transform: uppercase; 
                letter-spacing: 2px; 
                transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
                box-shadow: 0 0 20px rgba(231, 76, 60, 0.6), inset 0 0 10px rgba(231, 76, 60, 0.3);
                text-shadow: 0 0 5px #e74c3c;
            `;
            document.body.appendChild(this.uiWarning);
        }

        // 1B. Warstwa Krytyczna (Pełnoekranowy Flash Systemu)
        if (!document.getElementById('guardian-critical')) {
            this.uiCritical = document.createElement('div');
            this.uiCritical.id = 'guardian-critical';
            this.uiCritical.style.cssText = `
                position: fixed;
                inset: 0;
                background: radial-gradient(circle, transparent 20%, rgba(231, 76, 60, 0.4) 100%);
                z-index: 99998;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease-out;
                box-shadow: inset 0 0 50px rgba(231, 76, 60, 0.8);
            `;
            document.body.appendChild(this.uiCritical);
        }
    }

    pokazOstrzezenie(msg, autoHide = false) {
        if (!this.uiWarning) return;

        // Czyszczenie poprzedniego timera, jeśli alert ma być odświeżony
        if (this.ostrzezenieTimeout) {
            clearTimeout(this.ostrzezenieTimeout);
            this.ostrzezenieTimeout = null;
        }

        // Aktualizacja tekstu i pokazanie z animacją
        this.uiWarning.innerHTML = `⚠️ <span style="color: #e74c3c;">SYSTEM ALERT:</span> ${msg}`;
        this.uiWarning.style.opacity = '1';
        this.uiWarning.style.transform = 'translateX(-50%) translateY(0)';

        // Automatyczne ukrywanie, jeśli Mózg tak zarządził
        if (autoHide) {
            this.ostrzezenieTimeout = setTimeout(() => {
                this.ukryjOstrzezenie();
            }, 3000);
        }
    }

    ukryjOstrzezenie() {
        if (!this.uiWarning) return;
        this.uiWarning.style.opacity = '0';
        this.uiWarning.style.transform = 'translateX(-50%) translateY(-20px)';
    }

    // --- 2. ZAAWANSOWANE EFEKTY EGZEKUCYJNE (Haptics & Visuals) ---
    mrugnijEkranem(kolor = 'rgba(231, 76, 60, 0.4)', czasTrwania = 200) {
        if (!this.uiCritical) return;
        this.uiCritical.style.background = `radial-gradient(circle, transparent 20%, ${kolor} 100%)`;
        this.uiCritical.style.boxShadow = `inset 0 0 50px ${kolor}`;
        this.uiCritical.style.opacity = '1';
        
        setTimeout(() => {
            if (this.uiCritical) this.uiCritical.style.opacity = '0';
        }, czasTrwania);
    }

    wykonajWstrzasEkranu(moc = 10, czasTrwania = 300) {
        const body = document.body;
        const startCzas = Date.now();

        const wstrzas = () => {
            const uplynelo = Date.now() - startCzas;
            if (uplynelo < czasTrwania) {
                const x = (Math.random() - 0.5) * moc;
                const y = (Math.random() - 0.5) * moc;
                body.style.transform = `translate(${x}px, ${y}px)`;
                requestAnimationFrame(wstrzas);
            } else {
                body.style.transform = 'translate(0, 0)';
            }
        };
        requestAnimationFrame(wstrzas);
    }

    // --- 3. OCHRONA KONTROLEK I DOM ---
    aktywujTarczeSystemowe() {
        // Blokada "Ghost Input" - Gdy gracz klika Alt-Tab lub zmienia kartę
        window.addEventListener('blur', () => {
            console.log("🦾 [HAND] Utrata fokusu. Zerowanie wektorów ruchu fizycznego i myszy.");
            
            // Lista wszystkich klawiszy używanych do ruchu i akcji
            const keysToRelease = [
                'KeyW', 'KeyS', 'KeyA', 'KeyD', 
                'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
                'KeyQ', 'KeyE', 'Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4'
            ];
            
            // Symulacja puszczenia klawiszy i przycisków myszy, by tryby.js to wyłapały
            try {
                keysToRelease.forEach(code => {
                    const eventCode = new KeyboardEvent('keyup', { 'code': code, 'key': code.replace('Key', '').toLowerCase() });
                    window.dispatchEvent(eventCode);
                });

                // Uwolnienie zablokowanej myszki
                const mouseEvent = new MouseEvent('mouseup', { button: 0 });
                window.dispatchEvent(mouseEvent);
            } catch(e) {
                console.warn("🦾 [HAND] Błąd podczas zerowania klawiszy:", e);
            }
        });

        // Awaryjne czyszczenie focusa z pól tekstowych (zapobiega blokowaniu ruchu po wyjściu ze sklepu)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (document.activeElement && document.activeElement.tagName === 'INPUT') {
                    document.activeElement.blur();
                    console.log("🦾 [HAND] Focus usunięty z pola tekstowego (Escape).");
                }
            }
        });
    }

    // --- 4. EGZEKUCJA OPTYMALIZACJI ---
    wlaczTrybZiemniaka() {
        if (window.Flagi && window.Flagi.Srodowisko) {
            // Flaga isMobile w tryby.js odcina m.in. wibracje i może odciąć ciężkie procesy
            window.Flagi.Srodowisko.isMobile = true; 
        }
        
        // Ratowanie GPU: Twarde wyłączenie efektów na Canvasie
        const gameCanvas = document.querySelector('canvas');
        if (gameCanvas) {
            gameCanvas.style.filter = 'none'; // Odcina kosztowne cienie i blury na głównej macierzy
        }

        // Agresywne wyłączenie obciążających animacji w CSS
        document.body.style.setProperty('--bg-glass', 'rgba(10, 10, 15, 0.9)'); // Zastępuje ciężki backdrop-filter
        const style = document.createElement('style');
        style.innerHTML = `
            * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        `;
        document.head.appendChild(style);

        this.mrugnijEkranem('rgba(241, 196, 15, 0.3)', 300); // Subtelny żółty błysk potwierdzający wejście trybu wydajności
        this.pokazOstrzezenie("AKTYWOWANO PROTOKÓŁ WYDAJNOŚCI", true);
    }

    // --- 5. TWARDY REBOOT (Procedura Ostatniej Szansy) ---
    wymusTwardyReset() {
        console.error("☠️ [HAND] Wprowadzam twardy restart środowiska. Zegnaj świecie.");
        
        // Agresywny efekt wizualny przed śmiercią strony
        document.body.style.transition = "filter 0.5s, transform 0.5s";
        document.body.style.filter = "grayscale(100%) contrast(200%)";
        document.body.style.transform = "scale(1.05)";
        
        this.mrugnijEkranem('rgba(231, 76, 60, 0.8)', 1500);
        this.wykonajWstrzasEkranu(20, 1500);
        
        this.pokazOstrzezenie("CRASH SYSTEMU - REBOOT KONSOLI W TOKU...", false);
        
        // Zabezpieczenie przed nieskończonym odświeżaniem - czyścimy SessionStorage
        try { sessionStorage.clear(); } catch(e) {}

        // Twardy reload z wymuszeniem pobrania nowych plików (pominięcie cache)
        setTimeout(() => {
            window.location.reload(true);
        }, 1500);
    }
}

// Udostępnienie instancji dla Głównego Guardiana
window.GuardianHand = GuardianHand;