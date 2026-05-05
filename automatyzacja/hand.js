// ==========================================================================
// HAND.JS - "Mięśnie" i Egzekutor Akcji Guardiana (Pełna Wersja AAA+ Precision)
// Odpowiada za UI, DOM, Klawiaturę, Efekty Wizualne, Awaryjny Reset i Anty-Lag
// ==========================================================================

class GuardianHand {
    constructor() {
        // --- 0. IMMUNITET DEWELOPERSKI ---
        this.isDevMode = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' || 
                         sessionStorage.getItem('dev_mode') === 'true';

        if (this.isDevMode) {
            console.log("%c🛡️ [HAND] Immunitet Deweloperski AKTYWNY. Logi i funkcje dev odblokowane.", "color: #f1c40f; font-weight: bold;");
        }

        // --- 1. ZMIENNE UI I INTERFEJSU ---
        this.uiWarning = null;
        this.uiCritical = null; 
        this.ostrzezenieTimeout = null;
        
        // --- 2. REJESTRY STANU (Fail-Safes i Anty-Lag) ---
        this.stan = {
            fps: 60,
            ostatniaKlatka: performance.now(),
            poziomZiemniaka: 0, // 0 - Ultra, 1 - Medium, 2 - Extreme Potato
            czyKlawiaturaZacieta: false, // Lokalny Input Jamming
            czyShadowBanned: false
        };
        this.historiaKlikniec = [];
        this.bledyWizualne = 0;

        // --- INICJALIZACJA ---
        this.zbudujInterfejs();
        this.aktywujTarczeSystemowe();
        
        console.log("🦾 [HAND] Moduł Egzekucyjny podłączony do macierzy. Gotowy do uderzenia i ochrony.");
    }

    // ==========================================================================
    // 🎨 MODUŁ 1: ZARZĄDZANIE INTERFEJSEM (Wstrzykiwanie DOM)
    // ==========================================================================
    
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

    // ==========================================================================
    // 💥 MODUŁ 2: ZAAWANSOWANE EFEKTY EGZEKUCYJNE (Haptics & Visuals)
    // ==========================================================================
    
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

    // ==========================================================================
    // 🛡️ MODUŁ 3: OCHRONA KONTROLEK, DOM I FAIL-SAFES
    // ==========================================================================
    
    aktywujTarczeSystemowe() {
        // --- ORYGINALNE TARCZE (Ghost Input & Focus) ---
        window.addEventListener('blur', () => {
            console.log("🦾 [HAND] Utrata fokusu. Zerowanie wektorów ruchu fizycznego i myszy.");
            const keysToRelease = [
                'KeyW', 'KeyS', 'KeyA', 'KeyD', 
                'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
                'KeyQ', 'KeyE', 'Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4'
            ];
            try {
                keysToRelease.forEach(code => {
                    const eventCode = new KeyboardEvent('keyup', { 'code': code, 'key': code.replace('Key', '').toLowerCase() });
                    window.dispatchEvent(eventCode);
                });
                const mouseEvent = new MouseEvent('mouseup', { button: 0 });
                window.dispatchEvent(mouseEvent);
            } catch(e) {
                console.warn("🦾 [HAND] Błąd podczas zerowania klawiszy:", e);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (document.activeElement && document.activeElement.tagName === 'INPUT') {
                    document.activeElement.blur();
                    console.log("🦾 [HAND] Focus usunięty z pola tekstowego (Escape).");
                }
            }
        });

        // --- NOWOŚĆ: Pożeracz Błędów (Silent Error Swallowing) ---
        // Chroni klienta przed całkowitym zamrożeniem z powodu drobnego błędu w animacji/UI
        window.addEventListener('error', (e) => {
            if (this.isDevMode) return; // Szef musi widzieć błędy
            
            this.bledyWizualne++;
            if (this.bledyWizualne > 50 && this.stan.poziomZiemniaka < 2) {
                console.warn("🛡️ [HAND] Kaskada błędów wizualnych! Odpalam Tryb Ziemniaka (Bezpieczny).");
                this.wlaczTrybZiemniaka(2);
                this.bledyWizualne = 0;
            }
            e.preventDefault(); // Powstrzymuje propagację do silnika głównego
        });

        // --- NOWOŚĆ: Przycisk Paniki (F4) - Ręczny ratunek przed lagiem ---
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F4') {
                e.preventDefault();
                const nowyPoziom = this.stan.poziomZiemniaka >= 2 ? 0 : 2;
                if (nowyPoziom === 2) {
                    this.wlaczTrybZiemniaka(2);
                    this.pokazOstrzezenie("RĘCZNY TRYB WYDAJNOŚCI AKTYWNY (F4)", true);
                } else {
                    this.przywrocGrafike();
                    this.pokazOstrzezenie("GRAFIKA PRZYWRÓCONA (F4)", true);
                }
            }
        });

        // --- NOWOŚĆ: WebGL Context Recovery ---
        // Ratowanie Canvasa jeśli zawiesi się karta graficzna
        const canvas = document.getElementById('gameCanvas'); 
        if (canvas) {
            canvas.addEventListener('webglcontextlost', (e) => {
                e.preventDefault(); 
                console.error("🏥 [HAND] Utracono kontekst GPU! Próba restartu płótna...");
                setTimeout(() => { this.odbudujCanvas(); }, 1000);
            }, false);
        }
    }

    odbudujCanvas() {
        console.log("🏥 [HAND] Odtwarzanie kontekstu graficznego...");
        if (typeof window.grafika !== 'undefined' && typeof window.grafika.inicjalizuj === 'function') {
            window.grafika.inicjalizuj();
        }
    }

    // ==========================================================================
    // ⚡ MODUŁ 4: EKSTREMALNY ANTY-LAG I SKALOWANIE
    // ==========================================================================
    
    monitorujWydajnoscRenderu() {
        const teraz = performance.now();
        const delta = teraz - this.stan.ostatniaKlatka;
        this.stan.ostatniaKlatka = teraz;

        if (delta > 0) {
            this.stan.fps = (this.stan.fps * 0.9) + ((1000 / delta) * 0.1);
        }

        // Dynamiczne Skalowanie Rozdzielczości (Auto-Downscale)
        if (!this.isDevMode) {
            if (this.stan.fps < 30 && this.stan.poziomZiemniaka === 0) {
                this.wlaczTrybZiemniaka(1);
            } else if (this.stan.fps < 15 && this.stan.poziomZiemniaka === 1) {
                this.wlaczTrybZiemniaka(2);
            }
        }
    }

    wlaczTrybZiemniaka(poziom = 1) {
        this.stan.poziomZiemniaka = poziom;
        
        if (window.Flagi && window.Flagi.Srodowisko) {
            window.Flagi.Srodowisko.isMobile = true; 
        }
        
        const gameCanvas = document.querySelector('canvas');
        if (!gameCanvas) return;

        if (poziom === 1) {
            // [Poziom 1]: Odcina kosztowne cienie i delikatnie skaluje Canvas
            gameCanvas.style.filter = 'none';
            gameCanvas.style.transform = "scale(1.25)";
            gameCanvas.width = window.innerWidth * 0.8;
            gameCanvas.height = window.innerHeight * 0.8;
        } else if (poziom === 2) {
            // [Poziom 2]: Agresywne ucięcie detali, pikseloza dla ratowania FPS
            gameCanvas.style.filter = "none";
            gameCanvas.style.boxShadow = "none";
            gameCanvas.width = window.innerWidth * 0.5;
            gameCanvas.height = window.innerHeight * 0.5;
            gameCanvas.style.transform = "scale(2.0)";
            gameCanvas.style.imageRendering = "pixelated";
            
            document.body.style.setProperty('--bg-glass', 'rgba(10, 10, 15, 0.9)'); 
            const style = document.createElement('style');
            style.id = 'guardian-potato-style';
            style.innerHTML = `* { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }`;
            if (!document.getElementById('guardian-potato-style')) document.head.appendChild(style);
        }

        this.mrugnijEkranem('rgba(241, 196, 15, 0.3)', 300);
        this.pokazOstrzezenie(`PROTOKÓŁ WYDAJNOŚCI [POZIOM ${poziom}]`, true);
    }

    przywrocGrafike() {
        this.stan.poziomZiemniaka = 0;
        const gameCanvas = document.querySelector('canvas');
        if (gameCanvas) {
            gameCanvas.style.transform = "scale(1)";
            gameCanvas.width = window.innerWidth;
            gameCanvas.height = window.innerHeight;
            gameCanvas.style.imageRendering = "auto";
        }
        const potatoStyle = document.getElementById('guardian-potato-style');
        if (potatoStyle) potatoStyle.remove();
    }

    chronRenderowanie(funkcjaRenderujaca) {
        // [IDEA: Proxy Shield] - Ochrona głównej pętli renderującej grę przed crashami
        return (...args) => {
            this.monitorujWydajnoscRenderu();
            try {
                funkcjaRenderujaca(...args);
            } catch (err) {
                // Pożera błąd klatki, pozwalając silnikowi spróbować wyrenderować następną
                if (this.isDevMode) console.error("🎨 [HAND-RENDER ERROR]:", err);
            }
        };
    }

    // ==========================================================================
    // 🎯 MODUŁ 5: SNAJPERSKI ANTY-CHEAT (Izolacja lokalnego gracza)
    // ==========================================================================

    weryfikujLokalneWejscie() {
        if (this.isDevMode) return true; // Szef klika jak chce i z jaką chce prędkością

        const teraz = performance.now();
        this.historiaKlikniec.push(teraz);
        if (this.historiaKlikniec.length > 5) this.historiaKlikniec.shift();

        // [IDEA: Kłódka na Klawiaturę / Input Jamming]
        // Uderza tylko w tego jednego gracza. Blokuje jego strzały/skille jeśli używa makra o stałym interwale
        if (this.historiaKlikniec.length === 5) {
            let interwaly = [];
            for (let i = 1; i < 5; i++) interwaly.push(this.historiaKlikniec[i] - this.historiaKlikniec[i-1]);

            const srednia = interwaly.reduce((a, b) => a + b) / 4;
            const wariancja = interwaly.reduce((a, b) => a + Math.pow(b - srednia, 2), 0) / 4;

            if (wariancja < 2.0 && srednia < 100) { 
                this.stan.czyKlawiaturaZacieta = true;
                setTimeout(() => { this.stan.czyKlawiaturaZacieta = false; }, 2000); 
            }
        }

        if (this.stan.czyKlawiaturaZacieta) {
            return false; // Zablokowano akcję (broń u hakera zacina się i nie wysyła pakietu na serwer)
        }

        return true;
    }

    aktywujShadowRealm(czyWlaczyc) {
        // [IDEA: Piekło Szarości]
        // Oszust zostaje oflagowany. Jego gra staje się depresyjnie szara, kursor robi się "wait".
        // Nie cierpią na tym inni gracze, ani serwer.
        if (this.isDevMode) return;

        this.stan.czyShadowBanned = czyWlaczyc;
        const canvas = document.getElementById('gameCanvas');
        
        if (canvas) {
            if (czyWlaczyc) {
                canvas.style.filter = "grayscale(100%) contrast(150%) blur(1px)";
                document.body.style.cursor = "wait"; 
            } else if (this.stan.poziomZiemniaka === 0) {
                canvas.style.filter = "none";
                document.body.style.cursor = "crosshair";
            }
        }
    }

    // ==========================================================================
    // 💀 MODUŁ 6: TWARDY REBOOT (Procedura Ostatniej Szansy)
    // ==========================================================================
    
    wymusTwardyReset() {
        console.error("☠️ [HAND] Wprowadzam twardy restart środowiska. Zegnaj świecie.");
        
        document.body.style.transition = "filter 0.5s, transform 0.5s";
        document.body.style.filter = "grayscale(100%) contrast(200%)";
        document.body.style.transform = "scale(1.05)";
        
        this.mrugnijEkranem('rgba(231, 76, 60, 0.8)', 1500);
        this.wykonajWstrzasEkranu(20, 1500);
        
        this.pokazOstrzezenie("CRASH SYSTEMU - REBOOT KONSOLI W TOKU...", false);
        
        try { sessionStorage.clear(); } catch(e) {}

        setTimeout(() => {
            window.location.reload(true);
        }, 1500);
    }
}

// Udostępnienie instancji dla Głównego Guardiana i pętli
window.GuardianHand = new GuardianHand();