// ==========================================
// GRAFIKA.JS - Produkcyjny Silnik Renderujący (Architektura Północna & Taktyczne Boty)
// WERSJA: FINAL AAA ULTRA (Pełna Struktura + 3 FILARY TECH + 60x JUICE/NOIR)
// ==========================================

window.Grafika = (function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d', { alpha: false }); 
    
    // ==========================================
    // ⚙️ FILAR 1: ZARZĄDCA PAMIĘCI (Brak wycieków RAM)
    // ==========================================
    const ZarzadcaPamieci = {
        // Pre-alokacja Float32Array do ekstremalnie szybkich obliczeń
        szybkiePozycjeX: new Float32Array(2000),
        szybkiePozycjeY: new Float32Array(2000),
        
        // Pula obiektów (Object Pooling) by nie tworzyć śmieci Garbage Collectora
        pulaCzasteczek: Array.from({ length: 3000 }, () => ({
            x: 0, y: 0, vx: 0, vy: 0, zycie: 0, kolor: '#fff', rozmiar: 0, aktywne: false
        })),

        pobierzCzasteczke: function() {
            for (let i = 0; i < this.pulaCzasteczek.length; i++) {
                if (!this.pulaCzasteczek[i].aktywne) {
                    this.pulaCzasteczek[i].aktywne = true;
                    return this.pulaCzasteczek[i];
                }
            }
            return null; // Zabezpieczenie, gdy pula jest pełna
        },

        wyczyscPamiecCoRunde: function() {
            // Szybkie zerowanie referencji bez usuwania tablic
            KolejkaEfektow.length = 0;
            wskaznikiOffscreen.length = 0;
        }
    };

    // ==========================================
    // ⚙️ FILAR 2: AKCELERATOR RENDERU (Hakowanie Canvas)
    // ==========================================
    const AkceleratorRenderu = {
        optymalizujPozycje: function(wartosc) {
            // Bitwise Floor (x | 0) - ułatwia karcie graficznej rysowanie (brak sub-pikseli)
            return wartosc | 0;
        },
        
        wylaczWygladzanie: function(context) {
            context.imageSmoothingEnabled = false;
        },

        ustawCienNaMocnychSprzetach: function(context, kolor, blur = 15) {
            if (!window.Flagi.Srodowisko.isMobile && !ecoModeActive) {
                context.shadowBlur = blur;
                context.shadowColor = kolor;
            }
        },

        resetujCien: function(context) {
            context.shadowBlur = 0;
        }
    };

    // ==========================================
    // ⚙️ FILAR 3: RDZEŃ FIZYKI I SIECI (Szybka Matematyka)
    // ==========================================
    const RdzenFizyki = {
        SIN_TABLE: new Float32Array(360),
        
        inicjalizujTablice: function() {
            // CPU nie musi liczyć Math.sin, bierze gotowce z RAMu
            for(let i = 0; i < 360; i++) {
                this.SIN_TABLE[i] = Math.sin(i * Math.PI / 180);
            }
        },

        szybkiDystans: function(dx, dy) {
            // Brak Math.sqrt - optymalizacja O(1)
            return (dx * dx) + (dy * dy);
        },

        plynnyRuch: function(start, cel, dtKrok) {
            return start + (cel - start) * dtKrok;
        }
    };
    RdzenFizyki.inicjalizujTablice();

    // --- [TECH] STAŁE MATEMATYCZNE I CZAS ---
    const TWO_PI = Math.PI * 2;
    let dpr = 1; 
    let lastTime = performance.now(); 
    
    // --- [TECH 7] AUTO-ECO MODE ---
    let ecoModeActive = false;
    let lagFramesCounter = 0; 
    
    // --- KAMERA I EKRAN ---
    let camera = { x: 0, y: 0 };
    let cameraScale = 1.0; 
    let screenW = window.innerWidth;
    let screenH = window.innerHeight;
    let wstrzasEkranu = { moc: 0, wygasanie: 0.9 }; 
    let pokazDuzaMape = false;
    let siatkaWarp = 0; 

    // --- 🎬 ZARZĄDCA KLIMATU (Kategoria 6: Kosmiczny Noir) ---
    let StanKlimatu = { 
        kinowePasy: 0, 
        intensywnoscDeszczu: 0, 
        gniecieGranicy: { lewa: 0, prawa: 0, gora: 0, dol: 0 } 
    };
    let EventyTla = []; 

    let pozycjaMyszki = { x: screenW / 2, y: screenH / 2 };
    window.addEventListener('mousemove', (e) => {
        pozycjaMyszki.x = e.clientX; 
        pozycjaMyszki.y = e.clientY;
    });

    // ==========================================
    // 🗄️ BAZY DANYCH (PORZĄDEK TABLICOWY)
    // ==========================================
    let MacierzOtoczenia = []; 
    let mapaObiekty = { mury: [], swiatla: [] }; 
    let czyMapaWygenerowana = false;
    let czasteczkiTla = []; 
    let lokalnyBuforJedzenia = {};
    
    let czasWejsciaGraczy = {};
    let poprzedniePozycje = { players: {}, bots: {} };
    let poziomyEwolucji = {}; 
    let wskaznikiOffscreen = []; 
    
    // TABLICE EFEKTÓW WIZUALNYCH
    let sladPostaci = {};           
    let efektyWizualne = [];        
    let powiadomieniaLiczbowe = []; 
    let plamyZniszczen = [];        
    let faleUderzeniowe = [];       
    let sladyButow = [];            
    let efektyChrapania = [];       

    // 🚀 SILNIK 2: ZUNIFIKOWANA KOLEJKA EFEKTÓW WALKI
    let KolejkaEfektow = []; 

    function wstrzyknijEfektWalki(typ, x, y, opcje = {}) {
        KolejkaEfektow.push({
            typ: typ, 
            x: x, 
            y: y, 
            vx: opcje.vx || 0, 
            vy: opcje.vy || 0, 
            zycie: opcje.zycie || 1.0, 
            kat: opcje.kat || 0, 
            tekst: opcje.tekst || ''
        });
    }

    // --- BUFOR MINIMAPY (OFF-SCREEN) ---
    let minimapCanvas = document.createElement('canvas');
    let mCtx = minimapCanvas.getContext('2d', { alpha: true });

    window.addEventListener('keydown', (e) => { 
        if (e.code === 'KeyM') pokazDuzaMape = true; 
    });
    window.addEventListener('keyup', (e) => { 
        if (e.code === 'KeyM') pokazDuzaMape = false; 
    });

    const obrazyPostaci = {
        'standard': new Image(),
        'ninja': new Image(),
        'arystokrata': new Image()
    };
    obrazyPostaci['standard'].src = '/assety/xtreme-destiny-postac(1).png';
    obrazyPostaci['ninja'].src = '/assety/ninja-transparent.png';
    obrazyPostaci['arystokrata'].src = '/assety/postac-bez-tla.png';

    function resize() {
        screenW = window.innerWidth;
        screenH = window.innerHeight;
        dpr = window.devicePixelRatio || 1; 
        
        if (ecoModeActive) {
            dpr = Math.min(dpr, 0.75); 
        }

        canvas.width = screenW * dpr;
        canvas.height = screenH * dpr;
        canvas.style.width = screenW + "px";
        canvas.style.height = screenH + "px";
        canvas.style.cursor = 'none'; 
        
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
        AkceleratorRenderu.wylaczWygladzanie(ctx);
    }
    window.addEventListener('resize', resize);
    resize();

    function czyWidoczny(x, y, promien) {
        const margines = 300 / cameraScale; 
        return (
            x + promien + margines > camera.x &&
            x - promien - margines < camera.x + screenW / cameraScale &&
            y + promien + margines > camera.y &&
            y - promien - margines < camera.y + screenH / cameraScale
        );
    }

    // ==========================================
    // 🏭 GENERATORY EFEKTÓW 
    // ==========================================
    function generujWybuch(x, y, kolor, moc) {
        let ilosc = Math.min(moc, 50); 
        for(let i=0; i < ilosc; i++) {
            let czastka = ZarzadcaPamieci.pobierzCzasteczke();
            if (czastka) {
                let kat = Math.random() * TWO_PI;
                let predkosc = Math.random() * 12 + 3;
                czastka.x = x;
                czastka.y = y;
                czastka.vx = Math.cos(kat) * predkosc;
                czastka.vy = Math.sin(kat) * predkosc;
                czastka.zycie = 1.0;
                czastka.kolor = kolor;
                czastka.rozmiar = Math.random() * 5 + 2;
                efektyWizualne.push(czastka);
            }
        }
        
        plamyZniszczen.push({ 
            x: x, 
            y: y, 
            r: moc * 2, 
            kolor: kolor, 
            zycie: 1.0, 
            kat: Math.random() * TWO_PI 
        });
        
        if(plamyZniszczen.length > 40) {
            plamyZniszczen.shift(); 
        }
        
        faleUderzeniowe.push({ 
            x: x, 
            y: y, 
            r: 10, 
            maxR: moc * 4, 
            zycie: 1.0, 
            kolor: kolor 
        });
        
        if (moc >= 30) {
            siatkaWarp = 1.0; 
        }
    }

    function generujSmugęPocisku(x, y, kolor) {
        if(Math.random() > 0.4) return; 
        
        let czastka = ZarzadcaPamieci.pobierzCzasteczke();
        if (czastka) {
            czastka.x = x + (Math.random()*10-5);
            czastka.y = y + (Math.random()*10-5);
            czastka.vx = Math.random()*2-1;
            czastka.vy = Math.random()*2-1;
            czastka.zycie = 0.6;
            czastka.kolor = kolor;
            czastka.rozmiar = Math.random() * 3 + 1;
            efektyWizualne.push(czastka);
        }
        
        if(efektyWizualne.length > 150) {
            let stara = efektyWizualne.shift();
            stara.aktywne = false; // Powrót do puli
        }
    }

    function dodajPowiadomienie(x, y, roznica, nadpisanyTekst = null) {
        if (roznica === 0 && !nadpisanyTekst) return;
        
        let wypis = nadpisanyTekst;
        if (!wypis) {
            if (roznica > 0 && roznica < 5 && Math.random() > 0.5) {
                wypis = Math.random() > 0.5 ? "Mniam!" : "Chrum!";
            } else {
                wypis = (roznica > 0 ? '+' : '') + Math.floor(roznica);
            }
        }

        powiadomieniaLiczbowe.push({ 
            x: x + (Math.random() * 20 - 10), 
            y: y - 30, 
            vx: (Math.random() - 0.5) * 6, 
            vy: -4 - Math.random() * 3,    
            tekst: wypis, 
            kolor: roznica > 0 ? '#2ecc71' : '#e74c3c', 
            zycie: 1.0 
        });
    }

    function generujSladButa(x, y, kat) {
        sladyButow.push({ 
            x: x, 
            y: y, 
            kat: kat, 
            zycie: 0.5 
        });
        if(sladyButow.length > 100) {
            sladyButow.shift();
        }
    }

    // ==========================================
    // 🖌️ MENEDŻER RYSOWANIA TABLIC EFEKTÓW
    // ==========================================
    function aktualizujEfektyZniszczen(dt) {
        for(let i = plamyZniszczen.length - 1; i >= 0; i--) {
            let d = plamyZniszczen[i];
            d.zycie -= 0.002 * dt; 
            
            if (d.zycie <= 0) { 
                plamyZniszczen.splice(i, 1); 
                continue; 
            }
            
            if (czyWidoczny(d.x, d.y, d.r)) {
                ctx.save(); 
                ctx.translate(AkceleratorRenderu.optymalizujPozycje(d.x), AkceleratorRenderu.optymalizujPozycje(d.y)); 
                ctx.rotate(d.kat); 
                ctx.globalAlpha = d.zycie * 0.3;
                let grad = ctx.createRadialGradient(0,0,0, 0,0, AkceleratorRenderu.optymalizujPozycje(d.r));
                grad.addColorStop(0, '#000'); 
                grad.addColorStop(0.5, d.kolor); 
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad; 
                ctx.beginPath(); 
                ctx.arc(0, 0, AkceleratorRenderu.optymalizujPozycje(d.r), 0, TWO_PI); 
                ctx.fill();
                ctx.restore();
            }
        }

        for(let i = sladyButow.length - 1; i >= 0; i--) {
            let s = sladyButow[i];
            s.zycie -= 0.01 * dt;
            
            if (s.zycie <= 0) { 
                sladyButow.splice(i, 1); 
                continue; 
            }
            
            if (czyWidoczny(s.x, s.y, 10)) {
                ctx.save(); 
                ctx.translate(AkceleratorRenderu.optymalizujPozycje(s.x), AkceleratorRenderu.optymalizujPozycje(s.y)); 
                ctx.rotate(s.kat);
                ctx.fillStyle = `rgba(0, 0, 0, ${s.zycie * 0.3})`;
                ctx.fillRect(-5, -8, 10, 16); 
                ctx.restore();
            }
        }

        for(let i = faleUderzeniowe.length - 1; i >= 0; i--) {
            let f = faleUderzeniowe[i];
            f.r += (f.maxR - f.r) * 0.15 * dt; 
            f.zycie -= 0.05 * dt; 
            
            if (f.zycie <= 0) { 
                faleUderzeniowe.splice(i, 1); 
                continue; 
            }
            
            if (czyWidoczny(f.x, f.y, f.r)) {
                ctx.globalAlpha = f.zycie; 
                ctx.strokeStyle = f.kolor; 
                ctx.lineWidth = 4 * f.zycie;
                ctx.beginPath(); 
                ctx.arc(AkceleratorRenderu.optymalizujPozycje(f.x), AkceleratorRenderu.optymalizujPozycje(f.y), AkceleratorRenderu.optymalizujPozycje(f.r), 0, TWO_PI); 
                ctx.stroke(); 
                ctx.globalAlpha = 1.0;
            }
        }

        for(let i = efektyWizualne.length - 1; i >= 0; i--) {
            let p = efektyWizualne[i];
            p.x += p.vx * dt; 
            p.y += p.vy * dt;
            p.vx *= Math.pow(0.92, dt); 
            p.vy *= Math.pow(0.92, dt); 
            p.zycie -= 0.03 * dt;
            
            if (p.zycie <= 0) { 
                p.aktywne = false; // Powrót do puli
                efektyWizualne.splice(i, 1); 
                continue; 
            }
            
            if (czyWidoczny(p.x, p.y, p.rozmiar)) {
                ctx.globalAlpha = p.zycie; 
                ctx.fillStyle = p.kolor;
                AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, p.kolor, 15);
                ctx.beginPath(); 
                ctx.arc(AkceleratorRenderu.optymalizujPozycje(p.x), AkceleratorRenderu.optymalizujPozycje(p.y), AkceleratorRenderu.optymalizujPozycje(p.rozmiar * p.zycie), 0, TWO_PI); 
                ctx.fill();
                AkceleratorRenderu.resetujCien(ctx); 
                ctx.globalAlpha = 1.0;
            }
        }
    }

    function aktualizujEfektyTekstowe(dt) {
        ctx.font = '900 20px Exo 2, sans-serif'; 
        ctx.textAlign = 'center';
        
        for(let i = powiadomieniaLiczbowe.length - 1; i >= 0; i--) {
            let txt = powiadomieniaLiczbowe[i];
            txt.vy += 0.2 * dt; 
            txt.x += txt.vx * dt; 
            txt.y += txt.vy * dt; 
            txt.zycie -= 0.02 * dt;

            if (txt.zycie <= 0) { 
                powiadomieniaLiczbowe.splice(i, 1); 
                continue; 
            }

            if (czyWidoczny(txt.x, txt.y, 20)) {
                ctx.globalAlpha = txt.zycie; 
                ctx.fillStyle = txt.kolor; 
                ctx.strokeStyle = '#000'; 
                ctx.lineWidth = 3;
                ctx.strokeText(txt.tekst, AkceleratorRenderu.optymalizujPozycje(txt.x), AkceleratorRenderu.optymalizujPozycje(txt.y)); 
                ctx.fillText(txt.tekst, AkceleratorRenderu.optymalizujPozycje(txt.x), AkceleratorRenderu.optymalizujPozycje(txt.y));
            }
        }
        ctx.globalAlpha = 1.0;

        for(let i = efektyChrapania.length - 1; i >= 0; i--) {
            let z = efektyChrapania[i];
            z.y -= 1 * dt; 
            z.x += Math.sin(z.zycie * 10) * 0.5 * dt; 
            z.zycie -= 0.015 * dt;
            
            if (z.zycie <= 0) { 
                efektyChrapania.splice(i, 1); 
                continue; 
            }
            
            if (czyWidoczny(z.x, z.y, 20)) {
                ctx.globalAlpha = z.zycie; 
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold ' + Math.floor(10 + z.rozmiar) + 'px Exo 2, sans-serif';
                ctx.fillText('Z', AkceleratorRenderu.optymalizujPozycje(z.x), AkceleratorRenderu.optymalizujPozycje(z.y));
            }
        }
        ctx.globalAlpha = 1.0;
    }

    // 🚀 RENDERER SILNIKA 2 (Efekty Chwilowe na Wierzchu)
    function rysujKolejkeEfektow_SILNIK2(dt) {
        for (let i = KolejkaEfektow.length - 1; i >= 0; i--) {
            let e = KolejkaEfektow[i];
            e.x += e.vx * dt;
            e.y += e.vy * dt;
            e.zycie -= 0.016 * dt; 

            if (e.zycie <= 0) { 
                KolejkaEfektow.splice(i, 1); 
                continue; 
            }
            
            if (!czyWidoczny(e.x, e.y, 100)) {
                continue;
            }

            ctx.save();
            ctx.translate(AkceleratorRenderu.optymalizujPozycje(e.x), AkceleratorRenderu.optymalizujPozycje(e.y));
            ctx.globalAlpha = Math.min(1, Math.max(0, e.zycie));

            switch(e.typ) {
                case 'obrys_kreda':
                    ctx.rotate(e.kat); 
                    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; 
                    ctx.setLineDash([5, 5]); 
                    ctx.lineWidth = 3;
                    ctx.beginPath(); 
                    ctx.arc(0, 0, 35, 0, TWO_PI); 
                    ctx.stroke();
                    break;
                    
                case 'duszek_do_nieba':
                    ctx.fillStyle = 'rgba(200,200,255,0.6)'; 
                    ctx.beginPath(); 
                    ctx.arc(0, Math.sin(e.zycie*10)*5, 15, Math.PI, TWO_PI); 
                    ctx.lineTo(15, 20); 
                    ctx.lineTo(-15, 20); 
                    ctx.fill();
                    ctx.fillStyle = '#000'; 
                    ctx.beginPath(); 
                    ctx.arc(-5, -5, 3, 0, TWO_PI); 
                    ctx.arc(5, -5, 3, 0, TWO_PI); 
                    ctx.fill();
                    break;
                    
                case 'nagrobek_rip':
                    ctx.fillStyle = '#7f8c8d'; 
                    ctx.beginPath(); 
                    ctx.arc(0, -15, 15, Math.PI, TWO_PI); 
                    ctx.lineTo(15, 20); 
                    ctx.lineTo(-15, 20); 
                    ctx.fill();
                    ctx.fillStyle = '#fff'; 
                    ctx.font = '12px Arial'; 
                    ctx.textAlign = 'center'; 
                    ctx.fillText('RIP', 0, 5);
                    break;
                    
                case 'dymek_czaszka':
                    ctx.fillStyle = 'rgba(236, 240, 241, 0.8)'; 
                    ctx.beginPath(); 
                    ctx.arc(0, 0, 15, 0, TWO_PI); 
                    ctx.fillRect(-10, 5, 20, 10); 
                    ctx.fill();
                    ctx.fillStyle = '#2c3e50'; 
                    ctx.beginPath(); 
                    ctx.arc(-5, -2, 4, 0, TWO_PI); 
                    ctx.arc(5, -2, 4, 0, TWO_PI); 
                    ctx.fill();
                    break;
                    
                case 'wylatujace_srubki':
                    ctx.rotate(e.zycie * 10); 
                    ctx.fillStyle = '#95a5a6'; 
                    ctx.fillRect(-4, -2, 8, 4); 
                    ctx.fillRect(-2, -4, 4, 8);
                    break;
                    
                case 'komiksowy_napis':
                    ctx.fillStyle = '#f1c40f'; 
                    ctx.beginPath(); 
                    ctx.moveTo(0, 0); 
                    ctx.lineTo(20, -10); 
                    ctx.lineTo(15, -25); 
                    ctx.lineTo(0, -15); 
                    ctx.lineTo(-15, -25); 
                    ctx.lineTo(-20, -10); 
                    ctx.fill();
                    ctx.fillStyle = '#e74c3c'; 
                    ctx.font = '900 16px Exo 2'; 
                    ctx.textAlign = 'center'; 
                    ctx.fillText(e.tekst, 0, -10);
                    break;
                    
                case 'odpadajacy_pancerz':
                    ctx.rotate(e.zycie * 5); 
                    ctx.strokeStyle = '#3498db'; 
                    ctx.lineWidth = 4; 
                    ctx.beginPath(); 
                    ctx.arc(0, 0, 20, 0, Math.PI); 
                    ctx.stroke();
                    break;
                    
                case 'pot_strachu':
                    ctx.fillStyle = 'rgba(52, 152, 219, 0.8)'; 
                    ctx.beginPath(); 
                    ctx.arc(0, 0, 4, 0, Math.PI); 
                    ctx.lineTo(0, -6); 
                    ctx.fill();
                    break;
                    
                case 'roztrzaskane_szklo':
                    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; 
                    ctx.lineWidth = 2;
                    ctx.beginPath(); 
                    ctx.moveTo(0, 0); 
                    ctx.lineTo(15, -20); 
                    ctx.moveTo(0, 0); 
                    ctx.lineTo(-20, -10); 
                    ctx.moveTo(0, 0); 
                    ctx.lineTo(10, 20); 
                    ctx.stroke();
                    break;
                    
                case 'spiralny_dym':
                    ctx.fillStyle = `rgba(150,150,150,${e.zycie})`; 
                    ctx.beginPath(); 
                    ctx.arc(Math.sin(e.zycie*20)*10, 0, Math.max(1, e.zycie * 10), 0, TWO_PI); 
                    ctx.fill();
                    break;
                    
                case 'iskra_lontu':
                    ctx.fillStyle = '#f1c40f'; 
                    ctx.beginPath(); 
                    ctx.arc(0, 0, Math.random()*4+2, 0, TWO_PI); 
                    ctx.fill();
                    break;
                    
                case 'tarcie_powietrza':
                    ctx.strokeStyle = '#f1c40f'; 
                    ctx.lineWidth = 2; 
                    ctx.beginPath(); 
                    ctx.moveTo(0, 0); 
                    ctx.lineTo(-10 + Math.random()*5, (Math.random()-0.5)*10); 
                    ctx.stroke();
                    break;
                    
                case 'dym_z_lufy':
                    ctx.fillStyle = `rgba(150, 150, 150, ${e.zycie * 0.5})`; 
                    ctx.beginPath(); 
                    ctx.arc(0, Math.sin(e.zycie*10)*5, 5 + (1-e.zycie)*10, 0, TWO_PI); 
                    ctx.fill();
                    break;
            }
            ctx.restore();
        }
    }

    // ==========================================
    // 🌌 ŚRODOWISKO I MACIERZ OTOCZENIA 
    // ==========================================
    function generujSrodowisko(tryb, limitWielkosci) {
        MacierzOtoczenia = []; 
        mapaObiekty.swiatla = []; 
        czasteczkiTla = [];
        EventyTla = [];

        // [KATEGORIA 6 - Pyłki i Kurz w tle]
        let iloscCzasteczek = tryb === 'CAMPAIGN' ? 150 : (tryb === 'TEAMS' ? 200 : 100);
        for(let i = 0; i < iloscCzasteczek; i++) {
            let predkoscX = (Math.random() - 0.5) * 0.5;
            let predkoscY = (Math.random() - 0.5) * 0.5;
            let rozmiar = Math.random() * 2;
            
            if (tryb === 'TEAMS') { 
                predkoscX = (Math.random() * 2 + 1); 
                predkoscY = (Math.random() * 3 + 2); 
            } else if (tryb === 'CAMPAIGN') { 
                rozmiar = Math.random() * 4 + 1; 
                predkoscX = (Math.random() - 0.5) * 0.2; 
                predkoscY = (Math.random() - 0.5) * 0.2; 
            }
            
            czasteczkiTla.push({ 
                x: Math.random() * 6000, 
                y: Math.random() * 6000, 
                speedX: predkoscX, 
                speedY: predkoscY, 
                r: rozmiar, 
                alpha: Math.random() * 0.5 + 0.1, 
                głębia: Math.random() * 0.8 + 0.2 
            });
        }

        // [KATEGORIA 6 - Przejeżdżający pociąg w tle]
        EventyTla.push({ 
            typ: 'kosmiczny_pociag', 
            x: -5000, 
            y: limitWielkosci * 0.8, 
            vx: 10 
        });
        
        if (tryb === 'FREE') {
            const typyKryjowek = [
                'ser_z_dziurami', 'mglawica_dymu', 'smietnik_neon', 
                'wrak_ufo', 'hologram_drzewa', 'krater_meteorytu', 
                'budka_telefoniczna', 'czarna_mikrodziura', 
                'billboard_noir', 'porzucony_satelita'
            ];
            
            for(let i = 0; i < 60; i++) {
                let wylosowanyTyp = typyKryjowek[Math.floor(Math.random() * typyKryjowek.length)];
                let wylosowanyR = 70;
                
                if (wylosowanyTyp === 'mglawica_dymu' || wylosowanyTyp === 'czarna_mikrodziura') {
                    wylosowanyR = 120;
                }
                if (wylosowanyTyp === 'wrak_ufo' || wylosowanyTyp === 'billboard_noir') {
                    wylosowanyR = 90;
                }

                MacierzOtoczenia.push({ 
                    typ: wylosowanyTyp, 
                    x: Math.random() * 4000, 
                    y: Math.random() * 4000, 
                    r: wylosowanyR,
                    faza: Math.random() * TWO_PI 
                });
            }
            
            for(let i = 0; i < 40; i++) {
                mapaObiekty.swiatla.push({ 
                    x: Math.random() * 4000, 
                    y: Math.random() * 4000, 
                    r: Math.random() * 100 + 50, 
                    color: ['rgba(231,76,60,0.05)', 'rgba(52,152,219,0.05)', 'rgba(155,89,182,0.05)'][Math.floor(Math.random()*3)] 
                });
            }
        }
        
        minimapCanvas.width = 1000; 
        minimapCanvas.height = 1000;
        let scale = 1000 / limitWielkosci;
        mCtx.clearRect(0, 0, 1000, 1000);
        
        if (tryb === 'FREE') {
            const castleWidth = 300 * scale; 
            const castleHeight = 250 * scale;
            
            mCtx.save(); 
            mCtx.translate(2000 * scale, 2000 * scale);
            mCtx.strokeStyle = '#f1c40f'; 
            mCtx.lineWidth = 3;
            mCtx.fillStyle = 'rgba(241, 196, 15, 0.05)';
            
            mCtx.beginPath();
            mCtx.moveTo(-castleWidth/2, castleHeight/2); 
            mCtx.lineTo(castleWidth/2, castleHeight/2); 
            mCtx.lineTo(castleWidth/2, 0);
            mCtx.lineTo(castleWidth*0.6, 0); 
            mCtx.lineTo(castleWidth*0.6, -castleHeight*0.1); 
            mCtx.lineTo(castleWidth*0.7, -castleHeight*0.1); 
            mCtx.lineTo(castleWidth*0.7, 0);
            mCtx.lineTo(castleWidth/2, 0); 
            mCtx.lineTo(castleWidth*0.4, -castleHeight*0.3); 
            mCtx.lineTo(0, -castleHeight/2); 
            mCtx.lineTo(-castleWidth*0.4, -castleHeight*0.3);
            mCtx.lineTo(-castleWidth/2, 0); 
            mCtx.lineTo(-castleWidth*0.7, 0); 
            mCtx.lineTo(-castleWidth*0.7, -castleHeight*0.1); 
            mCtx.lineTo(-castleWidth*0.6, -castleHeight*0.1); 
            mCtx.lineTo(-castleWidth*0.6, 0);
            mCtx.lineTo(-castleWidth/2, 0); 
            mCtx.closePath();
            
            mCtx.fill(); 
            mCtx.stroke();
            mCtx.strokeStyle = 'rgba(241, 196, 15, 0.4)'; 
            mCtx.strokeRect(-castleWidth*0.15, castleHeight*0.15, castleWidth*0.3, castleHeight*0.35);
            mCtx.restore();
        } else if (tryb === 'TEAMS') {
            mCtx.fillStyle = 'rgba(231, 76, 60, 0.3)'; 
            mCtx.strokeStyle = '#e74c3c'; 
            mCtx.lineWidth = 2;
            mCtx.beginPath(); 
            mCtx.arc(500 * scale, 3000 * scale, 400 * scale, 0, TWO_PI); 
            mCtx.fill(); 
            mCtx.stroke();
            
            mCtx.fillStyle = 'rgba(52, 152, 219, 0.3)'; 
            mCtx.strokeStyle = '#3498db';
            mCtx.beginPath(); 
            mCtx.arc(5500 * scale, 3000 * scale, 400 * scale, 0, TWO_PI); 
            mCtx.fill(); 
            mCtx.stroke();
        }

        czyMapaWygenerowana = true;
    }

    function aktualizujCząsteczki(tryb, dt) {
        czasteczkiTla.forEach(c => {
            c.x += c.speedX * dt; 
            c.y += c.speedY * dt;
            
            if (c.x < 0) c.x = 6000; 
            if (c.x > 6000) c.x = 0;
            if (c.y < 0) c.y = 6000; 
            if (c.y > 6000) c.y = 0;
            
            let drawX = c.x + (camera.x * (1 - c.głębia)); 
            let drawY = c.y + (camera.y * (1 - c.głębia));

            if (tryb === 'TEAMS') {
                ctx.fillStyle = `rgba(200, 200, 200, ${c.alpha})`; 
                ctx.beginPath(); 
                ctx.moveTo(drawX, drawY); 
                ctx.lineTo(drawX - c.speedX * 3, drawY - c.speedY * 3); 
                ctx.strokeStyle = ctx.fillStyle; 
                ctx.lineWidth = 1.5; 
                ctx.stroke();
            } else if (tryb === 'CAMPAIGN') {
                ctx.fillStyle = `rgba(180, 20, 20, ${c.alpha * 0.4})`; 
                ctx.beginPath(); 
                ctx.arc(drawX, drawY, c.r * c.głębia, 0, TWO_PI); 
                ctx.fill();
            } else {
                ctx.fillStyle = `rgba(255, 255, 255, ${c.alpha})`; 
                ctx.beginPath(); 
                ctx.arc(drawX, drawY, c.r * c.głębia, 0, TWO_PI); 
                ctx.fill();
            }
        });
    }

    function rysujMape(tryb, limitSwiata, stanSerwera, dt) {
        ctx.save(); 
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
        ctx.fillStyle = '#08080a'; 
        ctx.fillRect(0, 0, screenW, screenH); 
        ctx.restore();

        aktualizujCząsteczki(tryb, dt);

        // [KATEGORIA 6 - Przejeżdżający pociąg w tle]
        EventyTla.forEach(ev => {
            if (ev.typ === 'kosmiczny_pociag') {
                ev.x += ev.vx * dt;
                
                if (ev.x > limitSwiata + 2000) {
                    ev.x = -5000;
                }
                
                ctx.save(); 
                ctx.translate(AkceleratorRenderu.optymalizujPozycje(ev.x), AkceleratorRenderu.optymalizujPozycje(ev.y));
                ctx.fillStyle = 'rgba(20, 25, 30, 0.8)';
                ctx.fillRect(0, -100, 800, 100); 
                
                for(let w = 0; w < 5; w++) { 
                    ctx.fillStyle = 'rgba(241,196,15,0.2)'; 
                    ctx.fillRect(50 + w * 150, -60, 40, 30); 
                } 
                ctx.restore();
            }
        });

        // [KATEGORIA 6 - Deszcz w próżni Noir]
        if (StanKlimatu.intensywnoscDeszczu > 0) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 * StanKlimatu.intensywnoscDeszczu})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            
            let rainOffset = (Date.now() * 2) % 200;
            let sx = camera.x;
            let sy = camera.y;
            let ew = screenW / cameraScale;
            let eh = screenH / cameraScale;
            
            for(let x = sx; x < sx + ew + 200; x += 30) {
                for(let y = sy; y < sy + eh; y += 100) {
                    let dropY = y + rainOffset + (x % 50);
                    ctx.moveTo(x, dropY);
                    ctx.lineTo(x - 10, dropY + 20); 
                }
            }
            ctx.stroke();
        }

        // [KATEGORIA 6 - Pulsowanie do Bitu]
        siatkaWarp *= Math.pow(0.9, dt); 
        const siatkaRozmiar = 200 + (Math.sin(Date.now() / 50) * 15 * siatkaWarp); 
        
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.05)'; 
        ctx.lineWidth = 1;
        const startX = Math.floor(camera.x / siatkaRozmiar) * siatkaRozmiar; 
        const startY = Math.floor(camera.y / siatkaRozmiar) * siatkaRozmiar;
        
        ctx.beginPath();
        for(let x = startX; x < camera.x + screenW / cameraScale; x += siatkaRozmiar) { 
            ctx.moveTo(x, camera.y); 
            ctx.lineTo(x, camera.y + screenH / cameraScale); 
        }
        for(let y = startY; y < camera.y + screenH / cameraScale; y += siatkaRozmiar) { 
            ctx.moveTo(camera.x, y); 
            ctx.lineTo(camera.x + screenW / cameraScale, y); 
        }
        ctx.stroke();

        if (mapaObiekty.swiatla) {
            mapaObiekty.swiatla.forEach(s => { 
                if(czyWidoczny(s.x, s.y, s.r)) { 
                    ctx.beginPath(); 
                    ctx.arc(s.x | 0, s.y | 0, s.r | 0, 0, TWO_PI); 
                    ctx.fillStyle = s.color; 
                    ctx.fill(); 
                }
            });
        }

        // [KATEGORIA 6 - Gnące się granice mapy]
        ctx.strokeStyle = '#e74c3c'; 
        ctx.lineWidth = 6;
        AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, '#e74c3c', 15);
        
        ctx.beginPath();
        ctx.moveTo(0, 0); 
        ctx.quadraticCurveTo(limitSwiata/2, StanKlimatu.gniecieGranicy.gora, limitSwiata, 0);
        ctx.quadraticCurveTo(limitSwiata - StanKlimatu.gniecieGranicy.prawa, limitSwiata/2, limitSwiata, limitSwiata);
        ctx.quadraticCurveTo(limitSwiata/2, limitSwiata - StanKlimatu.gniecieGranicy.dol, 0, limitSwiata);
        ctx.quadraticCurveTo(StanKlimatu.gniecieGranicy.lewa, limitSwiata/2, 0, 0);
        ctx.stroke();
        
        AkceleratorRenderu.resetujCien(ctx);
        
        StanKlimatu.gniecieGranicy.lewa *= Math.pow(0.9, dt);
        StanKlimatu.gniecieGranicy.prawa *= Math.pow(0.9, dt);
        StanKlimatu.gniecieGranicy.gora *= Math.pow(0.9, dt);
        StanKlimatu.gniecieGranicy.dol *= Math.pow(0.9, dt);

        const czas = Date.now();

        if (tryb === 'FREE') {
            MacierzOtoczenia.forEach(obiekt => {
                if(!czyWidoczny(obiekt.x, obiekt.y, obiekt.r)) return;
                
                let drganie = 0;
                if (stanSerwera) {
                    let rSq = obiekt.r * obiekt.r; 
                    
                    // Użycie RdzenFizyki do optymalizacji odległości
                    let ktosJestWKrzaku = Object.values(stanSerwera.players).some(p => RdzenFizyki.szybkiDystans(p.x - obiekt.x, p.y - obiekt.y) < rSq) || 
                                          Object.values(stanSerwera.bots).some(b => RdzenFizyki.szybkiDystans(b.x - obiekt.x, b.y - obiekt.y) < rSq);
                    
                    if (ktosJestWKrzaku) drganie = Math.sin(czas / 40) * 4;
                }

                ctx.save(); 
                ctx.translate((obiekt.x + drganie) | 0, obiekt.y | 0);
                obiekt.faza += 0.05 * dt; 

                switch(obiekt.typ) {
                    case 'ser_z_dziurami':
                        ctx.fillStyle = '#f1c40f'; 
                        ctx.beginPath(); 
                        ctx.arc(0, 0, obiekt.r, 0, TWO_PI); 
                        ctx.fill();
                        
                        ctx.fillStyle = '#08080a'; 
                        ctx.beginPath(); ctx.arc(-obiekt.r/3, -obiekt.r/3, obiekt.r/4, 0, TWO_PI); ctx.fill();
                        ctx.beginPath(); ctx.arc(obiekt.r/2, 0, obiekt.r/5, 0, TWO_PI); ctx.fill();
                        break;
                        
                    case 'mglawica_dymu':
                        let mGrad = ctx.createRadialGradient(0,0,0, 0,0, obiekt.r);
                        mGrad.addColorStop(0, `rgba(142, 68, 173, ${0.7 + Math.sin(obiekt.faza)*0.2})`); 
                        mGrad.addColorStop(1, 'transparent');
                        ctx.fillStyle = mGrad; 
                        ctx.beginPath(); 
                        ctx.arc(0, 0, obiekt.r, 0, TWO_PI); 
                        ctx.fill();
                        break;
                        
                    case 'smietnik_neon':
                        ctx.fillStyle = '#2c3e50'; 
                        ctx.fillRect(-obiekt.r, -obiekt.r/2, obiekt.r*2, obiekt.r);
                        ctx.strokeStyle = '#2ecc71'; 
                        ctx.lineWidth = 3; 
                        if (Math.sin(obiekt.faza * 2) > 0) { 
                            AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, '#2ecc71', 15);
                        } 
                        ctx.strokeRect(-obiekt.r, -obiekt.r/2, obiekt.r*2, obiekt.r); 
                        AkceleratorRenderu.resetujCien(ctx);
                        break;
                        
                    case 'wrak_ufo':
                        ctx.fillStyle = '#7f8c8d'; 
                        ctx.beginPath(); 
                        ctx.ellipse(0, 0, obiekt.r, obiekt.r/2, 0, 0, TWO_PI); 
                        ctx.fill();
                        ctx.fillStyle = Math.sin(obiekt.faza * 5) > 0 ? '#e74c3c' : '#555'; 
                        ctx.beginPath(); 
                        ctx.arc(0, -obiekt.r/4, 8, 0, TWO_PI); 
                        ctx.fill();
                        break;
                        
                    case 'hologram_drzewa':
                        ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 + Math.sin(obiekt.faza)*0.3})`; 
                        ctx.lineWidth = 2;
                        let gX = Math.random() > 0.95 ? (Math.random()-0.5)*10 : 0; 
                        ctx.strokeRect(-obiekt.r/4 + gX, -obiekt.r, obiekt.r/2, obiekt.r*2);
                        ctx.beginPath(); 
                        ctx.moveTo(-obiekt.r/2 + gX, -obiekt.r/2); 
                        ctx.lineTo(0 + gX, -obiekt.r); 
                        ctx.lineTo(obiekt.r/2 + gX, -obiekt.r/2); 
                        ctx.stroke();
                        break;
                        
                    case 'krater_meteorytu':
                        ctx.fillStyle = '#111'; 
                        ctx.beginPath(); 
                        ctx.arc(0, 0, obiekt.r, 0, TWO_PI); 
                        ctx.fill();
                        ctx.fillStyle = '#222'; 
                        ctx.beginPath(); 
                        ctx.arc(-10, -10, obiekt.r*0.8, 0, TWO_PI); 
                        ctx.fill();
                        break;
                        
                    case 'budka_telefoniczna':
                        ctx.fillStyle = '#2980b9'; 
                        ctx.fillRect(-obiekt.r/2, -obiekt.r, obiekt.r, obiekt.r*2);
                        ctx.fillStyle = '#f1c40f'; 
                        ctx.fillRect(-obiekt.r/3, -obiekt.r*0.8, obiekt.r/1.5, obiekt.r/2); 
                        break;
                        
                    case 'czarna_mikrodziura':
                        let bGrad = ctx.createRadialGradient(0,0, obiekt.r/2, 0,0, obiekt.r);
                        bGrad.addColorStop(0, '#000'); 
                        bGrad.addColorStop(1, 'transparent');
                        ctx.fillStyle = bGrad; 
                        ctx.beginPath(); 
                        ctx.arc(0, 0, obiekt.r, 0, TWO_PI); 
                        ctx.fill();
                        ctx.fillStyle = '#000'; 
                        ctx.beginPath(); 
                        ctx.arc(0, 0, obiekt.r/2, 0, TWO_PI); 
                        ctx.fill();
                        break;
                        
                    case 'billboard_noir':
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; 
                        ctx.fillRect(-obiekt.r, -obiekt.r/2, obiekt.r*2, obiekt.r);
                        ctx.strokeStyle = '#e74c3c'; 
                        ctx.strokeRect(-obiekt.r, -obiekt.r/2, obiekt.r*2, obiekt.r);
                        ctx.fillStyle = '#e74c3c'; 
                        ctx.font = '20px Exo 2'; 
                        ctx.textAlign = 'center'; 
                        ctx.fillText('NOIR', 0, 5);
                        break;
                        
                    case 'porzucony_satelita':
                        ctx.strokeStyle = '#bdc3c7'; 
                        ctx.lineWidth = 3; 
                        ctx.rotate(obiekt.faza * 0.1);
                        ctx.strokeRect(-obiekt.r, -10, obiekt.r*2, 20); 
                        ctx.beginPath(); 
                        ctx.arc(0, 0, 15, 0, TWO_PI); 
                        ctx.fill(); 
                        ctx.stroke();
                        break;
                }
                ctx.restore();
            });
            
            if (czyWidoczny(2000, 2000, 400)) {
                ctx.save(); 
                ctx.translate(2000, 2000); 
                let puls = Math.abs(Math.sin(czas / 500)); 
                const kolorMuru = '#95a5a6'; 
                const kolorKrawedzi = '#f1c40f'; 
                const kolorDachu = '#e74c3c';    
                const kolorFosy = 'rgba(52, 152, 219, 0.3)'; 
                const kolorFosyGlow = '#3498db';

                ctx.beginPath(); 
                ctx.arc(0, 0, 320, 0, TWO_PI); 
                ctx.fillStyle = kolorFosy; 
                ctx.fill();
                ctx.lineWidth = 4; 
                ctx.strokeStyle = kolorFosyGlow;
                AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, kolorFosyGlow, 20);
                ctx.stroke(); 
                AkceleratorRenderu.resetujCien(ctx);

                ctx.fillStyle = '#7f8c8d'; 
                ctx.fillRect(-50, 20, 100, 300); 
                ctx.strokeStyle = '#fff'; 
                ctx.lineWidth = 2; 
                ctx.strokeRect(-50, 20, 100, 300);
                
                ctx.lineWidth = 4; 
                AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, '#000', 15);

                ctx.fillStyle = kolorMuru; 
                ctx.strokeStyle = kolorKrawedzi; 
                ctx.fillRect(-150, -100, 300, 200); 
                ctx.strokeRect(-150, -100, 300, 200);
                ctx.beginPath(); 
                ctx.moveTo(-180, -100); 
                ctx.lineTo(180, -100); 
                ctx.lineTo(0, -250); 
                ctx.closePath(); 
                ctx.fillStyle = kolorDachu; 
                ctx.fill(); 
                ctx.stroke();
                
                ctx.fillStyle = kolorMuru; 
                ctx.fillRect(-220, -50, 70, 150); 
                ctx.strokeRect(-220, -50, 70, 150);
                ctx.beginPath(); 
                ctx.moveTo(-240, -50); 
                ctx.lineTo(-130, -50); 
                ctx.lineTo(-185, -150); 
                ctx.closePath(); 
                ctx.fillStyle = kolorDachu; 
                ctx.fill(); 
                ctx.stroke();
                
                ctx.fillStyle = kolorMuru; 
                ctx.fillRect(150, -50, 70, 150); 
                ctx.strokeRect(150, -50, 70, 150);
                ctx.beginPath(); 
                ctx.moveTo(130, -50); 
                ctx.lineTo(240, -50); 
                ctx.lineTo(185, -150); 
                ctx.closePath(); 
                ctx.fillStyle = kolorDachu; 
                ctx.fill(); 
                ctx.stroke();

                ctx.fillStyle = '#050505'; 
                ctx.fillRect(-60, 20, 120, 80); 
                ctx.strokeStyle = '#f1c40f'; 
                ctx.strokeRect(-60, 20, 120, 80);
                
                ctx.save(); 
                ctx.translate(0, 60); 
                ctx.rotate(czas / 1000); 
                ctx.strokeStyle = '#fff'; 
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, '#fff', 15);
                ctx.beginPath(); 
                ctx.rect(-15, -15, 30, 30); 
                ctx.rotate(Math.PI / 4); 
                ctx.rect(-15, -15, 30, 30); 
                ctx.fill(); 
                ctx.stroke(); 
                ctx.restore();
                
                ctx.restore();
            }
        }
    }

    function rysujWstegeRuchu(id, promien, kolor) {
        if (!sladPostaci[id] || sladPostaci[id].length < 2) return;
        
        ctx.save(); 
        ctx.beginPath(); 
        ctx.moveTo(sladPostaci[id][0].x, sladPostaci[id][0].y);
        
        for(let i = 1; i < sladPostaci[id].length; i++) {
            let p1 = sladPostaci[id][i-1]; 
            let p2 = sladPostaci[id][i];
            let mx = (p1.x + p2.x) / 2; 
            let my = (p1.y + p2.y) / 2;
            ctx.quadraticCurveTo(p1.x, p1.y, mx, my);
        }
        
        ctx.strokeStyle = kolor; 
        ctx.lineWidth = promien * 0.8; 
        ctx.lineCap = 'round'; 
        ctx.lineJoin = 'round'; 
        ctx.globalAlpha = 0.3;
        
        AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, kolor, 10);
        ctx.stroke(); 
        ctx.restore();
    }

    function obliczCienKierunkowy(jestGraczem = false) {
        if (jestGraczem) {
            let cx = pozycjaMyszki.x - screenW/2;
            let cy = pozycjaMyszki.y - screenH/2;
            return { offsetX: -cx * 0.05, offsetY: -cy * 0.05 };
        }
        let katOswietlenia = Date.now() / 2000; 
        return { offsetX: Math.cos(katOswietlenia) * 10, offsetY: Math.sin(katOswietlenia) * 10 };
    }

    // ==========================================
    // RENDEROWANIE BOTÓW I GRACZY
    // ==========================================
    function rysujBota(bot) {
        let widoczny = czyWidoczny(bot.x, bot.y, 100);
        let isBoss = bot.isBoss || bot.skin === 'ninja';

        if (!widoczny && isBoss) { 
            wskaznikiOffscreen.push({ x: bot.x, y: bot.y }); 
            return; 
        }
        if (!widoczny) return;

        let wKrzaku = false;
        MacierzOtoczenia.forEach(k => { 
            if (RdzenFizyki.szybkiDystans(bot.x - k.x, bot.y - k.y) < k.r * k.r) wKrzaku = true; 
        });
        
        if (wKrzaku) return;

        let masa = Math.min(bot.score || 10, 600);
        let promien = 15 + Math.sqrt(masa) * 1.5;
        
        let idleData = poprzedniePozycje.bots[bot.id] ? poprzedniePozycje.bots[bot.id].idleTime : 0;
        if (idleData > 10) {
            promien += Math.sin(Date.now() / 200) * 2; 
        }

        // [KATEGORIA 6 - Odbicia w podłodze (Mokry Asfalt)]
        ctx.save(); 
        ctx.translate(bot.x | 0, bot.y | 0); 
        ctx.rotate(bot.angle || 0);
        
        ctx.save();
        ctx.scale(1, -0.4); 
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        if (isBoss) {
            ctx.moveTo(promien * 0.8, -promien); 
            ctx.lineTo(promien, 0); 
            ctx.lineTo(promien * 0.8, promien); 
            ctx.lineTo(-promien * 0.8, promien); 
            ctx.lineTo(-promien, 0); 
            ctx.lineTo(-promien * 0.8, -promien);
        } else {
            for (let i = 0; i < 6; i++) { 
                ctx.lineTo(Math.cos(i * Math.PI/3) * promien, Math.sin(i * Math.PI/3) * promien); 
            }
        }
        ctx.closePath(); 
        ctx.fill(); 
        ctx.restore();

        let mainColor = isBoss ? '#9b59b6' : '#e74c3c';
        let strokeColor = mainColor;
        if (bot.ownerId && bot.team) strokeColor = bot.team === 'RED' ? '#e74c3c' : '#3498db';

        let cien = obliczCienKierunkowy(false);
        AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, strokeColor, 15);
        ctx.shadowOffsetX = cien.offsetX; 
        ctx.shadowOffsetY = cien.offsetY;

        ctx.fillStyle = '#050505'; 
        ctx.strokeStyle = strokeColor; 
        ctx.lineWidth = 3;

        let bFlash = poprzedniePozycje.bots[bot.id] ? poprzedniePozycje.bots[bot.id].hitFlash : 0;
        if (bFlash > 0) { 
            ctx.fillStyle = `rgba(255, 255, 255, ${bFlash})`; 
            ctx.strokeStyle = '#fff'; 
        }

        ctx.beginPath();
        if (isBoss) {
            ctx.moveTo(promien * 0.8, -promien); 
            ctx.lineTo(promien, 0); 
            ctx.lineTo(promien * 0.8, promien); 
            ctx.lineTo(-promien * 0.8, promien); 
            ctx.lineTo(-promien, 0); 
            ctx.lineTo(-promien * 0.8, -promien);
        } else {
            for (let i = 0; i < 6; i++) { 
                ctx.lineTo(Math.cos(i * Math.PI/3) * promien, Math.sin(i * Math.PI/3) * promien); 
            }
        }
        ctx.closePath(); 
        ctx.fill(); 
        ctx.stroke();
        AkceleratorRenderu.resetujCien(ctx);
        ctx.shadowOffsetX = 0; 
        ctx.shadowOffsetY = 0;
        
        ctx.strokeStyle = `rgba(${strokeColor === '#3498db' ? '52, 152, 219' : '231, 76, 60'}, 0.5)`;
        if (isBoss) ctx.strokeStyle = 'rgba(155, 89, 182, 0.5)';
        
        ctx.lineWidth = 1; 
        ctx.beginPath(); 
        ctx.arc(0, 0, promien * 0.4, 0, TWO_PI); 
        ctx.stroke();
        
        ctx.beginPath(); 
        ctx.moveTo(-promien*0.6, 0); ctx.lineTo(promien*0.6, 0); 
        ctx.moveTo(promien*0.3, -promien*0.5); ctx.lineTo(promien*0.3, promien*0.5); 
        ctx.moveTo(-promien*0.3, -promien*0.5); ctx.lineTo(-promien*0.3, promien*0.5); 
        ctx.stroke();
        
        if (isBoss) {
            ctx.strokeStyle = '#e74c3c'; 
            ctx.lineWidth = 2; 
            ctx.beginPath();
            ctx.moveTo(promien*0.2, -promien*0.8); 
            ctx.lineTo(promien*0.4, -promien*0.6); 
            ctx.lineTo(promien*0.2, -promien*0.4); 
            ctx.stroke();
        }
        ctx.restore();

        ctx.save(); 
        ctx.translate(bot.x | 0, bot.y | 0);
        let massPercent = Math.min(1, masa / 600);
        ctx.beginPath(); 
        ctx.arc(0, 0, promien + 6, -HALF_PI, (-HALF_PI) + (TWO_PI * massPercent));
        ctx.strokeStyle = strokeColor; 
        ctx.lineWidth = 2; 
        ctx.globalAlpha = 0.5; 
        ctx.stroke(); 
        ctx.restore();

        if (!isBoss) {
            ctx.save(); 
            ctx.translate(bot.x | 0, bot.y | 0); 
            ctx.fillStyle = strokeColor;
            ctx.font = 'bold 12px Exo 2, sans-serif'; 
            ctx.textAlign = 'center';
            let factionTag = ""; 
            if (bot.ownerId) factionTag = bot.team === 'RED' ? "[RED] " : "[BLUE] ";
            ctx.fillText(`${factionTag}${bot.name} (${Math.floor(masa)})`, 0, -promien - 15); 
            ctx.restore();
        }
    }

    function rysujPostac(postac, id, isMe) {
        if (!postac || !czyWidoczny(postac.x, postac.y, 100)) return;

        let wKrzaku = false;
        let typKrzaka = '';
        MacierzOtoczenia.forEach(k => { 
            if (RdzenFizyki.szybkiDystans(postac.x - k.x, postac.y - k.y) < k.r * k.r) {
                wKrzaku = true; 
                typKrzaka = k.typ;
            }
        });
        
        if (wKrzaku && !isMe) {
            ctx.fillStyle = '#fff'; 
            ctx.beginPath(); 
            ctx.arc(postac.x - 5, postac.y, 3, 0, TWO_PI); 
            ctx.arc(postac.x + 5, postac.y, 3, 0, TWO_PI); 
            ctx.fill();
            return;
        }

        let masa = Math.max(10, postac.score || 10);
        let obliczonyPromien = 20 + Math.sqrt(masa) * 2;
        let promien = Math.min(obliczonyPromien, 65); 
        
        let idleData = poprzedniePozycje.players[id] ? poprzedniePozycje.players[id].idleTime : 0;
        if (idleData > 10) {
            promien += Math.sin(Date.now() / 200) * 2; 
        }

        let skin = postac.skin || 'standard';
        let currentTime = Date.now();
        let kolorWiodacy = skin === 'ninja' ? '#9b59b6' : (skin === 'arystokrata' ? '#f1c40f' : '#e74c3c');
        if (postac.team) {
            kolorWiodacy = postac.team === 'RED' ? '#e74c3c' : '#3498db';
        }

        let wektorRuchu = (postac.dx * postac.dx) + (postac.dy * postac.dy); 
        if (wektorRuchu > 25 && Math.random() > 0.8) {
            generujSladButa(postac.x, postac.y, postac.kat || 0);
        }
        
        if (wektorRuchu > 100 && Math.random() > 0.5) {
            wstrzyknijEfektWalki('tarcie_powietrza', postac.x + (Math.random()*promien - promien/2), postac.y + (Math.random()*promien - promien/2));
        }
        
        if (masa < 50 && isMe && wektorRuchu > 10 && Math.random() > 0.8) {
            wstrzyknijEfektWalki('pot_strachu', postac.x + (Math.random()*20-10), postac.y - promien, {vy: 2, zycie: 0.5});
        }

        let tier = masa >= 600 ? 3 : (masa >= 150 ? 2 : (masa >= 50 ? 1 : 0));
        if (poziomyEwolucji[id] !== undefined && poziomyEwolucji[id] < tier) {
            faleUderzeniowe.push({ x: postac.x, y: postac.y, r: promien, maxR: promien * 3, zycie: 1.0, kolor: '#fff' });
        }
        poziomyEwolucji[id] = tier;

        if (!czasWejsciaGraczy[id]) czasWejsciaGraczy[id] = currentTime;
        let czasOdWejscia = currentTime - czasWejsciaGraczy[id];

        ctx.save(); 
        if (wKrzaku && isMe) ctx.globalAlpha = 0.4; 

        let czyZglitchowany = isMe && wstrzasEkranu.moc > 5;

        if (czasOdWejscia < 1200) {
            let op = 1 - (czasOdWejscia / 1200);
            ctx.save(); 
            ctx.translate(postac.x | 0, postac.y | 0);
            ctx.fillStyle = `rgba(52, 152, 219, ${op * 0.6})`; 
            ctx.fillRect(-promien, -screenH, promien*2, screenH);
            ctx.strokeStyle = `rgba(52, 152, 219, ${op})`; 
            ctx.lineWidth = 15 * op;
            ctx.beginPath(); 
            ctx.arc(0, 0, promien + (czasOdWejscia * 0.3), 0, TWO_PI); 
            ctx.stroke();
            ctx.restore();
        }

        if (masa >= 150 && !wKrzaku) {
            if (!sladPostaci[id]) sladPostaci[id] = [];
            sladPostaci[id].push({x: postac.x, y: postac.y});
            if (sladPostaci[id].length > 6) sladPostaci[id].shift();
            rysujWstegeRuchu(id, promien, kolorWiodacy);
        }

        let renderGracza = (offsetX = 0, offsetY = 0, kolorNadpisany = null) => {
            ctx.save(); 
            ctx.translate((postac.x + offsetX) | 0, (postac.y + offsetY) | 0); 
            ctx.rotate(postac.kat || 0);
            
            if (kolorNadpisany) ctx.globalCompositeOperation = 'screen';
            
            let img = obrazyPostaci[skin] || obrazyPostaci['standard'];
            
            if (!kolorNadpisany) {
                ctx.save();
                ctx.scale(1, -0.4); 
                ctx.globalAlpha = 0.2;
                if (img.complete && img.naturalWidth !== 0) {
                    ctx.drawImage(img, -promien, -promien, promien * 2, promien * 2);
                } else { 
                    ctx.beginPath(); 
                    ctx.arc(0, 0, promien, 0, TWO_PI); 
                    ctx.fill(); 
                }
                ctx.restore();
            }

            if (img.complete && img.naturalWidth !== 0) {
                if (masa >= 100 && !kolorNadpisany) {
                    let cien = obliczCienKierunkowy(isMe); 
                    AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, kolorWiodacy, 15);
                    ctx.shadowOffsetX = cien.offsetX; 
                    ctx.shadowOffsetY = cien.offsetY;
                }
                
                ctx.drawImage(img, -promien, -promien, promien * 2, promien * 2);
                
                if (kolorNadpisany) {
                    ctx.fillStyle = kolorNadpisany; 
                    ctx.globalCompositeOperation = 'source-atop';
                    ctx.fillRect(-promien, -promien, promien*2, promien*2);
                }

                let pFlash = poprzedniePozycje.players[id] ? poprzedniePozycje.players[id].hitFlash : 0;
                if (pFlash > 0 && !kolorNadpisany) {
                    ctx.fillStyle = `rgba(255, 255, 255, ${pFlash})`; 
                    ctx.globalCompositeOperation = 'source-atop'; 
                    ctx.fillRect(-promien, -promien, promien*2, promien*2);
                }

                if (!kolorNadpisany && (Date.now() % 4000 < 150)) {
                    ctx.strokeStyle = '#000'; 
                    ctx.lineWidth = 3; 
                    ctx.beginPath(); 
                    ctx.moveTo(promien*0.2, -promien*0.3); 
                    ctx.lineTo(promien*0.6, -promien*0.3);
                    ctx.moveTo(promien*0.2, promien*0.3); 
                    ctx.lineTo(promien*0.6, promien*0.3); 
                    ctx.stroke();
                }

                if (!kolorNadpisany && isMe && typKrzaka === 'ser_z_dziurami') {
                    ctx.strokeStyle = '#fff'; 
                    ctx.lineWidth = 1; 
                    ctx.beginPath();
                    ctx.moveTo(promien*0.5, 0); ctx.lineTo(promien*1.2, -5); 
                    ctx.moveTo(promien*0.5, 0); ctx.lineTo(promien*1.2, 5); 
                    ctx.stroke();
                }

                if (!kolorNadpisany && masa < 50) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; 
                    ctx.lineWidth = 5; 
                    ctx.beginPath();
                    ctx.moveTo(0, -promien*0.5); ctx.lineTo(-promien*0.5, 0); 
                    ctx.moveTo(-promien*0.5, -promien*0.5); ctx.lineTo(0, 0); 
                    ctx.stroke();
                }

            } else {
                ctx.fillStyle = '#555'; 
                ctx.beginPath(); 
                ctx.arc(0, 0, promien, 0, TWO_PI); 
                ctx.fill();
            }
            AkceleratorRenderu.resetujCien(ctx);
            ctx.shadowOffsetX = 0; 
            ctx.shadowOffsetY = 0;
            ctx.restore();
        };

        if (czyZglitchowany) {
            renderGracza(-5, 0, 'rgba(255,0,0,0.7)'); 
            renderGracza(5, 0, 'rgba(0,255,255,0.7)'); 
            ctx.globalAlpha = 0.8;
        }
        renderGracza(); 

        ctx.save(); 
        ctx.translate(postac.x | 0, postac.y | 0); 
        ctx.rotate(postac.kat || 0);

        let kolorZbroi = '#3498db'; 
        if (skin === 'ninja') kolorZbroi = '#9b59b6'; 
        if (skin === 'arystokrata') kolorZbroi = '#e74c3c'; 
        
        ctx.save(); 
        ctx.translate(promien * 0.7, promien * 0.2); 
        ctx.rotate(-HALF_PI / 2); 
        
        let progresOszczepu = Math.min(1, Math.max(0, (masa - 10) / 39)); 
        let hue = Math.floor(0 + 280 * progresOszczepu); 
        let saturation = Math.floor(0 + 80 * progresOszczepu);
        let lightness = Math.floor(60 - 10 * progresOszczepu);
        let kolorOszczepu = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        
        ctx.strokeStyle = kolorOszczepu; 
        ctx.lineWidth = 4 + (2 * progresOszczepu); 
        if (progresOszczepu > 0.8) { 
            AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, kolorOszczepu, 10); 
        }
        
        ctx.beginPath(); 
        ctx.moveTo(0, -promien); 
        ctx.lineTo(0, promien); 
        ctx.stroke();
        
        ctx.fillStyle = kolorOszczepu; 
        ctx.beginPath(); 
        ctx.moveTo(-5, -promien); 
        ctx.lineTo(5, -promien); 
        ctx.lineTo(0, -promien - 15); 
        ctx.closePath(); 
        ctx.fill();
        ctx.restore();

        if (tier >= 1) {
            ctx.save(); 
            ctx.translate(-promien * 0.8, 0); 
            ctx.fillStyle = '#111'; 
            ctx.strokeStyle = kolorZbroi; 
            ctx.lineWidth = 3; 
            AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, kolorZbroi, 10);
            
            ctx.beginPath(); 
            ctx.moveTo(-10, -15); 
            ctx.lineTo(-20, 0); 
            ctx.lineTo(-10, 15); 
            ctx.lineTo(5, 0); 
            ctx.closePath(); 
            ctx.fill(); 
            ctx.stroke();
            
            if (skin === 'ninja') {
                ctx.strokeStyle = '#fff'; 
                ctx.lineWidth = 2; 
                ctx.beginPath(); 
                ctx.arc(15, -15, 6, 0, TWO_PI); 
                ctx.moveTo(10,-10); 
                ctx.lineTo(5,-5); 
                ctx.stroke();
            }

            if (tier >= 2) {
                ctx.rotate(currentTime / 500); 
                ctx.strokeStyle = `rgba(${kolorZbroi === '#3498db' ? '52,152,219' : kolorZbroi === '#9b59b6' ? '155,89,182' : '231,76,60'}, 0.6)`;
                ctx.setLineDash([5, 10]); 
                ctx.lineWidth = 4; 
                ctx.beginPath(); 
                ctx.arc(0, 0, 25, 0, TWO_PI); 
                ctx.stroke();
            }
            ctx.restore();
        }
        ctx.restore(); 

        if (tier >= 3) {
            ctx.save(); 
            ctx.translate(postac.x | 0, (postac.y - promien - 20) | 0); 
            ctx.translate(0, Math.sin(currentTime / 200) * 5); 
            ctx.fillStyle = '#f1c40f'; 
            AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, '#f1c40f', 15);
            ctx.beginPath(); 
            ctx.moveTo(-15, 0); ctx.lineTo(-20, -15); ctx.lineTo(-7, -5); ctx.lineTo(0, -20); 
            ctx.lineTo(7, -5); ctx.lineTo(20, -15); ctx.lineTo(15, 0); 
            ctx.closePath(); 
            ctx.fill(); 
            ctx.restore();
        }

        if (postac.isSafe) { 
            ctx.save(); 
            ctx.translate(postac.x | 0, postac.y | 0); 
            ctx.strokeStyle = 'rgba(46, 204, 113, 0.6)'; 
            ctx.lineWidth = 3; 
            ctx.setLineDash([10, 15]); 
            ctx.rotate(currentTime / 800); 
            AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, '#2ecc71', 15);
            ctx.beginPath(); 
            ctx.arc(0, 0, promien + 15, 0, TWO_PI); 
            ctx.stroke(); 
            ctx.restore();
        } else if (postac.isShielding) { 
            ctx.save(); 
            ctx.translate(postac.x | 0, postac.y | 0); 
            ctx.strokeStyle = 'rgba(52, 152, 219, 0.7)'; 
            ctx.lineWidth = 4; 
            ctx.beginPath(); 
            ctx.arc(0, 0, promien + 15, 0, TWO_PI); 
            ctx.stroke(); 
            ctx.restore();
        }

        ctx.save(); 
        ctx.translate(postac.x | 0, postac.y | 0);
        let massPercent = Math.min(1, masa / 600);
        ctx.beginPath(); 
        ctx.arc(0, 0, promien + 6, -HALF_PI, (-HALF_PI) + (TWO_PI * massPercent));
        ctx.strokeStyle = (postac.team === 'RED') ? '#e74c3c' : ((postac.team === 'BLUE') ? '#3498db' : '#f1c40f');
        ctx.lineWidth = 3; 
        ctx.globalAlpha = 0.8; 
        ctx.stroke(); 
        ctx.restore();

        ctx.save();
        if (wKrzaku && isMe) ctx.globalAlpha = 0.4;
        ctx.translate(postac.x | 0, postac.y | 0); 
        ctx.fillStyle = '#ffffff'; 
        ctx.font = 'bold 14px Exo 2, sans-serif'; 
        ctx.textAlign = 'center';
        
        let prefix = masa >= 1000 ? "👑 " : "";
        ctx.fillText(`${prefix}${postac.name || 'Gracz'} (${Math.floor(masa)})`, 0, promien + 25 + (masa >= 600 ? 5 : 0));
        ctx.restore();
    }

    function rysujEfektyHUD(tryb, stanSerwera, mojGracz, limitWielkosci) {
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
        
        if (wstrzasEkranu.moc > 5 || (mojGracz.score > 200 && Math.abs(Math.sin(Date.now() / 100)) > 0.8)) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; 
            ctx.lineWidth = 2; 
            ctx.beginPath();
            
            for(let i=0; i<30; i++) {
                let angle = Math.random() * TWO_PI; 
                let length = Math.random() * 150 + 50;
                let startR = Math.min(screenW, screenH) / 2; 
                let endR = startR + length;
                ctx.moveTo(screenW/2 + Math.cos(angle)*startR, screenH/2 + Math.sin(angle)*startR); 
                ctx.lineTo(screenW/2 + Math.cos(angle)*endR, screenH/2 + Math.sin(angle)*endR);
            }
            ctx.stroke();
        }

        let dystX = Math.min(mojGracz.x, limitWielkosci - mojGracz.x);
        let dystY = Math.min(mojGracz.y, limitWielkosci - mojGracz.y);
        let odlegloscOdKrawedzi = Math.min(dystX, dystY);
        
        if (odlegloscOdKrawedzi < 600) {
            let intensywnosc = 1 - (odlegloscOdKrawedzi / 600);
            let pX = (mojGracz.x < 600) ? 0 : (mojGracz.x > limitWielkosci - 600) ? screenW : screenW/2;
            let pY = (mojGracz.y < 600) ? 0 : (mojGracz.y > limitWielkosci - 600) ? screenH : screenH/2;
            let grad = ctx.createRadialGradient(pX, pY, screenH/2, pX, pY, screenW);
            
            grad.addColorStop(0, 'rgba(0,0,0,0)'); 
            grad.addColorStop(1, `rgba(231, 76, 60, ${intensywnosc * 0.8})`);
            ctx.fillStyle = grad; 
            ctx.fillRect(0, 0, screenW, screenH);
        }

        if (tryb === 'TEAMS' && mojGracz.team) {
            let gradient = ctx.createRadialGradient(screenW/2, screenH/2, screenH/1.5, screenW/2, screenH/2, screenW);
            let teamColor = mojGracz.team === 'RED' ? 'rgba(231, 76, 60, 0.2)' : 'rgba(52, 152, 219, 0.2)';
            
            gradient.addColorStop(0, 'rgba(0,0,0,0)'); 
            gradient.addColorStop(1, teamColor);
            ctx.fillStyle = gradient; 
            ctx.fillRect(0, 0, screenW, screenH);
        } else if (tryb === 'CAMPAIGN') {
            let masaDoŚwiatła = Math.max(10, mojGracz.score || 10);
            let promienSwiatla = 250 + Math.sqrt(masaDoŚwiatła) * 8; 
            let gradient = ctx.createRadialGradient(screenW/2, screenH/2, promienSwiatla * 0.4, screenW/2, screenH/2, promienSwiatla);
            
            gradient.addColorStop(0, 'rgba(0,0,0,0)'); 
            gradient.addColorStop(1, 'rgba(5,5,5,0.96)'); 
            ctx.fillStyle = gradient; 
            ctx.fillRect(0, 0, screenW, screenH);
            
            ctx.beginPath(); 
            ctx.rect(0, 0, screenW, screenH); 
            ctx.arc(screenW/2, screenH/2, promienSwiatla, 0, TWO_PI, true); 
            ctx.fillStyle = 'rgba(5,5,5,0.96)'; 
            ctx.fill();

            let bossAlive = null;
            if (stanSerwera.bots) { 
                Object.values(stanSerwera.bots).forEach(b => { 
                    if (b.isBoss || b.skin === 'ninja') bossAlive = b; 
                }); 
            }
            
            if (bossAlive) {
                let alarmAlpha = Math.abs(Math.sin(Date.now() / 300)) * 0.2;
                ctx.fillStyle = `rgba(231, 76, 60, ${alarmAlpha})`; 
                ctx.fillRect(0, 0, screenW, screenH);

                let barW = Math.min(screenW * 0.7, 800); 
                let barH = 22; 
                let barX = (screenW - barW) / 2; 
                let barY = 50;
                let maxBossHp = bossAlive.maxScore || 1500; 
                let hpPercent = Math.max(0, bossAlive.score / maxBossHp);
                
                ctx.fillStyle = 'rgba(15, 0, 0, 0.8)'; 
                ctx.fillRect(barX, barY, barW, barH);
                ctx.strokeStyle = '#333'; 
                ctx.lineWidth = 3; 
                ctx.strokeRect(barX, barY, barW, barH);
                
                ctx.fillStyle = '#e74c3c';
                AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, '#e74c3c', 20);
                ctx.fillRect(barX, barY, barW * hpPercent, barH); 
                AkceleratorRenderu.resetujCien(ctx);

                ctx.fillStyle = '#fff'; 
                ctx.font = 'bold 22px Permanent Marker, sans-serif'; 
                ctx.textAlign = 'center';
                ctx.fillText(`TYTAN OMEGA`, screenW / 2, barY - 12);
            }
        }

        wskaznikiOffscreen.forEach(b => {
            let angle = Math.atan2(b.y - mojGracz.y, b.x - mojGracz.x);
            let dist = Math.min(screenW, screenH) / 2 - 40; 
            let px = screenW/2 + Math.cos(angle) * dist;
            let py = screenH/2 + Math.sin(angle) * dist;
            
            ctx.save(); 
            ctx.translate(px, py); 
            ctx.rotate(angle);
            ctx.fillStyle = `rgba(231, 76, 60, ${0.4 + Math.abs(Math.sin(Date.now()/150)) * 0.6})`;
            AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, '#e74c3c', 15);
            ctx.beginPath(); 
            ctx.moveTo(20, 0); 
            ctx.lineTo(-15, 15); 
            ctx.lineTo(-15, -15); 
            ctx.closePath(); 
            ctx.fill();
            ctx.restore();
        });

        if (StanKlimatu.kinowePasy > 0) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, screenW, StanKlimatu.kinowePasy); 
            ctx.fillRect(0, screenH - StanKlimatu.kinowePasy, screenW, StanKlimatu.kinowePasy); 
        }

        let vinGrad = ctx.createRadialGradient(screenW/2, screenH/2, screenH * 0.5, screenW/2, screenH/2, screenW * 0.8);
        vinGrad.addColorStop(0, 'rgba(0,0,0,0)'); 
        vinGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = vinGrad; 
        ctx.fillRect(0, 0, screenW, screenH);

        ctx.restore();
    }

    function rysujMapeTaktyczna(stanSerwera, mojGracz, limitWielkosci, czyMala = true) {
        ctx.save();
        let mapSize = czyMala ? 160 : Math.min(screenW, screenH) * 0.7;
        let startX = czyMala ? screenW - mapSize - 20 : (screenW - mapSize) / 2;
        let startY = czyMala ? 20 : (screenH - mapSize) / 2;
        let scale = mapSize / limitWielkosci;

        ctx.fillStyle = 'rgba(10, 10, 15, 0.85)'; 
        ctx.strokeStyle = czyMala ? '#3498db' : '#f1c40f'; 
        ctx.lineWidth = 2;
        ctx.fillRect(startX, startY, mapSize, mapSize); 
        ctx.strokeRect(startX, startY, mapSize, mapSize);

        ctx.drawImage(minimapCanvas, startX, startY, mapSize, mapSize);

        function rysujKropke(x, y, kolor, promienKropki) {
            ctx.fillStyle = kolor; 
            ctx.beginPath(); 
            ctx.arc(startX + (x * scale), startY + (y * scale), promienKropki, 0, TWO_PI); 
            ctx.fill();
        }

        if (stanSerwera.bots) {
            Object.values(stanSerwera.bots).forEach(b => { 
                rysujKropke(b.x, b.y, b.skin === 'ninja' ? '#9b59b6' : '#e74c3c', czyMala ? 1 : 2); 
            });
        }
        
        if (stanSerwera.players) {
            Object.values(stanSerwera.players).forEach(p => {
                if (p.id !== mojGracz.id) {
                    let kolorGracza = '#95a5a6'; 
                    if (window.Flagi && window.Flagi.Stan.wybranyTryb === 'TEAMS') {
                        kolorGracza = p.team === 'RED' ? '#e74c3c' : '#3498db';
                    }
                    rysujKropke(p.x, p.y, kolorGracza, czyMala ? 2 : 4);
                }
            });
        }

        let puls = 2 + Math.abs(Math.sin(Date.now() / 300)) * 2;
        rysujKropke(mojGracz.x, mojGracz.y, '#ffffff', czyMala ? puls : puls * 2);

        if (!czyMala) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; 
            ctx.lineWidth = 1;
            ctx.beginPath(); 
            ctx.arc(startX + (mojGracz.x * scale), startY + (mojGracz.y * scale), 300 * scale, 0, TWO_PI); 
            ctx.stroke();
            ctx.fillStyle = '#fff'; 
            ctx.font = 'bold 24px Exo 2, sans-serif'; 
            ctx.textAlign = 'center';
            ctx.fillText("MAPA TAKTYCZNA", startX + mapSize/2, startY - 20);
        }
        ctx.restore();
    }

    // ==========================================
    // ⚙️ GŁÓWNA PĘTLA RENDERUJĄCA KLATKĘ
    // ==========================================
    return {
        wywolajWstrzas: function(moc) { 
            wstrzasEkranu.moc = moc; 
        },
        
        rysujKlatke: function(stanSerwera, mojGracz) {
            if (!stanSerwera || !mojGracz) return;

            let now = performance.now();
            let dt = (now - lastTime) / 16.666; 
            lastTime = now;
            if (dt > 3) dt = 3; 

            if (dt > 1.5) { 
                lagFramesCounter += dt; 
            } else { 
                lagFramesCounter = Math.max(0, lagFramesCounter - dt * 0.5); 
            }
            
            if (lagFramesCounter > 120 && !ecoModeActive) { 
                ecoModeActive = true; 
                resize(); 
            }

            let docelowaKameraX = mojGracz.x - screenW / 2;
            let docelowaKameraY = mojGracz.y - screenH / 2;
            
            if (RdzenFizyki.szybkiDystans(docelowaKameraX - camera.x, docelowaKameraY - camera.y) > 1000000) {
                camera.x = docelowaKameraX; 
                camera.y = docelowaKameraY;
            } else {
                camera.x += (docelowaKameraX - camera.x) * (0.1 * dt); 
                camera.y += (docelowaKameraY - camera.y) * (0.1 * dt);
            }

            let masaDoZooma = Math.max(10, mojGracz.score);
            let docelowaSkala = Math.max(0.4, 1.15 - Math.sqrt(masaDoZooma) * 0.015);
            cameraScale += (docelowaSkala - cameraScale) * (0.05 * dt);

            let drawCamX = camera.x; 
            let drawCamY = camera.y;

            if (wstrzasEkranu.moc > 0.5) {
                drawCamX += (Math.random() - 0.5) * wstrzasEkranu.moc; 
                drawCamY += (Math.random() - 0.5) * wstrzasEkranu.moc;
                wstrzasEkranu.moc *= Math.pow(wstrzasEkranu.wygasanie, dt);
            }
            
            let tryb = (window.Flagi && window.Flagi.Stan.wybranyTryb) ? window.Flagi.Stan.wybranyTryb : 'FREE';
            let limitWielkosci = tryb === 'TEAMS' ? 6000 : 4000;

            if (!czyMapaWygenerowana) {
                generujSrodowisko(tryb, limitWielkosci);
            }

            ZarzadcaPamieci.wyczyscPamiecCoRunde();

            let isBossActive = false;
            if (stanSerwera.bots) {
                Object.values(stanSerwera.bots).forEach(b => { 
                    if (b.isBoss || b.skin === 'ninja') {
                        isBossActive = true; 
                    }
                });
            }
            
            if (isBossActive) {
                StanKlimatu.kinowePasy += (80 - StanKlimatu.kinowePasy) * 0.05 * dt;
                StanKlimatu.intensywnoscDeszczu += (1.0 - StanKlimatu.intensywnoscDeszczu) * 0.05 * dt;
            } else {
                StanKlimatu.kinowePasy += (0 - StanKlimatu.kinowePasy) * 0.05 * dt;
                StanKlimatu.intensywnoscDeszczu += (0 - StanKlimatu.intensywnoscDeszczu) * 0.05 * dt;
            }

            if (mojGracz.x < 100) StanKlimatu.gniecieGranicy.lewa = -50;
            if (mojGracz.x > limitWielkosci - 100) StanKlimatu.gniecieGranicy.prawa = -50;
            if (mojGracz.y < 100) StanKlimatu.gniecieGranicy.gora = -50;
            if (mojGracz.y > limitWielkosci - 100) StanKlimatu.gniecieGranicy.dol = -50;

            ctx.save(); 
            ctx.translate(screenW / 2, screenH / 2);
            ctx.scale(cameraScale, cameraScale);
            ctx.translate(-screenW / 2, -screenH / 2);
            ctx.translate(-drawCamX, -drawCamY);

            rysujMape(tryb, limitWielkosci, stanSerwera, dt);

            // LOGIKA ŚLEDZENIA ZMIAN GRACZY
            let nowePlayers = {};
            if (stanSerwera.players) {
                Object.keys(stanSerwera.players).forEach(id => {
                    let n = stanSerwera.players[id];
                    let oldP = poprzedniePozycje.players[id];
                    
                    let idle = oldP ? (oldP.idleTime || 0) : 0;
                    let flash = oldP ? (oldP.hitFlash || 0) : 0;
                    
                    if (oldP && RdzenFizyki.szybkiDystans(oldP.x - n.x, oldP.y - n.y) < 4) {
                        idle += dt; 
                    } else {
                        idle = 0;
                    }
                    
                    if (oldP && n.score < oldP.score) {
                        flash = 1.0;
                        if (id === mojGracz.id) {
                            generujWybuch(n.x, n.y, '#e74c3c', 20); 
                            if (Math.random() > 0.5) wstrzyknijEfektWalki('roztrzaskane_szklo', n.x, n.y, {zycie: 0.5});
                        }
                        wstrzyknijEfektWalki('komiksowy_napis', n.x, n.y, {tekst: ['BAM!','ZAP!','KAPOW!'][Math.floor(Math.random()*3)], zycie: 0.8, vy: -1});
                        if (n.score < 50 && Math.random() > 0.5) {
                            wstrzyknijEfektWalki('odpadajacy_pancerz', n.x, n.y, {vx: (Math.random()-0.5)*5, vy: -5, zycie: 2.0});
                        }
                        if (id === mojGracz.id) {
                            wstrzyknijEfektWalki('dym_z_lufy', n.x, n.y - 20, {zycie: 1.0});
                        }
                    }
                    
                    if (flash > 0) flash -= 0.1 * dt;

                    if (idle > 120 && Math.random() > 0.95) {
                        efektyChrapania.push({x: n.x + 15, y: n.y - 30, zycie: 1.0, rozmiar: Math.random() * 10});
                    }

                    nowePlayers[id] = {
                        x: n.x, y: n.y, score: n.score, idleTime: idle, hitFlash: Math.max(0, flash)
                    };

                    if (oldP && n.score - oldP.score !== 0) {
                        dodajPowiadomienie(n.x, n.y, n.score - oldP.score);
                    }
                });
                
                Object.keys(poprzedniePozycje.players).forEach(id => {
                    if (!stanSerwera.players[id] && id !== mojGracz.id) {
                        generujWybuch(poprzedniePozycje.players[id].x, poprzedniePozycje.players[id].y, '#e74c3c', 40);
                        wstrzyknijEfektWalki('obrys_kreda', poprzedniePozycje.players[id].x, poprzedniePozycje.players[id].y, {zycie: 10.0, kat: Math.random() * TWO_PI});
                        wstrzyknijEfektWalki('duszek_do_nieba', poprzedniePozycje.players[id].x, poprzedniePozycje.players[id].y, {vy: -2, zycie: 3.0});
                        wstrzyknijEfektWalki('nagrobek_rip', poprzedniePozycje.players[id].x, poprzedniePozycje.players[id].y, {zycie: 5.0});
                    }
                });
                
                poprzedniePozycje.players = nowePlayers;
            }

            let noweBots = {};
            if (stanSerwera.bots) {
                Object.keys(stanSerwera.bots).forEach(id => {
                    let n = stanSerwera.bots[id];
                    let oldB = poprzedniePozycje.bots[id];
                    
                    let idle = oldB ? (oldB.idleTime || 0) : 0;
                    let flash = oldB ? (oldB.hitFlash || 0) : 0;
                    
                    if (oldB && RdzenFizyki.szybkiDystans(oldB.x - n.x, oldB.y - n.y) < 4) {
                        idle += dt; 
                    } else {
                        idle = 0;
                    }
                    
                    if (oldB && n.score < oldB.score) {
                        flash = 1.0;
                        wstrzyknijEfektWalki('komiksowy_napis', n.x, n.y, {tekst: ['BAM!','ZAP!','KAPOW!'][Math.floor(Math.random()*3)], zycie: 0.8, vy: -1});
                    }
                    
                    if (flash > 0) flash -= 0.1 * dt;

                    if (idle > 120 && Math.random() > 0.95) {
                        efektyChrapania.push({x: n.x + 15, y: n.y - 30, zycie: 1.0, rozmiar: Math.random() * 10});
                    }

                    noweBots[id] = {
                        x: n.x, y: n.y, score: n.score, idleTime: idle, hitFlash: Math.max(0, flash), isBoss: n.isBoss || n.skin === 'ninja' 
                    };

                    if (oldB && n.score - oldB.score !== 0) {
                        dodajPowiadomienie(n.x, n.y, n.score - oldB.score);
                    }
                });
                
                Object.keys(poprzedniePozycje.bots).forEach(id => {
                    if (!stanSerwera.bots[id]) {
                        generujWybuch(poprzedniePozycje.bots[id].x, poprzedniePozycje.bots[id].y, poprzedniePozycje.bots[id].isBoss ? '#9b59b6' : '#e74c3c', 25);
                        wstrzyknijEfektWalki('dymek_czaszka', poprzedniePozycje.bots[id].x, poprzedniePozycje.bots[id].y, {vy: -1, zycie: 2.0});
                        for(let s = 0; s < 5; s++) {
                            wstrzyknijEfektWalki('wylatujace_srubki', poprzedniePozycje.bots[id].x, poprzedniePozycje.bots[id].y, {vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, zycie: 2.0});
                        }
                    }
                });
                
                poprzedniePozycje.bots = noweBots;
            }

            if (stanSerwera.foods) {
                lokalnyBuforJedzenia = window.Guardian ? window.Guardian.safeObj(stanSerwera.foods, 'foods') : stanSerwera.foods;
            }
            
            // SYSTEM ZAAWANSOWANEGO JEDZENIA
            Object.values(lokalnyBuforJedzenia).forEach(f => {
                if (!czyWidoczny(f.x, f.y, 10)) return;
                
                ctx.save(); 
                ctx.translate(AkceleratorRenderu.optymalizujPozycje(f.x), AkceleratorRenderu.optymalizujPozycje(f.y));
                
                let oscylacja = Math.sin(now / 200 + f.x) * 2;
                let typJedzenia = Math.floor(Math.abs(f.x + f.y)) % 10;
                
                switch(typJedzenia) {
                    case 0: 
                        ctx.strokeStyle = '#fd79a8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, oscylacja, 6, 0, TWO_PI); ctx.stroke(); 
                        break;
                    case 1: 
                        ctx.fillStyle = '#34495e'; ctx.fillRect(-4, oscylacja-6, 8, 12); ctx.fillStyle = '#f1c40f'; ctx.fillRect(-4, oscylacja-6, 8, 4); ctx.fillStyle = '#bdc3c7'; ctx.fillRect(-2, oscylacja-8, 4, 2); 
                        break;
                    case 2: 
                        ctx.fillStyle = '#95a5a6'; ctx.beginPath(); ctx.arc(0, oscylacja, 5, 0, TWO_PI); ctx.fill(); ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.arc(0, oscylacja, 2, 0, TWO_PI); ctx.fill(); 
                        break;
                    case 3: 
                        ctx.strokeStyle = '#ecf0f1'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-5, oscylacja-5); ctx.lineTo(0, oscylacja+2); ctx.lineTo(5, oscylacja-5); ctx.stroke(); ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(0, oscylacja-3, 2, 0, TWO_PI); ctx.fill(); 
                        break;
                    case 4: 
                        ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.moveTo(0, oscylacja-4); ctx.lineTo(-4, oscylacja+4); ctx.lineTo(4, oscylacja+4); ctx.closePath(); ctx.fill(); 
                        break;
                    case 5: 
                        ctx.fillStyle = `rgba(46, 204, 113, ${0.5 + Math.abs(oscylacja)/4})`; 
                        AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, '#2ecc71', 10);
                        ctx.fillRect(-4, oscylacja-4, 8, 8); 
                        AkceleratorRenderu.resetujCien(ctx);
                        break;
                    case 6: 
                        ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(-2, oscylacja, 3, 0, TWO_PI); ctx.arc(2, oscylacja, 3, 0, TWO_PI); ctx.fill(); ctx.fillRect(-4, oscylacja-4, 8, 4); 
                        break;
                    case 7: 
                        ctx.fillStyle = '#2ecc71'; ctx.rotate(oscylacja*0.2); ctx.fillRect(-6, -3, 12, 6); ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, TWO_PI); ctx.fill(); 
                        break;
                    default: 
                        let r = 5 + oscylacja/2; ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(0, 0, Math.max(2, r), 0, TWO_PI); ctx.fill(); 
                        break;
                }
                ctx.restore();
            });

            aktualizujEfektyZniszczen(dt);

            if (stanSerwera.projectiles) {
                let bezpiecznePociski = window.Guardian ? window.Guardian.safeObj(stanSerwera.projectiles, 'projectiles') : stanSerwera.projectiles;
                Object.values(bezpiecznePociski).forEach(proj => {
                    if (czyWidoczny(proj.x, proj.y, 30)) {
                        ctx.save(); 
                        ctx.translate(AkceleratorRenderu.optymalizujPozycje(proj.x), AkceleratorRenderu.optymalizujPozycje(proj.y)); 
                        ctx.rotate(Math.atan2(proj.dy, proj.dx));
                        
                        if (proj.type === 'oszczep') {
                            let kolorOszczepu = proj.piercing ? '#9b59b6' : '#bdc3c7'; 
                            if (proj.mode === 'TEAMS') kolorOszczepu = proj.team === 'RED' ? '#e74c3c' : '#3498db';
                            
                            wstrzyknijEfektWalki('iskra_lontu', proj.x - 20, proj.y, {zycie: 0.5});
                            AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, kolorOszczepu, 15);
                            
                            ctx.strokeStyle = '#555'; 
                            ctx.lineWidth = 3; 
                            ctx.beginPath(); 
                            ctx.moveTo(-20, 0); 
                            ctx.lineTo(10, 0); 
                            ctx.stroke();
                            
                            ctx.fillStyle = kolorOszczepu; 
                            ctx.beginPath(); 
                            ctx.moveTo(10, -5); 
                            ctx.lineTo(25, 0); 
                            ctx.lineTo(10, 5); 
                            ctx.closePath(); 
                            ctx.fill();
                            
                            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; 
                            ctx.beginPath(); 
                            ctx.arc(-20, 0, 2, 0, TWO_PI); 
                            ctx.fill();

                        } else if (proj.type === 'laser') {
                            let kolorLasera = proj.team === 'BOSS' ? '#e74c3c' : '#f1c40f';
                            wstrzyknijEfektWalki('spiralny_dym', proj.x, proj.y, {zycie: 0.8});

                            AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, kolorLasera, 15);
                            ctx.strokeStyle = kolorLasera; 
                            ctx.lineWidth = 5; 
                            ctx.lineCap = 'round';
                            ctx.beginPath(); 
                            ctx.moveTo(-15, 0); 
                            ctx.lineTo(15, 0); 
                            ctx.stroke();
                        } else {
                            ctx.fillStyle = proj.piercing ? '#3498db' : '#bdc3c7';
                            AkceleratorRenderu.ustawCienNaMocnychSprzetach(ctx, ctx.fillStyle, 10);
                            ctx.beginPath(); 
                            ctx.moveTo(15, 0); 
                            ctx.lineTo(-10, 5); 
                            ctx.lineTo(-10, -5); 
                            ctx.closePath(); 
                            ctx.fill();
                        }
                        AkceleratorRenderu.resetujCien(ctx);
                        ctx.restore();
                    }
                });
            }

            if (stanSerwera.bots) {
                Object.values(stanSerwera.bots).forEach(bot => rysujBota(bot));
            }
            if (stanSerwera.players) {
                Object.keys(stanSerwera.players).forEach(id => { 
                    if (id !== mojGracz.id) rysujPostac(stanSerwera.players[id], id, false); 
                });
            }

            rysujPostac(mojGracz, mojGracz.id, true);

            // 🚀 RENDERER SILNIKA 2 (Efekty Chwilowe)
            rysujKolejkeEfektow_SILNIK2(dt);
            
            aktualizujEfektyTekstowe(dt);

            ctx.restore(); 

            rysujEfektyHUD(tryb, stanSerwera, mojGracz, limitWielkosci);

            if (pokazDuzaMape) {
                rysujMapeTaktyczna(stanSerwera, mojGracz, limitWielkosci, false);
            } else {
                rysujMapeTaktyczna(stanSerwera, mojGracz, limitWielkosci, true);
            }

            // GAME JUICE: Dynamiczny Celownik
            ctx.save();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.strokeStyle = '#2ecc71'; 
            ctx.lineWidth = 2;
            
            let wektorRuchuMoje = RdzenFizyki.szybkiDystans(mojGracz.dx, mojGracz.dy);
            let cr = 8 + (wektorRuchuMoje > 25 ? 8 : 0); 
            
            ctx.beginPath();
            ctx.moveTo(pozycjaMyszki.x - cr - 5, pozycjaMyszki.y); 
            ctx.lineTo(pozycjaMyszki.x - 3, pozycjaMyszki.y);
            ctx.moveTo(pozycjaMyszki.x + cr + 5, pozycjaMyszki.y); 
            ctx.lineTo(pozycjaMyszki.x + 3, pozycjaMyszki.y);
            ctx.moveTo(pozycjaMyszki.x, pozycjaMyszki.y - cr - 5); 
            ctx.lineTo(pozycjaMyszki.x, pozycjaMyszki.y - 3);
            ctx.moveTo(pozycjaMyszki.x, pozycjaMyszki.y + cr + 5); 
            ctx.lineTo(pozycjaMyszki.x, pozycjaMyszki.y + 3);
            ctx.stroke();
            
            ctx.fillStyle = '#e74c3c'; 
            ctx.fillRect(pozycjaMyszki.x - 1, pozycjaMyszki.y - 1, 3, 3);
            ctx.restore();
        }
    };
})();