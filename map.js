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

// Funkcja pomocnicza generująca teksturę podłoża (Uruchamiana tylko przy zmianie pogody)
function generateGroundPattern(ctx, type) {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 200; pCanvas.height = 200;
    const pCtx = pCanvas.getContext('2d');
    
    let baseColor, dotColor1, dotColor2;
    
    if (type === 'WINTER') {
        baseColor = '#dbe4e9'; dotColor1 = 'rgba(255,255,255,0.7)'; dotColor2 = 'rgba(189,195,199,0.3)';
    } else if (type === 'TOXIC') {
        baseColor = '#2d2720'; dotColor1 = 'rgba(0,0,0,0.4)'; dotColor2 = 'rgba(62,39,35,0.6)';
    } else {
        baseColor = '#264a18'; dotColor1 = 'rgba(20,50,15,0.5)'; dotColor2 = 'rgba(45,106,49,0.2)';
    }

    pCtx.fillStyle = baseColor;
    pCtx.fillRect(0, 0, 200, 200);

    // Szum terenu (źdźbła / kamyki)
    for(let i=0; i<400; i++) {
        pCtx.fillStyle = Math.random() > 0.5 ? dotColor1 : dotColor2;
        let size = Math.random() * 3 + 1;
        pCtx.fillRect(Math.random() * 200, Math.random() * 200, size, size);
    }
    
    return ctx.createPattern(pCanvas, 'repeat');
}

// --- RYSOWANIE GRAFIKI MAPY ---
function drawForestMap(ctx, camera, canvasWidth, canvasHeight) {
    let eventName = typeof currentEvent !== 'undefined' ? currentEvent : null;
    let isWinter = eventName === 'BLIZZARD';
    let isToxic = eventName === 'TOXIC_RAIN';
    let groundType = isWinter ? 'WINTER' : (isToxic ? 'TOXIC' : 'NORMAL');

    // Aktualizacja cache'u tekstury
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

    // Rysowanie pięknego podłoża z patternu
    ctx.fillStyle = cachedGroundPattern;
    ctx.save();
    ctx.translate(-camera.x % 200, -camera.y % 200); // Paralaksa tekstury
    ctx.fillRect(-200, -200, canvasWidth + 400, canvasHeight + 400);
    ctx.restore();

    // Nowoczesna, delikatna siatka geograficzna (Kropki zamiast twardych linii)
    ctx.strokeStyle = isWinter ? 'rgba(44, 62, 80, 0.2)' : 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 38]); // Kropkowana linia (2px kropka, 38px przerwy)
    ctx.lineCap = 'round';
    
    const TILE_SIZE = 80; // Zagęszczenie siatki
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
    ctx.setLineDash([]); // Reset linii

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Piękniejsze Drogi (Z wydeptanymi krawędziami)
    let roadColor = '#6d4c41';
    let roadBorder = '#3e2723';
    let roadHighlight = '#5d4037';
    if (isWinter) { roadColor = '#95a5a6'; roadBorder = '#7f8c8d'; roadHighlight = '#bdc3c7'; }
    else if (isToxic) { roadColor = '#3e2723'; roadBorder = '#1a1110'; roadHighlight = '#2d1b17'; }

    for(let road of mapData.roads) {
        // Tło drogi
        ctx.fillStyle = roadColor;
        ctx.fillRect(road.x, road.y, road.width, road.height);
        
        // Zewnętrzne twarde obramowanie
        ctx.strokeStyle = roadBorder;
        ctx.lineWidth = 6;
        ctx.strokeRect(road.x, road.y, road.width, road.height);

        // Wewnętrzne wytarcie traktu (dodaje głębi)
        ctx.fillStyle = roadHighlight;
        ctx.fillRect(road.x + 15, road.y + 15, Math.max(0, road.width - 30), Math.max(0, road.height - 30));
    }

    let visibleTrees = mapData.trees.filter(tree => {
        return !(tree.x + tree.radius * 1.5 < camera.x || tree.x - tree.radius * 1.5 > camera.x + canvasWidth ||
                 tree.y + tree.radius * 1.5 < camera.y || tree.y - tree.radius * 1.5 > camera.y + canvasHeight);
    });
    visibleTrees.sort((a, b) => a.y - b.y);

    let globalWind = Date.now() / 1200; // Globalny czas wiatru

    for(let tree of visibleTrees) {
        let tTrunk1 = '#3e2723'; let tTrunk2 = '#4e342e';
        let tMainColor = tree.color;
        let tBrightColor = tree.brightColor;
        let tShadowEdge = '#0d210f';
        let strokeColor = '#143016'; // Ciemny obrys liści komiksowy

        if (isWinter) {
            tTrunk1 = '#7f8c8d'; tTrunk2 = '#95a5a6'; 
            tMainColor = '#bdc3c7'; tBrightColor = '#ffffff'; tShadowEdge = '#7f8c8d'; strokeColor = '#95a5a6';
        } else if (isToxic) {
            tTrunk1 = '#2c1f1c'; tTrunk2 = '#3e2c28'; 
            tMainColor = '#5c5316'; tBrightColor = '#8c8021'; tShadowEdge = '#1a1804'; strokeColor = '#2b2608';
        }

        // Obliczenie wiatru dla pnia i korony
        let treeSway = Math.sin(globalWind + tree.windOffset) * (tree.radius * 0.08);

        // 1. RYSOWANIE KORZENI I PNIA
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = tTrunk1;
        
        // Korzenie
        ctx.beginPath();
        ctx.moveTo(tree.x - 12, tree.y + tree.radius - 5);
        ctx.lineTo(tree.x - 20, tree.y + tree.radius + 15);
        ctx.lineTo(tree.x + 20, tree.y + tree.radius + 15);
        ctx.lineTo(tree.x + 12, tree.y + tree.radius - 5);
        ctx.fill();

        // Pień główny
        ctx.fillRect(tree.x - 10 + treeSway * 0.2, tree.y + tree.radius - 30, 20, 40);
        ctx.fillStyle = tTrunk2; 
        ctx.fillRect(tree.x - 10 + treeSway * 0.2, tree.y + tree.radius - 30, 8, 40);

        // 2. KORONA (Przemieszczona przez wiatr)
        let crownX = tree.x + treeSway;
        let crownY = tree.y;

        // Potężny Cień pod koroną (rzucany na ziemię i pień)
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; 
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 10; 
        ctx.shadowOffsetY = 15; 

        // Rysujemy podkład korony z obrysem
        ctx.fillStyle = tShadowEdge;
        ctx.beginPath();
        ctx.arc(crownX, crownY, tree.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = 'transparent'; // Wyłączamy cień dla detali wewnętrznych

        // Gradient promienisty nadający objętość (Kula)
        let grad = ctx.createRadialGradient(
            crownX - tree.radius * 0.35, crownY - tree.radius * 0.35, tree.radius * 0.1, 
            crownX, crownY, tree.radius * 1.2
        );
        grad.addColorStop(0, tBrightColor); 
        grad.addColorStop(0.4, tMainColor);
        grad.addColorStop(1, tShadowEdge); 

        ctx.fillStyle = grad;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.arc(crownX, crownY, tree.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke(); // Komiksowy obrys bazy

        // Rysowanie puszystych klastrów z indywidualnym mikro-wiatrem i obrysami
        if (tree.clusters) {
            for (let c of tree.clusters) {
                let clusterSwayX = Math.sin(globalWind * 2 + c.phase) * 3;
                let clusterSwayY = Math.cos(globalWind * 2 + c.phase) * 3;
                
                let cx = crownX + c.x + clusterSwayX;
                let cy = crownY + c.y + clusterSwayY;

                let cGrad = ctx.createRadialGradient(cx - c.r*0.3, cy - c.r*0.3, c.r*0.1, cx, cy, c.r);
                cGrad.addColorStop(0, tBrightColor);
                cGrad.addColorStop(0.7, tMainColor);
                cGrad.addColorStop(1, tShadowEdge);

                ctx.fillStyle = cGrad;
                ctx.beginPath();
                ctx.arc(cx, cy, c.r, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke(); // Każdy liść ma obrys
            }
        }
    }
    ctx.restore();

    // 4. FILTR PORY DNIA
    if (timeOverlay !== 'transparent') {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.fillStyle = timeOverlay;
        ctx.fillRect(0, 0, canvasWidth * globalScale, canvasHeight * globalScale); 
        ctx.restore();
    }
}

// --- RYSOWANIE KAMIENNEGO ZAMKU (Epicka Twierdza) ---
function drawCastle(ctx, z) {
    if (typeof z === 'number') { z = { x: arguments[0], y: arguments[1], radius: arguments[2] }; }
    let cx = z.x || arguments[0], cy = z.y || arguments[1], radius = z.radius || arguments[2];

    ctx.save();
    ctx.translate(cx, cy);
    
    // 1. ANIMOWANA WODA (FOSA)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    
    ctx.beginPath();
    ctx.arc(0, 0, radius + 45, 0, Math.PI * 2);
    ctx.fillStyle = '#2980b9'; // Głębsza woda
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    // Fale na wodzie
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.setLineDash([15, 25]);
    ctx.lineDashOffset = -(Date.now() / 40) % 40; // Animacja płynięcia fosy
    ctx.beginPath(); ctx.arc(0, 0, radius + 25, 0, Math.PI * 2); ctx.stroke();
    ctx.lineDashOffset = (Date.now() / 60) % 40; // Przeciwne fale
    ctx.beginPath(); ctx.arc(0, 0, radius + 35, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // 2. DREWNIANY MOST
    ctx.fillStyle = '#4e342e'; 
    ctx.fillRect(-30, radius - 15, 60, 70);
    ctx.fillStyle = '#795548'; // Deski
    for(let i=0; i<6; i++) {
        ctx.fillRect(-28, radius - 5 + i*10, 56, 6);
    }
    // Gwoździe w moście
    ctx.fillStyle = '#212121';
    for(let i=0; i<6; i++) {
        ctx.beginPath(); ctx.arc(-24, radius - 2 + i*10, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(24, radius - 2 + i*10, 2, 0, Math.PI*2); ctx.fill();
    }

    // 3. MURY KAMIENNE (Zewnętrzny obwód)
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#7f8c8d';
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#2c3e50';
    ctx.stroke();

    // Rysowanie cegieł na murze
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 2;
    for(let i = 0; i < 36; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 / 36) * i);
        ctx.beginPath(); ctx.moveTo(radius - 12, 0); ctx.lineTo(radius, 0); ctx.stroke();
        ctx.restore();
    }

    // 4. BLANKI WIEŻYCZKI (Zębatki z 3D efektem)
    for(let i = 0; i < 12; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 / 12) * i);
        
        ctx.fillStyle = '#95a5a6'; // Góra
        ctx.fillRect(-18, -radius - 15, 36, 25);
        ctx.fillStyle = '#bdc3c7'; // Jasny kant
        ctx.fillRect(-18, -radius - 15, 36, 5);
        ctx.fillStyle = '#7f8c8d'; // Ciemny dół
        ctx.fillRect(-18, -radius + 5, 36, 5);
        
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 3;
        ctx.strokeRect(-18, -radius - 15, 36, 25);
        ctx.restore();
    }

    // 5. WNĘTRZE ZAMKU (Mrok ze światłem w centrum)
    let innerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius - 15);
    innerGrad.addColorStop(0, '#2c3e50');
    innerGrad.addColorStop(1, '#111');
    
    ctx.beginPath();
    ctx.arc(0, 0, radius - 15, 0, Math.PI * 2);
    ctx.fillStyle = innerGrad;
    ctx.fill();

    // 6. MAGICZNY PORTAL SKLEPU (Serce zamku)
    let pulse = 1 + Math.sin(Date.now() / 300) * 0.1;
    
    ctx.shadowColor = '#f1c40f';
    ctx.shadowBlur = 30 * pulse;
    
    ctx.fillStyle = 'rgba(241, 196, 15, 0.2)';
    ctx.beginPath(); ctx.arc(0, 0, 60 * pulse, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.stroke();
    
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 10;
    ctx.font = `bold 35px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛒', 0, 2);

    ctx.restore();
}
