// ==========================================
// GRAFIKA.JS - Produkcyjny Silnik Renderujący (Architektura Północna & Taktyczne Boty)
// ==========================================

window.Grafika = (function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // --- ZMIENNE SYSTEMOWE ---
    let camera = { x: 0, y: 0 };
    let screenW = window.innerWidth;
    let screenH = window.innerHeight;
    
    // Pule obiektów i efekty
    let mapaObiekty = { krzaki: [], mury: [] };
    let czyMapaWygenerowana = false;
    let czasteczkiTla = []; 
    let sladPostaci = {}; 
    let lokalnyBuforJedzenia = {};
    
    // Zmienna do obsługi mapy pod klawiszem M
    let pokazDuzaMape = false;

    // Nasłuchiwanie klawisza M
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyM') pokazDuzaMape = true;
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyM') pokazDuzaMape = false;
    });

    // --- ŁADOWANIE GRAFIK POSTACI (ASSETY) ---
    const obrazyPostaci = {
        'standard': new Image(),
        'ninja': new Image(),
        'arystokrata': new Image()
    };
    obrazyPostaci['standard'].src = '/assety/xtreme-destiny-postac(1).png';
    obrazyPostaci['ninja'].src = '/assety/ninja-transparent.png';
    obrazyPostaci['arystokrata'].src = '/assety/postac-bez-tla.png';

    // --- OBSŁUGA EKRANU ---
    function resize() {
        screenW = window.innerWidth;
        screenH = window.innerHeight;
        canvas.width = screenW;
        canvas.height = screenH;
    }
    window.addEventListener('resize', resize);
    resize();

    // Optymalizacja: Culling (Rysuje tylko to, co widzi kamera)
    function czyWidoczny(x, y, promien) {
        const margines = 150;
        return (
            x + promien + margines > camera.x &&
            x - promien - margines < camera.x + screenW &&
            y + promien + margines > camera.y &&
            y - promien - margines < camera.y + screenH
        );
    }

    // --- ŚRODOWISKO I MAPA ---
    function generujSrodowisko(tryb) {
        mapaObiekty = { krzaki: [], mury: [] };
        czasteczkiTla = [];

        // Generowanie cząsteczek Vibe Noir
        for(let i = 0; i < 100; i++) {
            czasteczkiTla.push({
                x: Math.random() * screenW, y: Math.random() * screenH,
                speedX: (Math.random() - 0.5) * 0.5, speedY: (Math.random() - 0.5) * 0.5,
                r: Math.random() * 2
            });
        }
        
        if (tryb === 'FREE') {
            for(let i=0; i<45; i++) mapaObiekty.krzaki.push({ x: Math.random() * 4000, y: Math.random() * 4000, r: 70 });
        }
        czyMapaWygenerowana = true;
    }

    function aktualizujCząsteczki() {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        czasteczkiTla.forEach(c => {
            c.x += c.speedX; c.y += c.speedY;
            if (c.x < 0) c.x = screenW; if (c.x > screenW) c.x = 0;
            if (c.y < 0) c.y = screenH; if (c.y > screenH) c.y = 0;
            ctx.beginPath(); ctx.arc(camera.x + c.x, camera.y + c.y, c.r, 0, Math.PI*2); ctx.fill();
        });
    }

    // Generator baz dla trybu TEAMS
    function rysujZamek(x, y, kolorWiodacy, nazwa) {
        if (!czyWidoczny(x, y, 600)) return;

        const czas = Date.now();
        ctx.save();
        ctx.translate(x, y);

        // Fosa / Pole Siłowe (Strefa Bezpieczna)
        ctx.beginPath();
        ctx.arc(0, 0, 400, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${kolorWiodacy}, 0.05)`; // Delikatna poświata wewnątrz
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = `rgba(${kolorWiodacy}, 0.6)`;
        ctx.setLineDash([15, 20]); // Przerywany, technologiczny laser
        ctx.stroke();

        // Główna bryła bazy (Cyber-Bunkier)
        ctx.beginPath();
        ctx.rect(-150, -150, 300, 300);
        ctx.fillStyle = '#0a0a0a';
        ctx.fill();
        ctx.setLineDash([]); 
        ctx.lineWidth = 5;
        ctx.strokeStyle = `rgb(${kolorWiodacy})`;
        if (!window.Flagi.Srodowisko.isMobile) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = `rgb(${kolorWiodacy})`;
        }
        ctx.stroke();

        // Rdzeń centralny zbrojowni
        ctx.beginPath();
        ctx.rect(-80, -80, 160, 160);
        ctx.fillStyle = `rgba(${kolorWiodacy}, 0.2)`;
        ctx.fill();

        // Holograficzny podpis bazy
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Exo 2';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 0;
        ctx.fillText(nazwa, 0, -180);

        // Hologram Sklepu (Pulsujący)
        ctx.save();
        ctx.rotate(czas / 1000);
        ctx.strokeStyle = '#fff';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 15; ctx.shadowColor = '#fff'; }
        ctx.beginPath(); ctx.rect(-15, -15, 30, 30); ctx.rotate(Math.PI / 4); ctx.rect(-15, -15, 30, 30); 
        ctx.fill(); ctx.stroke();
        ctx.restore();

        ctx.restore();
    }

    function rysujMape(tryb, limitSwiata) {
        ctx.fillStyle = '#050505'; 
        ctx.fillRect(camera.x, camera.y, screenW, screenH);
        aktualizujCząsteczki();

        // Siatka
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.05)'; ctx.lineWidth = 1;
        const siatkaRozmiar = 200;
        const startX = Math.floor(camera.x / siatkaRozmiar) * siatkaRozmiar;
        const startY = Math.floor(camera.y / siatkaRozmiar) * siatkaRozmiar;
        ctx.beginPath();
        for(let x = startX; x < camera.x + screenW; x += siatkaRozmiar) { ctx.moveTo(x, camera.y); ctx.lineTo(x, camera.y + screenH); }
        for(let y = startY; y < camera.y + screenH; y += siatkaRozmiar) { ctx.moveTo(camera.x, y); ctx.lineTo(camera.x + screenW, y); }
        ctx.stroke();

        // Granice Świata
        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 6;
        if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 15; ctx.shadowColor = '#e74c3c'; }
        ctx.strokeRect(0, 0, limitSwiata, limitSwiata);
        ctx.shadowBlur = 0;

        const czas = Date.now();

        if (tryb === 'TEAMS') {
            // Generowanie potężnych baz dla trybu drużynowego
            rysujZamek(500, 3000, '231, 76, 60', 'BAZA CZERWONYCH');
            rysujZamek(5500, 3000, '52, 152, 219', 'BAZA NIEBIESKICH');
        } 
        else if (tryb === 'FREE') {
            // Krzaki (Stealth)
            mapaObiekty.krzaki.forEach(k => {
                if(czyWidoczny(k.x, k.y, k.r)) {
                    ctx.save(); ctx.translate(k.x, k.y);
                    let krzakGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, k.r);
                    krzakGrad.addColorStop(0, 'rgba(46, 204, 113, 0.05)'); krzakGrad.addColorStop(1, 'rgba(10, 30, 15, 0.8)');
                    ctx.fillStyle = krzakGrad; ctx.strokeStyle = 'rgba(46, 204, 113, 0.4)'; ctx.lineWidth = 4;
                    if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 15; ctx.shadowColor = '#2ecc71'; }
                    ctx.beginPath(); ctx.arc(0, 0, k.r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                    ctx.strokeStyle = 'rgba(46, 204, 113, 0.15)'; ctx.lineWidth = 2; ctx.shadowBlur = 0;
                    ctx.beginPath(); ctx.arc(-k.r*0.2, -k.r*0.2, k.r*0.6, 0, Math.PI*2); ctx.stroke();
                    ctx.beginPath(); ctx.arc(k.r*0.3, k.r*0.1, k.r*0.5, 0, Math.PI*2); ctx.stroke();
                    ctx.restore();
                }
            });
            
            // --- IKONICZNY ZAMEK Z PRZODU + FOSA ---
            if (czyWidoczny(2000, 2000, 400)) {
                ctx.save(); 
                ctx.translate(2000, 2000); // Środek mapy
                
                let puls = Math.abs(Math.sin(czas / 500)); 

                // POPRAWIONE KOLORY (Wysoki kontrast!)
                const kolorMuru = '#95a5a6';     // Jasny, kamienny szary (Super widoczny na czarnym tle)
                const kolorKrawedzi = '#f1c40f'; // Neonowe złoto
                const kolorDachu = '#e74c3c';    // Krwista czerwień
                const kolorFosy = 'rgba(52, 152, 219, 0.3)'; // Woda / Energia fosy
                const kolorFosyGlow = '#3498db';

                // 0. FOSA (Błękitny, jarzący się basen wokół zamku)
                ctx.beginPath();
                ctx.arc(0, 0, 320, 0, Math.PI * 2);
                ctx.fillStyle = kolorFosy;
                ctx.fill();
                ctx.lineWidth = 4;
                ctx.strokeStyle = kolorFosyGlow;
                if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 20; ctx.shadowColor = kolorFosyGlow; }
                ctx.stroke();
                ctx.shadowBlur = 0; // Wyłączamy cień na chwilę

                // 0.5 MOST ZWODZONY (Przez fosę do bramy)
                ctx.fillStyle = '#7f8c8d'; 
                ctx.fillRect(-50, 20, 100, 300); // Most prowadzący w dół mapy
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.strokeRect(-50, 20, 100, 300);

                ctx.lineWidth = 4;
                if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 15; ctx.shadowColor = '#000'; } // Cień pod zamkiem

                // 1. GŁÓWNY BUDYNEK (Środek)
                ctx.fillStyle = kolorMuru;
                ctx.strokeStyle = kolorKrawedzi;
                ctx.fillRect(-150, -100, 300, 200);
                ctx.strokeRect(-150, -100, 300, 200);

                // 2. GŁÓWNY DACH (Czerwony trójkąt)
                ctx.beginPath();
                ctx.moveTo(-180, -100); 
                ctx.lineTo(180, -100);  
                ctx.lineTo(0, -250);    
                ctx.closePath();
                ctx.fillStyle = kolorDachu;
                ctx.fill(); ctx.stroke();

                // 3. LEWA WIEŻA
                ctx.fillStyle = kolorMuru;
                ctx.fillRect(-220, -50, 70, 150);
                ctx.strokeRect(-220, -50, 70, 150);
                ctx.beginPath(); ctx.moveTo(-240, -50); ctx.lineTo(-130, -50); ctx.lineTo(-185, -150); ctx.closePath();
                ctx.fillStyle = kolorDachu; ctx.fill(); ctx.stroke();

                // 4. PRAWA WIEŻA
                ctx.fillStyle = kolorMuru;
                ctx.fillRect(150, -50, 70, 150);
                ctx.strokeRect(150, -50, 70, 150);
                ctx.beginPath(); ctx.moveTo(130, -50); ctx.lineTo(240, -50); ctx.lineTo(185, -150); ctx.closePath();
                ctx.fillStyle = kolorDachu; ctx.fill(); ctx.stroke();

                // 5. OTWARTA BRAMA WEJŚCIOWA (Zaprasza do środka)
                ctx.fillStyle = '#050505'; // Wnętrze bramy mroczne jak tło gry
                ctx.fillRect(-60, 20, 120, 80);
                ctx.strokeStyle = '#f1c40f';
                ctx.strokeRect(-60, 20, 120, 80);

                // 6. HOLOGRAM SKLEPU W BRAMIE (Pulsujący znacznik)
                ctx.save();
                ctx.translate(0, 60); // Środek bramy
                ctx.rotate(czas / 1000); 
                ctx.strokeStyle = '#fff'; 
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 15; ctx.shadowColor = '#fff'; }
                ctx.beginPath(); ctx.rect(-15, -15, 30, 30); ctx.rotate(Math.PI / 4); ctx.rect(-15, -15, 30, 30); 
                ctx.fill(); ctx.stroke();
                ctx.restore();

                ctx.restore();
            }
        }
    }

    // --- RYSOWANIE DRONÓW AI (Kształty Taktyczne) ---
    function rysujBota(bot) {
        if (!bot || !czyWidoczny(bot.x, bot.y, 100)) return;

        let wKrzaku = false;
        mapaObiekty.krzaki.forEach(k => { if (Math.hypot(bot.x - k.x, bot.y - k.y) < k.r) wKrzaku = true; });
        if (wKrzaku) return;

        let masa = Math.min(bot.score || 10, 600);
        let promien = 15 + Math.sqrt(masa) * 1.5;
        let isBoss = bot.skin === 'ninja';

        ctx.save();
        ctx.translate(bot.x, bot.y);
        ctx.rotate(bot.angle || 0);

        if (!window.Flagi.Srodowisko.isMobile) {
            ctx.shadowBlur = 15; ctx.shadowColor = isBoss ? '#9b59b6' : '#e74c3c';
        }

        ctx.fillStyle = '#050505';
        ctx.strokeStyle = isBoss ? '#9b59b6' : '#e74c3c';
        ctx.lineWidth = 3;

        ctx.beginPath();
        if (isBoss) {
            // Elita (Taktyczny kształt rombu)
            ctx.moveTo(promien * 0.8, -promien); 
            ctx.lineTo(promien, 0); 
            ctx.lineTo(promien * 0.8, promien); 
            ctx.lineTo(-promien * 0.8, promien); 
            ctx.lineTo(-promien, 0); 
            ctx.lineTo(-promien * 0.8, -promien);
        } else {
            // Dron (Sześciokąt)
            for (let i = 0; i < 6; i++) {
                ctx.lineTo(Math.cos(i * Math.PI/3) * promien, Math.sin(i * Math.PI/3) * promien);
            }
        }
        ctx.closePath(); 
        ctx.fill(); 
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = isBoss ? 'rgba(155, 89, 182, 0.5)' : 'rgba(231, 76, 60, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, promien * 0.4, 0, Math.PI*2); ctx.stroke();
        
        // Siatka celownicza
        ctx.beginPath();
        ctx.moveTo(-promien*0.6, 0); ctx.lineTo(promien*0.6, 0);
        ctx.moveTo(promien*0.3, -promien*0.5); ctx.lineTo(promien*0.3, promien*0.5);
        ctx.moveTo(-promien*0.3, -promien*0.5); ctx.lineTo(-promien*0.3, promien*0.5);
        ctx.stroke();

        ctx.restore();

        ctx.save();
        ctx.translate(bot.x, bot.y);
        ctx.fillStyle = isBoss ? '#9b59b6' : '#e74c3c';
        ctx.font = 'bold 12px Exo 2, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${bot.name} (${Math.floor(masa)})`, 0, -promien - 10);
        ctx.restore();
    }

    // --- RYSOWANIE GRACZY (Własne Assety PNG) ---
    function rysujPostac(postac, id, isMe) {
        if (!postac || !czyWidoczny(postac.x, postac.y, 100)) return;

        let wKrzaku = false;
        mapaObiekty.krzaki.forEach(k => {
            if (Math.hypot(postac.x - k.x, postac.y - k.y) < k.r) wKrzaku = true;
        });

        if (wKrzaku && !isMe) return; 

        let masa = Math.min(postac.score || 10, 600);
        let promien = 20 + Math.sqrt(masa) * 2;
        let skin = postac.skin || 'standard';

        ctx.save(); 
        if (wKrzaku && isMe) ctx.globalAlpha = 0.4; 

        if (masa >= 300 && !wKrzaku) {
            if (!sladPostaci[id]) sladPostaci[id] = [];
            sladPostaci[id].push({x: postac.x, y: postac.y});
            if (sladPostaci[id].length > 5) sladPostaci[id].shift();
            
            sladPostaci[id].forEach((punkt, index) => {
                ctx.beginPath(); ctx.arc(punkt.x, punkt.y, promien * 0.8 * (index/5), 0, Math.PI*2);
                ctx.fillStyle = (skin === 'ninja') ? `rgba(155, 89, 182, ${index * 0.05})` : `rgba(231, 76, 60, ${index * 0.05})`;
                ctx.fill();
            });
        }

        ctx.translate(postac.x, postac.y);
        if (postac.kat) ctx.rotate(postac.kat);

        let img = obrazyPostaci[skin] || obrazyPostaci['standard'];
        
        if (img.complete && img.naturalWidth !== 0) {
            if (masa >= 100 && !window.Flagi.Srodowisko.isMobile) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = skin === 'ninja' ? '#9b59b6' : (skin === 'arystokrata' ? '#f1c40f' : '#e74c3c');
            }
            ctx.drawImage(img, -promien, -promien, promien * 2, promien * 2);
        } else {
            ctx.fillStyle = '#555';
            ctx.beginPath(); ctx.arc(0, 0, promien, 0, Math.PI*2); ctx.fill();
        }

        ctx.restore(); 

        // Rysowanie Tarczy Ochronnej, gdy gracz jest w bezpiecznej strefie
        if (postac.isSafe) { 
            ctx.save();
            ctx.translate(postac.x, postac.y);
            ctx.strokeStyle = 'rgba(46, 204, 113, 0.6)'; // Neonowa Zieleń
            ctx.lineWidth = 3; 
            ctx.setLineDash([10, 15]); // Cyber-przerywana linia
            ctx.rotate(Date.now() / 800); // Tarcza wolno się obraca
            if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 15; ctx.shadowColor = '#2ecc71'; }
            ctx.beginPath(); ctx.arc(0, 0, promien + 15, 0, Math.PI*2); ctx.stroke(); 
            ctx.restore();
        } 
        else if (postac.isShielding) { // Tarcza z klawisza Q
            ctx.save();
            ctx.translate(postac.x, postac.y);
            ctx.strokeStyle = 'rgba(52, 152, 219, 0.7)'; 
            ctx.lineWidth = 4; 
            ctx.beginPath(); ctx.arc(0, 0, promien + 15, 0, Math.PI*2); ctx.stroke(); 
            ctx.restore();
        }

        ctx.save();
        if (wKrzaku && isMe) ctx.globalAlpha = 0.4;
        ctx.translate(postac.x, postac.y);
        ctx.fillStyle = '#ffffff'; 
        ctx.font = 'bold 14px Exo 2, sans-serif'; 
        ctx.textAlign = 'center';
        
        let prefix = masa >= 600 ? "👑 " : "";
        ctx.fillText(`${prefix}${postac.name || 'Gracz'} (${Math.floor(masa)})`, 0, promien + 25);
        ctx.restore();
    }

    // --- RYSOWANIE MAPY TAKTYCZNEJ (Ze szczegółowym Zamkiem i Bazami) ---
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

        // Zamek na mapie taktycznej (FREE)
        if (window.Flagi && window.Flagi.Stan.wybranyTryb === 'FREE') {
            const castleX = startX + (2000 * scale);
            const castleY = startY + (2000 * scale);
            const castleWidth = 300 * scale;
            const castleHeight = 250 * scale;

            ctx.save();
            ctx.translate(castleX, castleY);
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = czyMala ? 1 : 3;
            if (!window.Flagi.Srodowisko.isMobile && !czyMala) { ctx.shadowBlur = 10; ctx.shadowColor = '#f1c40f'; }
            ctx.fillStyle = 'rgba(241, 196, 15, 0.05)';

            // Bryła zamku
            ctx.beginPath();
            ctx.moveTo(-castleWidth/2, castleHeight/2);
            ctx.lineTo(castleWidth/2, castleHeight/2);
            ctx.lineTo(castleWidth/2, 0);

            // Blanki na prawej
            ctx.lineTo(castleWidth*0.6, 0); ctx.lineTo(castleWidth*0.6, -castleHeight*0.1);
            ctx.lineTo(castleWidth*0.7, -castleHeight*0.1); ctx.lineTo(castleWidth*0.7, 0);
            
            ctx.lineTo(castleWidth/2, 0);
            ctx.lineTo(castleWidth*0.4, -castleHeight*0.3);
            ctx.lineTo(0, -castleHeight/2); 
            ctx.lineTo(-castleWidth*0.4, -castleHeight*0.3);

            ctx.lineTo(-castleWidth/2, 0);
            // Blanki na lewej
            ctx.lineTo(-castleWidth*0.7, 0); ctx.lineTo(-castleWidth*0.7, -castleHeight*0.1);
            ctx.lineTo(-castleWidth*0.6, -castleHeight*0.1); ctx.lineTo(-castleWidth*0.6, 0);
            
            ctx.lineTo(-castleWidth/2, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Brama
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.4)';
            ctx.strokeRect(-castleWidth*0.15, castleHeight*0.15, castleWidth*0.3, castleHeight*0.35);

            ctx.restore();
        } 
        // Bazy na mapie taktycznej (TEAMS)
        else if (window.Flagi && window.Flagi.Stan.wybranyTryb === 'TEAMS') {
            // Baza Czerwonych
            ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
            ctx.strokeStyle = '#e74c3c';
            ctx.beginPath(); ctx.arc(startX + (500 * scale), startY + (3000 * scale), 400 * scale, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            // Baza Niebieskich
            ctx.fillStyle = 'rgba(52, 152, 219, 0.3)';
            ctx.strokeStyle = '#3498db';
            ctx.beginPath(); ctx.arc(startX + (5500 * scale), startY + (3000 * scale), 400 * scale, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        }

        function rysujKropke(x, y, kolor, promienKropki) {
            ctx.fillStyle = kolor;
            ctx.beginPath(); 
            ctx.arc(startX + (x * scale), startY + (y * scale), promienKropki, 0, Math.PI*2); 
            ctx.fill();
        }

        // Boty (Czerwone / Fioletowe)
        if (stanSerwera.bots) {
            Object.values(stanSerwera.bots).forEach(b => {
                const kolorBota = b.skin === 'ninja' ? '#9b59b6' : '#e74c3c';
                rysujKropke(b.x, b.y, kolorBota, czyMala ? 1 : 2);
            });
        }
        
        // Gracze
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

        // Twój znacznik (Biały puls)
        let puls = 2 + Math.abs(Math.sin(Date.now() / 300)) * 2;
        rysujKropke(mojGracz.x, mojGracz.y, '#ffffff', czyMala ? puls : puls * 2);

        // Aura radaru
        if (!czyMala) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(startX + (mojGracz.x * scale), startY + (mojGracz.y * scale), 300 * scale, 0, Math.PI*2); ctx.stroke();
            
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 24px Exo 2, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("MAPA TAKTYCZNA", startX + mapSize/2, startY - 20);
        }
        
        ctx.restore();
    }

    // --- GŁÓWNA PĘTLA RENDERUJĄCA ---
    return {
        rysujKlatke: function(stanSerwera, mojGracz) {
            if (!stanSerwera || !mojGracz) return;

            camera.x = mojGracz.x - screenW / 2; 
            camera.y = mojGracz.y - screenH / 2;
            
            let tryb = (window.Flagi && window.Flagi.Stan.wybranyTryb) ? window.Flagi.Stan.wybranyTryb : 'FREE';
            let limitWielkosci = tryb === 'TEAMS' ? 6000 : 4000;

            if (!czyMapaWygenerowana) generujSrodowisko(tryb);

            ctx.save(); 
            ctx.translate(-camera.x, -camera.y);

            rysujMape(tryb, limitWielkosci);

            if (stanSerwera.foods) {
                lokalnyBuforJedzenia = window.Guardian ? window.Guardian.safeObj(stanSerwera.foods) : stanSerwera.foods;
            }
            
            ctx.fillStyle = '#f1c40f';
            Object.values(lokalnyBuforJedzenia).forEach(f => {
                if (czyWidoczny(f.x, f.y, 5)) {
                    let r = 5 + Math.sin(Date.now() / 200 + f.x) * 1.5;
                    ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(2, r), 0, Math.PI*2); ctx.fill();
                }
            });

            if (stanSerwera.projectiles) {
                let bezpiecznePociski = window.Guardian ? window.Guardian.safeObj(stanSerwera.projectiles) : stanSerwera.projectiles;
                Object.values(bezpiecznePociski).forEach(proj => {
                    if (czyWidoczny(proj.x, proj.y, 20)) {
                        ctx.save(); ctx.translate(proj.x, proj.y); ctx.rotate(Math.atan2(proj.dy, proj.dx));
                        ctx.fillStyle = proj.piercing ? '#3498db' : '#bdc3c7';
                        if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle; }
                        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, 5); ctx.lineTo(-10, -5); ctx.closePath(); ctx.fill();
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

            ctx.restore(); // Koniec rysowania świata, powrót do warstwy UI

            // Rysowanie UI na wierzchu ekranu
            if (pokazDuzaMape) {
                rysujMapeTaktyczna(stanSerwera, mojGracz, limitWielkosci, false);
            } else {
                rysujMapeTaktyczna(stanSerwera, mojGracz, limitWielkosci, true);
            }
        }
    };
})();