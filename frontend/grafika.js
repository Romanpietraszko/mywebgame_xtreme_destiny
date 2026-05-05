// ==========================================
// GRAFIKA.JS - Ustabilizowany Silnik Renderujący (Faza 2: Czystość i Precyzja)
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
    let MacierzOtoczenia = []; 
    let czyMapaWygenerowana = false;
    let czasteczkiTla = []; 
    
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
    ladujObrazek('standard', '/assety/xtreme-destiny-postac-1.png'); // Zmieniono nazwę pliku z nawiasami!
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

        // ZAMEK / BAZA
        if (tryb === 'FREE' && czyWidoczny(2000, 2000, 400)) {
            ctx.save(); 
            ctx.translate(2000, 2000); 
            ctx.fillStyle = 'rgba(52, 152, 219, 0.1)'; ctx.beginPath(); ctx.arc(0, 0, 400, 0, TWO_PI); ctx.fill();
            ctx.strokeStyle = '#3498db'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 400, 0, TWO_PI); ctx.stroke();
            
            ctx.fillStyle = '#7f8c8d'; ctx.fillRect(-150, -100, 300, 200); 
            ctx.strokeStyle = '#f1c40f'; ctx.strokeRect(-150, -100, 300, 200);
            ctx.restore();
        }
    }

    // ==========================================
    // RENDEROWANIE BOTÓW I GRACZY (STABILNE)
    // ==========================================
    function rysujBota(bot) {
        let promien = 15 + Math.sqrt(Math.min(bot.score || 10, 600)) * 1.5;
        if (!czyWidoczny(bot.x, bot.y, promien)) return;

        let isBoss = bot.isBoss || bot.skin === 'ninja';
        let kolor = isBoss ? '#9b59b6' : '#e74c3c';
        if (bot.ownerId && bot.team) kolor = bot.team === 'RED' ? '#e74c3c' : '#3498db';

        ctx.save(); 
        ctx.translate(bot.x | 0, bot.y | 0); 
        ctx.rotate(bot.angle || 0);

        // Kształt bota
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

        // Oznaczenie przodu
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(promien, 0); ctx.stroke();
        ctx.restore();

        // Tekst
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

        let skin = postac.skin || 'standard';
        let kolor = skin === 'ninja' ? '#9b59b6' : (skin === 'arystokrata' ? '#f1c40f' : '#e74c3c');
        if (postac.team) kolor = postac.team === 'RED' ? '#e74c3c' : '#3498db';

        ctx.save(); 
        ctx.translate(postac.x | 0, postac.y | 0); 
        ctx.rotate(postac.kat || 0);

        // BEZPIECZNE RYSOWANIE
        let asset = obrazyPostaci[skin];
        if (asset && asset.loaded) {
            AkceleratorRenderu.ustawCien(ctx, kolor, 15);
            ctx.drawImage(asset.img, -promien, -promien, promien * 2, promien * 2);
            AkceleratorRenderu.resetujCien(ctx);
            
            // Marker kierunku nad teksturą
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(promien * 0.5, 0); ctx.lineTo(promien + 10, 0); ctx.stroke();
        } else {
            // Awaryjny wektor
            ctx.fillStyle = '#111'; ctx.strokeStyle = kolor; ctx.lineWidth = 4;
            AkceleratorRenderu.ustawCien(ctx, kolor, 20);
            ctx.beginPath(); ctx.arc(0, 0, promien, 0, TWO_PI); ctx.fill(); ctx.stroke();
            AkceleratorRenderu.resetujCien(ctx);
            // Kierunek
            ctx.fillStyle = kolor; ctx.fillRect(0, -5, promien + 10, 10);
        }
        ctx.restore(); 

        // Nazwa i masa
        ctx.save();
        ctx.translate(postac.x | 0, postac.y | 0); 
        ctx.fillStyle = isMe ? '#f1c40f' : '#ffffff'; 
        ctx.font = 'bold 14px Exo 2, sans-serif'; 
        ctx.textAlign = 'center';
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

            // Kamera
            let celX = mojGracz.x - screenW / 2; let celY = mojGracz.y - screenH / 2;
            camera.x += (celX - camera.x) * (0.2 * dt); 
            camera.y += (celY - camera.y) * (0.2 * dt);

            // Wstrząs
            let drawCamX = camera.x + (Math.random() - 0.5) * wstrzasEkranu.moc; 
            let drawCamY = camera.y + (Math.random() - 0.5) * wstrzasEkranu.moc;
            wstrzasEkranu.moc *= Math.pow(wstrzasEkranu.wygasanie, dt);

            let tryb = (window.Flagi && window.Flagi.Stan.wybranyTryb) ? window.Flagi.Stan.wybranyTryb : 'FREE';
            let limitWielkosci = tryb === 'TEAMS' ? 6000 : 4000;

            if (!czyMapaWygenerowana) generujSrodowisko(tryb, limitWielkosci);
            ZarzadcaPamieci.wyczyscPamiecCoRunde();

            // PŁÓTNO GŁÓWNE
            ctx.save(); 
            ctx.translate(screenW / 2, screenH / 2);
            ctx.scale(cameraScale, cameraScale);
            ctx.translate(-screenW / 2, -screenH / 2);
            ctx.translate(-drawCamX, -drawCamY);

            // 1. TŁO I ŚRODOWISKO
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
                Object.values(stanSerwera.foods).forEach(f => {
                    if (!czyWidoczny(f.x, f.y, 10)) return;
                    ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(f.x | 0, f.y | 0, 5, 0, TWO_PI); ctx.fill();
                });
            }

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
            // Celownik myszki
            ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(pozycjaMyszki.x, pozycjaMyszki.y, 10, 0, TWO_PI); ctx.stroke();
            ctx.fillStyle = '#e74c3c'; ctx.fillRect(pozycjaMyszki.x - 1, pozycjaMyszki.y - 1, 2, 2);
        }
    };
})();