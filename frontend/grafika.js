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
    let mapaObiekty = { krzaki: [], mury: [], swiatla: [] };
    let czyMapaWygenerowana = false;
    let czasteczkiTla = []; 
    let sladPostaci = {}; 
    let lokalnyBuforJedzenia = {};
    
    // Zmienne efektów specjalnych i śledzenia
    let czasWejsciaGraczy = {};
    let pokazDuzaMape = false;
    let wstrzasEkranu = { moc: 0, wygasanie: 0.9 }; // System trzęsienia kamery

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

    // --- ŚRODOWISKO I MAPA Z POGODĄ ---
    function generujSrodowisko(tryb) {
        mapaObiekty = { krzaki: [], mury: [], swiatla: [] };
        czasteczkiTla = [];

        // Dynamiczna pogoda zależna od trybu gry
        let iloscCzasteczek = tryb === 'CAMPAIGN' ? 150 : (tryb === 'TEAMS' ? 200 : 100);
        
        for(let i = 0; i < iloscCzasteczek; i++) {
            let predkoscX = (Math.random() - 0.5) * 0.5;
            let predkoscY = (Math.random() - 0.5) * 0.5;
            let rozmiar = Math.random() * 2;

            if (tryb === 'TEAMS') {
                // Szybki wojenny deszcz popiołu
                predkoscX = (Math.random() * 2 + 1); 
                predkoscY = (Math.random() * 3 + 2);
            } else if (tryb === 'CAMPAIGN') {
                // Powolne, mroczne zarodniki
                rozmiar = Math.random() * 4 + 1;
                predkoscX = (Math.random() - 0.5) * 0.2;
                predkoscY = (Math.random() - 0.5) * 0.2;
            }

            czasteczkiTla.push({
                x: Math.random() * screenW, 
                y: Math.random() * screenH,
                speedX: predkoscX, 
                speedY: predkoscY,
                r: rozmiar,
                alpha: Math.random() * 0.5 + 0.1
            });
        }
        
        if (tryb === 'FREE') {
            for(let i=0; i<45; i++) mapaObiekty.krzaki.push({ x: Math.random() * 4000, y: Math.random() * 4000, r: 70 });
            
            for(let i=0; i<40; i++) {
                mapaObiekty.swiatla.push({ 
                    x: Math.random() * 4000, 
                    y: Math.random() * 4000, 
                    r: Math.random() * 100 + 50,
                    color: ['rgba(231,76,60,0.05)', 'rgba(52,152,219,0.05)', 'rgba(155,89,182,0.05)'][Math.floor(Math.random()*3)]
                });
            }
        }
        czyMapaWygenerowana = true;
    }

    function aktualizujCząsteczki(tryb) {
        czasteczkiTla.forEach(c => {
            c.x += c.speedX; c.y += c.speedY;
            if (c.x < 0) c.x = screenW; if (c.x > screenW) c.x = 0;
            if (c.y < 0) c.y = screenH; if (c.y > screenH) c.y = 0;
            
            if (tryb === 'TEAMS') {
                // Rysowanie dynamicznych linii iskier/deszczu
                ctx.fillStyle = `rgba(200, 200, 200, ${c.alpha})`;
                ctx.beginPath(); 
                ctx.moveTo(camera.x + c.x, camera.y + c.y); 
                ctx.lineTo(camera.x + c.x - c.speedX * 3, camera.y + c.y - c.speedY * 3); 
                ctx.strokeStyle = ctx.fillStyle; 
                ctx.lineWidth = 1.5; 
                ctx.stroke();
            } else if (tryb === 'CAMPAIGN') {
                // Rozmyte, niepokojące plamy
                ctx.fillStyle = `rgba(180, 20, 20, ${c.alpha * 0.4})`;
                ctx.beginPath(); ctx.arc(camera.x + c.x, camera.y + c.y, c.r, 0, Math.PI*2); ctx.fill();
            } else {
                // Standardowe białe neonowe pyłki
                ctx.fillStyle = `rgba(255, 255, 255, ${c.alpha})`;
                ctx.beginPath(); ctx.arc(camera.x + c.x, camera.y + c.y, c.r, 0, Math.PI*2); ctx.fill();
            }
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
        aktualizujCząsteczki(tryb);

        // Siatka
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.05)'; ctx.lineWidth = 1;
        const siatkaRozmiar = 200;
        const startX = Math.floor(camera.x / siatkaRozmiar) * siatkaRozmiar;
        const startY = Math.floor(camera.y / siatkaRozmiar) * siatkaRozmiar;
        ctx.beginPath();
        for(let x = startX; x < camera.x + screenW; x += siatkaRozmiar) { ctx.moveTo(x, camera.y); ctx.lineTo(x, camera.y + screenH); }
        for(let y = startY; y < camera.y + screenH; y += siatkaRozmiar) { ctx.moveTo(camera.x, y); ctx.lineTo(camera.x + screenW, y); }
        ctx.stroke();

        if (mapaObiekty.swiatla) {
            mapaObiekty.swiatla.forEach(s => {
                if(czyWidoczny(s.x, s.y, s.r)) {
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
                    ctx.fillStyle = s.color;
                    ctx.fill();
                }
            });
        }

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

                const kolorMuru = '#95a5a6';     
                const kolorKrawedzi = '#f1c40f'; 
                const kolorDachu = '#e74c3c';    
                const kolorFosy = 'rgba(52, 152, 219, 0.3)'; 
                const kolorFosyGlow = '#3498db';

                ctx.beginPath();
                ctx.arc(0, 0, 320, 0, Math.PI * 2);
                ctx.fillStyle = kolorFosy;
                ctx.fill();
                ctx.lineWidth = 4;
                ctx.strokeStyle = kolorFosyGlow;
                if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 20; ctx.shadowColor = kolorFosyGlow; }
                ctx.stroke();
                ctx.shadowBlur = 0; 

                ctx.fillStyle = '#7f8c8d'; 
                ctx.fillRect(-50, 20, 100, 300); 
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.strokeRect(-50, 20, 100, 300);

                ctx.lineWidth = 4;
                if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 15; ctx.shadowColor = '#000'; } 

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
                ctx.fill(); ctx.stroke();

                ctx.fillStyle = kolorMuru;
                ctx.fillRect(-220, -50, 70, 150);
                ctx.strokeRect(-220, -50, 70, 150);
                ctx.beginPath(); ctx.moveTo(-240, -50); ctx.lineTo(-130, -50); ctx.lineTo(-185, -150); ctx.closePath();
                ctx.fillStyle = kolorDachu; ctx.fill(); ctx.stroke();

                ctx.fillStyle = kolorMuru;
                ctx.fillRect(150, -50, 70, 150);
                ctx.strokeRect(150, -50, 70, 150);
                ctx.beginPath(); ctx.moveTo(130, -50); ctx.lineTo(240, -50); ctx.lineTo(185, -150); ctx.closePath();
                ctx.fillStyle = kolorDachu; ctx.fill(); ctx.stroke();

                ctx.fillStyle = '#050505'; 
                ctx.fillRect(-60, 20, 120, 80);
                ctx.strokeStyle = '#f1c40f';
                ctx.strokeRect(-60, 20, 120, 80);

                ctx.save();
                ctx.translate(0, 60); 
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

    // --- RYSOWANIE DRONÓW AI (AURY FRAKCYJNE) ---
    function rysujBota(bot) {
        if (!bot || !czyWidoczny(bot.x, bot.y, 100)) return;

        let wKrzaku = false;
        mapaObiekty.krzaki.forEach(k => { if (Math.hypot(bot.x - k.x, bot.y - k.y) < k.r) wKrzaku = true; });
        if (wKrzaku) return;

        let masa = Math.min(bot.score || 10, 600);
        let promien = 15 + Math.sqrt(masa) * 1.5;
        let isBoss = bot.isBoss || bot.skin === 'ninja';

        ctx.save();
        ctx.translate(bot.x, bot.y);
        ctx.rotate(bot.angle || 0);

        // KONTROLA KOLORU I AURY (Zależne od bycia w Drużynie)
        let mainColor = isBoss ? '#9b59b6' : '#e74c3c';
        let strokeColor = mainColor;
        
        if (bot.ownerId && bot.team) {
            // Jeśli bot został zwerbowany do armii - nadpisujemy wygląd!
            strokeColor = bot.team === 'RED' ? '#e74c3c' : '#3498db';
            
            // Rysowanie pulsującej Aury na ziemi dla zwerbowanych
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, promien + 8, 0, Math.PI * 2);
            ctx.fillStyle = bot.team === 'RED' ? 'rgba(231, 76, 60, 0.2)' : 'rgba(52, 152, 219, 0.2)';
            ctx.fill();
            if (window.Flagi && !window.Flagi.Srodowisko.isMobile) {
                ctx.shadowBlur = 20; 
                ctx.shadowColor = strokeColor;
            }
            ctx.lineWidth = 2;
            ctx.strokeStyle = strokeColor;
            ctx.setLineDash([5, 5]); 
            ctx.stroke();
            ctx.restore();
        }

        if (window.Flagi && !window.Flagi.Srodowisko.isMobile) {
            ctx.shadowBlur = 15; ctx.shadowColor = strokeColor;
        }

        ctx.fillStyle = '#050505';
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;

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

        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(${strokeColor === '#3498db' ? '52, 152, 219' : '231, 76, 60'}, 0.5)`;
        if (isBoss) ctx.strokeStyle = 'rgba(155, 89, 182, 0.5)';
        
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, promien * 0.4, 0, Math.PI*2); ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(-promien*0.6, 0); ctx.lineTo(promien*0.6, 0);
        ctx.moveTo(promien*0.3, -promien*0.5); ctx.lineTo(promien*0.3, promien*0.5);
        ctx.moveTo(-promien*0.3, -promien*0.5); ctx.lineTo(-promien*0.3, promien*0.5);
        ctx.stroke();

        ctx.restore();

        // Nie rysujemy nicku Bossa na samej postaci, bo ma teraz wielki pasek u góry ekranu w kampanii
        if (!isBoss) {
            ctx.save();
            ctx.translate(bot.x, bot.y);
            ctx.fillStyle = strokeColor;
            ctx.font = 'bold 12px Exo 2, sans-serif';
            ctx.textAlign = 'center';
            
            // Dodawanie tagu frakcji do nazwy bota
            let factionTag = "";
            if (bot.ownerId) factionTag = bot.team === 'RED' ? "[RED] " : "[BLUE] ";
            
            ctx.fillText(`${factionTag}${bot.name} (${Math.floor(masa)})`, 0, -promien - 15);
            ctx.restore();
        }
    }

    // --- RYSOWANIE GRACZY (Z Systemem Visual Progression!) ---
    function rysujPostac(postac, id, isMe) {
        if (!postac || !czyWidoczny(postac.x, postac.y, 100)) return;

        let wKrzaku = false;
        mapaObiekty.krzaki.forEach(k => {
            if (Math.hypot(postac.x - k.x, postac.y - k.y) < k.r) wKrzaku = true;
        });

        if (wKrzaku && !isMe) return; 

        // TWARDY LIMIT WIELKOŚCI GRACZA (Żeby nie zasłaniał całego ekranu!)
        let masa = Math.max(10, postac.score || 10);
        let obliczonyPromien = 20 + Math.sqrt(masa) * 2;
        let promien = Math.min(obliczonyPromien, 65); // Zablokowane na max 65 pikseli promienia
        
        let skin = postac.skin || 'standard';
        let currentTime = Date.now();

        // Rejestrowanie czasu wejścia dla efektu zrzutu orbitalnego
        if (!czasWejsciaGraczy[id]) {
            czasWejsciaGraczy[id] = currentTime;
        }
        let czasOdWejscia = currentTime - czasWejsciaGraczy[id];

        ctx.save(); 
        if (wKrzaku && isMe) ctx.globalAlpha = 0.4; 

        // 1. DESANT ORBITALNY (Efekt WOW przez pierwsze 1.2 sekundy)
        if (czasOdWejscia < 1200) {
            let op = 1 - (czasOdWejscia / 1200);
            ctx.save();
            ctx.translate(postac.x, postac.y);
            
            // Filar światła
            ctx.fillStyle = `rgba(52, 152, 219, ${op * 0.6})`;
            ctx.fillRect(-promien, -screenH, promien*2, screenH);
            
            // Fala uderzeniowa (Shockwave)
            ctx.strokeStyle = `rgba(52, 152, 219, ${op})`;
            ctx.lineWidth = 15 * op;
            ctx.beginPath(); ctx.arc(0, 0, promien + (czasOdWejscia * 0.3), 0, Math.PI*2); ctx.stroke();
            ctx.restore();
        }

        // 2. ŚLAD RUCHU (Dla ciężkich postaci)
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

        // 3. RYSOWANIE SAMEJ POSTACI (Z rotacją)
        ctx.save();
        ctx.translate(postac.x, postac.y);
        let postacKat = postac.kat || 0;
        ctx.rotate(postacKat);

        let img = obrazyPostaci[skin] || obrazyPostaci['standard'];
        
        if (img.complete && img.naturalWidth !== 0) {
            if (masa >= 100 && window.Flagi && !window.Flagi.Srodowisko.isMobile) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = skin === 'ninja' ? '#9b59b6' : (skin === 'arystokrata' ? '#f1c40f' : '#e74c3c');
            }
            ctx.drawImage(img, -promien, -promien, promien * 2, promien * 2);
        } else {
            ctx.fillStyle = '#555';
            ctx.beginPath(); ctx.arc(0, 0, promien, 0, Math.PI*2); ctx.fill();
        }
        ctx.shadowBlur = 0; // Reset cienia dla nakładek

        // ==========================================
        // SYSTEM VISUAL PROGRESSION (NAKŁADKI)
        // ==========================================
        
        // Definiowanie kolorów klasowych do pancerza
        let kolorZbroi = '#3498db'; // Standard (Niebieski)
        if (skin === 'ninja') kolorZbroi = '#9b59b6'; // Fioletowy
        if (skin === 'arystokrata') kolorZbroi = '#e74c3c'; // Czerwony/Złoty
        
        // A. EWOLUCJA OSZCZEPU (Trzymany w prawej ręce)
        ctx.save();
        ctx.translate(promien * 0.7, promien * 0.2); // Przesunięcie do prawej dłoni
        ctx.rotate(Math.PI / -4); // Wychylenie broni w przód
        
        // Obliczanie ewolucji od 10 do 49 masy
        let progresOszczepu = Math.min(1, Math.max(0, (masa - 10) / 39)); 
        let hue = Math.floor(0 + 280 * progresOszczepu); // Od szarości/czerwieni do fioletu (280)
        let saturation = Math.floor(0 + 80 * progresOszczepu);
        let lightness = Math.floor(60 - 10 * progresOszczepu);
        
        let kolorOszczepu = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        
        ctx.strokeStyle = kolorOszczepu;
        ctx.lineWidth = 4 + (2 * progresOszczepu); // Oszczep grubieje
        if (progresOszczepu > 0.8 && window.Flagi && !window.Flagi.Srodowisko.isMobile) {
            ctx.shadowBlur = 10; ctx.shadowColor = kolorOszczepu;
        }
        // Drzewiec
        ctx.beginPath(); ctx.moveTo(0, -promien); ctx.lineTo(0, promien); ctx.stroke();
        // Grot
        ctx.fillStyle = kolorOszczepu;
        ctx.beginPath(); ctx.moveTo(-5, -promien); ctx.lineTo(5, -promien); ctx.lineTo(0, -promien - 15); ctx.closePath(); ctx.fill();
        ctx.restore();

        // B. TIER 1: PUKLERZ / NARAMIENNIK (Masa >= 50)
        if (masa >= 50) {
            ctx.save();
            ctx.translate(-promien * 0.8, 0); // Lewe ramię
            ctx.fillStyle = '#111';
            ctx.strokeStyle = kolorZbroi;
            ctx.lineWidth = 3;
            if (window.Flagi && !window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 10; ctx.shadowColor = kolorZbroi; }
            
            // Kształt naramiennika
            ctx.beginPath();
            ctx.moveTo(-10, -15);
            ctx.lineTo(-20, 0);
            ctx.lineTo(-10, 15);
            ctx.lineTo(5, 0);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            
            // C. TIER 4: WZMOCNIONY PUKLERZ ENERGETYCZNY (Masa >= 150)
            if (masa >= 150) {
                ctx.rotate(currentTime / 500); // Rotacja tarczy
                ctx.strokeStyle = `rgba(${kolorZbroi === '#3498db' ? '52,152,219' : kolorZbroi === '#9b59b6' ? '155,89,182' : '231,76,60'}, 0.6)`;
                ctx.setLineDash([5, 10]);
                ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI*2); ctx.stroke();
            }
            ctx.restore();
        }
        ctx.restore(); // Koniec transformacji rotacji dla całej postaci

        // D. TIER 5: KORONA WŁADCY (Masa >= 600)
        if (masa >= 600) {
            ctx.save();
            ctx.translate(postac.x, postac.y - promien - 20); // Zawsze nad głową (nie obraca się z ciałem)
            // Lekkie unoszenie się (Hover)
            ctx.translate(0, Math.sin(currentTime / 200) * 5); 
            
            ctx.fillStyle = '#f1c40f'; // Czyste złoto
            if (window.Flagi && !window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 15; ctx.shadowColor = '#f1c40f'; }
            
            ctx.beginPath();
            ctx.moveTo(-15, 0); ctx.lineTo(-20, -15); // Lewy róg
            ctx.lineTo(-7, -5); ctx.lineTo(0, -20);   // Środek
            ctx.lineTo(7, -5); ctx.lineTo(20, -15);   // Prawy róg
            ctx.lineTo(15, 0); ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // Tarcze Ochronne / Zdolności (Bezpieczna Strefa i Q)
        if (postac.isSafe) { 
            ctx.save();
            ctx.translate(postac.x, postac.y);
            ctx.strokeStyle = 'rgba(46, 204, 113, 0.6)'; 
            ctx.lineWidth = 3; 
            ctx.setLineDash([10, 15]); 
            ctx.rotate(currentTime / 800); 
            if (window.Flagi && !window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 15; ctx.shadowColor = '#2ecc71'; }
            ctx.beginPath(); ctx.arc(0, 0, promien + 15, 0, Math.PI*2); ctx.stroke(); 
            ctx.restore();
        } 
        else if (postac.isShielding) { 
            ctx.save();
            ctx.translate(postac.x, postac.y);
            ctx.strokeStyle = 'rgba(52, 152, 219, 0.7)'; 
            ctx.lineWidth = 4; 
            ctx.beginPath(); ctx.arc(0, 0, promien + 15, 0, Math.PI*2); ctx.stroke(); 
            ctx.restore();
        }
        
        ctx.restore(); // Całkowite zamknięcie głównego stanu (reset alpha itp)

        // RENDEROWANIE NICKU I MASY
        ctx.save();
        if (wKrzaku && isMe) ctx.globalAlpha = 0.4;
        ctx.translate(postac.x, postac.y);
        ctx.fillStyle = '#ffffff'; 
        ctx.font = 'bold 14px Exo 2, sans-serif'; 
        ctx.textAlign = 'center';
        
        let prefix = masa >= 600 ? "👑 " : "";
        ctx.fillText(`${prefix}${postac.name || 'Gracz'} (${Math.floor(masa)})`, 0, promien + 25 + (masa >= 600 ? 5 : 0));
        ctx.restore();
    }

    // --- ZAKTUALIZOWANE EFEKTY WIZUALNE I PASKI BOSSA ---
    function rysujEfektyEkranu(tryb, stanSerwera, mojGracz) {
        if (tryb === 'TEAMS' && mojGracz.team) {
            // Poświata na krawędziach zależna od drużyny
            let gradient = ctx.createRadialGradient(screenW/2, screenH/2, screenH/1.5, screenW/2, screenH/2, screenW);
            let teamColor = mojGracz.team === 'RED' ? 'rgba(231, 76, 60, 0.2)' : 'rgba(52, 152, 219, 0.2)';
            gradient.addColorStop(0, 'rgba(0,0,0,0)');
            gradient.addColorStop(1, teamColor);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, screenW, screenH);
        } 
        else if (tryb === 'CAMPAIGN') {
            // Prawdziwa Mgła Wojny (Tylko otoczenie gracza jest widoczne)
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0); 
            
            let masaDoŚwiatła = Math.max(10, mojGracz.score || 10);
            let promienSwiatla = 250 + Math.sqrt(masaDoŚwiatła) * 8; // Światło rośnie z masą
            
            // Tworzenie ciemnego płótna z wyciętą dziurą (Światło latarki)
            let gradient = ctx.createRadialGradient(screenW/2, screenH/2, promienSwiatla * 0.4, screenW/2, screenH/2, promienSwiatla);
            gradient.addColorStop(0, 'rgba(0,0,0,0)'); // Środek jest przeźroczysty
            gradient.addColorStop(1, 'rgba(5,5,5,0.96)'); // Krawędzie ucinają widoczność do czerni
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, screenW, screenH);
            
            // Dorysowanie absolutnej czerni poza okręgiem
            ctx.beginPath();
            ctx.rect(0, 0, screenW, screenH);
            ctx.arc(screenW/2, screenH/2, promienSwiatla, 0, Math.PI*2, true);
            ctx.fillStyle = 'rgba(5,5,5,0.96)';
            ctx.fill();

            // Rysowanie UI Bossa (Jeśli istnieje)
            let bossAlive = null;
            if (stanSerwera.bots) {
                Object.values(stanSerwera.bots).forEach(b => { if (b.isBoss || b.skin === 'ninja') bossAlive = b; });
            }
            
            if (bossAlive) {
                // Alarm na krawędziach
                let alarmAlpha = Math.abs(Math.sin(Date.now() / 300)) * 0.2;
                ctx.fillStyle = `rgba(231, 76, 60, ${alarmAlpha})`;
                ctx.fillRect(0, 0, screenW, screenH);

                // GIGANTYCZNY PASEK ZDROWIA BOSSA
                let barW = Math.min(screenW * 0.7, 800);
                let barH = 22;
                let barX = (screenW - barW) / 2;
                let barY = 50;
                
                // Obliczanie % HP (Boss w serwerze zaczyna od 1500 masy)
                let maxBossHp = bossAlive.maxScore || 1500;
                let hpPercent = Math.max(0, bossAlive.score / maxBossHp);
                
                // Tło Paska
                ctx.fillStyle = 'rgba(15, 0, 0, 0.8)';
                ctx.fillRect(barX, barY, barW, barH);
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 3;
                ctx.strokeRect(barX, barY, barW, barH);
                
                // Wypełnienie Czerwienią
                ctx.fillStyle = '#e74c3c';
                if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 20; ctx.shadowColor = '#e74c3c'; }
                ctx.fillRect(barX, barY, barW * hpPercent, barH);
                ctx.shadowBlur = 0;

                // Tytuł nad paskiem
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 22px Permanent Marker, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`TYTAN OMEGA`, screenW / 2, barY - 12);
            }
            ctx.restore();
        }
    }

    // --- RYSOWANIE MAPY TAKTYCZNEJ ---
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

        if (window.Flagi && window.Flagi.Stan.wybranyTryb === 'FREE') {
            const castleX = startX + (2000 * scale);
            const castleY = startY + (2000 * scale);
            const castleWidth = 300 * scale;
            const castleHeight = 250 * scale;

            ctx.save();
            ctx.translate(castleX, castleY);
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = czyMala ? 1 : 3;
            if (window.Flagi && !window.Flagi.Srodowisko.isMobile && !czyMala) { ctx.shadowBlur = 10; ctx.shadowColor = '#f1c40f'; }
            ctx.fillStyle = 'rgba(241, 196, 15, 0.05)';

            ctx.beginPath();
            ctx.moveTo(-castleWidth/2, castleHeight/2);
            ctx.lineTo(castleWidth/2, castleHeight/2);
            ctx.lineTo(castleWidth/2, 0);

            ctx.lineTo(castleWidth*0.6, 0); ctx.lineTo(castleWidth*0.6, -castleHeight*0.1);
            ctx.lineTo(castleWidth*0.7, -castleHeight*0.1); ctx.lineTo(castleWidth*0.7, 0);
            
            ctx.lineTo(castleWidth/2, 0);
            ctx.lineTo(castleWidth*0.4, -castleHeight*0.3);
            ctx.lineTo(0, -castleHeight/2); 
            ctx.lineTo(-castleWidth*0.4, -castleHeight*0.3);

            ctx.lineTo(-castleWidth/2, 0);
            ctx.lineTo(-castleWidth*0.7, 0); ctx.lineTo(-castleWidth*0.7, -castleHeight*0.1);
            ctx.lineTo(-castleWidth*0.6, -castleHeight*0.1); ctx.lineTo(-castleWidth*0.6, 0);
            
            ctx.lineTo(-castleWidth/2, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.strokeStyle = 'rgba(241, 196, 15, 0.4)';
            ctx.strokeRect(-castleWidth*0.15, castleHeight*0.15, castleWidth*0.3, castleHeight*0.35);
            ctx.restore();
        } 
        else if (window.Flagi && window.Flagi.Stan.wybranyTryb === 'TEAMS') {
            ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
            ctx.strokeStyle = '#e74c3c';
            ctx.beginPath(); ctx.arc(startX + (500 * scale), startY + (3000 * scale), 400 * scale, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            
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

        if (stanSerwera.bots) {
            Object.values(stanSerwera.bots).forEach(b => {
                const kolorBota = b.skin === 'ninja' ? '#9b59b6' : '#e74c3c';
                rysujKropke(b.x, b.y, kolorBota, czyMala ? 1 : 2);
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
        // Publiczne API wstrząsu przeniesione w bezpieczne miejsce
        wywolajWstrzas: function(moc) {
            wstrzasEkranu.moc = moc;
        },
        rysujKlatke: function(stanSerwera, mojGracz) {
            if (!stanSerwera || !mojGracz) return;

            camera.x = mojGracz.x - screenW / 2; 
            camera.y = mojGracz.y - screenH / 2;
            
            // Aplikacja Trzęsienia Kamery
            if (wstrzasEkranu.moc > 0.5) {
                camera.x += (Math.random() - 0.5) * wstrzasEkranu.moc;
                camera.y += (Math.random() - 0.5) * wstrzasEkranu.moc;
                wstrzasEkranu.moc *= wstrzasEkranu.wygasanie;
            }
            
            let tryb = (window.Flagi && window.Flagi.Stan.wybranyTryb) ? window.Flagi.Stan.wybranyTryb : 'FREE';
            let limitWielkosci = tryb === 'TEAMS' ? 6000 : 4000;

            if (!czyMapaWygenerowana) generujSrodowisko(tryb);

            ctx.save(); 
            ctx.translate(-camera.x, -camera.y);

            rysujMape(tryb, limitWielkosci);

            if (stanSerwera.foods) {
                lokalnyBuforJedzenia = window.Guardian ? window.Guardian.safeObj(stanSerwera.foods, 'foods') : stanSerwera.foods;
            }
            
            ctx.fillStyle = '#f1c40f';
            Object.values(lokalnyBuforJedzenia).forEach(f => {
                if (czyWidoczny(f.x, f.y, 5)) {
                    let r = 5 + Math.sin(Date.now() / 200 + f.x) * 1.5;
                    ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(2, r), 0, Math.PI*2); ctx.fill();
                }
            });

            // ==========================================
            // ZAKTUALIZOWANE RYSOWANIE POCISKÓW (OSZCZEPY I LASERY)
            // ==========================================
            if (stanSerwera.projectiles) {
                let bezpiecznePociski = window.Guardian ? window.Guardian.safeObj(stanSerwera.projectiles, 'projectiles') : stanSerwera.projectiles;
                Object.values(bezpiecznePociski).forEach(proj => {
                    if (czyWidoczny(proj.x, proj.y, 30)) {
                        ctx.save(); 
                        ctx.translate(proj.x, proj.y); 
                        ctx.rotate(Math.atan2(proj.dy, proj.dx));
                        
                        if (proj.type === 'oszczep') {
                            let kolorOszczepu = proj.piercing ? '#9b59b6' : '#bdc3c7'; 
                            if (proj.mode === 'TEAMS') kolorOszczepu = proj.team === 'RED' ? '#e74c3c' : '#3498db';
                            
                            if (window.Flagi && !window.Flagi.Srodowisko.isMobile) { 
                                ctx.shadowBlur = 15; 
                                ctx.shadowColor = kolorOszczepu; 
                            }
                            
                            // Drzewiec (kij)
                            ctx.strokeStyle = '#555';
                            ctx.lineWidth = 3;
                            ctx.beginPath(); 
                            ctx.moveTo(-20, 0); 
                            ctx.lineTo(10, 0); 
                            ctx.stroke();
                            
                            // Grot (ostrze)
                            ctx.fillStyle = kolorOszczepu;
                            ctx.beginPath(); 
                            ctx.moveTo(10, -5); 
                            ctx.lineTo(25, 0); 
                            ctx.lineTo(10, 5); 
                            ctx.closePath(); 
                            ctx.fill();

                            // Smuga światła na końcu
                            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                            ctx.beginPath(); ctx.arc(-20, 0, 2, 0, Math.PI*2); ctx.fill();

                        } else if (proj.type === 'laser') {
                            let kolorLasera = proj.team === 'BOSS' ? '#e74c3c' : '#f1c40f';
                            if (window.Flagi && !window.Flagi.Srodowisko.isMobile) { 
                                ctx.shadowBlur = 15; 
                                ctx.shadowColor = kolorLasera; 
                            }
                            ctx.strokeStyle = kolorLasera;
                            ctx.lineWidth = 5;
                            ctx.lineCap = 'round';
                            ctx.beginPath(); 
                            ctx.moveTo(-15, 0); 
                            ctx.lineTo(15, 0); 
                            ctx.stroke();
                        } else {
                            // Wariant podstawowy
                            ctx.fillStyle = proj.piercing ? '#3498db' : '#bdc3c7';
                            if (window.Flagi && !window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle; }
                            ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, 5); ctx.lineTo(-10, -5); ctx.closePath(); ctx.fill();
                        }
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

            ctx.restore(); 

            // NAKŁADANIE EFEKTÓW WIZUALNYCH (Niezależne od przesunięcia kamery)
            rysujEfektyEkranu(tryb, stanSerwera, mojGracz);

            if (pokazDuzaMape) {
                rysujMapeTaktyczna(stanSerwera, mojGracz, limitWielkosci, false);
            } else {
                rysujMapeTaktyczna(stanSerwera, mojGracz, limitWielkosci, true);
            }
        }
    };
})();