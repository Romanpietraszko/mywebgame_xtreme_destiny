// ==========================================
// GRAFIKA.JS - Silnik Renderujący Vibe Noir (TikTok Edition)
// ==========================================

window.Grafika = (function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    let camera = { x: 0, y: 0 };
    let screenW = window.innerWidth;
    let screenH = window.innerHeight;
    
    let mapaObiekty = { drzewa: [], krzaki: [], mury: [] };
    let czyMapaWygenerowana = false;
    let czasteczkiTla = [];
    let sladPostaci = {};
    let lokalnyBuforJedzenia = {}; // TARCZA: Pamięta jedzenie, gdy serwer nic nie wyśle

    function resize() {
        screenW = window.innerWidth;
        screenH = window.innerHeight;
        canvas.width = screenW;
        canvas.height = screenH;
    }
    window.addEventListener('resize', resize);
    resize();

    function czyWidoczny(x, y, promien) {
        const margines = 150;
        return (x + promien + margines > camera.x && x - promien - margines < camera.x + screenW &&
                y + promien + margines > camera.y && y - promien - margines < camera.y + screenH);
    }

    function generujSrodowisko(tryb) {
        mapaObiekty = { drzewa: [], krzaki: [], mury: [] };
        czasteczkiTla = [];
        for(let i=0; i<100; i++) {
            czasteczkiTla.push({ x: Math.random() * screenW, y: Math.random() * screenH, speedX: (Math.random() - 0.5) * 0.5, speedY: (Math.random() - 0.5) * 0.5, r: Math.random() * 2 });
        }
        if (tryb === 'FREE') {
            for(let i=0; i<25; i++) mapaObiekty.drzewa.push({ x: Math.random() * 4000, y: Math.random() * 4000, r: 45 });
            for(let i=0; i<40; i++) mapaObiekty.krzaki.push({ x: Math.random() * 4000, y: Math.random() * 4000, r: 70 });
        }
        czyMapaWygenerowana = true;
    }

    function aktualizujCząsteczki() {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
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

        ctx.strokeStyle = 'rgba(52, 152, 219, 0.08)'; ctx.lineWidth = 1;
        const siatkaRozmiar = 200;
        const startX = Math.floor(camera.x / siatkaRozmiar) * siatkaRozmiar;
        const startY = Math.floor(camera.y / siatkaRozmiar) * siatkaRozmiar;
        
        ctx.beginPath();
        for(let x = startX; x < camera.x + screenW; x += siatkaRozmiar) { ctx.moveTo(x, camera.y); ctx.lineTo(x, camera.y + screenH); }
        for(let y = startY; y < camera.y + screenH; y += siatkaRozmiar) { ctx.moveTo(camera.x, y); ctx.lineTo(camera.x + screenW, y); }
        ctx.stroke();

        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 5;
        ctx.strokeRect(0, 0, limitSwiata, limitSwiata);

        const czas = Date.now();

        if (tryb === 'FREE') {
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
            
            mapaObiekty.drzewa.forEach(d => {
                if(czyWidoczny(d.x, d.y, d.r)) {
                    ctx.fillStyle = '#080808'; ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 0.4, 0, Math.PI*2); ctx.fill();
                }
            });
        }
    }

    function rysujPostac(postac, id, isMe) {
        if (!postac || !czyWidoczny(postac.x, postac.y, 100)) return;
        let masa = Math.min(postac.score || 10, 600);
        let promien = 15 + Math.sqrt(masa) * 1.5;
        let skin = postac.skin || 'standard';

        if (masa >= 300) {
            if (!sladPostaci[id]) sladPostaci[id] = [];
            sladPostaci[id].push({x: postac.x, y: postac.y});
            if (sladPostaci[id].length > 5) sladPostaci[id].shift();
            sladPostaci[id].forEach((punkt, index) => {
                ctx.beginPath(); ctx.arc(punkt.x, punkt.y, promien * (index/5), 0, Math.PI*2);
                ctx.fillStyle = (skin === 'ninja') ? `rgba(155, 89, 182, ${index * 0.05})` : `rgba(231, 76, 60, ${index * 0.05})`;
                ctx.fill();
            });
        }

        ctx.save(); ctx.translate(postac.x, postac.y);
        if (postac.kat) ctx.rotate(postac.kat);

        ctx.fillStyle = isMe ? '#222' : '#111';
        let kolorKlasy = skin === 'standard' ? '#e74c3c' : (skin === 'ninja' ? '#9b59b6' : '#f1c40f');
        ctx.strokeStyle = isMe ? '#fff' : kolorKlasy;
        ctx.lineWidth = masa === 600 ? 5 : 2;

        ctx.beginPath();
        if (skin === 'ninja') { ctx.arc(0, 0, promien, Math.PI, 0); ctx.lineTo(0, promien * 1.3); } 
        else if (skin === 'arystokrata') { ctx.arc(0, 0, promien, 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, promien - 5, 0, Math.PI*2); } 
        else { ctx.arc(0, 0, promien, 0, Math.PI*2); }
        ctx.closePath(); ctx.fill(); ctx.stroke();

        if (masa >= 30) { ctx.fillStyle = kolorKlasy; ctx.fillRect(promien, -4, promien * 0.8, 8); }
        if (masa >= 80) { ctx.strokeStyle = '#555'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, promien + 6, Math.PI*0.7, Math.PI*1.3); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, promien + 6, -Math.PI*0.3, Math.PI*0.3); ctx.stroke(); }
        if (masa >= 130) { ctx.fillStyle = kolorKlasy; masa >= 300 ? (ctx.fillRect(promien * 0.2, -8, 4, 6), ctx.fillRect(promien * 0.2, 2, 4, 6)) : ctx.fillRect(promien * 0.2, -5, 6, 10); }
        if (masa >= 180) { ctx.fillStyle = '#3498db'; ctx.beginPath(); ctx.arc(0, 0, promien*0.4, 0, Math.PI*2); ctx.fill(); }
        if (masa === 600) { ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.moveTo(-15, -promien - 5); ctx.lineTo(0, -promien - 25); ctx.lineTo(15, -promien - 5); ctx.fill(); }

        ctx.restore();

        ctx.save(); ctx.translate(postac.x, postac.y);
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px Rajdhani'; ctx.textAlign = 'center';
        ctx.fillText(`${postac.name || 'Gracz'} (${Math.floor(masa)})`, 0, -promien - 15);
        if (postac.isShielding) { ctx.strokeStyle = '#3498db'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, promien + 15, 0, Math.PI*2); ctx.stroke(); }
        ctx.restore();
    }

    return {
        rysujKlatke: function(stanSerwera, mojGracz) {
            if (!stanSerwera || !mojGracz) return;

            camera.x = mojGracz.x - screenW / 2; camera.y = mojGracz.y - screenH / 2;
            let tryb = window.Flagi.Stan.wybranyTryb || 'FREE';
            let limitWielkosci = tryb === 'TEAMS' ? 6000 : 4000;

            if (!czyMapaWygenerowana) generujSrodowisko(tryb);

            ctx.save(); ctx.translate(-camera.x, -camera.y);

            rysujMape(tryb, limitWielkosci);

            // BEZPIECZNE JEDZENIE (Nie zamrozi gry)
            if (stanSerwera.foods) lokalnyBuforJedzenia = window.Guardian ? window.Guardian.safeObj(stanSerwera.foods) : stanSerwera.foods;
            
            ctx.fillStyle = '#f1c40f';
            Object.values(lokalnyBuforJedzenia).forEach(f => {
                if (czyWidoczny(f.x, f.y, 5)) {
                    let r = 5 + Math.sin(Date.now() / 200 + f.x) * 1.5;
                    ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(2, r), 0, Math.PI*2); ctx.fill();
                }
            });

            // RYSOWANIE POCISKÓW
            if (stanSerwera.projectiles) {
                Object.values(stanSerwera.projectiles).forEach(proj => {
                    if (czyWidoczny(proj.x, proj.y, 20)) {
                        ctx.save(); ctx.translate(proj.x, proj.y); ctx.rotate(Math.atan2(proj.dy, proj.dx));
                        ctx.fillStyle = proj.piercing ? '#3498db' : '#bdc3c7';
                        if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle; }
                        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, 5); ctx.lineTo(-10, -5); ctx.closePath(); ctx.fill();
                        ctx.restore();
                    }
                });
            }

            if (stanSerwera.players) Object.keys(stanSerwera.players).forEach(id => { if (id !== mojGracz.id) rysujPostac(stanSerwera.players[id], id, false); });
            if (stanSerwera.bots) Object.keys(stanSerwera.bots).forEach(id => rysujPostac(stanSerwera.bots[id], id, false));

            rysujPostac(mojGracz, mojGracz.id, true);

            ctx.restore();
        }
    };
})();