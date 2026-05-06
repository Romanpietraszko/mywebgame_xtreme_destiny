// ==========================================
// GRAFIKA.JS - Ustabilizowany Silnik Renderujący (Faza 7: LERP + Głębia 2.5D na stabilnym kodzie)
// ==========================================

window.Grafika = (function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d', { alpha: false }); 
    
    // ==========================================
    // ⚙️ FILAR 1: ZARZĄDCA PAMIĘCI
    // ==========================================
    const ZarzadcaPamieci = {
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
            return null; 
        },

        wyczyscPamiecCoRunde: function() {
            wskaznikiOffscreen.length = 0;
        }
    };

    // ==========================================
    // ⚙️ FILAR 2: AKCELERATOR RENDERU
    // ==========================================
    const AkceleratorRenderu = {
        optymalizujPozycje: function(wartosc) { return wartosc | 0; },
        wylaczWygladzanie: function(context) { context.imageSmoothingEnabled = false; },
        ustawCien: function(context, kolor, blur = 15) {
            if (!ecoModeActive) { context.shadowBlur = blur; context.shadowColor = kolor; }
        },
        resetujCien: function(context) { context.shadowBlur = 0; }
    };

    // ==========================================
    // ⚙️ FILAR 4: FABRYKA PIECZĄTEK (Zrzut do Offscreen Canvas)
    // ==========================================
    const FabrykaPieczatek = {
        zamekFree: document.createElement('canvas'),
        bazaRed: document.createElement('canvas'),
        bazaBlue: document.createElement('canvas'),
        reaktorTeams: document.createElement('canvas'),
        kraterCampaign: document.createElement('canvas'),
        gotowe: false,

        generujWszystko: function() {
            if (this.gotowe) return;
            this.generujZamekFree();
            this.generujBazyTeams();
            this.generujReaktor();
            this.generujKrater();
            this.gotowe = true;
        },

        generujZamekFree: function() {
            this.zamekFree.width = 800; this.zamekFree.height = 800;
            let zCtx = this.zamekFree.getContext('2d');
            const sr = 400;

            zCtx.beginPath(); zCtx.arc(sr, sr, 320, 0, Math.PI * 2); 
            zCtx.fillStyle = 'rgba(52, 152, 219, 0.3)'; zCtx.fill();
            zCtx.lineWidth = 4; zCtx.strokeStyle = '#3498db';
            zCtx.shadowBlur = 20; zCtx.shadowColor = '#3498db'; zCtx.stroke(); zCtx.shadowBlur = 0;

            zCtx.fillStyle = '#7f8c8d'; zCtx.fillRect(sr - 50, sr + 20, 100, 300);
            zCtx.strokeStyle = '#fff'; zCtx.lineWidth = 2; zCtx.strokeRect(sr - 50, sr + 20, 100, 300);
            zCtx.fillStyle = '#34495e'; zCtx.fillRect(sr - 60, sr - 80, 120, 180);

            zCtx.shadowBlur = 20; zCtx.shadowColor = '#000';
            zCtx.fillStyle = '#95a5a6'; zCtx.strokeStyle = '#f1c40f'; zCtx.lineWidth = 4;
            zCtx.fillRect(sr - 150, sr - 100, 300, 200); zCtx.strokeRect(sr - 150, sr - 100, 300, 200);
            
            zCtx.fillStyle = '#7f8c8d';
            for(let i = 0; i < 7; i++) { zCtx.fillRect(sr - 140 + (i * 42), sr + 80, 20, 20); }

            zCtx.beginPath(); zCtx.moveTo(sr - 180, sr - 100); zCtx.lineTo(sr + 180, sr - 100); zCtx.lineTo(sr, sr - 250); zCtx.closePath(); 
            zCtx.fillStyle = '#e74c3c'; zCtx.fill(); zCtx.stroke();
            
            const pozycjeWiez = [{x: sr-150, y: sr-100}, {x: sr+150, y: sr-100}, {x: sr-150, y: sr+100}, {x: sr+150, y: sr+100}];
            pozycjeWiez.forEach(poz => {
                zCtx.beginPath(); zCtx.arc(poz.x, poz.y, 45, 0, Math.PI * 2); zCtx.fillStyle = '#7f8c8d'; zCtx.fill(); zCtx.stroke();
                zCtx.beginPath(); zCtx.arc(poz.x, poz.y, 35, 0, Math.PI * 2); zCtx.fillStyle = '#c0392b'; zCtx.fill(); zCtx.stroke();
                zCtx.beginPath(); zCtx.arc(poz.x, poz.y, 8, 0, Math.PI * 2); zCtx.fillStyle = '#f1c40f'; zCtx.fill();
            });

            zCtx.fillStyle = '#050505'; zCtx.fillRect(sr - 60, sr + 20, 120, 80); 
            zCtx.strokeStyle = '#f1c40f'; zCtx.strokeRect(sr - 60, sr + 20, 120, 80);
        },

        generujBazyTeams: function() {
            const drawBase = (canvasObj, mainColor, glowColor) => {
                canvasObj.width = 800; canvasObj.height = 800;
                let c = canvasObj.getContext('2d');
                c.fillStyle = `rgba(${mainColor}, 0.15)`; c.beginPath(); c.arc(400, 400, 380, 0, Math.PI*2); c.fill();
                c.lineWidth = 6; c.strokeStyle = glowColor; c.shadowBlur = 20; c.shadowColor = glowColor; c.stroke(); c.shadowBlur = 0;
                c.strokeStyle = 'rgba(255, 255, 255, 0.05)'; c.lineWidth = 2;
                for(let i=0; i<800; i+=40) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 800); c.moveTo(0, i); c.lineTo(800, i); c.stroke(); }
                c.fillStyle = '#111'; c.beginPath(); c.arc(400, 400, 100, 0, Math.PI*2); c.fill();
                c.strokeStyle = glowColor; c.stroke();
            };
            drawBase(this.bazaRed, '231, 76, 60', '#e74c3c');
            drawBase(this.bazaBlue, '52, 152, 219', '#3498db');
        },

        generujReaktor: function() {
            this.reaktorTeams.width = 600; this.reaktorTeams.height = 600;
            let rx = this.reaktorTeams.getContext('2d');
            rx.fillStyle = '#111'; rx.beginPath(); rx.arc(300, 300, 250, 0, Math.PI*2); rx.fill();
            rx.lineWidth = 10; rx.strokeStyle = '#f1c40f'; rx.stroke();
            rx.fillStyle = 'rgba(46, 204, 113, 0.1)'; rx.beginPath(); rx.arc(300, 300, 200, 0, Math.PI*2); rx.fill();
            rx.save(); rx.translate(300, 300); rx.rotate(Math.PI/4);
            rx.fillStyle = '#f1c40f'; rx.fillRect(-80, -80, 160, 160);
            rx.fillStyle = '#000'; for(let i=-80; i<80; i+=40) rx.fillRect(i, -80, 20, 160);
            rx.restore();
        },

        generujKrater: function() {
            this.kraterCampaign.width = 1200; this.kraterCampaign.height = 1200;
            let kCtx = this.kraterCampaign.getContext('2d');
            let kGrad = kCtx.createRadialGradient(600, 600, 50, 600, 600, 550);
            kGrad.addColorStop(0, '#000'); kGrad.addColorStop(0.6, '#1a0505'); kGrad.addColorStop(1, 'transparent');
            kCtx.fillStyle = kGrad; kCtx.fillRect(0, 0, 1200, 1200);
            kCtx.strokeStyle = '#e74c3c'; kCtx.lineWidth = 2; kCtx.shadowBlur = 10; kCtx.shadowColor = '#e74c3c';
            for(let i=0; i<12; i++) {
                kCtx.save(); kCtx.translate(600, 600); kCtx.rotate((i * Math.PI/6) + Math.random());
                kCtx.beginPath(); kCtx.moveTo(0,0); kCtx.lineTo(50 + Math.random()*50, 20); kCtx.lineTo(150 + Math.random()*100, 10); kCtx.lineTo(350 + Math.random()*100, 40); kCtx.stroke();
                kCtx.restore();
            }
            kCtx.shadowBlur = 0;
        }
    };

    const TWO_PI = Math.PI * 2;
    let dpr = 1; 
    let lastTime = performance.now(); 
    let ecoModeActive = false;
    let lagFramesCounter = 0; 
    
    let camera = { x: 0, y: 0 };
    let cameraScale = 1.0; 
    let screenW = window.innerWidth;
    let screenH = window.innerHeight;
    let wstrzasEkranu = { moc: 0, wygasanie: 0.9 }; 
    let pokazDuzaMape = false;

    let pozycjaMyszki = { x: screenW / 2, y: screenH / 2 };
    window.addEventListener('mousemove', (e) => { pozycjaMyszki.x = e.clientX; pozycjaMyszki.y = e.clientY; });

    // ==========================================
    // 🗄️ BAZY DANYCH I ASSETY
    // ==========================================
    let MacierzOtoczenia = []; 
    let czyMapaWygenerowana = false;
    let czasteczkiTla = []; 
    let lokalnyBuforJedzenia = {}; 
    let plamyPolaBitwy = []; 
    
    // <--- NOWOŚĆ: LOKALNY STAN DLA PŁYNNOŚCI (LERP) --->
    let LokalnyStan = { players: {}, bots: {} }; 
    let poprzedniePozycje = { projectiles: {} };
    let wskaznikiOffscreen = []; 
    let KolejkaEfektow = []; 

    function wstrzyknijEfektWalki(typ, x, y, opcje = {}) {
        KolejkaEfektow.push({ typ: typ, x: x, y: y, vx: opcje.vx || 0, vy: opcje.vy || 0, zycie: opcje.zycie || 1.0, kat: opcje.kat || 0, tekst: opcje.tekst || '' });
    }

    let minimapCanvas = document.createElement('canvas');
    let mCtx = minimapCanvas.getContext('2d', { alpha: true });

    window.addEventListener('keydown', (e) => { if (e.code === 'KeyM') pokazDuzaMape = true; });
    window.addEventListener('keyup', (e) => { if (e.code === 'KeyM') pokazDuzaMape = false; });

    const obrazyPostaci = {
        'standard': { img: new Image(), loaded: false },
        'ninja': { img: new Image(), loaded: false },
        'arystokrata': { img: new Image(), loaded: false }
    };

    function ladujObrazek(klucz, sciezka) {
        obrazyPostaci[klucz].img.onload = () => { obrazyPostaci[klucz].loaded = true; };
        obrazyPostaci[klucz].img.onerror = () => { console.warn(`Brak grafiki: ${sciezka}. Włączam tryb wektorowy.`); };
        obrazyPostaci[klucz].img.src = sciezka;
    }
    ladujObrazek('standard', '/assety/xtreme-destiny-postac-1.png'); 
    ladujObrazek('ninja', '/assety/ninja-transparent.png');
    ladujObrazek('arystokrata', '/assety/postac-bez-tla.png');

    function resize() {
        screenW = window.innerWidth;
        screenH = window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, ecoModeActive ? 1.0 : 2.0); 
        
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
        const margines = 200 / cameraScale; 
        return (x + promien + margines > camera.x && x - promien - margines < camera.x + screenW / cameraScale && y + promien + margines > camera.y && y - promien - margines < camera.y + screenH / cameraScale);
    }

    // ==========================================
    // 🌌 ŚRODOWISKO I MACIERZ OTOCZENIA 
    // ==========================================
    function generujSrodowisko(tryb, limitWielkosci) {
        MacierzOtoczenia = []; 
        czasteczkiTla = [];
        plamyPolaBitwy = [];
        KolejkaEfektow = [];

        FabrykaPieczatek.generujWszystko();

        for(let i = 0; i < 150; i++) {
            czasteczkiTla.push({ 
                x: Math.random() * limitWielkosci, y: Math.random() * limitWielkosci, 
                speedX: (Math.random() - 0.5) * 0.5, speedY: (Math.random() - 0.5) * 0.5, 
                r: Math.random() * 2, alpha: Math.random() * 0.5 + 0.1, głębia: Math.random() * 0.8 + 0.2 
            });
        }

        if (tryb === 'FREE') {
            for(let i = 0; i < 60; i++) MacierzOtoczenia.push({ typ: 'ser_z_dziurami', x: Math.random() * limitWielkosci, y: Math.random() * limitWielkosci, r: 90 + Math.random() * 40, faza: Math.random() * TWO_PI });
        } else if (tryb === 'TEAMS') {
            for(let i = 0; i < 40; i++) MacierzOtoczenia.push({ typ: 'zasieki_laserowe', x: Math.random() * limitWielkosci, y: Math.random() * limitWielkosci, r: 120, faza: Math.random() * TWO_PI });
        } else if (tryb === 'CAMPAIGN') {
            for(let i = 0; i < 50; i++) MacierzOtoczenia.push({ typ: 'kokon_roju', x: Math.random() * limitWielkosci, y: Math.random() * limitWielkosci, r: 70 + Math.random() * 30, faza: Math.random() * TWO_PI });
        }

        minimapCanvas.width = 1000; minimapCanvas.height = 1000;
        let scale = 1000 / limitWielkosci;
        mCtx.clearRect(0, 0, 1000, 1000);
        
        if (tryb === 'FREE') {
            mCtx.fillStyle = 'rgba(241, 196, 15, 0.2)'; mCtx.strokeStyle = '#f1c40f';
            mCtx.beginPath(); mCtx.arc(2000 * scale, 2000 * scale, 400 * scale, 0, TWO_PI); mCtx.fill(); mCtx.stroke();
        } else if (tryb === 'TEAMS') {
            mCtx.fillStyle = 'rgba(231, 76, 60, 0.3)'; mCtx.beginPath(); mCtx.arc(500 * scale, 3000 * scale, 400 * scale, 0, TWO_PI); mCtx.fill();
            mCtx.fillStyle = 'rgba(52, 152, 219, 0.3)'; mCtx.beginPath(); mCtx.arc(5500 * scale, 3000 * scale, 400 * scale, 0, TWO_PI); mCtx.fill();
            mCtx.fillStyle = '#f1c40f'; mCtx.beginPath(); mCtx.arc(3000 * scale, 3000 * scale, 250 * scale, 0, TWO_PI); mCtx.fill();
        } else if (tryb === 'CAMPAIGN') {
            mCtx.fillStyle = 'rgba(231, 76, 60, 0.2)'; mCtx.beginPath(); mCtx.arc(limitWielkosci/2 * scale, limitWielkosci/2 * scale, 500 * scale, 0, TWO_PI); mCtx.fill();
        }
        czyMapaWygenerowana = true;
    }

    // <--- NOWOŚĆ: Wyizolowana funkcja do rysowania pojedynczych obiektów środowiska (na potrzeby Y-Sortingu) --->
    function rysujPojedynczyKrzak(obiekt) {
        ctx.save(); ctx.translate(obiekt.x | 0, obiekt.y | 0);
        if (obiekt.typ === 'ser_z_dziurami') {
            ctx.fillStyle = '#f1c40f'; AkceleratorRenderu.ustawCien(ctx, '#f1c40f', 15);
            ctx.beginPath(); ctx.arc(0, 0, obiekt.r, 0, TWO_PI); ctx.fill(); AkceleratorRenderu.resetujCien(ctx);
            ctx.fillStyle = '#08080a'; 
            ctx.beginPath(); ctx.arc(-obiekt.r/3, -obiekt.r/3, obiekt.r/4, 0, TWO_PI); ctx.fill();
            ctx.beginPath(); ctx.arc(obiekt.r/2, 0, obiekt.r/5, 0, TWO_PI); ctx.fill();
            ctx.beginPath(); ctx.arc(-obiekt.r/4, obiekt.r/2, obiekt.r/6, 0, TWO_PI); ctx.fill();
        } else if (obiekt.typ === 'zasieki_laserowe') {
            ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 4; ctx.setLineDash([10, 10]); ctx.lineDashOffset = performance.now() / 20;
            AkceleratorRenderu.ustawCien(ctx, '#e74c3c', 15);
            ctx.beginPath(); ctx.moveTo(-obiekt.r, 0); ctx.lineTo(obiekt.r, 0); ctx.moveTo(0, -obiekt.r); ctx.lineTo(0, obiekt.r); ctx.stroke();
            AkceleratorRenderu.resetujCien(ctx);
        } else if (obiekt.typ === 'kokon_roju') {
            ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.ellipse(0, 0, obiekt.r, obiekt.r*0.7, obiekt.faza, 0, TWO_PI); ctx.fill();
            let puls = Math.sin(performance.now() / 300 + obiekt.faza);
            ctx.fillStyle = `rgba(142, 68, 173, ${0.4 + puls*0.2})`; ctx.beginPath(); ctx.ellipse(0, 0, obiekt.r*0.8, obiekt.r*0.5, obiekt.faza, 0, TWO_PI); ctx.fill();
        }
        ctx.restore();
    }

    function rysujMape(tryb, limitWielkosci, dt) {
        ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
        ctx.fillStyle = '#08080a'; ctx.fillRect(0, 0, screenW, screenH); 
        ctx.restore();

        czasteczkiTla.forEach(c => {
            c.x += c.speedX * dt; c.y += c.speedY * dt;
            if (c.x < 0) c.x = limitWielkosci; if (c.x > limitWielkosci) c.x = 0;
            if (c.y < 0) c.y = limitWielkosci; if (c.y > limitWielkosci) c.y = 0;
            let drawX = c.x + (camera.x * (1 - c.głębia)); let drawY = c.y + (camera.y * (1 - c.głębia));
            ctx.fillStyle = `rgba(255, 255, 255, ${c.alpha})`; 
            ctx.beginPath(); ctx.arc(drawX, drawY, c.r * c.głębia, 0, TWO_PI); ctx.fill();
        });

        if (tryb === 'TEAMS') {
            ctx.strokeStyle = `rgba(241, 196, 15, ${0.05 + Math.abs(Math.sin(performance.now()/500))*0.05})`;
            ctx.lineWidth = 20;
            ctx.beginPath(); ctx.moveTo(500, 3000); ctx.lineTo(3000, 3000); ctx.lineTo(5500, 3000); ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(52, 152, 219, 0.05)'; ctx.lineWidth = 1;
        const siatkaRozmiar = 200; 
        const startX = Math.floor(camera.x / siatkaRozmiar) * siatkaRozmiar; const startY = Math.floor(camera.y / siatkaRozmiar) * siatkaRozmiar;
        ctx.beginPath();
        for(let x = startX; x < camera.x + screenW / cameraScale; x += siatkaRozmiar) { ctx.moveTo(x, camera.y); ctx.lineTo(x, camera.y + screenH / cameraScale); }
        for(let y = startY; y < camera.y + screenH / cameraScale; y += siatkaRozmiar) { ctx.moveTo(camera.x, y); ctx.lineTo(camera.x + screenW / cameraScale, y); }
        ctx.stroke();

        plamyPolaBitwy.forEach((plama, i) => {
            plama.zycie -= 0.001 * dt;
            if (plama.zycie <= 0) { plamyPolaBitwy.splice(i, 1); return; }
            if (!czyWidoczny(plama.x, plama.y, plama.r)) return;
            ctx.save(); ctx.translate(plama.x, plama.y); ctx.rotate(plama.kat);
            ctx.fillStyle = plama.isBoss ? `rgba(155, 89, 182, ${plama.zycie * 0.4})` : `rgba(20, 20, 25, ${plama.zycie * 0.6})`;
            ctx.beginPath(); ctx.ellipse(0, 0, plama.r, plama.r * 0.6, 0, 0, TWO_PI); ctx.fill();
            ctx.restore();
        });

        if (tryb === 'FREE' && czyWidoczny(2000, 2000, 400)) {
            ctx.drawImage(FabrykaPieczatek.zamekFree, 2000 - 400, 2000 - 400);
            ctx.save(); ctx.translate(2000, 2000 + 60); ctx.rotate(performance.now() / 1000); 
            ctx.strokeStyle = '#fff'; ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'; AkceleratorRenderu.ustawCien(ctx, '#fff', 15);
            ctx.beginPath(); ctx.rect(-15, -15, 30, 30); ctx.rotate(Math.PI / 4); ctx.rect(-15, -15, 30, 30); ctx.fill(); ctx.stroke(); 
            ctx.restore();
        } 
        else if (tryb === 'TEAMS') {
            if (czyWidoczny(500, 3000, 400)) {
                ctx.drawImage(FabrykaPieczatek.bazaRed, 500 - 400, 3000 - 400);
                let puls = Math.abs(Math.sin(performance.now() / 500));
                ctx.fillStyle = `rgba(231, 76, 60, ${0.3 + puls * 0.2})`; ctx.beginPath(); ctx.arc(500, 3000, 50 + puls * 20, 0, TWO_PI); ctx.fill();
            }
            if (czyWidoczny(5500, 3000, 400)) {
                ctx.drawImage(FabrykaPieczatek.bazaBlue, 5500 - 400, 3000 - 400);
                let puls = Math.abs(Math.sin(performance.now() / 500));
                ctx.fillStyle = `rgba(52, 152, 219, ${0.3 + puls * 0.2})`; ctx.beginPath(); ctx.arc(5500, 3000, 50 + puls * 20, 0, TWO_PI); ctx.fill();
            }
            if (czyWidoczny(3000, 3000, 300)) {
                ctx.drawImage(FabrykaPieczatek.reaktorTeams, 3000 - 300, 3000 - 300);
                let puls = Math.abs(Math.sin(performance.now() / 200));
                ctx.fillStyle = `rgba(46, 204, 113, ${0.4 + puls * 0.3})`; ctx.beginPath(); ctx.arc(3000, 3000, 100 + puls * 10, 0, TWO_PI); ctx.fill();
            }
        }
        else if (tryb === 'CAMPAIGN') {
            if (czyWidoczny(limitWielkosci/2, limitWielkosci/2, 600)) {
                ctx.drawImage(FabrykaPieczatek.kraterCampaign, limitWielkosci/2 - 600, limitWielkosci/2 - 600);
            }
        }
    }

    function rysujEfektyKolejki(dt) {
        for (let i = KolejkaEfektow.length - 1; i >= 0; i--) {
            let e = KolejkaEfektow[i];
            e.x += e.vx * dt; e.y += e.vy * dt; e.zycie -= 0.02 * dt;
            if (e.zycie <= 0 || !czyWidoczny(e.x, e.y, 10)) { KolejkaEfektow.splice(i, 1); continue; }
            ctx.save(); ctx.translate(e.x | 0, e.y | 0); ctx.rotate(e.kat += 0.1 * dt);
            if (e.typ === 'luska') {
                ctx.fillStyle = '#f1c40f'; ctx.globalAlpha = e.zycie; ctx.fillRect(-2, -4, 4, 8);
            } else if (e.typ === 'iskra') {
                ctx.fillStyle = '#e74c3c'; ctx.globalAlpha = e.zycie; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TWO_PI); ctx.fill();
            }
            ctx.restore();
        }
    }

    // ==========================================
    // RENDEROWANIE BOTÓW I GRACZY
    // ==========================================
    function rysujBota(bot) {
        let promien = 15 + Math.sqrt(Math.min(bot.score || 10, 600)) * 1.5;
        if (!czyWidoczny(bot.x, bot.y, promien)) return;

        let wKrzaku = false;
        for (let i = 0; i < MacierzOtoczenia.length; i++) {
            if (MacierzOtoczenia[i].typ === 'zasieki_laserowe') continue;
            let dx = bot.x - MacierzOtoczenia[i].x; let dy = bot.y - MacierzOtoczenia[i].y;
            if ((dx*dx + dy*dy) < MacierzOtoczenia[i].r * MacierzOtoczenia[i].r) { wKrzaku = true; break; }
        }
        if (wKrzaku) return; 

        let isBoss = bot.isBoss || bot.skin === 'ninja';
        let kolor = isBoss ? '#9b59b6' : '#e74c3c';
        if (bot.ownerId && bot.team) kolor = bot.team === 'RED' ? '#e74c3c' : '#3498db';

        ctx.save(); ctx.translate(bot.x | 0, bot.y | 0); ctx.rotate(bot.angle || 0);
        ctx.fillStyle = '#050505'; ctx.strokeStyle = kolor; ctx.lineWidth = 3;
        AkceleratorRenderu.ustawCien(ctx, kolor, 10);
        ctx.beginPath();
        if (isBoss) { ctx.arc(0, 0, promien, 0, TWO_PI); } 
        else { for (let i = 0; i < 6; i++) { ctx.lineTo(Math.cos(i * Math.PI/3) * promien, Math.sin(i * Math.PI/3) * promien); } }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        AkceleratorRenderu.resetujCien(ctx);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(promien, 0); ctx.stroke();
        ctx.restore();

        if (!isBoss) {
            ctx.save(); ctx.translate(bot.x | 0, bot.y | 0); ctx.fillStyle = '#aaa';
            ctx.font = '10px Exo 2, sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(`DRON [${Math.floor(bot.score)}]`, 0, -promien - 10); 
            ctx.restore();
        }
    }

    function rysujPostac(postac, isMe) {
        let masa = Math.max(10, postac.score || 10);
        let promien = Math.min(20 + Math.sqrt(masa) * 2, 65); 
        if (!czyWidoczny(postac.x, postac.y, promien)) return;

        let wKrzaku = false; let typKrzaka = '';
        for (let i = 0; i < MacierzOtoczenia.length; i++) {
            if (MacierzOtoczenia[i].typ === 'zasieki_laserowe') continue;
            let dx = postac.x - MacierzOtoczenia[i].x; let dy = postac.y - MacierzOtoczenia[i].y;
            if ((dx*dx + dy*dy) < MacierzOtoczenia[i].r * MacierzOtoczenia[i].r) { 
                wKrzaku = true; typKrzaka = MacierzOtoczenia[i].typ; break; 
            }
        }

        if (wKrzaku && !isMe) return; 

        let skin = postac.skin || 'standard';
        let kolor = skin === 'ninja' ? '#9b59b6' : (skin === 'arystokrata' ? '#f1c40f' : '#e74c3c');
        if (postac.team) kolor = postac.team === 'RED' ? '#e74c3c' : '#3498db';

        if (postac.isSafe) { 
            ctx.save(); ctx.translate(postac.x | 0, postac.y | 0); 
            ctx.strokeStyle = 'rgba(46, 204, 113, 0.6)'; ctx.lineWidth = 3; ctx.setLineDash([10, 15]); 
            ctx.rotate(performance.now() / 800); AkceleratorRenderu.ustawCien(ctx, '#2ecc71', 15);
            ctx.beginPath(); ctx.arc(0, 0, promien + 15, 0, TWO_PI); ctx.stroke(); 
            AkceleratorRenderu.resetujCien(ctx); ctx.restore();
        }

        ctx.save(); 
        if (wKrzaku && isMe) ctx.globalAlpha = 0.5;

        ctx.translate(postac.x | 0, postac.y | 0); ctx.rotate(postac.kat || 0);

        let asset = obrazyPostaci[skin];
        if (asset && asset.loaded) {
            AkceleratorRenderu.ustawCien(ctx, kolor, 15);
            ctx.drawImage(asset.img, -promien, -promien, promien * 2, promien * 2);
            AkceleratorRenderu.resetujCien(ctx);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(promien * 0.5, 0); ctx.lineTo(promien + 10, 0); ctx.stroke();
        } else {
            ctx.fillStyle = '#111'; ctx.strokeStyle = kolor; ctx.lineWidth = 4;
            AkceleratorRenderu.ustawCien(ctx, kolor, 20);
            ctx.beginPath(); ctx.arc(0, 0, promien, 0, TWO_PI); ctx.fill(); ctx.stroke();
            AkceleratorRenderu.resetujCien(ctx);
            ctx.fillStyle = kolor; ctx.fillRect(0, -5, promien + 10, 10);
        }

        if (wKrzaku && isMe) {
            if (typKrzaka === 'ser_z_dziurami') {
                ctx.fillStyle = kolor; ctx.beginPath();
                ctx.arc(-promien * 0.5, -promien * 0.6, 12, 0, TWO_PI); ctx.arc(promien * 0.5, -promien * 0.6, 12, 0, TWO_PI); ctx.fill();
                ctx.fillStyle = '#e84393'; ctx.beginPath();
                ctx.arc(-promien * 0.5, -promien * 0.6, 6, 0, TWO_PI); ctx.arc(promien * 0.5, -promien * 0.6, 6, 0, TWO_PI); ctx.fill();
                let wibracja = Math.sin(performance.now() / 50) * 2;
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath();
                ctx.moveTo(-promien * 0.2, 0); ctx.lineTo(-promien * 0.8, -10 + wibracja); ctx.moveTo(-promien * 0.2, 0); ctx.lineTo(-promien * 0.9, 0 + wibracja); ctx.moveTo(-promien * 0.2, 0); ctx.lineTo(-promien * 0.8, 10 + wibracja);
                ctx.moveTo(promien * 0.2, 0); ctx.lineTo(promien * 0.8, -10 - wibracja); ctx.moveTo(promien * 0.2, 0); ctx.lineTo(promien * 0.9, 0 - wibracja); ctx.moveTo(promien * 0.2, 0); ctx.lineTo(promien * 0.8, 10 - wibracja);
                ctx.stroke();
                ctx.fillStyle = '#ff7675'; ctx.beginPath(); ctx.arc(0, -promien * 0.2, 4, 0, TWO_PI); ctx.fill();
            } else if (typKrzaka === 'kokon_roju') {
                ctx.fillStyle = '#8e44ad'; ctx.beginPath(); ctx.arc(-promien*0.6, 0, 8, 0, TWO_PI); ctx.arc(promien*0.6, 0, 8, 0, TWO_PI); ctx.fill();
                let p = Math.sin(performance.now() / 100) * 5;
                ctx.strokeStyle = '#9b59b6'; ctx.lineWidth = 3; ctx.beginPath();
                ctx.moveTo(-promien*0.6, 0); ctx.quadraticCurveTo(-promien*1.5, -15 - p, -promien*1.2, -25 + p);
                ctx.moveTo(promien*0.6, 0); ctx.quadraticCurveTo(promien*1.5, -15 - p, promien*1.2, -25 + p); ctx.stroke();
            }
        }

        ctx.restore(); 

        ctx.save();
        ctx.translate(postac.x | 0, postac.y | 0); 
        ctx.fillStyle = isMe ? '#f1c40f' : '#ffffff'; 
        ctx.font = 'bold 14px Exo 2, sans-serif'; ctx.textAlign = 'center';
        if (wKrzaku && isMe) ctx.fillStyle = 'rgba(150, 150, 150, 0.5)';
        ctx.fillText(`${postac.name || 'Gracz'} (${Math.floor(masa)})`, 0, promien + 20);
        ctx.restore();
    }

    function rysujMapeTaktyczna(stanSerwera, mojGracz, limitWielkosci, czyMala = true) {
        ctx.save();
        let mapSize = czyMala ? 160 : Math.min(screenW, screenH) * 0.7;
        let startX = czyMala ? screenW - mapSize - 20 : (screenW - mapSize) / 2;
        let startY = czyMala ? 20 : (screenH - mapSize) / 2;
        let scale = mapSize / limitWielkosci;

        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.fillStyle = 'rgba(10, 10, 15, 0.85)'; ctx.strokeStyle = czyMala ? '#3498db' : '#f1c40f'; ctx.lineWidth = 2;
        ctx.fillRect(startX, startY, mapSize, mapSize); ctx.strokeRect(startX, startY, mapSize, mapSize);
        ctx.drawImage(minimapCanvas, startX, startY, mapSize, mapSize);

        function rysujKropke(x, y, kolor, promienKropki) {
            ctx.fillStyle = kolor; ctx.beginPath(); ctx.arc(startX + (x * scale), startY + (y * scale), promienKropki, 0, TWO_PI); ctx.fill();
        }

        if (LokalnyStan.bots) Object.values(LokalnyStan.bots).forEach(b => rysujKropke(b.x, b.y, b.skin === 'ninja' ? '#9b59b6' : '#e74c3c', czyMala ? 1.5 : 3));
        if (LokalnyStan.players) Object.values(LokalnyStan.players).forEach(p => { if (p.id !== mojGracz.id) rysujKropke(p.x, p.y, (window.Flagi && window.Flagi.Stan.wybranyTryb === 'TEAMS') ? (p.team === 'RED' ? '#e74c3c' : '#3498db') : '#95a5a6', czyMala ? 2.5 : 5); });

        let puls = 2.5 + Math.abs(Math.sin(performance.now() / 300)) * 2;
        rysujKropke(mojGracz.x, mojGracz.y, '#ffffff', czyMala ? puls : puls * 2);

        if (!czyMala) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(startX + (mojGracz.x * scale), startY + (mojGracz.y * scale), (screenH/2) * scale, 0, TWO_PI); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 24px Exo 2, sans-serif'; ctx.textAlign = 'center'; ctx.fillText("MAPA TAKTYCZNA", startX + mapSize/2, startY - 20);
        }
        ctx.restore();
    }

    // ==========================================
    // ⚙️ GŁÓWNA PĘTLA RENDERUJĄCA KLATKĘ
    // ==========================================
    return {
        wywolajWstrzas: function(moc) { wstrzasEkranu.moc = moc; },
        
        rysujKlatke: function(stanSerwera, mojGracz) {
            if (!stanSerwera || !mojGracz) return;

            let now = performance.now();
            let dt = Math.min(3, (now - lastTime) / 16.666); 
            lastTime = now;

            let celX = mojGracz.x - screenW / 2; let celY = mojGracz.y - screenH / 2;
            camera.x += (celX - camera.x) * (0.2 * dt); 
            camera.y += (celY - camera.y) * (0.2 * dt);

            let drawCamX = camera.x + (Math.random() - 0.5) * wstrzasEkranu.moc; 
            let drawCamY = camera.y + (Math.random() - 0.5) * wstrzasEkranu.moc;
            wstrzasEkranu.moc *= Math.pow(wstrzasEkranu.wygasanie, dt);

            let tryb = (window.Flagi && window.Flagi.Stan.wybranyTryb) ? window.Flagi.Stan.wybranyTryb : 'FREE';
            let limitWielkosci = tryb === 'TEAMS' ? 6000 : 4000;

            if (!czyMapaWygenerowana) generujSrodowisko(tryb, limitWielkosci);
            ZarzadcaPamieci.wyczyscPamiecCoRunde();

            // <--- NOWOŚĆ 1: LERP (PŁYNNY RUCH BEZ SKOKÓW) --->
            if (stanSerwera.bots) {
                Object.keys(stanSerwera.bots).forEach(id => {
                    let serwerBot = stanSerwera.bots[id];
                    if (!LokalnyStan.bots[id]) {
                        LokalnyStan.bots[id] = { ...serwerBot }; // Jeśli bot jest nowy, od razu kopiujemy go do lokalnego stanu
                    } else {
                        // Jeśli bot już istnieje, powoli przysuwamy jego pozycję do tej, którą przysłał serwer
                        LokalnyStan.bots[id].x += (serwerBot.x - LokalnyStan.bots[id].x) * (0.3 * dt);
                        LokalnyStan.bots[id].y += (serwerBot.y - LokalnyStan.bots[id].y) * (0.3 * dt);
                        LokalnyStan.bots[id].score = serwerBot.score;
                        LokalnyStan.bots[id].angle = serwerBot.angle;
                        LokalnyStan.bots[id].isBoss = serwerBot.isBoss;
                        LokalnyStan.bots[id].skin = serwerBot.skin;
                    }
                });
                // Kasowanie martwych botów
                Object.keys(LokalnyStan.bots).forEach(id => {
                    if (!stanSerwera.bots[id]) {
                        plamyPolaBitwy.push({ x: LokalnyStan.bots[id].x, y: LokalnyStan.bots[id].y, r: 20 + Math.random()*20, kat: Math.random() * TWO_PI, zycie: 1.0, isBoss: LokalnyStan.bots[id].isBoss });
                        for(let i=0; i<5; i++) wstrzyknijEfektWalki('iskra', LokalnyStan.bots[id].x, LokalnyStan.bots[id].y, {vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, zycie: 0.5 + Math.random()});
                        delete LokalnyStan.bots[id];
                    }
                });
            }

            if (stanSerwera.players) {
                Object.keys(stanSerwera.players).forEach(id => {
                    let serwerGracz = stanSerwera.players[id];
                    if (!LokalnyStan.players[id]) {
                        LokalnyStan.players[id] = { ...serwerGracz };
                    } else {
                        LokalnyStan.players[id].x += (serwerGracz.x - LokalnyStan.players[id].x) * (0.3 * dt);
                        LokalnyStan.players[id].y += (serwerGracz.y - LokalnyStan.players[id].y) * (0.3 * dt);
                        LokalnyStan.players[id].score = serwerGracz.score;
                        LokalnyStan.players[id].kat = serwerGracz.kat;
                        LokalnyStan.players[id].isSafe = serwerGracz.isSafe;
                    }
                });
                Object.keys(LokalnyStan.players).forEach(id => {
                    if (!stanSerwera.players[id]) delete LokalnyStan.players[id];
                });
            }

            let nowePociski = {};
            if (stanSerwera.projectiles) {
                Object.keys(stanSerwera.projectiles).forEach(id => {
                    nowePociski[id] = stanSerwera.projectiles[id];
                    if (!poprzedniePozycje.projectiles[id]) {
                        wstrzyknijEfektWalki('luska', nowePociski[id].x, nowePociski[id].y, { vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5, zycie: 1.0, kat: Math.random()*TWO_PI });
                    }
                });
            }
            poprzedniePozycje.projectiles = nowePociski;

            ctx.save(); 
            ctx.translate(screenW / 2, screenH / 2);
            ctx.scale(cameraScale, cameraScale);
            ctx.translate(-screenW / 2, -screenH / 2);
            ctx.translate(-drawCamX, -drawCamY);

            rysujMape(tryb, limitWielkosci, dt);

            // <--- NOWOŚĆ 2: GŁĘBIA (Y-SORTING) --->
            // Wrzucamy wszystko do jednego worka, by posortować
            let KolejkaY = [];

            // 1. Dodajemy krzaki i lasery
            MacierzOtoczenia.forEach(obiekt => {
                if (czyWidoczny(obiekt.x, obiekt.y, obiekt.r)) {
                    KolejkaY.push({ typObj: 'srodowisko', y: obiekt.y, dane: obiekt });
                }
            });

            // 2. Dodajemy boty z Lokalnego Stanu
            Object.values(LokalnyStan.bots).forEach(bot => {
                let promien = 15 + Math.sqrt(Math.min(bot.score || 10, 600)) * 1.5;
                if (czyWidoczny(bot.x, bot.y, promien)) {
                    KolejkaY.push({ typObj: 'bot', y: bot.y, dane: bot });
                }
            });

            // 3. Dodajemy graczy z Lokalnego Stanu
            Object.keys(LokalnyStan.players).forEach(id => {
                if (id !== mojGracz.id) {
                    let p = LokalnyStan.players[id];
                    let promien = Math.min(20 + Math.sqrt(Math.max(10, p.score || 10)) * 2, 65);
                    if (czyWidoczny(p.x, p.y, promien)) {
                        KolejkaY.push({ typObj: 'gracz', y: p.y, dane: p, isMe: false });
                    }
                }
            });

            // 4. Dodajemy Ciebie (żebyś mógł chować się za serem)
            KolejkaY.push({ typObj: 'gracz', y: mojGracz.y, dane: mojGracz, isMe: true });

            // Sortujemy całą tablicę po Y (od góry do dołu)
            KolejkaY.sort((a, b) => a.y - b.y);

            // Rysujemy posortowane obiekty
            KolejkaY.forEach(element => {
                if (element.typObj === 'srodowisko') {
                    rysujPojedynczyKrzak(element.dane);
                } else if (element.typObj === 'bot') {
                    rysujBota(element.dane);
                } else if (element.typObj === 'gracz') {
                    rysujPostac(element.dane, element.isMe);
                }
            });

            // Reszta renderowania (Pociski i HUD na wierzchu)
            if (stanSerwera.projectiles) {
                Object.values(stanSerwera.projectiles).forEach(proj => {
                    if (!czyWidoczny(proj.x, proj.y, 20)) return;
                    ctx.save(); ctx.translate(proj.x | 0, proj.y | 0); ctx.rotate(Math.atan2(proj.dy, proj.dx));
                    ctx.fillStyle = proj.type === 'laser' ? '#e74c3c' : '#bdc3c7'; ctx.fillRect(-10, -3, 20, 6); ctx.restore();
                });
            }

            if (stanSerwera.foods) { lokalnyBuforJedzenia = stanSerwera.foods; }
            Object.values(lokalnyBuforJedzenia).forEach(f => {
                if (!czyWidoczny(f.x, f.y, 10)) return;
                let oscylacja = Math.sin(now / 200 + f.x) * 2; 
                ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(f.x | 0, (f.y + oscylacja) | 0, 5, 0, TWO_PI); ctx.fill();
            });

            rysujEfektyKolejki(dt);
            ctx.restore(); 

            ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pozycjaMyszki.x, pozycjaMyszki.y, 10, 0, TWO_PI); ctx.stroke();
            ctx.fillStyle = '#e74c3c'; ctx.fillRect(pozycjaMyszki.x - 1, pozycjaMyszki.y - 1, 2, 2);

            if (pokazDuzaMape) rysujMapeTaktyczna(stanSerwera, mojGracz, limitWielkosci, false);
            else rysujMapeTaktyczna(stanSerwera, mojGracz, limitWielkosci, true);
        }
    };
})();