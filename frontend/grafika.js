// ==========================================
// GRAFIKA.JS - Produkcyjny Silnik Renderujący (PNG Gracze + Neonowe Boty)
// ==========================================

window.Grafika = (function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // --- ZMIENNE SYSTEMOWE ---
    let camera = { x: 0, y: 0 };
    let screenW = window.innerWidth;
    let screenH = window.innerHeight;
    
    // Pule obiektów i efekty
    let mapaObiekty = { drzewa: [], krzaki: [], mury: [] };
    let czyMapaWygenerowana = false;
    let czasteczkiTla = []; 
    let sladPostaci = {}; 
    let lokalnyBuforJedzenia = {};

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
        mapaObiekty = { drzewa: [], krzaki: [], mury: [] };
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
            for(let i=0; i<30; i++) mapaObiekty.drzewa.push({ x: Math.random() * 4000, y: Math.random() * 4000, r: 45 });
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

        if (tryb === 'FREE') {
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
            
            // Cyber-Zamek
            if (czyWidoczny(2000, 2000, 300)) {
                ctx.save(); ctx.translate(2000, 2000);
                let puls = Math.abs(Math.sin(czas / 600)); 
                let zamekGrad = ctx.createRadialGradient(0, 0, 50, 0, 0, 300);
                zamekGrad.addColorStop(0, `rgba(241, 196, 15, ${0.1 + puls * 0.1})`); zamekGrad.addColorStop(1, '#020202');
                ctx.fillStyle = zamekGrad; ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 6 + (puls * 4);
                if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 20 + (puls * 15); ctx.shadowColor = '#f1c40f'; }
                ctx.beginPath(); for (let i = 0; i < 8; i++) ctx.lineTo(Math.cos(i * Math.PI/4) * 300, Math.sin(i * Math.PI/4) * 300);
                ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(241, 196, 15, 0.3)'; ctx.lineWidth = 2;
                ctx.beginPath(); for (let i = 0; i < 8; i++) ctx.lineTo(Math.cos(i * Math.PI/4) * 280, Math.sin(i * Math.PI/4) * 280);
                ctx.closePath(); ctx.stroke();
                ctx.rotate(czas / 1000); ctx.strokeStyle = '#ffffff'; 
                if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 10; ctx.shadowColor = '#fff'; }
                ctx.beginPath(); ctx.rect(-40, -40, 80, 80); ctx.rotate(Math.PI / 4); ctx.rect(-40, -40, 80, 80); ctx.stroke();
                ctx.restore();
            }
            
            // Martwe Drzewa
            mapaObiekty.drzewa.forEach(d => {
                if(czyWidoczny(d.x, d.y, d.r)) {
                    ctx.fillStyle = '#080808'; ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 0.4, 0, Math.PI*2); ctx.fill();
                }
            });
        }
    }

    // --- RYSOWANIE DRONÓW AI (Neonowa Geometria) ---
    function rysujBota(bot) {
        if (!bot || !czyWidoczny(bot.x, bot.y, 100)) return;

        let wKrzaku = false;
        mapaObiekty.krzaki.forEach(k => { if (Math.hypot(bot.x - k.x, bot.y - k.y) < k.r) wKrzaku = true; });
        if (wKrzaku) return; // Boty w krzakach też znikają

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
            ctx.moveTo(0, -promien); ctx.lineTo(promien, 0); ctx.lineTo(0, promien); ctx.lineTo(-promien, 0);
        } else {
            for (let i = 0; i < 8; i++) ctx.lineTo(Math.cos(i * Math.PI/4) * promien, Math.sin(i * Math.PI/4) * promien);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = isBoss ? 'rgba(155, 89, 182, 0.5)' : 'rgba(231, 76, 60, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, promien * 0.4, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-promien*0.6, 0); ctx.lineTo(promien*0.6, 0);
        ctx.moveTo(0, -promien*0.6); ctx.lineTo(0, promien*0.6);
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

        if (postac.isShielding) { 
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

            ctx.restore(); 
        }
    };
})();