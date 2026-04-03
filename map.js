// ==========================================
// MAP.JS - MOTYW: ARENA ZESZYTOWA (CHOINKI Z EKIERKI)
// ==========================================
const safeZones = []; 
const mapData = { trees: [], roads: [] };

function initMap(worldSize, mapType = 'default') {
    mapData.roads.length = 0;
    mapData.trees.length = 0;
    safeZones.length = 0;

    if (mapType === 'campaign_1') {
        safeZones.push({ x: 2000, y: 3800, radius: 250 });
        // Główna oś (jak zamazany markerem szlak)
        mapData.roads.push({ x: worldSize / 2 - 120, y: 200, width: 240, height: worldSize - 200 });
    } else {
        safeZones.push({ x: 1000, y: 1000, radius: 250 });
        safeZones.push({ x: 3000, y: 3000, radius: 250 });
        mapData.roads.push({ x: worldSize / 2 - 120, y: 0, width: 240, height: worldSize });
        mapData.roads.push({ x: 0, y: worldSize / 2 - 120, width: worldSize, height: 240 });
    }

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
                for(let road of mapData.roads) {
                    if (tx > road.x - r && tx < road.x + road.width + r &&
                        ty > road.y - r && ty < road.y + road.height + r) {
                        invalidPos = true; break;
                    }
                }
            }
        } while(invalidPos);
        
        mapData.trees.push({ x: tx, y: ty, radius: r });
    }
}

// --- RYSOWANIE DRZEWA (TUSZ NA PAPIERZE) ---
function drawNotebookTree(ctx, x, y, radius) {
    ctx.save();
    ctx.translate(x, y);
    
    ctx.fillStyle = '#111111'; // Głęboka czerń tuszu
    ctx.strokeStyle = '#111111';
    ctx.lineJoin = 'miter'; // Ostre rogi!

    // 1. Pień (Prostokąt)
    ctx.fillRect(-radius * 0.15, 0, radius * 0.3, radius * 0.8);

    // 2. Korona (3 ostre trójkąty)
    ctx.beginPath();
    
    // Dolny trójkąt
    ctx.moveTo(0, -radius * 0.1);
    ctx.lineTo(radius * 0.9, radius * 0.5);
    ctx.lineTo(-radius * 0.9, radius * 0.5);
    
    // Środkowy trójkąt
    ctx.moveTo(0, -radius * 0.6);
    ctx.lineTo(radius * 0.7, 0);
    ctx.lineTo(-radius * 0.7, 0);
    
    // Górny trójkąt
    ctx.moveTo(0, -radius * 1.2);
    ctx.lineTo(radius * 0.5, -radius * 0.4);
    ctx.lineTo(-radius * 0.5, -radius * 0.4);
    
    ctx.fill();
    ctx.restore();
}

function drawForestMap(ctx, camera, canvasWidth, canvasHeight) {
    // 1. CZYSTA KARTKA PAPIERU
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. NIEBIESKA KRATKA (Zeszyt)
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
    ctx.strokeRect(0, 0, 4000, 4000); 
    ctx.lineWidth = 1;
    ctx.strokeRect(-10, -10, 4020, 4020);

    // 4. DROGI (Jak zamazane czarnym markerem)
    ctx.fillStyle = 'rgba(17, 17, 17, 0.05)'; // Delikatne zszarzenie
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2;
    for(let road of mapData.roads) {
        ctx.fillRect(road.x, road.y, road.width, road.height);
        
        // Kreskowane granice drogi
        ctx.setLineDash([15, 10]);
        ctx.strokeRect(road.x, road.y, road.width, road.height);
        ctx.setLineDash([]);
    }

    // 5. DRZEWA ZESZYTOWE
    let visibleTrees = mapData.trees.filter(tree => {
        return !(tree.x + tree.radius * 2 < camera.x || tree.x - tree.radius * 2 > camera.x + canvasWidth ||
                 tree.y + tree.radius * 2 < camera.y || tree.y - tree.radius * 2 > camera.y + canvasHeight);
    });
    visibleTrees.sort((a, b) => a.y - b.y);

    for(let tree of visibleTrees) {
        drawNotebookTree(ctx, tree.x, tree.y, tree.radius);
    }

    ctx.restore();

    // 6. EFEKTY POGODOWE W STYLU ZESZYTOWYM
    let eventName = typeof currentEvent !== 'undefined' ? currentEvent : null;
    if (eventName === 'TOXIC_RAIN') {
        ctx.fillStyle = 'rgba(46, 204, 113, 0.1)'; // Lekko zielonkawa kartka
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    } else if (eventName === 'BLIZZARD') {
        ctx.fillStyle = 'rgba(52, 152, 219, 0.1)'; // Lekko błękitna kartka
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
}

// --- ZESZYTOWY ZAMEK ---
function drawCastle(x, y, radius) {
    if (typeof x === 'object' && y && y.radius !== undefined) {
        radius = y.radius; let tempX = y.x; y = y.y; x = tempX;
    }

    ctx.save();
    ctx.translate(x, y);

    // Fosa narysowana przerywanym długopisem
    ctx.beginPath();
    ctx.arc(0, 0, radius + 40, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; 
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#111111'; 
    ctx.setLineDash([10, 15]); 
    ctx.lineDashOffset = -(Date.now() / 50) % 50; 
    ctx.stroke();
    ctx.setLineDash([]);

    // Mury
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Wnętrze zamku (Białe koło w środku)
    ctx.beginPath();
    ctx.arc(0, 0, radius - 10, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.stroke();

    // Ikona (Korona z trójkątów lub Baza)
    ctx.fillStyle = '#111111';
    ctx.font = `bold ${radius * 0.6}px 'Permanent Marker', Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('B', 0, 0); 

    ctx.restore();
}

// Systemowe
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
