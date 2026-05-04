// ==========================================
// GRAFIKA.JS - Produkcyjny Silnik Renderujący (Architektura Północna & Taktyczne Boty)
// WERSJA: AAA Visuals (10 Upgrades + Zoom Bleed Fix)
// ==========================================

window.Grafika = (function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // --- ZMIENNE SYSTEMOWE ---
    let camera = { x: 0, y: 0 };
    let cameraScale = 1.0; // Dynamiczny Zoom
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
    
    // Systemy FX (Gore, Combat Text, Decals, Shockwaves)
    let efektyWizualne = [];
    let powiadomieniaLiczbowe = []; 
    let plamyZniszczen = []; // Wypalone kratery po śmierci
    let faleUderzeniowe = []; // Kinowe fale przy uderzeniach/ewolucji
    let poprzedniePozycje = { players: {}, bots: {} };
    let poziomyEwolucji = {}; // Śledzenie tierów pancerza do błysków

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

    // Optymalizacja: Culling (Rysuje tylko to, co widzi kamera z uwzględnieniem zooma)
    function czyWidoczny(x, y, promien) {
        const margines = 300 / cameraScale; // Zwiększony margines dla pewności
        return (
            x + promien + margines > camera.x &&
            x - promien - margines < camera.x + screenW / cameraScale &&
            y + promien + margines > camera.y &&
            y - promien - margines < camera.y + screenH / cameraScale
        );
    }

    // --- SYSTEM FX (Cząsteczki, Fale, Plamy, Smugi) ---
    function generujWybuch(x, y, kolor, moc) {
        let ilosc = Math.min(moc, 50); 
        for(let i=0; i<ilosc; i++) {
            let kat = Math.random() * Math.PI * 2;
            let predkosc = Math.random() * 12 + 3;
            efektyWizualne.push({
                x: x, y: y,
                vx: Math.cos(kat) * predkosc, vy: Math.sin(kat) * predkosc,
                zycie: 1.0, kolor: kolor, rozmiar: Math.random() * 5 + 2
            });
        }
        
        // Zostaw wypalony krater (Decal)
        plamyZniszczen.push({
            x: x, y: y, 
            r: moc * 2, 
            kolor: kolor, 
            zycie: 1.0, 
            kat: Math.random() * Math.PI * 2
        });
        if(plamyZniszczen.length > 40) plamyZniszczen.shift(); // Limit dla wydajności
        
        // Wygeneruj falę uderzeniową (Shockwave)
        faleUderzeniowe.push({ x: x, y: y, r: 10, maxR: moc * 4, zycie: 1.0, kolor: kolor });
    }

    function generujSmugęPocisku(x, y, kolor) {
        if(Math.random() > 0.4) return; // Tworzy gęsty, ale zoptymalizowany ogon
        efektyWizualne.push({
            x: x + (Math.random()*10-5), y: y + (Math.random()*10-5),
            vx: Math.random()*2-1, vy: Math.random()*2-1,
            zycie: 0.6, kolor: kolor, rozmiar: Math.random() * 3 + 1
        });
        if(efektyWizualne.length > 150) efektyWizualne.shift();
    }

    function dodajPowiadomienie(x, y, roznica) {
        if (roznica === 0) return;
        let znak = roznica > 0 ? '+' : '';
        let kolor = roznica > 0 ? '#2ecc71' : '#e74c3c';
        powiadomieniaLiczbowe.push({
            x: x + (Math.random() * 30 - 15), 
            y: y - 40,
            vy: -2 - Math.random(), 
            tekst: znak + Math.floor(roznica),
            kolor: kolor,
            zycie: 1.0
        });
    }

    function aktualizujEfektyZniszczen() {
        // 1. Plamy zniszczeń na samej ziemi (Decals)
        for(let i = plamyZniszczen.length - 1; i >= 0; i--) {
            let d = plamyZniszczen[i];
            d.zycie -= 0.002; // Znikają baaardzo powoli
            if (d.zycie <= 0) { plamyZniszczen.splice(i, 1); continue; }
            
            if (czyWidoczny(d.x, d.y, d.r)) {
                ctx.save(); 
                ctx.translate(d.x, d.y); 
                ctx.rotate(d.kat);
                ctx.globalAlpha = d.zycie * 0.3;
                let grad = ctx.createRadialGradient(0,0,0, 0,0,d.r);
                grad.addColorStop(0, '#000'); 
                grad.addColorStop(0.5, d.kolor); 
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad; 
                ctx.beginPath(); 
                ctx.arc(0, 0, d.r, 0, Math.PI*2); 
                ctx.fill();
                ctx.restore();
            }
        }

        // 2. Fale uderzeniowe
        for(let i = faleUderzeniowe.length - 1; i >= 0; i--) {
            let f = faleUderzeniowe[i];
            f.r += (f.maxR - f.r) * 0.15; // Rozszerzanie
            f.zycie -= 0.05; // Szybkie znikanie
            if (f.zycie <= 0) { faleUderzeniowe.splice(i, 1); continue; }
            
            if (czyWidoczny(f.x, f.y, f.r)) {
                ctx.globalAlpha = f.zycie;
                ctx.strokeStyle = f.kolor; 
                ctx.lineWidth = 4 * f.zycie;
                ctx.beginPath(); 
                ctx.arc(f.x, f.y, f.r, 0, Math.PI*2); 
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }
        }

        // 3. Fizyczne Cząsteczki (Gore)
        for(let i = efektyWizualne.length - 1; i >= 0; i--) {
            let p = efektyWizualne[i];
            p.x += p.vx; p.y += p.vy;
            p.vx *= 0.92; p.vy *= 0.92; 
            p.zycie -= 0.03;
            
            if (p.zycie <= 0) { efektyWizualne.splice(i, 1); continue; }
            
            if (czyWidoczny(p.x, p.y, p.rozmiar)) {
                ctx.globalAlpha = p.zycie;
                ctx.fillStyle = p.kolor;
                if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 15; ctx.shadowColor = p.kolor; }
                ctx.beginPath(); ctx.arc(p.x, p.y, p.rozmiar * p.zycie, 0, Math.PI*2); ctx.fill();
                ctx.shadowBlur = 0; ctx.globalAlpha = 1.0;
            }
        }

        // 4. Floating Text (Zawsze na wierzchu)
        ctx.font = 'bold 20px Exo 2, sans-serif';
        ctx.textAlign = 'center';
        for(let i = powiadomieniaLiczbowe.length - 1; i >= 0; i--) {
            let txt = powiadomieniaLiczbowe[i];
            txt.y += txt.vy;
            txt.vy *= 0.95; 
            txt.zycie -= 0.02;

            if (txt.zycie <= 0) { powiadomieniaLiczbowe.splice(i, 1); continue; }

            if (czyWidoczny(txt.x, txt.y, 20)) {
                ctx.globalAlpha = txt.zycie;
                ctx.fillStyle = txt.kolor;
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                ctx.strokeText(txt.tekst, txt.x, txt.y);
                ctx.fillText(txt.tekst, txt.x, txt.y);
                ctx.globalAlpha = 1.0;
            }
        }
    }

    // --- ŚRODOWISKO I PARALAKSA Z POGODĄ ---
    function generujSrodowisko(tryb) {
        mapaObiekty = { krzaki: [], mury: [], swiatla: [] };
        czasteczkiTla = [];

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
                głębia: Math.random() * 0.8 + 0.2 // Wskaźnik Paralaksy (1.0 = blisko, 0.2 = bardzo daleko)
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
            
            // Obszar wrap-around na dużej przestrzeni
            if (c.x < 0) c.x = 6000; if (c.x > 6000) c.x = 0;
            if (c.y < 0) c.y = 6000; if (c.y > 6000) c.y = 0;
            
            // Logika Paralaksy
            let offsetX = camera.x * (1 - c.głębia);
            let offsetY = camera.y * (1 - c.głębia);
            
            let drawX = c.x + offsetX;
            let drawY = c.y + offsetY;

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
                ctx.beginPath(); ctx.arc(drawX, drawY, c.r * c.głębia, 0, Math.PI*2); ctx.fill();
            } else {
                ctx.fillStyle = `rgba(255, 255, 255, ${c.alpha})`;
                ctx.beginPath(); ctx.arc(drawX, drawY, c.r * c.głębia, 0, Math.PI*2); ctx.fill();
            }
        });
    }

    // Generator baz dla trybu TEAMS
    function rysujZamek(x, y, kolorWiodacy, nazwa) {
        if (!czyWidoczny(x, y, 600)) return;

        const czas = Date.now();
        ctx.save();
        ctx.translate(x, y);

        ctx.beginPath();
        ctx.arc(0, 0, 400, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${kolorWiodacy}, 0.05)`; 
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = `rgba(${kolorWiodacy}, 0.6)`;
        ctx.setLineDash([15, 20]); 
        ctx.stroke();

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

        ctx.beginPath();
        ctx.rect(-80, -80, 160, 160);
        ctx.fillStyle = `rgba(${kolorWiodacy}, 0.2)`;
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px Exo 2';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 0;
        ctx.fillText(nazwa, 0, -180);

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

    function rysujMape(tryb, limitSwiata, stanSerwera) {
        // TWARDY FIX NA PRZEŚWITY TŁA PRZY ZOOMIE (Zawsze pełne pokrycie monitora czernią)
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.fillStyle = '#08080a'; 
        ctx.fillRect(0, 0, screenW, screenH);
        ctx.restore();

        aktualizujCząsteczki(tryb);

        ctx.strokeStyle = 'rgba(52, 152, 219, 0.05)'; ctx.lineWidth = 1;
        const siatkaRozmiar = 200;
        const startX = Math.floor(camera.x / siatkaRozmiar) * siatkaRozmiar;
        const startY = Math.floor(camera.y / siatkaRozmiar) * siatkaRozmiar;
        ctx.beginPath();
        for(let x = startX; x < camera.x + screenW / cameraScale; x += siatkaRozmiar) { ctx.moveTo(x, camera.y); ctx.lineTo(x, camera.y + screenH / cameraScale); }
        for(let y = startY; y < camera.y + screenH / cameraScale; y += siatkaRozmiar) { ctx.moveTo(camera.x, y); ctx.lineTo(camera.x + screenW / cameraScale, y); }
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

        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 6;
        if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 15; ctx.shadowColor = '#e74c3c'; }
        ctx.strokeRect(0, 0, limitSwiata, limitSwiata);
        ctx.shadowBlur = 0;

        const czas = Date.now();

        if (tryb === 'TEAMS') {
            rysujZamek(500, 3000, '231, 76, 60', 'BAZA CZERWONYCH');
            rysujZamek(5500, 3000, '52, 152, 219', 'BAZA NIEBIESKICH');
        } 
        else if (tryb === 'FREE') {
            mapaObiekty.krzaki.forEach(k => {
                if(czyWidoczny(k.x, k.y, k.r)) {
                    let drganie = 0;
                    if (stanSerwera) {
                        let ktosJestWKrzaku = Object.values(stanSerwera.players).some(p => Math.hypot(p.x - k.x, p.y - k.y) < k.r) || 
                                              Object.values(stanSerwera.bots).some(b => Math.hypot(b.x - k.x, b.y - k.y) < k.r);
                        if (ktosJestWKrzaku) drganie = Math.sin(czas / 40) * 4;
                    }

                    ctx.save(); ctx.translate(k.x + drganie, k.y);
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

    // Dodatkowe Skrypty Animacji
    function rysujWstegeRuchu(id, promien, kolor) {
        if (!sladPostaci[id] || sladPostaci[id].length < 2) return;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sladPostaci[id][0].x, sladPostaci[id][0].y);
        for(let i=1; i<sladPostaci[id].length; i++) {
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
        if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 10; ctx.shadowColor = kolor; }
        ctx.stroke();
        ctx.restore();
    }

    function obliczCienKierunkowy() {
        let katOswietlenia = Date.now() / 2000; 
        return { offsetX: Math.cos(katOswietlenia) * 10, offsetY: Math.sin(katOswietlenia) * 10 };
    }

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

        let mainColor = isBoss ? '#9b59b6' : '#e74c3c';
        let strokeColor = mainColor;
        
        if (bot.ownerId && bot.team) strokeColor = bot.team === 'RED' ? '#e74c3c' : '#3498db';

        // Cienie kierunkowe na botach
        if (!window.Flagi.Srodowisko.isMobile) {
            let cien = obliczCienKierunkowy();
            ctx.shadowColor = strokeColor; 
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = cien.offsetX; 
            ctx.shadowOffsetY = cien.offsetY;
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

        ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowBlur = 0;
        
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

        // Pierścień zdrowia dla bota
        ctx.save();
        ctx.translate(bot.x, bot.y);
        let massPercent = Math.min(1, masa / 600);
        ctx.beginPath();
        ctx.arc(0, 0, promien + 6, -Math.PI/2, (-Math.PI/2) + (Math.PI * 2 * massPercent));
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.restore();

        if (!isBoss) {
            ctx.save();
            ctx.translate(bot.x, bot.y);
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
        mapaObiekty.krzaki.forEach(k => {
            if (Math.hypot(postac.x - k.x, postac.y - k.y) < k.r) wKrzaku = true;
        });

        if (wKrzaku && !isMe) return; 

        let masa = Math.max(10, postac.score || 10);
        let obliczonyPromien = 20 + Math.sqrt(masa) * 2;
        let promien = Math.min(obliczonyPromien, 65); 
        
        let skin = postac.skin || 'standard';
        let currentTime = Date.now();
        let kolorWiodacy = skin === 'ninja' ? '#9b59b6' : (skin === 'arystokrata' ? '#f1c40f' : '#e74c3c');
        if (postac.team) kolorWiodacy = postac.team === 'RED' ? '#e74c3c' : '#3498db';

        // Błysk Ewolucji przy wbiciu poziomu (Tier 1, 2, 3)
        let tier = masa >= 600 ? 3 : (masa >= 150 ? 2 : (masa >= 50 ? 1 : 0));
        if (poziomyEwolucji[id] !== undefined && poziomyEwolucji[id] < tier) {
            faleUderzeniowe.push({ x: postac.x, y: postac.y, r: promien, maxR: promien * 3, zycie: 1.0, kolor: '#fff' });
        }
        poziomyEwolucji[id] = tier;

        if (!czasWejsciaGraczy[id]) czasWejsciaGraczy[id] = currentTime;
        let czasOdWejscia = currentTime - czasWejsciaGraczy[id];

        ctx.save(); 
        if (wKrzaku && isMe) ctx.globalAlpha = 0.4; 

        // Glitch Effect (Gdy tracisz HP i ekran mocno drży)
        let czyZglitchowany = isMe && wstrzasEkranu.moc > 5;

        // Desant Orbitalny
        if (czasOdWejscia < 1200) {
            let op = 1 - (czasOdWejscia / 1200);
            ctx.save();
            ctx.translate(postac.x, postac.y);
            ctx.fillStyle = `rgba(52, 152, 219, ${op * 0.6})`;
            ctx.fillRect(-promien, -screenH, promien*2, screenH);
            ctx.strokeStyle = `rgba(52, 152, 219, ${op})`;
            ctx.lineWidth = 15 * op;
            ctx.beginPath(); ctx.arc(0, 0, promien + (czasOdWejscia * 0.3), 0, Math.PI*2); ctx.stroke();
            ctx.restore();
        }

        // Płynna Wstęga Ruchu zamiast starego "Sladu"
        if (masa >= 150 && !wKrzaku) {
            if (!sladPostaci[id]) sladPostaci[id] = [];
            sladPostaci[id].push({x: postac.x, y: postac.y});
            if (sladPostaci[id].length > 6) sladPostaci[id].shift();
            rysujWstegeRuchu(id, promien, kolorWiodacy);
        }

        // Funkcja pomocnicza do rysowania ciała (ułatwia nakładanie Glitcha)
        let renderGracza = (offsetX = 0, offsetY = 0, kolorNadpisany = null) => {
            ctx.save(); 
            ctx.translate(postac.x + offsetX, postac.y + offsetY); 
            ctx.rotate(postac.kat || 0);
            
            if (kolorNadpisany) ctx.globalCompositeOperation = 'screen';
            
            let img = obrazyPostaci[skin] || obrazyPostaci['standard'];
            if (img.complete && img.naturalWidth !== 0) {
                if (masa >= 100 && window.Flagi && !window.Flagi.Srodowisko.isMobile && !kolorNadpisany) {
                    let cien = obliczCienKierunkowy();
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = kolorWiodacy;
                    ctx.shadowOffsetX = cien.offsetX; 
                    ctx.shadowOffsetY = cien.offsetY;
                }
                ctx.drawImage(img, -promien, -promien, promien * 2, promien * 2);
                
                if (kolorNadpisany) {
                    ctx.fillStyle = kolorNadpisany; 
                    ctx.globalCompositeOperation = 'source-atop';
                    ctx.fillRect(-promien, -promien, promien*2, promien*2);
                }
            } else {
                ctx.fillStyle = '#555';
                ctx.beginPath(); ctx.arc(0, 0, promien, 0, Math.PI*2); ctx.fill();
            }
            ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
            ctx.restore();
        };

        // Renderowanie Glitcha (Tylko w momentach uderzenia)
        if (czyZglitchowany) {
            renderGracza(-5, 0, 'rgba(255,0,0,0.7)'); // Przesunięcie Czerwone
            renderGracza(5, 0, 'rgba(0,255,255,0.7)'); // Przesunięcie Cyan
            ctx.globalAlpha = 0.8;
        }
        renderGracza(); // Ciało właściwe

        // Resetowanie transformacji i kontynuacja (Pancerze, Broń)
        ctx.save();
        ctx.translate(postac.x, postac.y);
        ctx.rotate(postac.kat || 0);

        let kolorZbroi = '#3498db'; 
        if (skin === 'ninja') kolorZbroi = '#9b59b6'; 
        if (skin === 'arystokrata') kolorZbroi = '#e74c3c'; 
        
        ctx.save();
        ctx.translate(promien * 0.7, promien * 0.2); 
        ctx.rotate(Math.PI / -4); 
        
        let progresOszczepu = Math.min(1, Math.max(0, (masa - 10) / 39)); 
        let hue = Math.floor(0 + 280 * progresOszczepu); 
        let saturation = Math.floor(0 + 80 * progresOszczepu);
        let lightness = Math.floor(60 - 10 * progresOszczepu);
        
        let kolorOszczepu = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        
        ctx.strokeStyle = kolorOszczepu;
        ctx.lineWidth = 4 + (2 * progresOszczepu); 
        if (progresOszczepu > 0.8 && window.Flagi && !window.Flagi.Srodowisko.isMobile) {
            ctx.shadowBlur = 10; ctx.shadowColor = kolorOszczepu;
        }
        ctx.beginPath(); ctx.moveTo(0, -promien); ctx.lineTo(0, promien); ctx.stroke();
        ctx.fillStyle = kolorOszczepu;
        ctx.beginPath(); ctx.moveTo(-5, -promien); ctx.lineTo(5, -promien); ctx.lineTo(0, -promien - 15); ctx.closePath(); ctx.fill();
        ctx.restore();

        if (tier >= 1) {
            ctx.save();
            ctx.translate(-promien * 0.8, 0); 
            ctx.fillStyle = '#111';
            ctx.strokeStyle = kolorZbroi;
            ctx.lineWidth = 3;
            if (window.Flagi && !window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 10; ctx.shadowColor = kolorZbroi; }
            
            ctx.beginPath();
            ctx.moveTo(-10, -15);
            ctx.lineTo(-20, 0);
            ctx.lineTo(-10, 15);
            ctx.lineTo(5, 0);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            
            if (tier >= 2) {
                ctx.rotate(currentTime / 500); 
                ctx.strokeStyle = `rgba(${kolorZbroi === '#3498db' ? '52,152,219' : kolorZbroi === '#9b59b6' ? '155,89,182' : '231,76,60'}, 0.6)`;
                ctx.setLineDash([5, 10]);
                ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI*2); ctx.stroke();
            }
            ctx.restore();
        }
        ctx.restore(); 

        if (tier >= 3) {
            ctx.save();
            ctx.translate(postac.x, postac.y - promien - 20); 
            ctx.translate(0, Math.sin(currentTime / 200) * 5); 
            ctx.fillStyle = '#f1c40f'; 
            if (window.Flagi && !window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 15; ctx.shadowColor = '#f1c40f'; }
            ctx.beginPath();
            ctx.moveTo(-15, 0); ctx.lineTo(-20, -15); 
            ctx.lineTo(-7, -5); ctx.lineTo(0, -20);   
            ctx.lineTo(7, -5); ctx.lineTo(20, -15);   
            ctx.lineTo(15, 0); ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

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
        ctx.restore(); 

        // Pierścień HP gracza
        ctx.save();
        ctx.translate(postac.x, postac.y);
        let massPercent = Math.min(1, masa / 600);
        ctx.beginPath();
        ctx.arc(0, 0, promien + 6, -Math.PI/2, (-Math.PI/2) + (Math.PI * 2 * massPercent));
        ctx.strokeStyle = (postac.team === 'RED') ? '#e74c3c' : ((postac.team === 'BLUE') ? '#3498db' : '#f1c40f');
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.8;
        ctx.stroke();
        ctx.restore();

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

    function rysujEfektyHUD(tryb, stanSerwera, mojGracz, limitWielkosci) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        
        // Speedlines (Efekt Anime/Prędkości na skrajach ekranu)
        // Szacujemy prędkość na podstawie ruchu kamery z ostatnich klatek lub wywołanego wstrząsu
        if (wstrzasEkranu.moc > 5 || (mojGracz.score > 200 && Math.abs(Math.sin(Date.now() / 100)) > 0.8)) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; 
            ctx.lineWidth = 2;
            ctx.beginPath();
            for(let i=0; i<30; i++) {
                let angle = Math.random() * Math.PI * 2;
                let length = Math.random() * 150 + 50;
                let startR = Math.min(screenW, screenH) / 2;
                let endR = startR + length;
                ctx.moveTo(screenW/2 + Math.cos(angle)*startR, screenH/2 + Math.sin(angle)*startR);
                ctx.lineTo(screenW/2 + Math.cos(angle)*endR, screenH/2 + Math.sin(angle)*endR);
            }
            ctx.stroke();
        }

        // Winieta Krańca Mapy (Czerwona pulsująca mgła blisko ściany)
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
            ctx.fillRect(0,0,screenW,screenH);
        }

        // Tryby Specyficzne
        if (tryb === 'TEAMS' && mojGracz.team) {
            let gradient = ctx.createRadialGradient(screenW/2, screenH/2, screenH/1.5, screenW/2, screenH/2, screenW);
            let teamColor = mojGracz.team === 'RED' ? 'rgba(231, 76, 60, 0.2)' : 'rgba(52, 152, 219, 0.2)';
            gradient.addColorStop(0, 'rgba(0,0,0,0)');
            gradient.addColorStop(1, teamColor);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, screenW, screenH);
        } 
        else if (tryb === 'CAMPAIGN') {
            let masaDoŚwiatła = Math.max(10, mojGracz.score || 10);
            let promienSwiatla = 250 + Math.sqrt(masaDoŚwiatła) * 8; 
            
            let gradient = ctx.createRadialGradient(screenW/2, screenH/2, promienSwiatla * 0.4, screenW/2, screenH/2, promienSwiatla);
            gradient.addColorStop(0, 'rgba(0,0,0,0)'); 
            gradient.addColorStop(1, 'rgba(5,5,5,0.96)'); 
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, screenW, screenH);
            
            ctx.beginPath();
            ctx.rect(0, 0, screenW, screenH);
            ctx.arc(screenW/2, screenH/2, promienSwiatla, 0, Math.PI*2, true);
            ctx.fillStyle = 'rgba(5,5,5,0.96)';
            ctx.fill();

            let bossAlive = null;
            if (stanSerwera.bots) {
                Object.values(stanSerwera.bots).forEach(b => { if (b.isBoss || b.skin === 'ninja') bossAlive = b; });
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
                if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 20; ctx.shadowColor = '#e74c3c'; }
                ctx.fillRect(barX, barY, barW * hpPercent, barH);
                ctx.shadowBlur = 0;

                ctx.fillStyle = '#fff';
                ctx.font = 'bold 22px Permanent Marker, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`TYTAN OMEGA`, screenW / 2, barY - 12);
            }
        }
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
            ctx.moveTo(-castleWidth/2, castleHeight/2); ctx.lineTo(castleWidth/2, castleHeight/2); ctx.lineTo(castleWidth/2, 0);
            ctx.lineTo(castleWidth*0.6, 0); ctx.lineTo(castleWidth*0.6, -castleHeight*0.1); ctx.lineTo(castleWidth*0.7, -castleHeight*0.1); ctx.lineTo(castleWidth*0.7, 0);
            ctx.lineTo(castleWidth/2, 0); ctx.lineTo(castleWidth*0.4, -castleHeight*0.3); ctx.lineTo(0, -castleHeight/2); ctx.lineTo(-castleWidth*0.4, -castleHeight*0.3);
            ctx.lineTo(-castleWidth/2, 0); ctx.lineTo(-castleWidth*0.7, 0); ctx.lineTo(-castleWidth*0.7, -castleHeight*0.1); ctx.lineTo(-castleWidth*0.6, -castleHeight*0.1); ctx.lineTo(-castleWidth*0.6, 0);
            ctx.lineTo(-castleWidth/2, 0);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.4)'; ctx.strokeRect(-castleWidth*0.15, castleHeight*0.15, castleWidth*0.3, castleHeight*0.35);
            ctx.restore();
        } 
        else if (window.Flagi && window.Flagi.Stan.wybranyTryb === 'TEAMS') {
            ctx.fillStyle = 'rgba(231, 76, 60, 0.3)'; ctx.strokeStyle = '#e74c3c';
            ctx.beginPath(); ctx.arc(startX + (500 * scale), startY + (3000 * scale), 400 * scale, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = 'rgba(52, 152, 219, 0.3)'; ctx.strokeStyle = '#3498db';
            ctx.beginPath(); ctx.arc(startX + (5500 * scale), startY + (3000 * scale), 400 * scale, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        }

        function rysujKropke(x, y, kolor, promienKropki) {
            ctx.fillStyle = kolor; ctx.beginPath(); ctx.arc(startX + (x * scale), startY + (y * scale), promienKropki, 0, Math.PI*2); ctx.fill();
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
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(startX + (mojGracz.x * scale), startY + (mojGracz.y * scale), 300 * scale, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 24px Exo 2, sans-serif'; ctx.textAlign = 'center';
            ctx.fillText("MAPA TAKTYCZNA", startX + mapSize/2, startY - 20);
        }
        ctx.restore();
    }

    // --- GŁÓWNA PĘTLA RENDERUJĄCA ---
    return {
        wywolajWstrzas: function(moc) {
            wstrzasEkranu.moc = moc;
        },
        rysujKlatke: function(stanSerwera, mojGracz) {
            if (!stanSerwera || !mojGracz) return;

            // Płynna Kamera (Lerp)
            let docelowaKameraX = mojGracz.x - screenW / 2;
            let docelowaKameraY = mojGracz.y - screenH / 2;
            
            if (Math.hypot(docelowaKameraX - camera.x, docelowaKameraY - camera.y) > 1000) {
                camera.x = docelowaKameraX;
                camera.y = docelowaKameraY;
            } else {
                camera.x += (docelowaKameraX - camera.x) * 0.1;
                camera.y += (docelowaKameraY - camera.y) * 0.1;
            }

            // Dynamiczny Zoom oparty na masie gracza
            let masaDoZooma = Math.max(10, mojGracz.score);
            let docelowaSkala = Math.max(0.4, 1.15 - Math.sqrt(masaDoZooma) * 0.015);
            cameraScale += (docelowaSkala - cameraScale) * 0.05;

            let drawCamX = camera.x;
            let drawCamY = camera.y;

            if (wstrzasEkranu.moc > 0.5) {
                drawCamX += (Math.random() - 0.5) * wstrzasEkranu.moc;
                drawCamY += (Math.random() - 0.5) * wstrzasEkranu.moc;
                wstrzasEkranu.moc *= wstrzasEkranu.wygasanie;
            }
            
            let tryb = (window.Flagi && window.Flagi.Stan.wybranyTryb) ? window.Flagi.Stan.wybranyTryb : 'FREE';
            let limitWielkosci = tryb === 'TEAMS' ? 6000 : 4000;

            if (!czyMapaWygenerowana) generujSrodowisko(tryb);

            ctx.save(); 
            // Implementacja zooma wyśrodkowanego na graczu
            ctx.translate(screenW / 2, screenH / 2);
            ctx.scale(cameraScale, cameraScale);
            ctx.translate(-screenW / 2, -screenH / 2);
            ctx.translate(-drawCamX, -drawCamY);

            rysujMape(tryb, limitWielkosci, stanSerwera);

            // ==========================================
            // LOGIKA ŚLEDZENIA ZMIAN (Gore, Decale, Text)
            // ==========================================
            if (stanSerwera.players) {
                Object.keys(poprzedniePozycje.players).forEach(id => {
                    // Wykrywanie śmierci gracza
                    if (!stanSerwera.players[id] && id !== mojGracz.id) {
                        generujWybuch(poprzedniePozycje.players[id].x, poprzedniePozycje.players[id].y, '#e74c3c', 40);
                    }
                    // Wykrywanie obrażeń/leczenia
                    else if (stanSerwera.players[id]) {
                        let roznica = stanSerwera.players[id].score - poprzedniePozycje.players[id].score;
                        if (Math.abs(roznica) >= 1) {
                            dodajPowiadomienie(stanSerwera.players[id].x, stanSerwera.players[id].y, roznica);
                        }
                    }
                });
                poprzedniePozycje.players = {};
                Object.keys(stanSerwera.players).forEach(id => {
                    poprzedniePozycje.players[id] = {x: stanSerwera.players[id].x, y: stanSerwera.players[id].y, score: stanSerwera.players[id].score};
                });
            }

            if (stanSerwera.bots) {
                Object.keys(poprzedniePozycje.bots).forEach(id => {
                    if (!stanSerwera.bots[id]) {
                        let kolorWybuchu = poprzedniePozycje.bots[id].isBoss ? '#9b59b6' : '#e74c3c';
                        generujWybuch(poprzedniePozycje.bots[id].x, poprzedniePozycje.bots[id].y, kolorWybuchu, 25);
                    } 
                    else if (stanSerwera.bots[id]) {
                        let roznica = stanSerwera.bots[id].score - poprzedniePozycje.bots[id].score;
                        if (Math.abs(roznica) >= 1) {
                            dodajPowiadomienie(stanSerwera.bots[id].x, stanSerwera.bots[id].y, roznica);
                        }
                    }
                });
                poprzedniePozycje.bots = {};
                Object.keys(stanSerwera.bots).forEach(id => {
                    poprzedniePozycje.bots[id] = {
                        x: stanSerwera.bots[id].x, y: stanSerwera.bots[id].y,
                        score: stanSerwera.bots[id].score, isBoss: stanSerwera.bots[id].isBoss || stanSerwera.bots[id].skin === 'ninja'
                    };
                });
            }

            // Rysowanie zniszczeń na mapie przed resztą obiektów
            aktualizujEfektyZniszczen();

            // Rysowanie Masy (Cukierki)
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

            // Rysowanie Krwawiących Pocisków
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
                            
                            // Wywołanie Smugi Oszczepu (Iskry z tyłu pocisku)
                            generujSmugęPocisku(proj.x, proj.y, kolorOszczepu);

                            if (window.Flagi && !window.Flagi.Srodowisko.isMobile) { 
                                ctx.shadowBlur = 15; 
                                ctx.shadowColor = kolorOszczepu; 
                            }
                            
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
                            ctx.beginPath(); ctx.arc(-20, 0, 2, 0, Math.PI*2); ctx.fill();

                        } else if (proj.type === 'laser') {
                            let kolorLasera = proj.team === 'BOSS' ? '#e74c3c' : '#f1c40f';
                            
                            generujSmugęPocisku(proj.x, proj.y, kolorLasera);

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

            // NAKŁADANIE EFEKTÓW HUD (Winieta, Speedlines) - Bez względu na zoom kamery
            rysujEfektyHUD(tryb, stanSerwera, mojGracz, limitWielkosci);

            if (pokazDuzaMape) {
                rysujMapeTaktyczna(stanSerwera, mojGracz, limitWielkosci, false);
            } else {
                rysujMapeTaktyczna(stanSerwera, mojGracz, limitWielkosci, true);
            }
        }
    };
})();