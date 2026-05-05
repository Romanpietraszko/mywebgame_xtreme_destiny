// ==========================================
// GRAFIKA.JS - Ustabilizowany Silnik Renderujący (Faza 4: Powrót "Juice'u" - SER I MYSZY!)
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
            KolejkaEfektow.length = 0;
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
    let MacierzOtoczenia = []; // Nasze złoża sera!
    let czyMapaWygenerowana = false;
    let czasteczkiTla = []; 
    let lokalnyBuforJedzenia = {}; 
    
    let poprzedniePozycje = { players: {}, bots: {} };
    let wskaznikiOffscreen = []; 
    let efektyWizualne = [];        
    let KolejkaEfektow = []; 

    function wstrzyknijEfektWalki(typ, x, y, opcje = {}) {
        KolejkaEfektow.push({ typ: typ, x: x, y: y, vx: opcje.vx || 0, vy: opcje.vy || 0, zycie: opcje.zycie || 1.0, kat: opcje.kat || 0, tekst: opcje.tekst || '' });
    }

    let minimapCanvas = document.createElement('canvas');
    let mCtx = minimapCanvas.getContext('2d', { alpha: true });

    window.addEventListener('keydown', (e) => { if (e.code === 'KeyM') pokazDuzaMape = true; });
    window.addEventListener('keyup', (e) => { if (e.code === 'KeyM') pokazDuzaMape = false; });

    // KULOODPORNE ŁADOWANIE OBRAZKÓW
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

        for(let i = 0; i < 150; i++) {
            czasteczkiTla.push({ 
                x: Math.random() * limitWielkosci, y: Math.random() * limitWielkosci, 
                speedX: (Math.random() - 0.5) * 0.5, speedY: (Math.random() - 0.5) * 0.5, 
                r: Math.random() * 2, alpha: Math.random() * 0.5 + 0.1, głębia: Math.random() * 0.8 + 0.2 
            });
        }

        // <--- WSTRZYKNIĘCIE KRZAKÓW (SERA) --->
        if (tryb === 'FREE') {
            for(let i = 0; i < 60; i++) {
                MacierzOtoczenia.push({ 
                    typ: 'ser_z_dziurami', 
                    x: Math.random() * limitWielkosci, 
                    y: Math.random() * limitWielkosci, 
                    r: 90 + Math.random() * 40, // Losowa wielkość bloków sera
                    faza: Math.random() * TWO_PI 
                });
            }
        }

        minimapCanvas.width = 1000; 
        minimapCanvas.height = 1000;
        let scale = 1000 / limitWielkosci;
        mCtx.clearRect(0, 0, 1000, 1000);
        
        if (tryb === 'FREE') {
            mCtx.fillStyle = 'rgba(241, 196, 15, 0.2)';
            mCtx.strokeStyle = '#f1c40f';
            mCtx.beginPath();
            mCtx.arc(2000 * scale, 2000 * scale, 400 * scale, 0, TWO_PI);
            mCtx.fill(); mCtx.stroke();
        } else if (tryb === 'TEAMS') {
            mCtx.fillStyle = 'rgba(231, 76, 60, 0.3)'; mCtx.strokeStyle = '#e74c3c';
            mCtx.beginPath(); mCtx.arc(500 * scale, 3000 * scale, 400 * scale, 0, TWO_PI); mCtx.fill(); mCtx.stroke();
            
            mCtx.fillStyle = 'rgba(52, 152, 219, 0.3)'; mCtx.strokeStyle = '#3498db';
            mCtx.beginPath(); mCtx.arc(5500 * scale, 3000 * scale, 400 * scale, 0, TWO_PI); mCtx.fill(); mCtx.stroke();
        }
        czyMapaWygenerowana = true;
    }

    function rysujMape(tryb, limitWielkosci, dt) {
        // TŁO
        ctx.save(); 
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
        ctx.fillStyle = '#08080a'; 
        ctx.fillRect(0, 0, screenW, screenH); 
        ctx.restore();

        // CZĄSTECZKI W TLE
        czasteczkiTla.forEach(c => {
            c.x += c.speedX * dt; c.y += c.speedY * dt;
            if (c.x < 0) c.x = limitWielkosci; if (c.x > limitWielkosci) c.x = 0;
            if (c.y < 0) c.y = limitWielkosci; if (c.y > limitWielkosci) c.y = 0;
            
            let drawX = c.x + (camera.x * (1 - c.głębia)); 
            let drawY = c.y + (camera.y * (1 - c.głębia));

            ctx.fillStyle = `rgba(255, 255, 255, ${c.alpha})`; 
            ctx.beginPath(); ctx.arc(drawX, drawY, c.r * c.głębia, 0, TWO_PI); ctx.fill();
        });

        // SIATKA
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.05)'; 
        ctx.lineWidth = 1;
        const siatkaRozmiar = 200; 
        const startX = Math.floor(camera.x / siatkaRozmiar) * siatkaRozmiar; 
        const startY = Math.floor(camera.y / siatkaRozmiar) * siatkaRozmiar;
        
        ctx.beginPath();
        for(let x = startX; x < camera.x + screenW / cameraScale; x += siatkaRozmiar) { ctx.moveTo(x, camera.y); ctx.lineTo(x, camera.y + screenH / cameraScale); }
        for(let y = startY; y < camera.y + screenH / cameraScale; y += siatkaRozmiar) { ctx.moveTo(camera.x, y); ctx.lineTo(camera.x + screenW / cameraScale, y); }
        ctx.stroke();

        // <--- RYSOWANIE SERA (KRZAKÓW) --->
        MacierzOtoczenia.forEach(obiekt => {
            if(!czyWidoczny(obiekt.x, obiekt.y, obiekt.r)) return;
            ctx.save(); 
            ctx.translate(obiekt.x | 0, obiekt.y | 0);
            if (obiekt.typ === 'ser_z_dziurami') {
                ctx.fillStyle = '#f1c40f'; // Apetyczny złoty ser
                AkceleratorRenderu.ustawCien(ctx, '#f1c40f', 15);
                ctx.beginPath(); 
                ctx.arc(0, 0, obiekt.r, 0, TWO_PI); 
                ctx.fill();
                AkceleratorRenderu.resetujCien(ctx);
                
                // Dziury w serze
                ctx.fillStyle = '#08080a'; // Przebija kolor tła mapy
                ctx.beginPath(); ctx.arc(-obiekt.r/3, -obiekt.r/3, obiekt.r/4, 0, TWO_PI); ctx.fill();
                ctx.beginPath(); ctx.arc(obiekt.r/2, 0, obiekt.r/5, 0, TWO_PI); ctx.fill();
                ctx.beginPath(); ctx.arc(-obiekt.r/4, obiekt.r/2, obiekt.r/6, 0, TWO_PI); ctx.fill();
            }
            ctx.restore();
        });

        // ZAMEK / BAZA
        if (tryb === 'FREE' && czyWidoczny(2000, 2000, 400)) {
            let czas = performance.now();
            ctx.save(); 
            ctx.translate(2000, 2000); 
            
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
            AkceleratorRenderu.ustawCien(ctx, kolorFosyGlow, 20);
            ctx.stroke(); 
            AkceleratorRenderu.resetujCien(ctx);

            ctx.fillStyle = '#7f8c8d'; 
            ctx.fillRect(-50, 20, 100, 300); 
            ctx.strokeStyle = '#fff'; 
            ctx.lineWidth = 2; 
            ctx.strokeRect(-50, 20, 100, 300);
            
            ctx.lineWidth = 4; 
            AkceleratorRenderu.ustawCien(ctx, '#000', 15);

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
            AkceleratorRenderu.ustawCien(ctx, '#fff', 15);
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

    // ==========================================
    // RENDEROWANIE BOTÓW I GRACZY (STABILNE)
    // ==========================================
    function rysujBota(bot) {
        let promien = 15 + Math.sqrt(Math.min(bot.score || 10, 600)) * 1.5;
        if (!czyWidoczny(bot.x, bot.y, promien)) return;

        // <--- UKRYWANIE W SERZE --->
        let wKrzaku = false;
        for (let i = 0; i < MacierzOtoczenia.length; i++) {
            let dx = bot.x - MacierzOtoczenia[i].x;
            let dy = bot.y - MacierzOtoczenia[i].y;
            if ((dx*dx + dy*dy) < MacierzOtoczenia[i].r * MacierzOtoczenia[i].r) { wKrzaku = true; break; }
        }
        if (wKrzaku) return; // Boty ukrywają się w serze i stają się niewidoczne

        let isBoss = bot.isBoss || bot.skin === 'ninja';
        let kolor = isBoss ? '#9b59b6' : '#e74c3c';
        if (bot.ownerId && bot.team) kolor = bot.team === 'RED' ? '#e74c3c' : '#3498db';

        ctx.save(); 
        ctx.translate(bot.x | 0, bot.y | 0); 
        ctx.rotate(bot.angle || 0);

        ctx.fillStyle = '#050505'; 
        ctx.strokeStyle = kolor; 
        ctx.lineWidth = 3;

        AkceleratorRenderu.ustawCien(ctx, kolor, 10);
        ctx.beginPath();
        if (isBoss) {
            ctx.arc(0, 0, promien, 0, TWO_PI);
        } else {
            for (let i = 0; i < 6; i++) { ctx.lineTo(Math.cos(i * Math.PI/3) * promien, Math.sin(i * Math.PI/3) * promien); }
        }
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

        // <--- LOGIKA TRANSFORMACJI W MYSZ --->
        let wKrzaku = false;
        for (let i = 0; i < MacierzOtoczenia.length; i++) {
            let dx = postac.x - MacierzOtoczenia[i].x;
            let dy = postac.y - MacierzOtoczenia[i].y;
            if ((dx*dx + dy*dy) < MacierzOtoczenia[i].r * MacierzOtoczenia[i].r) { 
                wKrzaku = true; 
                break; 
            }
        }

        // Jeśli to wróg w serze - nie rysujemy go wcale
        if (wKrzaku && !isMe) return; 

        let skin = postac.skin || 'standard';
        let kolor = skin === 'ninja' ? '#9b59b6' : (skin === 'arystokrata' ? '#f1c40f' : '#e74c3c');
        if (postac.team) kolor = postac.team === 'RED' ? '#e74c3c' : '#3498db';

        if (postac.isSafe) { 
            ctx.save(); 
            ctx.translate(postac.x | 0, postac.y | 0); 
            ctx.strokeStyle = 'rgba(46, 204, 113, 0.6)'; 
            ctx.lineWidth = 3; 
            ctx.setLineDash([10, 15]); 
            ctx.rotate(performance.now() / 800); 
            AkceleratorRenderu.ustawCien(ctx, '#2ecc71', 15);
            ctx.beginPath(); 
            ctx.arc(0, 0, promien + 15, 0, TWO_PI); 
            ctx.stroke(); 
            AkceleratorRenderu.resetujCien(ctx);
            ctx.restore();
        }

        ctx.save(); 
        // Półprzezroczystość dla nas, żebyśmy wiedzieli, że jesteśmy ukryci
        if (wKrzaku && isMe) ctx.globalAlpha = 0.5;

        ctx.translate(postac.x | 0, postac.y | 0); 
        ctx.rotate(postac.kat || 0);

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

        // <--- RYSOWANIE WĄSÓW I USZU MYSZY --->
        if (wKrzaku && isMe) {
            // Uszy myszy
            ctx.fillStyle = kolor;
            ctx.beginPath();
            ctx.arc(-promien * 0.5, -promien * 0.6, 12, 0, TWO_PI); // Lewe ucho
            ctx.arc(promien * 0.5, -promien * 0.6, 12, 0, TWO_PI);  // Prawe ucho
            ctx.fill();
            
            // Środki uszu (różowe/ciemniejsze)
            ctx.fillStyle = '#e84393'; 
            ctx.beginPath();
            ctx.arc(-promien * 0.5, -promien * 0.6, 6, 0, TWO_PI);
            ctx.arc(promien * 0.5, -promien * 0.6, 6, 0, TWO_PI);
            ctx.fill();

            // Wibrujące Wąsy!
            let wibracja = Math.sin(performance.now() / 50) * 2;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            // Lewe wąsy
            ctx.moveTo(-promien * 0.2, 0); ctx.lineTo(-promien * 0.8, -10 + wibracja);
            ctx.moveTo(-promien * 0.2, 0); ctx.lineTo(-promien * 0.9, 0 + wibracja);
            ctx.moveTo(-promien * 0.2, 0); ctx.lineTo(-promien * 0.8, 10 + wibracja);
            // Prawe wąsy
            ctx.moveTo(promien * 0.2, 0); ctx.lineTo(promien * 0.8, -10 - wibracja);
            ctx.moveTo(promien * 0.2, 0); ctx.lineTo(promien * 0.9, 0 - wibracja);
            ctx.moveTo(promien * 0.2, 0); ctx.lineTo(promien * 0.8, 10 - wibracja);
            ctx.stroke();

            // Słodki mysi nosek
            ctx.fillStyle = '#ff7675';
            ctx.beginPath();
            ctx.arc(0, -promien * 0.2, 4, 0, TWO_PI);
            ctx.fill();
        }

        ctx.restore(); 

        ctx.save();
        ctx.translate(postac.x | 0, postac.y | 0); 
        ctx.fillStyle = isMe ? '#f1c40f' : '#ffffff'; 
        ctx.font = 'bold 14px Exo 2, sans-serif'; 
        ctx.textAlign = 'center';
        // Gdy jesteś w krzaku, nick staje się szary i ukryty
        if (wKrzaku && isMe) ctx.fillStyle = 'rgba(150, 150, 150, 0.5)';
        ctx.fillText(`${postac.name || 'Gracz'} (${Math.floor(masa)})`, 0, promien + 20);
        ctx.restore();
    }

    // ==========================================
    // ⚙️ GŁÓWNA PĘTLA RENDERUJĄCA KLATKĘ (ŻELAZNY PIPELINE)
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

            ctx.save(); 
            ctx.translate(screenW / 2, screenH / 2);
            ctx.scale(cameraScale, cameraScale);
            ctx.translate(-screenW / 2, -screenH / 2);
            ctx.translate(-drawCamX, -drawCamY);

            // 1. TŁO I ŚRODOWISKO (ZAMEK + SERY)
            rysujMape(tryb, limitWielkosci, dt);

            // 2. POCISKI
            if (stanSerwera.projectiles) {
                Object.values(stanSerwera.projectiles).forEach(proj => {
                    if (!czyWidoczny(proj.x, proj.y, 20)) return;
                    ctx.save(); ctx.translate(proj.x | 0, proj.y | 0); ctx.rotate(Math.atan2(proj.dy, proj.dx));
                    ctx.fillStyle = proj.type === 'laser' ? '#e74c3c' : '#bdc3c7';
                    ctx.fillRect(-10, -3, 20, 6);
                    ctx.restore();
                });
            }

            // 3. JEDZENIE 
            if (stanSerwera.foods) {
                lokalnyBuforJedzenia = stanSerwera.foods; 
            }
            Object.values(lokalnyBuforJedzenia).forEach(f => {
                if (!czyWidoczny(f.x, f.y, 10)) return;
                let oscylacja = Math.sin(now / 200 + f.x) * 2; 
                ctx.fillStyle = '#2ecc71'; 
                ctx.beginPath(); 
                ctx.arc(f.x | 0, (f.y + oscylacja) | 0, 5, 0, TWO_PI); 
                ctx.fill();
            });

            // 4. BOTY I INNI GRACZE
            if (stanSerwera.bots) Object.values(stanSerwera.bots).forEach(bot => rysujBota(bot));
            if (stanSerwera.players) {
                Object.keys(stanSerwera.players).forEach(id => { 
                    if (id !== mojGracz.id) rysujPostac(stanSerwera.players[id], false); 
                });
            }

            // 5. MÓJ GRACZ (ZAWSZE NA WIERZCHU)
            rysujPostac(mojGracz, true);

            ctx.restore(); 

            // UI HUD ZAWSZE NA EKRANIE
            ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(pozycjaMyszki.x, pozycjaMyszki.y, 10, 0, TWO_PI); ctx.stroke();
            ctx.fillStyle = '#e74c3c'; ctx.fillRect(pozycjaMyszki.x - 1, pozycjaMyszki.y - 1, 2, 2);
        }
    };
})();