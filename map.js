// --- KONFIGURACJA ŚRODOWISKA ---
const safeZones = []; 
const mapData = { trees: [], roads: [] };

// Zmienne do optymalizacji (Cache proceduralnych tekstur)
let cachedGroundPattern = null;
let lastGroundColorType = '';

function initMap(worldSize, mapType = 'default') {
    mapData.roads.length = 0;
    mapData.trees.length = 0;
    safeZones.length = 0;

    if (mapType === 'campaign_1') {
        // MAPA FABULARNA
        safeZones.push({ x: 2000, y: 3800, radius: 250 });
        mapData.roads.push({ x: worldSize / 2 - 120, y: 200, width: 240, height: worldSize - 200 });
    } else {
        // MAPA MULTIPLAYER (Free / PvP)
        safeZones.push({ x: 1000, y: 1000, radius: 250 });
        safeZones.push({ x: 3000, y: 3000, radius: 250 });

        mapData.roads.push({ x: worldSize / 2 - 120, y: 0, width: 240, height: worldSize });
        mapData.roads.push({ x: 0, y: worldSize / 2 - 120, width: worldSize, height: 240 });
    }

    const NUM_TREES = mapType === 'campaign_1' ? 450 : 350; 
    
    for (let i = 0; i < NUM_TREES; i++) {
        const r = 35 + Math.random() * 40; 
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
        
        let clusters = [];
        let numClusters = 4 + Math.floor(Math.random() * 4); 
        for (let j = 0; j < numClusters; j++) {
            let angle = (Math.PI * 2 / numClusters) * j + (Math.random() * 0.5);
            let dist = r * (0.3 + Math.random() * 0.3); 
            clusters.push({
                x: Math.cos(angle) * dist,
                y: Math.sin(angle) * dist,
                r: r * (0.5 + Math.random() * 0.4), 
                phase: Math.random() * Math.PI * 2 // Faza wiatru dla klastra
            });
        }

        mapData.trees.push({
            x: tx, y: ty, radius: r,
            color: Math.random() > 0.5 ? '#1e4620' : '#255e28',          
            brightColor: Math.random() > 0.5 ? '#3ed05b' : '#2ecc71',   
            clusters: clusters,
            windOffset: Math.random() * Math.PI * 2 // Indywidualny wiatr drzewa
        });
    }
}

// --- GENERATOR PROCEDURALNEJ TRAWY (Teraz to prawdziwa trawa!) ---
function generateGroundPattern(ctx, type) {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 400; pCanvas.height = 400; // Większy bufor dla mniejszej powtarzalności
    const pCtx = pCanvas.getContext('2d');
    
    let baseColor, bladeColor1, bladeColor2;
    
    if (type === 'WINTER') {
        baseColor = '#dbe4e9'; bladeColor1 = 'rgba(255,255,255,0.8)'; bladeColor2 = 'rgba(189,195,199,0.5)';
    } else if (type === 'TOXIC') {
        baseColor = '#2d2720'; bladeColor1 = 'rgba(0,0,0,0.5)'; bladeColor2 = 'rgba(62,39,35,0.7)';
    } else {
        baseColor = '#224a15'; // Głęboka zieleń gleby
        bladeColor1 = '#2e6b1d'; // Średnia trawa
        bladeColor2 = '#3a8726'; // Jasna trawa
    }

    pCtx.fillStyle = baseColor;
    pCtx.fillRect(0, 0, 400, 400);

    // Rysowanie 1500 prawdziwych źdźbeł trawy (krzywe)
    for(let i=0; i<1500; i++) {
        pCtx.strokeStyle = Math.random() > 0.5 ? bladeColor1 : bladeColor2;
        pCtx.lineWidth = Math.random() * 1.5 + 1;
        let x = Math.random() * 400;
        let y = Math.random() * 400;
        let height = Math.random() * 8 + 4; // Wysokość źdźbła
        let tilt = (Math.random() - 0.5) * 6; // Przechylenie od wiatru
        
        pCtx.beginPath();
        pCtx.moveTo(x, y);
        // Lekkie zaokrąglenie źdźbła
        pCtx.quadraticCurveTo(x + tilt/2, y - height/2, x + tilt, y - height);
        pCtx.stroke();
    }
    
    return ctx.createPattern(pCanvas, 'repeat');
}

// --- RYSOWANIE GRAFIKI MAPY ---
function drawForestMap(ctx, camera, canvasWidth, canvasHeight) {
    let eventName = typeof currentEvent !== 'undefined' ? currentEvent : null;
    let isWinter = eventName === 'BLIZZARD';
    let isToxic = eventName === 'TOXIC_RAIN';
    let groundType = isWinter ? 'WINTER' : (isToxic ? 'TOXIC' : 'NORMAL');

    // Aktualizacja cache'u tekstury trawy
    if (groundType !== lastGroundColorType || !cachedGroundPattern) {
        cachedGroundPattern = generateGroundPattern(ctx, groundType);
        lastGroundColorType = groundType;
    }

    let currentHour = new Date().getHours();
    let timeOverlay = 'transparent';
    if (currentHour >= 18 && currentHour < 20) {
        timeOverlay = 'rgba(211, 84, 0, 0.15)'; 
    } else if (currentHour >= 20 || currentHour < 7) {
        timeOverlay = 'rgba(10, 17, 40, 0.45)'; 
    }

    // 1. Rysowanie pięknej łąki z tekstury
    ctx.fillStyle = cachedGroundPattern;
    ctx.save();
    ctx.translate(-camera.x % 400, -camera.y % 400); // Zapobieganie przesuwaniu tekstury
    ctx.fillRect(-400, -400, canvasWidth + 800, canvasHeight + 800);
    ctx.restore();

    // Siatka (subtelna, by nie psuła krajobrazu)
    ctx.strokeStyle = isWinter ? 'rgba(0,0,0, 0.05)' : 'rgba(0,0,0, 0.15)';
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 38]); // Kropkowana siatka taktyczna
    ctx.lineCap = 'round';
    
    const TILE_SIZE = 80; 
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
    ctx.setLineDash([]); 

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // 2. Piękniejsze Drogi z wydeptanym środkiem i koleinami
    let roadColor = '#4e342e'; // Główny, ciemny kolor drogi
    let roadBorder = '#212121'; // Obramowanie szlaku
    let roadHighlight = '#6d4c41'; // Wydeptany, jaśniejszy piasek
    
    if (isWinter) { roadColor = '#95a5a6'; roadBorder = '#7f8c8d'; roadHighlight = '#bdc3c7'; }
    else if (isToxic) { roadColor = '#2d1b17'; roadBorder = '#1a1110'; roadHighlight = '#3e2723'; }

    for(let road of mapData.roads) {
        // Ziemia bazowa drogi
        ctx.fillStyle = roadColor;
        ctx.fillRect(road.x, road.y, road.width, road.height);
        
        // Jaśniejszy środek (wydeptany trakt)
        ctx.fillStyle = roadHighlight;
        ctx.fillRect(road.x + 20, road.y + 20, Math.max(0, road.width - 40), Math.max(0, road.height - 40));

        // Obrzeża
        ctx.strokeStyle = roadBorder;
        ctx.lineWidth = 4;
        ctx.strokeRect(road.x, road.y, road.width, road.height);

        // Ślady wozów / Koleiny
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 3;
        ctx.setLineDash([15, 15]); // Przerywane ślady
        
        if (road.width > road.height) { // Droga pozioma
            ctx.beginPath(); ctx.moveTo(road.x, road.y + 30); ctx.lineTo(road.x + road.width, road.y + 30); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(road.x, road.y + road.height - 30); ctx.lineTo(road.x + road.width, road.y + road.height - 30); ctx.stroke();
        } else { // Droga pionowa
            ctx.beginPath(); ctx.moveTo(road.x + 30, road.y); ctx.lineTo(road.x + 30, road.y + road.height); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(road.x + road.width - 30, road.y); ctx.lineTo(road.x + road.width - 30, road.y + road.height); ctx.stroke();
        }
        ctx.setLineDash([]);
    }

    // Sortowanie drzew pod efekt 3D
    let visibleTrees = mapData.trees.filter(tree => {
        return !(tree.x + tree.radius * 1.5 < camera.x || tree.x - tree.radius * 1.5 > camera.x + canvasWidth ||
                 tree.y + tree.radius * 1.5 < camera.y || tree.y - tree.radius * 1.5 > camera.y + canvasHeight);
    });
    visibleTrees.sort((a, b) => a.y - b.y);

    let globalWind = Date.now() / 1200; 

    // 3. PRAWDZIWE DRZEWA (Koniec z "kupą")
    for(let tree of visibleTrees) {
        let tTrunk1 = '#5c4033'; let tTrunk2 = '#3e2723';
        let tMainColor = tree.color; 
        let tBrightColor = tree.brightColor; 
        let tShadowEdge = '#0a1f0d';

        if (isWinter) {
            tTrunk1 = '#7f8c8d'; tTrunk2 = '#2c3e50'; 
            tMainColor = '#95a5a6'; tBrightColor = '#ffffff'; tShadowEdge = '#34495e';
        } else if (isToxic) {
            tTrunk1 = '#2c1f1c'; tTrunk2 = '#1a1110'; 
            tMainColor = '#5c5316'; tBrightColor = '#8c8021'; tShadowEdge = '#1a1804';
        }

        let treeSway = Math.sin(globalWind + tree.windOffset) * (tree.radius * 0.1);

        // a) Twardy cień rzucany przez całe drzewo
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'; 
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 12; 
        ctx.shadowOffsetY = 12; 

        // Rysujemy podkład cienia (baza drzewa)
        ctx.fillStyle = tShadowEdge;
        ctx.beginPath();
        ctx.arc(tree.x + treeSway, tree.y, tree.radius * 0.9, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = 'transparent'; // Wyłączamy cień na resztę detali

        // b) Widoczne korzenie i pień!
        ctx.fillStyle = tTrunk2; 
        ctx.beginPath(); ctx.ellipse(tree.x, tree.y + tree.radius * 0.8, tree.radius * 0.4, tree.radius * 0.2, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = tTrunk1; 
        ctx.fillRect(tree.x - 8 + treeSway*0.2, tree.y + tree.radius * 0.2, 16, tree.radius * 0.8);

        // c) Baza korony drzewa
        ctx.fillStyle = tMainColor;
        ctx.beginPath();
        ctx.arc(tree.x + treeSway, tree.y, tree.radius * 0.85, 0, Math.PI * 2);
        ctx.fill();

        // d) Rysowanie puszystych "chmur" liści - każdy ma własny gradient 3D!
        if (tree.clusters) {
            for (let c of tree.clusters) {
                let clusterSwayX = Math.sin(globalWind * 2 + c.phase) * 2.5;
                let clusterSwayY = Math.cos(globalWind * 2 + c.phase) * 2.5;
                
                let cx = tree.x + treeSway + c.x + clusterSwayX;
                let cy = tree.y + c.y + clusterSwayY;

                // Tworzymy kulę (gradient) dla każdego liściastego bąbla osobno!
                let cGrad = ctx.createRadialGradient(cx - c.r*0.3, cy - c.r*0.3, c.r*0.1, cx, cy, c.r);
                cGrad.addColorStop(0, tBrightColor);
                cGrad.addColorStop(0.6, tMainColor);
                cGrad.addColorStop(1, tShadowEdge);

                ctx.fillStyle = cGrad;
                ctx.beginPath();
                ctx.arc(cx, cy, c.r, 0, Math.PI * 2);
                ctx.fill();
                
                // Subtelny połysk/liść na górze klastra
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.beginPath();
                ctx.arc(cx - c.r*0.2, cy - c.r*0.2, c.r*0.3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    ctx.restore();

    // 4. Nakładka pory dnia na całą grę
    if (timeOverlay !== 'transparent') {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.fillStyle = timeOverlay;
        ctx.fillRect(0, 0, canvasWidth * globalScale, canvasHeight * globalScale); 
        ctx.restore();
    }
}

// --- RYSOWANIE PRAWDZIWEGO ZAMKU ---
function drawCastle(x, y, radius) {
    if (typeof x === 'object' && y && y.radius !== undefined) {
        radius = y.radius; let tempX = y.x; y = y.y; x = tempX;
    }

    ctx.save();
    ctx.translate(x, y);

    // 1. FOSA Z Falami
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 15;
    
    ctx.beginPath(); ctx.arc(0, 0, radius + 40, 0, Math.PI * 2);
    ctx.fillStyle = '#2980b9'; ctx.fill();
    
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.setLineDash([15, 25]);
    ctx.lineDashOffset = -(Date.now() / 40) % 40; 
    ctx.beginPath(); ctx.arc(0, 0, radius + 25, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // 2. DREWNIANY MOST
    ctx.fillStyle = '#4e342e'; 
    ctx.fillRect(-25, radius - 10, 50, 60);
    ctx.fillStyle = '#795548'; 
    for(let i=0; i<5; i++) {
        ctx.fillRect(-23, radius + i*10, 46, 6);
    }
    ctx.fillStyle = '#212121';
    for(let i=0; i<5; i++) {
        ctx.beginPath(); ctx.arc(-20, radius + 3 + i*10, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(20, radius + 3 + i*10, 2, 0, Math.PI*2); ctx.fill();
    }

    // 3. MURY (Zewnętrzny obwód)
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#7f8c8d'; ctx.fill();
    ctx.lineWidth = 10; ctx.strokeStyle = '#2c3e50'; ctx.stroke();

    // Zarys cegieł
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 2;
    for(let i = 0; i < 24; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 / 24) * i);
        ctx.beginPath(); ctx.moveTo(radius - 12, 0); ctx.lineTo(radius, 0); ctx.stroke();
        ctx.restore();
    }

    // 4. BLANKI (Zębatki na murach)
    for(let i = 0; i < 12; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 / 12) * i);
        ctx.fillStyle = '#95a5a6'; ctx.fillRect(-15, -radius - 12, 30, 20);
        ctx.fillStyle = '#bdc3c7'; ctx.fillRect(-15, -radius - 12, 30, 4); // Połysk krawędzi
        ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 3; ctx.strokeRect(-15, -radius - 12, 30, 20);
        ctx.restore();
    }

    // 5. WNĘTRZE ZAMKU
    ctx.beginPath(); ctx.arc(0, 0, radius - 15, 0, Math.PI * 2);
    ctx.fillStyle = '#111'; ctx.fill();

    // 6. PORTAL SKLEPU
    let pulse = 1 + Math.sin(Date.now() / 300) * 0.1;
    ctx.shadowColor = '#f1c40f'; ctx.shadowBlur = 20 * pulse;
    ctx.fillStyle = 'rgba(241, 196, 15, 0.2)';
    ctx.beginPath(); ctx.arc(0, 0, 50 * pulse, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#f1c40f'; ctx.font = `bold ${radius * 0.6}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🏰', 0, 0);

    ctx.restore();
}
