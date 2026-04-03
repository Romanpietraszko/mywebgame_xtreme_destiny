// ==========================================
// MAP.JS - MOTYW: ARENA ZESZYTOWA (Z CHOINKAMI I ATRAMENTOWYMI KAŁUŻAMI)
// ==========================================
const safeZones = []; 
const mapData = { trees: [], roads: [], ponds: [] }; // Nowa tablica: Ponds (kałuże/jeziorka)

function initMap(worldSize, mapType = 'default') {
    mapData.roads.length = 0;
    mapData.trees.length = 0;
    mapData.ponds.length = 0; // Czyszczenie kałuż
    safeZones.length = 0;

    if (mapType === 'campaign_1') {
        safeZones.push({ x: 2000, y: 3800, radius: 250 });
        // Główna oś szlaku (naszkicowana markerem)
        mapData.roads.push({ x: worldSize / 2 - 120, y: 200, width: 240, height: worldSize - 200 });
    } else {
        safeZones.push({ x: 1000, y: 1000, radius: 250 });
        safeZones.push({ x: 3000, y: 3000, radius: 250 });
        mapData.roads.push({ x: worldSize / 2 - 120, y: 0, width: 240, height: worldSize });
        mapData.roads.push({ x: 0, y: worldSize / 2 - 120, width: worldSize, height: 240 });
    }

    // 1. GENEROWANIE ATRAMENTOWYCH KAŁUŻY / JEZIORKA
    const NUM_PONDS = 25 + Math.floor(Math.random() * 10); // 25-35 kałuż na mapie
    
    for (let i = 0; i < NUM_PONDS; i++) {
        const r = 30 + Math.random() * 30; // Promień od 30 do 60px
        let px, py, invalidPos;
        do {
            invalidPos = false;
            px = Math.random() * worldSize;
            py = Math.random() * worldSize;

            // Zabezpieczenie: Nie nachodź na DROGI
            for(let road of mapData.roads) {
                if (px > road.x - r - 10 && px < road.x + road.width + r + 10 &&
                    py > road.y - r - 10 && py < road.y + road.height + r + 10) {
                    invalidPos = true; break;
                }
            }
            if (!invalidPos) {
                // Zabezpieczenie: Nie nachodź na BAZY (z dużym marginesem)
                for(let zone of safeZones) {
                    if (Math.hypot(px - zone.x, py - zone.y) < r + zone.radius + 15) {
                        invalidPos = true; break;
                    }
                }
            }
            if (!invalidPos) {
                // Zabezpieczenie: Nie nachodź na inne KAŁUŻE (by były osobne)
                for(let pond of mapData.ponds) {
                    if (Math.hypot(px - pond.x, py - pond.y) < r + pond.radius + 10) {
                        invalidPos = true; break;
                    }
                }
            }
        } while(invalidPos);
        
        mapData.ponds.push({
            x: px, y: py, radius: r,
            // Parametry naszkicowanego, nieregularnego koła
            numPoints: 24 + Math.floor(Math.random() * 12), // Liczba punktów na obwodzie
            randomOffsetLimit: 0.15 + Math.random() * 0.1 // Odchylenie od promienia (nieregularność)
        });
    }

    // 2. GENEROWANIE CHOINEK (z zabezpieczeniem przed rośnięciem na wodzie)
    const NUM_TREES = mapType === 'campaign_1' ? 450 : 350; 
    
    for (let i = 0; i < NUM_TREES; i++) {
        const r = 25 + Math.random() * 20; 
        let tx, ty, invalidPos;
        do {
            invalidPos = false;
            tx = Math.random() * worldSize;
            ty = Math.random() * worldSize;

            if (mapType === 'campaign_1') {
                if (tx > 1300 && tx < 2700 && ty > 1300 && ty < 2700) invalidPos = true;
                if (Math.hypot(tx - 2000, ty - 3800) < 500) invalidPos = true; 
            }

            if (!invalidPos) {
                // Zabezpieczenie: Nie nachodź na DROGI
                for(let road of mapData.roads) {
                    if (tx > road.x - r && tx < road.x + road.width + r &&
                        ty > road.y - r && ty < road.y + road.height + r) {
                        invalidPos = true; break;
                    }
                }
            }
            if (!invalidPos) {
                // ZABEZPIECZENIE: NIE NACHODŹ NA KAŁUŻE!
                for(let pond of mapData.ponds) {
                    if (Math.hypot(tx - pond.x, ty - pond.y) < r + pond.radius + 5) {
                        invalidPos = true; break;
                    }
                }
            }
        } while(invalidPos);
        
        mapData.trees.push({ x: tx, y: ty, radius: r });
    }
}

// --- RYSOWANIE NASZKICOWANEJ KAŁUŻY / PLAMY ATRAMENTU ---
function drawNotebookPuddle(ctx, x, y, radius, numPoints, randomOffsetLimit) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#111111'; // Głęboka czerń tuszu
    
    // Rysowanie organicznego, naszkicowanego koła za pomocą lineTo z losowym odchyleniem
    ctx.beginPath();
    for (let i = 0; i < numPoints; i++) {
        let angle = (i / numPoints) * Math.PI * 2;
        // Losowe odchylenie promienia dla każdego punktu na obwodzie
        let randomRadius = radius * (1 - randomOffsetLimit + Math.random() * randomOffsetLimit * 2);
        let px = Math.cos(angle) * randomRadius;
        let py = Math.sin(angle) * randomRadius;
        
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill(); // Wypełnienie czernią
    ctx.restore();
}

// --- RYSOWANIE GEOMETRYCZNEGO DRZEWA (TUSZ NA PAPIERZE) ---
function drawNotebookTree(ctx, x, y, radius) {
    ctx.save();
    ctx.translate(x, y);
    
    ctx.fillStyle = '#111111'; // Głęboka czerń tuszu
    ctx.strokeStyle = '#111111';
    ctx.lineJoin = 'miter'; // Ostre rogi!
    ctx.lineWidth = 1;

    // 1. Pień (Prostokąt narysowany cienkopisem)
    ctx.fillRect(-radius * 0.15, 0, radius * 0.3, radius * 0.8);

    // 2. Korona (3 ostre trójkąty narysowane markerem)
    ctx.beginPath();
    // Dolny trójkąt
    ctx.moveTo(0, -radius * 0.1); ctx.lineTo(radius * 0.9, radius * 0.5); ctx.lineTo(-radius * 0.9, radius * 0.5);
    // Środkowy trójkąt
    ctx.moveTo(0, -radius * 0.6); ctx.lineTo(radius * 0.7, 0); ctx.lineTo(-radius * 0.7, 0);
    // Górny trójkąt
    ctx.moveTo(0, -radius * 1.2); ctx.lineTo(radius * 0.5, -radius * 0.4); ctx.lineTo(-radius * 0.5, -radius * 0.4);
    
    ctx.fill();
    ctx.restore();
}

function drawForestMap(ctx, camera, canvasWidth, canvasHeight) {
    // 1. CZYSTA KARTKA PAPIERU
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. NIEBIESKA KRATKA (Zeszyt do matematyki)
    ctx.strokeStyle = 'rgba(52, 152, 219, 0.3)'; 
    ctx.lineWidth = 1;
    const TILE_SIZE = 40; 
    const offsetX = -camera.x % TILE_SIZE;
    const offsetY = -camera.y % TILE_SIZE;

    ctx.beginPath();
    for(let x = offsetX - TILE_SIZE; x < canvasWidth; x += TILE_SIZE) {
        ctx.moveTo(x, 0); ctx.lineTo(x, canvasHeight);
    }
    for(let y = offsetY - TILE_SIZE; y < canvasHeight; y += TILE_SIZE) {
        ctx.moveTo(0, y); ctx.lineTo(canvasWidth, y);
    }
    ctx.stroke();

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // 3. CZERWONY MARGINES
    ctx.strokeStyle = '#e74c3c'; 
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 4000, 4000); // 4000 to WORLD_SIZE
    ctx.lineWidth = 1; ctx.strokeRect(-10, -10, 4020, 4020);

    // 4. DROGI (Jak zamazane czarnym markerem traktu)
    ctx.fillStyle = 'rgba(17, 17, 17, 0.05)'; // Delikatne zszarzenie papieru
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2;
    for(let road of mapData.roads) {
        ctx.fillRect(road.x, road.y, road.width, road.height);
        // Kreskowane granice drogi rysowanecienisopisem
        ctx.setLineDash([15, 10]);
        ctx.strokeRect(road.x, road.y, road.width, road.height);
        ctx.setLineDash([]);
    }

    // 5. RYSOWANIE ATRAMENTOWYCH KAŁUŻY / JEZIORKA (Rysujemy PRZED drzewami, żeby drzewa nachodziły naturalnie)
    let visiblePonds = mapData.ponds.filter(pond => {
        return !(pond.x + pond.radius * 2 < camera.x || pond.x - pond.radius * 2 > camera.x + canvasWidth ||
                 pond.y + pond.radius * 2 < camera.y || pond.y - pond.radius * 2 > camera.y + canvasHeight);
    });
    for(let pond of visiblePonds) {
        drawNotebookPuddle(ctx, pond.x, pond.y, pond.radius, pond.numPoints, pond.randomOffsetLimit);
    }

    // 6. RYSOWANIE DRZEW ZESZYTOWYCH
    let visibleTrees = mapData.trees.filter(tree => {
        return !(tree.x + tree.radius * 2 < camera.x || tree.x - tree.radius * 2 > camera.x + canvasWidth ||
                 tree.y + tree.radius * 2 < camera.y || tree.y - tree.radius * 2 > camera.y + canvasHeight);
    });
    visibleTrees.sort((a, b) => a.y - b.y); // Sortowanie po perspektywie

    for(let tree of visibleTrees) {
        drawNotebookTree(ctx, tree.x, tree.y, tree.radius);
    }

    ctx.restore();

    // Systemowe efekty pogodowe (zaktualizowane o czarną zámieć)
    let eventName = typeof currentEvent !== 'undefined' ? currentEvent : null;
    if (eventName === 'TOXIC_RAIN') {
        ctx.fillStyle = 'rgba(46, 204, 113, 0.1)'; 
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    } else if (eventName === 'BLIZZARD') {
        ctx.fillStyle = 'rgba(52, 152, 219, 0.1)'; 
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
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
    ctx.fillStyle = '#ffffff'; // Zamazujemy kratkę wewnatrz bazy
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#111111'; 
    ctx.setLineDash([10, 15]); ctx.lineDashOffset = -(Date.now() / 50) % 50; ctx.stroke(); ctx.setLineDash([]);

    // Rdzeń zamku (Marker ciosany markerem)
    ctx.fillStyle = '#111111';
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();

    // Wnętrze zamku (Białe koło dla czytelności sklepu)
    ctx.beginPath(); ctx.arc(0, 0, radius - 10, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
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
