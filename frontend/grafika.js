// ==========================================
// GRAFIKA.JS - Silnik Renderujący Vibe Noir
// ==========================================

window.Grafika = (function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // --- 1. ZMIENNE SYSTEMOWE ---
    let camera = { x: 0, y: 0 };
    let screenW = window.innerWidth;
    let screenH = window.innerHeight;
    
    // Pule obiektów i efekty
    let mapaObiekty = { drzewa: [], krzaki: [], mury: [] };
    let czyMapaWygenerowana = false;
    let czasteczkiTla = []; // Latający popiół / mgła
    let sladPostaci = {}; // Pamięć powidoków dla Bossów (powyżej 300 masy)

    // --- 2. OBSŁUGA EKRANU ---
    function resize() {
        screenW = window.innerWidth;
        screenH = window.innerHeight;
        canvas.width = screenW;
        canvas.height = screenH;
    }
    window.addEventListener('resize', resize);
    resize();

    // Optymalizacja: Rysuj tylko to, co jest widoczne (Culling)
    function czyWidoczny(x, y, promien) {
        const margines = 150;
        return (
            x + promien + margines > camera.x &&
            x - promien - margines < camera.x + screenW &&
            y + promien + margines > camera.y &&
            y - promien - margines < camera.y + screenH
        );
    }

    // --- 3. ŚRODOWISKO I GENERACJA MAPY ---
    function generujSrodowisko(tryb) {
        mapaObiekty = { drzewa: [], krzaki: [], mury: [] };
        czasteczkiTla = [];

        // Generowanie cząsteczek tła (Vibe Noir)
        for(let i=0; i<100; i++) {
            czasteczkiTla.push({
                x: Math.random() * screenW,
                y: Math.random() * screenH,
                speedX: (Math.random() - 0.5) * 0.5,
                speedY: (Math.random() - 0.5) * 0.5,
                r: Math.random() * 2
            });
        }
        
        if (tryb === 'FREE') {
            for(let i=0; i<25; i++) mapaObiekty.drzewa.push({ x: Math.random() * 4000, y: Math.random() * 4000, r: 45 });
            for(let i=0; i<40; i++) mapaObiekty.krzaki.push({ x: Math.random() * 4000, y: Math.random() * 4000, r: 70 });
        } else if (tryb === 'TEAMS') {
            // Generowanie barykad w ustalonych miejscach
            for(let i=0; i<32; i++) mapaObiekty.mury.push({ x: Math.random() * 6000, y: Math.random() * 6000, w: 100, h: 30 });
        }
        czyMapaWygenerowana = true;
    }

    function aktualizujCząsteczki() {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        czasteczkiTla.forEach(c => {
            c.x += c.speedX; c.y += c.speedY;
            // Zapętlanie cząsteczek na ekranie (zawsze latają wokół kamery)
            if (c.x < 0) c.x = screenW; if (c.x > screenW) c.x = 0;
            if (c.y < 0) c.y = screenH; if (c.y > screenH) c.y = 0;
            
            ctx.beginPath(); ctx.arc(camera.x + c.x, camera.y + c.y, c.r, 0, Math.PI*2); ctx.fill();
        });
    }

    function rysujHexagon(x, y, r, kolorWnetrza, kolorObrys) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            ctx.lineTo(r * Math.cos(i * Math.PI / 3), r * Math.sin(i * Math.PI / 3));
        }
        ctx.closePath();
        ctx.fillStyle = kolorWnetrza; ctx.fill();
        ctx.strokeStyle = kolorObrys; ctx.lineWidth = 5; ctx.stroke();
        ctx.restore();
    }

    // --- 4. RYSOWANIE TERENU ---
    function rysujMape(tryb, limitSwiata) {
        ctx.fillStyle = '#050505'; // Baza Vibe Noir
        ctx.fillRect(camera.x, camera.y, screenW, screenH);
        
        aktualizujCząsteczki();

        // Siatka świata (Grid)
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.1)';
        ctx.lineWidth = 1;
        const siatkaRozmiar = 200;
        const startX = Math.floor(camera.x / siatkaRozmiar) * siatkaRozmiar;
        const startY = Math.floor(camera.y / siatkaRozmiar) * siatkaRozmiar;
        
        ctx.beginPath();
        for(let x = startX; x < camera.x + screenW; x += siatkaRozmiar) { ctx.moveTo(x, camera.y); ctx.lineTo(x, camera.y + screenH); }
        for(let y = startY; y < camera.y + screenH; y += siatkaRozmiar) { ctx.moveTo(camera.x, y); ctx.lineTo(camera.x + screenW, y); }
        ctx.stroke();

        // Granice świata
        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, limitSwiata, limitSwiata);

        // --- SPECFIKA TRYBU FREE ---
        if (tryb === 'FREE') {
            mapaObiekty.krzaki.forEach(k => {
                if(czyWidoczny(k.x, k.y, k.r)) {
                    ctx.fillStyle = 'rgba(46, 204, 113, 0.1)'; ctx.strokeStyle = 'rgba(46, 204, 113, 0.3)';
                    ctx.beginPath(); ctx.arc(k.x, k.y, k.r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                }
            });
            
            // Centralny Zamek Monolit (ośmiokąt)
            if (czyWidoczny(2000, 2000, 300)) {
                ctx.save(); ctx.translate(2000, 2000);
                ctx.fillStyle = '#020202'; ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 8;
                if (!window.Flagi.Srodowisko.isMobile) { ctx.shadowBlur = 20; ctx.shadowColor = '#f1c40f'; }
                ctx.beginPath();
                for (let i = 0; i < 8; i++) ctx.lineTo(Math.cos(i * Math.PI/4) * 300, Math.sin(i * Math.PI/4) * 300);
                ctx.closePath(); ctx.fill(); ctx.stroke();
                
                // Wirujący rdzeń w zamku
                ctx.rotate(Date.now() / 1000);
                ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
                ctx.strokeRect(-50, -50, 100, 100);
                ctx.restore();
            }

            mapaObiekty.drzewa.forEach(d => {
                if(czyWidoczny(d.x, d.y, d.r)) {
                    ctx.fillStyle = '#0a0a0a'; ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                }
            });
        }
        // --- SPECFIKA TRYBU TEAMS ---
        else if (tryb === 'TEAMS') {
            rysujHexagon(1000, 1000, 200, '#050505', '#e74c3c'); // Czerwona baza
            rysujHexagon(5000, 1000, 200, '#050505', '#3498db'); // Niebieska baza
            rysujHexagon(1000, 5000, 200, '#050505', '#2ecc71'); // Zielona baza
            rysujHexagon(5000, 5000, 200, '#050505', '#f1c40f'); // Żółta baza
            
            mapaObiekty.mury.forEach(m => {
                if(czyWidoczny(m.x + m.w/2, m.y + m.h/2, Math.max(m.w, m.h))) {
                    ctx.fillStyle = '#111'; ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
                    ctx.fillRect(m.x, m.y, m.w, m.h); ctx.strokeRect(m.x, m.y, m.w, m.h);
                }
            });
        }
    }

    // --- 5. RYSOWANIE POSTACI I EWOLUCJI ---
    function rysujPostac(postac, id, isMe) {
        if (!postac || !czyWidoczny(postac.x, postac.y, 100)) return;

        let masa = Math.min(postac.score || 10, 600); // Limit masy
        let promien = 15 + Math.sqrt(masa) * 1.5;
        let skin = postac.skin || 'standard';

        // A. SYSTEM POWIDOKÓW (Ghost Trail) dla Bossów
        if (masa >= 300) {
            if (!sladPostaci[id]) sladPostaci[id] = [];
            sladPostaci[id].push({x: postac.x, y: postac.y});
            if (sladPostaci[id].length > 5) sladPostaci[id].shift(); // Pamięta 5 ostatnich klatek

            sladPostaci[id].forEach((punkt, index) => {
                ctx.beginPath();
                ctx.arc(punkt.x, punkt.y, promien * (index/5), 0, Math.PI*2);
                ctx.fillStyle = (skin === 'ninja') ? `rgba(155, 89, 182, ${index * 0.05})` : `rgba(231, 76, 60, ${index * 0.05})`;
                ctx.fill();
            });
        }

        ctx.save();
        ctx.translate(postac.x, postac.y);
        
        // Zwracanie postaci zgodnie z kierunkiem poruszania (kąt)
        if (postac.kat) ctx.rotate(postac.kat);

        // B. RYSOWANIE BAZY I KLASY
        ctx.fillStyle = isMe ? '#222' : '#111';
        let kolorKlasy = '#fff';
        if (skin === 'standard') kolorKlasy = '#e74c3c'; // Czerwony
        if (skin === 'ninja') kolorKlasy = '#9b59b6'; // Fiolet
        if (skin === 'arystokrata') kolorKlasy = '#f1c40f'; // Złoty

        ctx.strokeStyle = isMe ? '#fff' : kolorKlasy;
        ctx.lineWidth = masa === 600 ? 5 : 2;

        ctx.beginPath();
        if (skin === 'ninja') {
            ctx.arc(0, 0, promien, Math.PI, 0); // Ostra maska Ninja
            ctx.lineTo(0, promien * 1.3);
        } else if (skin === 'arystokrata') {
            ctx.arc(0, 0, promien, 0, Math.PI*2); // Klasyczny okrąg, ale dodamy ringi
            ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, promien - 5, 0, Math.PI*2);
        } else {
            ctx.arc(0, 0, promien, 0, Math.PI*2);
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // C. EWOLUCJA ZBROI (Zgodnie z GDD)
        if (masa >= 30) {
            // Broń w dłoni
            ctx.fillStyle = kolorKlasy;
            ctx.fillRect(promien, -4, promien * 0.8, 8); // Miecz skierowany w prawo
        }
        if (masa >= 80) {
            // Naramienniki
            ctx.strokeStyle = '#555'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(0, 0, promien + 6, Math.PI*0.7, Math.PI*1.3); ctx.stroke();
            ctx.beginPath(); ctx.arc(0, 0, promien + 6, -Math.PI*0.3, Math.PI*0.3); ctx.stroke();
        }
        if (masa >= 130) {
            // Cyber-Wizjer / Oczy
            ctx.fillStyle = kolorKlasy;
            if (masa >= 300) {
                // Złe oczy Bossa \ /
                ctx.fillRect(promien * 0.2, -8, 4, 6);
                ctx.fillRect(promien * 0.2, 2, 4, 6);
            } else {
                ctx.fillRect(promien * 0.2, -5, 6, 10); // Normalny wizjer
            }
        }
        if (masa >= 180) {
            // Rdzeń na klatce piersiowej
            ctx.fillStyle = '#3498db';
            rysujHexagon(0, 0, promien * 0.4, '#3498db', '#fff');
        }
        if (masa === 600) {
            // Tytan - Korona i Overcharge
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath(); ctx.moveTo(-15, -promien - 5); ctx.lineTo(0, -promien - 25); ctx.lineTo(15, -promien - 5); ctx.fill();
        }

        ctx.restore(); // Przywraca rotację

        // D. HUD GRACZA (Nick i Punkty ZAWSZE w poziomie, niezależnie od rotacji postaci)
        ctx.save();
        ctx.translate(postac.x, postac.y);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText(`${postac.name || 'Gracz'} (${Math.floor(masa)})`, 0, -promien - 15);
        
        // Pasek HP / Tarcza (Jeśli używa tarczy)
        if (postac.isShielding) {
            ctx.strokeStyle = '#3498db'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, promien + 15, 0, Math.PI*2); ctx.stroke();
        }
        ctx.restore();
    }

    // --- 6. GŁÓWNA PĘTLA RENDERUJĄCA ---
    return {
        rysujKlatke: function(stanSerwera, mojGracz) {
            if (!stanSerwera || !mojGracz) return;

            // Kamera miękko podąża za graczem (Lerp) albo sztywno (dla pewności)
            camera.x = mojGracz.x - screenW / 2;
            camera.y = mojGracz.y - screenH / 2;

            let tryb = window.Flagi.Stan.wybranyTryb || 'FREE';
            let limitWielkosci = window.Flagi.Srodowisko.worldSize || 4000;
            if (tryb === 'TEAMS') limitWielkosci = 6000;

            if (!czyMapaWygenerowana) generujSrodowisko(tryb);

            ctx.save();
            ctx.translate(-camera.x, -camera.y);

            // 1. Tło i Elementy Środowiska
            rysujMape(tryb, limitWielkosci);

            // 2. Masa (Kropki jedzenia)
            if (stanSerwera.foods) {
                ctx.fillStyle = '#f1c40f';
                stanSerwera.foods.forEach(f => {
                    if (czyWidoczny(f.x, f.y, 5)) {
                        // Kropki lekko pulsują
                        let r = 5 + Math.sin(Date.now() / 200 + f.x) * 1.5;
                        ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(2, r), 0, Math.PI*2); ctx.fill();
                    }
                });
            }

            // 3. Rysowanie wszystkich bytow (Inni gracze i Boty)
            if (stanSerwera.players) {
                Object.keys(stanSerwera.players).forEach(id => {
                    if (id !== mojGracz.id) rysujPostac(stanSerwera.players[id], id, false);
                });
            }
            if (stanSerwera.bots) {
                Object.keys(stanSerwera.bots).forEach(id => {
                    rysujPostac(stanSerwera.bots[id], id, false);
                });
            }

            // 4. Rysowanie NAS (Zawsze na samym wierzchu)
            rysujPostac(mojGracz, mojGracz.id, true);

            ctx.restore(); // Koniec rysowania z perspektywy kamery
        }
    };
})();