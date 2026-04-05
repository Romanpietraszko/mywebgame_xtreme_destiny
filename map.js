// ==========================================
// MAP.JS - MOTYW: ARENA ZESZYTOWA (Z CHOINKAMI I ATRAMENTOWYMI KAŁUŻAMI)
// ==========================================

// --- NOWOŚĆ: SYSTEM MOTYWÓW WIZUALNYCH ---
const MAP_THEMES = {
    'FREE': { bg: '#ffffff', road: 'rgba(17, 17, 17, 0.05)', border: '#e74c3c', spotColor: '#111111' },
    'PvP': { bg: '#f4f1ea', road: 'rgba(139, 69, 19, 0.1)', border: '#8b4513', spotColor: '#2c3e50' },
    'TRAINING': { bg: '#f4f1ea', road: 'rgba(139, 69, 19, 0.1)', border: '#8b4513', spotColor: '#2c3e50' },
    'campaign_1': { bg: '#e8f8f5', road: 'rgba(39, 174, 96, 0.1)', border: '#1abc9c', spotColor: '#111111' },
    'campaign_2': { bg: '#fdedec', road: 'rgba(192, 57, 43, 0.1)', border: '#c0392b', spotColor: '#8b0000' }
};

let activeTheme = MAP_THEMES['FREE'];

const safeZones = []; 
// Dodano tablice dla nowych elementów otoczenia
const mapData = { trees: [], roads: [], ponds: [], spots: [], rocks: [], grass: [], birds: [], lastBirdSpawn: 0 }; 

function initMap(worldSize, mapType = 'FREE') {
    mapData.roads.length = 0;
    mapData.trees.length = 0;
    mapData.ponds.length = 0; 
    mapData.spots.length = 0;
    mapData.rocks.length = 0;
    mapData.grass.length = 0;
    mapData.birds.length = 0;
    mapData.lastBirdSpawn = Date.now();
    safeZones.length = 0;

    activeTheme = MAP_THEMES[mapType] || MAP_THEMES['FREE'];

    let numPonds = 0; let numTrees = 0; let numSpots = 100; let numGrass = 400;

    if (mapType === 'campaign_1') {
        safeZones.push({ x: 2000, y: 3800, radius: 250 });
        mapData.roads.push({ x: worldSize / 2 - 120, y: 200, width: 240, height: worldSize - 200 });
        numPonds = 15; numTrees = 450; numGrass = 600;
    } 
    else if (mapType === 'campaign_2') {
        safeZones.push({ x: worldSize / 2, y: worldSize - 300, radius: 300 }); 
        mapData.roads.push({ x: 0, y: worldSize / 2 - 150, width: worldSize, height: 300 }); 
        numPonds = 45; numTrees = 100; numSpots = 300; numGrass = 100;
    }
    else {
        safeZones.push({ x: 1000, y: 1000, radius: 250 });
        safeZones.push({ x: 3000, y: 3000, radius: 250 });
        mapData.roads.push({ x: worldSize / 2 - 120, y: 0, width: 240, height: worldSize });
        mapData.roads.push({ x: 0, y: worldSize / 2 - 120, width: worldSize, height: 240 });
        numPonds = 25 + Math.floor(Math.random() * 10);
        numTrees = 350;
    }

    // --- 1. GENEROWANIE TRAWY ---
    for(let i = 0; i < numGrass; i++) {
        mapData.grass.push({ x: Math.random() * worldSize, y: Math.random() * worldSize });
    }

    // --- 2. GENEROWANIE ŁAZÓW (KROPEK) ---
    for(let i = 0; i < numSpots; i++) {
        mapData.spots.push({ x: Math.random() * worldSize, y: Math.random() * worldSize, radius: 3 + Math.random() * 5 });
    }

    // --- 3. GŁAZY I KROPKI W ROGACH MAPY ---
    const corners = [
        {cx: 150, cy: 150}, {cx: worldSize - 150, cy: 150},
        {cx: 150, cy: worldSize - 150}, {cx: worldSize - 150, cy: worldSize - 150}
    ];
    corners.forEach(corner => {
        // Łazy (plamy)
        let spotCount = 3 + Math.floor(Math.random() * 2); 
        for(let i = 0; i < spotCount; i++) {
            mapData.spots.push({
                x: corner.cx + (Math.random() * 200 - 100),
                y: corner.cy + (Math.random() * 200 - 100),
                radius: 8 + Math.random() * 12 
            });
        }
        // Po 5 głazów (sterty kamieni) w każdym rogu
        for(let i = 0; i < 5; i++) {
            mapData.rocks.push({
                x: corner.cx + (Math.random() * 180 - 90),
                y: corner.cy + (Math.random() * 180 - 90),
                radius: 15 + Math.random() * 20 
            });
        }
    });

    // --- 4. GENEROWANIE KAŁUŻY ---
    for (let i = 0; i < numPonds; i++) {
        const r = 30 + Math.random() * 30; 
        let px, py, invalidPos;
        do {
            invalidPos = false; px = Math.random() * worldSize; py = Math.random() * worldSize;
            for(let road of mapData.roads) { if (px > road.x - r - 10 && px < road.x + road.width + r + 10 && py > road.y - r - 10 && py < road.y + road.height + r + 10) { invalidPos = true; break; } }
            if (!invalidPos) { for(let zone of safeZones) { if (Math.hypot(px - zone.x, py - zone.y) < r + zone.radius + 15) { invalidPos = true; break; } } }
            if (!invalidPos) { for(let pond of mapData.ponds) { if (Math.hypot(px - pond.x, py - pond.y) < r + pond.radius + 10) { invalidPos = true; break; } } }
        } while(invalidPos);
        mapData.ponds.push({ x: px, y: py, radius: r, numPoints: 24 + Math.floor(Math.random() * 12), randomOffsetLimit: 0.15 + Math.random() * 0.1 });
    }

    // --- 5. GENEROWANIE CHOINEK (I GŁAZÓW OBOK NICH) ---
    for (let i = 0; i < numTrees; i++) {
        const r = 25 + Math.random() * 20; 
        let tx, ty, invalidPos;
        do {
            invalidPos = false; tx = Math.random() * worldSize; ty = Math.random() * worldSize;
            if (mapType === 'campaign_1') {
                if (tx > 1300 && tx < 2700 && ty > 1300 && ty < 2700) invalidPos = true;
                if (Math.hypot(tx - 2000, ty - 3800) < 500) invalidPos = true; 
            }
            if (!invalidPos) { for(let road of mapData.roads) { if (tx > road.x - r && tx < road.x + road.width + r && ty > road.y - r && ty < road.y + road.height + r) { invalidPos = true; break; } } }
            if (!invalidPos) { for(let pond of mapData.ponds) { if (Math.hypot(tx - pond.x, ty - pond.y) < r + pond.radius + 5) { invalidPos = true; break; } } }
        } while(invalidPos);
        
        mapData.trees.push({ x: tx, y: ty, radius: r });

        // 30% szans na wygenerowanie głazu obok drzewka
        if (Math.random() < 0.30) {
            mapData.rocks.push({
                x: tx + (Math.random() > 0.5 ? 1 : -1) * (r + 10 + Math.random() * 20),
                y: ty + (Math.random() > 0.5 ? 1 : -1) * (r + 10 + Math.random() * 20),
                radius: 10 + Math.random() * 15
            });
        }
    }
}

// --- RYSOWANIE KĘPKI TRAWY ---
function drawNotebookGrass(ctx, x, y) {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = activeTheme.spotColor; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 5); ctx.lineTo(-5, -8); // Lewe źdźbło
    ctx.moveTo(2, 6); ctx.lineTo(1, -12); // Środkowe (wyższe) źdźbło
    ctx.moveTo(4, 5); ctx.lineTo(8, -6);  // Prawe źdźbło
    ctx.stroke();
    ctx.restore();
}

// --- RYSOWANIE GŁAZU ---
function drawNotebookRock(ctx, x, y, radius) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = activeTheme.bg; // Wnętrze skały w kolorze papieru
    ctx.strokeStyle = '#111111'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    
    // Rysowanie ciosanego wielokąta
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
        let angle = (i / 7) * Math.PI * 2;
        let offset = Math.sin(angle * 4 + x) * 0.25; 
        let currentR = radius * (1 + offset);
        let px = Math.cos(angle) * currentR;
        let py = Math.sin(angle) * currentR;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    
    // Wewnętrzne przerysowania (pęknięcia skały)
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-radius * 0.4, -radius * 0.2); ctx.lineTo(radius * 0.3, radius * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(radius * 0.1, -radius * 0.4); ctx.lineTo(0, radius * 0.5); ctx.stroke();
    
    ctx.restore();
}

// --- RYSOWANIE NASZKICOWANEJ KAŁUŻY / PLAMY ATRAMENTU ---
function drawNotebookPuddle(ctx, x, y, radius, numPoints, randomOffsetLimit) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = activeTheme.spotColor; // Używa koloru z motywu
    
    ctx.beginPath();
    for (let i = 0; i < numPoints; i++) {
        let angle = (i / numPoints) * Math.PI * 2;
        let offset1 = Math.sin(angle * 3 + x) * randomOffsetLimit;
        let offset2 = Math.cos(angle * 4 + y) * (randomOffsetLimit * 0.7);
        let currentRadius = radius * (1 + offset1 + offset2);
        let px = Math.cos(angle) * currentRadius;
        let py = Math.sin(angle) * currentRadius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill(); 

    ctx.beginPath();
    let drop1X = Math.cos(x) * (radius * 1.3);
    let drop1Y = Math.sin(y) * (radius * 1.3);
    ctx.arc(drop1X, drop1Y, radius * 0.15, 0, Math.PI * 2);
    let drop2X = Math.cos(y) * (radius * 1.5);
    let drop2Y = Math.sin(x) * (radius * 1.5);
    ctx.arc(drop2X, drop2Y, radius * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// --- RYSOWANIE GEOMETRYCZNEGO DRZEWA (TUSZ NA PAPIERZE) ---
function drawNotebookTree(ctx, x, y, radius) {
    ctx.save();
    ctx.translate(x, y);
    
    ctx.fillStyle = '#111111'; // Zostawiamy głęboką czerń dla kontrastu drzew
    ctx.strokeStyle = '#111111';
    ctx.lineJoin = 'miter'; 
    ctx.lineWidth = 1;

    ctx.fillRect(-radius * 0.15, 0, radius * 0.3, radius * 0.8);

    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.1); ctx.lineTo(radius * 0.9, radius * 0.5); ctx.lineTo(-radius * 0.9, radius * 0.5);
    ctx.moveTo(0, -radius * 0.6); ctx.lineTo(radius * 0.7, 0); ctx.lineTo(-radius * 0.7, 0);
    ctx.moveTo(0, -radius * 1.2); ctx.lineTo(radius * 0.5, -radius * 0.4); ctx.lineTo(-radius * 0.5, -radius * 0.4);
    ctx.fill();
    ctx.restore();
}

function drawForestMap(ctx, camera, canvasWidth, canvasHeight) {
    // 1. DYNAMICZNE TŁO ARENY
    ctx.fillStyle = activeTheme.bg;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // 2. MARGINES ZESZYTU
    ctx.strokeStyle = activeTheme.border; 
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 4000, 4000); 
    ctx.lineWidth = 1; ctx.strokeRect(-10, -10, 4020, 4020);

    // 3. DROGI
    ctx.fillStyle = activeTheme.road; 
    ctx.strokeStyle = activeTheme.spotColor;
    ctx.lineWidth = 2;
    for(let road of mapData.roads) {
        ctx.fillRect(road.x, road.y, road.width, road.height);
        ctx.setLineDash([15, 10]);
        ctx.strokeRect(road.x, road.y, road.width, road.height);
        ctx.setLineDash([]);
    }

    // 4. TRAWA
    let visibleGrass = mapData.grass.filter(g => !(g.x + 10 < camera.x || g.x - 10 > camera.x + canvasWidth || g.y + 10 < camera.y || g.y - 10 > camera.y + canvasHeight));
    for(let g of visibleGrass) drawNotebookGrass(ctx, g.x, g.y);

    // 5. ŁAZY (KROPKI ATRAMENTU)
    ctx.fillStyle = activeTheme.spotColor;
    let visibleSpots = mapData.spots.filter(s => !(s.x + s.radius < camera.x || s.x - s.radius > camera.x + canvasWidth || s.y + s.radius < camera.y || s.y - s.radius > camera.y + canvasHeight));
    for(let s of visibleSpots) {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2); ctx.fill();
    }

    // 6. ATRAMENTOWE KAŁUŻE
    let visiblePonds = mapData.ponds.filter(pond => {
        return !(pond.x + pond.radius * 2 < camera.x || pond.x - pond.radius * 2 > camera.x + canvasWidth ||
                 pond.y + pond.radius * 2 < camera.y || pond.y - pond.radius * 2 > camera.y + canvasHeight);
    });
    for(let pond of visiblePonds) {
        drawNotebookPuddle(ctx, pond.x, pond.y, pond.radius, pond.numPoints, pond.randomOffsetLimit);
    }

    // 7. GŁAZY (Rysowane przed drzewami)
    let visibleRocks = mapData.rocks.filter(r => !(r.x + r.radius < camera.x || r.x - r.radius > camera.x + canvasWidth || r.y + r.radius < camera.y || r.y - r.radius > camera.y + canvasHeight));
    visibleRocks.sort((a, b) => a.y - b.y); 
    for(let r of visibleRocks) drawNotebookRock(ctx, r.x, r.y, r.radius);

    // 8. DRZEWA ZESZYTOWE
    let visibleTrees = mapData.trees.filter(tree => {
        return !(tree.x + tree.radius * 2 < camera.x || tree.x - tree.radius * 2 > camera.x + canvasWidth ||
                 tree.y + tree.radius * 2 < camera.y || tree.y - tree.radius * 2 > camera.y + canvasHeight);
    });
    visibleTrees.sort((a, b) => a.y - b.y); 
    for(let tree of visibleTrees) {
        drawNotebookTree(ctx, tree.x, tree.y, tree.radius);
    }

    // 9. LOGIKA I RYSOWANIE PTAKÓW NA NIEBIE
    let now = Date.now();
    if (now - mapData.lastBirdSpawn > 30000) { // Klucz co 30 sekund
        mapData.lastBirdSpawn = now;
        let flock = [];
        for(let i=0; i<7; i++) flock.push({ offsetX: -Math.abs(i - 3) * 25, offsetY: (i - 3) * 25 }); // V-Shape
        mapData.birds.push({ x: -200, y: Math.random() * 3000 + 500, speed: 2 + Math.random(), flock: flock });
    }

    ctx.strokeStyle = activeTheme.spotColor; ctx.lineWidth = 2; ctx.lineJoin = 'miter';
    for (let i = mapData.birds.length - 1; i >= 0; i--) {
        let b = mapData.birds[i];
        b.x += b.speed; b.y -= b.speed * 0.3; // Lot w górę w prawo
        b.flock.forEach(f => {
            let bx = b.x + f.offsetX; let by = b.y + f.offsetY;
            // Rysowanie ptaka typu "naszkicowane V"
            ctx.beginPath(); ctx.moveTo(bx - 6, by - 6); ctx.lineTo(bx, by); ctx.lineTo(bx - 6, by + 6); ctx.stroke();
        });
        if (b.x > 4500 || b.y < -200) mapData.birds.splice(i, 1); 
    }

    ctx.restore(); // KAMERA SIĘ ZATRZYMUJE TUTAJ

    // --- 10. EFEKTY POGODOWE BEZPOŚREDNIO NA EKRANIE (HUD) ---
    // Rysowane po restore(), co oznacza, że zawsze zostają w kadrze, jak brud na szybie
    let eventName = typeof currentEvent !== 'undefined' ? currentEvent : null;
    
    if (eventName === 'TOXIC_RAIN') {
        ctx.fillStyle = 'rgba(46, 204, 113, 0.15)'; 
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        ctx.strokeStyle = 'rgba(46, 204, 113, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for(let i = 0; i < 150; i++) {
            let rx = (Math.sin(i * 123) * 10000 - now * 0.5) % canvasWidth;
            let ry = (Math.cos(i * 321) * 10000 + now * 1.5) % canvasHeight;
            if (rx < 0) rx += canvasWidth; if (ry < 0) ry += canvasHeight;
            ctx.moveTo(rx, ry); ctx.lineTo(rx - 8, ry + 25); // Deszcz pada w dół i w lewo
        }
        ctx.stroke();

    } else if (eventName === 'BLIZZARD') {
        ctx.fillStyle = 'rgba(52, 152, 219, 0.2)'; 
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        for(let i = 0; i < 200; i++) {
            let sx = (Math.cos(i * 987) * 10000 + now * 2.0) % canvasWidth; // Szybki poziomy wiatr
            let sy = (Math.sin(i * 654) * 10000 + now * 0.3) % canvasHeight;
            if (sx < 0) sx += canvasWidth; if (sy < 0) sy += canvasHeight;
            ctx.beginPath(); ctx.arc(sx, sy, 1 + (i % 3), 0, Math.PI * 2); ctx.fill();
        }
    }
}

// --- RYSOWANIE ZESZYTOWEGO ZAMKU (Z PŁYNĄCĄ FOSĄ) ---
function drawCastle(x, y, radius) {
    if (typeof x === 'object' && y && y.radius !== undefined) {
        radius = y.radius; let tempX = y.x; y = y.y; x = tempX;
    }

    ctx.save();
    ctx.translate(x, y);

    // Czarna naszkicowana fosa (Kręcąca się przerywana linia)
    ctx.beginPath(); ctx.arc(0, 0, radius + 40, 0, Math.PI * 2);
    ctx.fillStyle = activeTheme.bg; // Zamazujemy otoczenie wewnątrz bazy na kolor papieru
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#111111'; 
    ctx.setLineDash([10, 15]); ctx.lineDashOffset = -(Date.now() / 50) % 50; ctx.stroke(); ctx.setLineDash([]);

    // Rdzeń zamku (Marker ciosany markerem)
    ctx.fillStyle = '#111111';
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();

    // Wnętrze zamku (Koło dla czytelności sklepu)
    ctx.beginPath(); ctx.arc(0, 0, radius - 10, 0, Math.PI * 2);
    ctx.fillStyle = activeTheme.bg; ctx.fill();
    ctx.lineWidth = 4; ctx.stroke();

    // Ikona (Korona z trójkątów lub Baza rysowana permanentnie markerem)
    ctx.fillStyle = '#111111';
    ctx.font = `bold ${radius * 0.6}px 'Permanent Marker', Arial`; // Używa czcionki naszkicowanej
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('B', 0, 0); 

    ctx.restore();
}

// Systemowe (Skalowanie i tutorial)
window.wrapText = function(context, text, x, y, maxWidth, lineHeight) {
    if (!text) return;
    let words = text.split(' '); let line = '';
    for(let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' '; let metrics = context.measureText(testLine); let testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) { context.fillText(line, x, y); line = words[n] + ' '; y += lineHeight; } 
        else { line = testLine; }
    }
    context.fillText(line, x, y);
};
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; globalScale = Math.min(1, window.innerHeight / 900); }
window.onresize = resize; resize();
