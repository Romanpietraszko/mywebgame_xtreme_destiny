// ==========================================
// MAP.JS - NOWOCZESNA ARCHITEKTURA KLASOWA (OOP)
// ==========================================

// --- SYSTEM MOTYWÓW WIZUALNYCH ---
const MAP_THEMES = {
    'FREE': { bg: '#050505', road: 'rgba(255, 255, 255, 0.05)', border: '#ffffff', spotColor: '#ffffff' },
    'PvP': { bg: '#050505', road: 'rgba(255, 255, 255, 0.05)', border: '#ffffff', spotColor: '#ffffff' },
    'TRAINING': { bg: '#050505', road: 'rgba(255, 255, 255, 0.05)', border: '#ffffff', spotColor: '#ffffff' },
    
    // AKT 1: Ruiny (Mroczny Las - Vibe Noir z neonowym zielonym zarysem)
    'campaign_1': { bg: '#050505', road: 'rgba(46, 204, 113, 0.05)', border: '#2ecc71', spotColor: '#ffffff' },
    
    // AKT 2: Dolina Cieni (Głęboki mrok z fioletowym neonem)
    'campaign_2': { bg: '#020205', road: 'rgba(155, 89, 182, 0.05)', border: '#9b59b6', spotColor: '#ffffff' },
    
    // AKT 3: Pustkowia Królów (Czarna otchłań z krwistoczerwonymi akcentami)
    'campaign_3': { bg: '#0a0505', road: 'rgba(231, 76, 60, 0.05)', border: '#e74c3c', spotColor: '#ffffff' }
};

let activeTheme = MAP_THEMES['FREE'];

// Główne kontenery z danymi mapy
const safeZones = []; 
const mapData = { trees: [], roads: [], ponds: [], spots: [], rocks: [], grass: [], birds: [], lastBirdSpawn: 0 }; 

// =========================================================================
// KLASA BAZOWA: MapGenerator (Wspólne narzędzia dla wszystkich trybów)
// =========================================================================
class MapGenerator {
    constructor(worldSize) {
        this.worldSize = worldSize;
    }

    clearData() {
        mapData.roads.length = 0;
        mapData.trees.length = 0;
        mapData.ponds.length = 0; 
        mapData.spots.length = 0;
        mapData.rocks.length = 0;
        mapData.grass.length = 0;
        mapData.birds.length = 0;
        mapData.lastBirdSpawn = Date.now();
        safeZones.length = 0;
    }

    addSafeZone(x, y, radius, type = 'safezone', teamLetter = '') {
        safeZones.push({ x: x, y: y, radius: radius, type: type, team: teamLetter });
    }

    addRoad(x, y, width, height) {
        mapData.roads.push({ x: x, y: y, width: width, height: height });
    }

    // Centralna metoda wypełniająca świat - zapobiega duplikacji kodu
    populateWorld(config) {
        // 1. Detale (Trawa, Nagrobki, Czaszki)
        for(let i = 0; i < config.numGrass; i++) {
            let type = config.grassTypes[Math.floor(Math.random() * config.grassTypes.length)];
            mapData.grass.push({ 
                x: Math.random() * this.worldSize, 
                y: Math.random() * this.worldSize, 
                type: type 
            });
        }

        // 2. Kropki (Łazy)
        for(let i = 0; i < config.numSpots; i++) {
            mapData.spots.push({ 
                x: Math.random() * this.worldSize, 
                y: Math.random() * this.worldSize, 
                radius: 3 + Math.random() * 5 
            });
        }

        // 3. Głazy w rogach mapy
        const corners = [
            {cx: 150, cy: 150}, {cx: this.worldSize - 150, cy: 150},
            {cx: 150, cy: this.worldSize - 150}, {cx: this.worldSize - 150, cy: this.worldSize - 150}
        ];
        corners.forEach(corner => {
            let spotCount = 3 + Math.floor(Math.random() * 2); 
            for(let i = 0; i < spotCount; i++) {
                mapData.spots.push({ x: corner.cx + (Math.random() * 200 - 100), y: corner.cy + (Math.random() * 200 - 100), radius: 8 + Math.random() * 12 });
            }
            for(let i = 0; i < 5; i++) {
                mapData.rocks.push({ x: corner.cx + (Math.random() * 180 - 90), y: corner.cy + (Math.random() * 180 - 90), radius: 15 + Math.random() * 20 });
            }
        });

        // 4. Pułapki (Kałuże, Kratery, Kolce)
        for (let i = 0; i < config.numPonds; i++) {
            const r = 30 + Math.random() * 40; 
            let px, py, invalidPos;
            do {
                invalidPos = false; px = Math.random() * this.worldSize; py = Math.random() * this.worldSize;
                for(let road of mapData.roads) { 
                    if (px > road.x - r - 10 && px < road.x + road.width + r + 10 && py > road.y - r - 10 && py < road.y + road.height + r + 10) { invalidPos = true; break; } 
                }
                if (!invalidPos) { for(let zone of safeZones) { if (Math.hypot(px - zone.x, py - zone.y) < r + zone.radius + 15) { invalidPos = true; break; } } }
                if (!invalidPos) { for(let pond of mapData.ponds) { if (Math.hypot(px - pond.x, py - pond.y) < r + pond.radius + 10) { invalidPos = true; break; } } }
            } while(invalidPos);
            
            mapData.ponds.push({ x: px, y: py, radius: r, numPoints: 12 + Math.floor(Math.random() * 8), randomOffsetLimit: 0.15 + Math.random() * 0.1, type: config.pondType });
        }

        // 5. Przeszkody (Drzewa, Kolumny)
        for (let i = 0; i < config.numTrees; i++) {
            const r = 25 + Math.random() * 20; 
            let tx, ty, invalidPos;
            do {
                invalidPos = false; tx = Math.random() * this.worldSize; ty = Math.random() * this.worldSize;
                
                if (config.isAct1) {
                    if (tx > 1300 && tx < 2700 && ty > 1300 && ty < 2700) invalidPos = true;
                    if (Math.hypot(tx - 2000, ty - 3800) < 500) invalidPos = true; 
                }
                if (config.isAct2Or3) {
                    for(let zone of safeZones) { if (Math.hypot(tx - zone.x, ty - zone.y) < zone.radius + 50) { invalidPos = true; break; } }
                }
                if (!invalidPos) { for(let road of mapData.roads) { if (tx > road.x - r && tx < road.x + road.width + r && ty > road.y - r && ty < road.y + road.height + r) { invalidPos = true; break; } } }
                if (!invalidPos) { for(let pond of mapData.ponds) { if (Math.hypot(tx - pond.x, ty - pond.y) < r + pond.radius + 5) { invalidPos = true; break; } } }
            } while(invalidPos);
            
            mapData.trees.push({ x: tx, y: ty, radius: r, type: config.treeType });

            // Kamienie obok drzew/kolumn
            if (Math.random() < config.rockChance) {
                mapData.rocks.push({ x: tx + (Math.random() > 0.5 ? 1 : -1) * (r + 10 + Math.random() * 20), y: ty + (Math.random() > 0.5 ? 1 : -1) * (r + 10 + Math.random() * 20), radius: 10 + Math.random() * 15 });
            }
        }
    }
}

// -------------------------------------------------------------------------
// KLASA: FREE MODE (Dla trybu free.js - Każdy na każdego)
// -------------------------------------------------------------------------
class FreeModeMap extends MapGenerator {
    generate() {
        this.clearData();
        activeTheme = MAP_THEMES['FREE'];
        
        // ZAMKI DLA TRYBU FREE
        this.addSafeZone(1000, 1000, 250, 'castle', ''); 
        this.addSafeZone(3000, 3000, 250, 'castle', ''); 
        
        this.addRoad(this.worldSize / 2 - 120, 0, 240, this.worldSize);
        this.addRoad(0, this.worldSize / 2 - 120, this.worldSize, 240);

        this.populateWorld({
            numGrass: 400, grassTypes: ['grass'],
            numSpots: 100,
            numPonds: 25 + Math.floor(Math.random() * 10), pondType: 'puddle',
            numTrees: 350, treeType: 'choinka',
            rockChance: 0.3,
            isAct1: false, isAct2Or3: false
        });
    }
}

// -------------------------------------------------------------------------
// KLASA: CAMPAIGN (Dla trybu campaign.js - Wszystkie akty)
// -------------------------------------------------------------------------
class CampaignMap extends MapGenerator {
    generate(actType) {
        this.clearData();
        activeTheme = MAP_THEMES[actType];

        if (actType === 'campaign_1') this.generateAct1();
        else if (actType === 'campaign_2') this.generateAct2();
        else if (actType === 'campaign_3') this.generateAct3();
    }

    generateAct1() {
        this.addSafeZone(2000, 3800, 250, 'safezone');
        this.addRoad(this.worldSize / 2 - 120, 200, 240, this.worldSize - 200);

        this.populateWorld({
            numGrass: 600, grassTypes: ['grass'],
            numSpots: 150,
            numPonds: 15, pondType: 'puddle',
            numTrees: 450, treeType: 'choinka',
            rockChance: 0.3,
            isAct1: true, isAct2Or3: false
        });
    }

    generateAct2() {
        this.addSafeZone(this.worldSize / 2, this.worldSize / 2, 300, 'safezone');
        this.addRoad(0, this.worldSize / 2 - 120, this.worldSize, 240);
        this.addRoad(this.worldSize / 2 - 120, 0, 240, this.worldSize);

        this.populateWorld({
            numGrass: 300, grassTypes: ['grave', 'sword'],
            numSpots: 250,
            numPonds: 35, pondType: 'crater',
            numTrees: 200, treeType: 'dead_tree',
            rockChance: 0.3,
            isAct1: false, isAct2Or3: true
        });
    }

    generateAct3() {
        this.addSafeZone(2000, 3800, 150, 'safezone');
        this.addSafeZone(2000, 200, 200, 'safezone');
        this.addRoad(this.worldSize / 2 - 60, 200, 120, this.worldSize - 400);

        this.populateWorld({
            numGrass: 50, grassTypes: ['skull', 'crown'],
            numSpots: 800,
            numPonds: 60, pondType: 'spikes',
            numTrees: 300, treeType: 'column',
            rockChance: 0.8,
            isAct1: false, isAct2Or3: true
        });
    }
}

// -------------------------------------------------------------------------
// KLASA: TEAMS (Dla trybu teams.js - PvP i Trening drużynowy)
// -------------------------------------------------------------------------
class TeamsMap extends MapGenerator {
    generate(modeType) {
        this.clearData();
        activeTheme = MAP_THEMES[modeType] || MAP_THEMES['PvP'];
        
        let center = this.worldSize / 2; // Środek mapy (2000, 2000)

        // 1. CENTRALNA ARENA BOJOWA (Wielki plac bez drzew na epickie starcia)
        this.addRoad(center - 400, center - 400, 800, 800);

        // 2. CZTERY GŁÓWNE DROGI DO BAZ FRAKCJI (N, S, E, W)
        this.addRoad(center - 150, 0, 300, center - 400); // Droga Północna
        this.addRoad(center - 150, center + 400, 300, center - 400); // Droga Południowa
        this.addRoad(0, center - 150, center - 400, 300); // Droga Zachodnia
        this.addRoad(center + 400, center - 150, center - 400, 300); // Droga Wschodnia

        // UWAGA: Nie używamy tutaj this.addSafeZone(), ponieważ teams.js ZAWSZE 
        // synchronizuje autorytatywne pozycje 4 Zamków prosto z serwera!

        // 3. GENEROWANIE ŚRODOWISKA (Więcej detali pobojowiska)
        this.populateWorld({
            numGrass: 500, 
            grassTypes: ['grass', 'sword', 'skull'], // Detale bitewne
            numSpots: 150,
            numPonds: 30, 
            pondType: 'puddle', // Możemy to w przyszłości zmienić na 'crater'
            numTrees: 450, 
            treeType: 'choinka',
            rockChance: 0.5, // Więcej głazów do chowania się przed ostrzałem łuczników
            isAct1: false, 
            isAct2Or3: false
        });
    }
}

// =========================================================================
// INICJALIZATOR (Wybiera odpowiednią klasę na podstawie argumentu)
// =========================================================================
function initMap(worldSize, mapType = 'FREE') {
    if (mapType === 'FREE') {
        new FreeModeMap(worldSize).generate();
    } else if (mapType.startsWith('campaign_')) {
        new CampaignMap(worldSize).generate(mapType);
    } else if (mapType === 'PvP' || mapType === 'TRAINING') {
        new TeamsMap(worldSize).generate(mapType);
    } else {
        new FreeModeMap(worldSize).generate(); // Zabezpieczenie domyślne
    }
}

// =========================================================================
// FUNKCJE RYSOWANIA DETALI MAPY
// =========================================================================

function drawNotebookGrass(ctx, x, y) {
    ctx.save(); 
    ctx.translate(x, y);
    ctx.strokeStyle = activeTheme.border; 
    ctx.lineWidth = 1.5; 
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(0, 5); 
    ctx.lineTo(-5, -8); 
    ctx.moveTo(2, 6); 
    ctx.lineTo(1, -12); 
    ctx.moveTo(4, 5); 
    ctx.lineTo(8, -6);  
    ctx.stroke();
    
    ctx.restore();
}

function drawGrave(ctx, x, y) {
    ctx.save(); 
    ctx.translate(x, y);
    ctx.strokeStyle = activeTheme.border; 
    ctx.lineWidth = 2.5; 
    ctx.lineCap = 'round'; 
    ctx.lineJoin = 'round';
    
    ctx.fillStyle = activeTheme.bg; 
    ctx.beginPath(); 
    ctx.moveTo(-6, 8); 
    ctx.lineTo(-6, -4); 
    ctx.arc(0, -4, 6, Math.PI, 0); 
    ctx.lineTo(6, 8); 
    ctx.closePath(); 
    ctx.fill(); 
    ctx.stroke();
    
    ctx.lineWidth = 1.5; 
    ctx.beginPath(); 
    ctx.moveTo(0, -5); 
    ctx.lineTo(0, 2); 
    ctx.moveTo(-3, -2); 
    ctx.lineTo(3, -2); 
    ctx.stroke(); 
    
    ctx.restore();
}

function drawSwordDetail(ctx, x, y) {
    ctx.save(); 
    ctx.translate(x, y); 
    ctx.rotate(-0.3); 
    ctx.strokeStyle = activeTheme.border; 
    ctx.lineWidth = 2;
    
    ctx.beginPath(); 
    ctx.moveTo(0, 10); 
    ctx.lineTo(0, -10); 
    ctx.stroke(); 
    
    ctx.beginPath();
    ctx.moveTo(-5, -6); 
    ctx.lineTo(5, -6); 
    ctx.stroke(); 
    
    ctx.beginPath(); 
    ctx.arc(0, -11, 1.5, 0, Math.PI*2); 
    ctx.stroke(); 
    
    ctx.restore();
}

function drawWastelandSkull(ctx, x, y) {
    ctx.save(); 
    ctx.translate(x, y);
    ctx.strokeStyle = activeTheme.border; 
    ctx.lineWidth = 2; 
    ctx.lineCap = 'round'; 
    ctx.lineJoin = 'round';
    
    ctx.beginPath(); 
    ctx.arc(0, -2, 5, 0, Math.PI*2); 
    ctx.stroke(); 
    
    ctx.beginPath(); 
    ctx.moveTo(-3, 3); 
    ctx.lineTo(-3, 6); 
    ctx.lineTo(3, 6); 
    ctx.lineTo(3, 3); 
    ctx.stroke(); 
    
    ctx.fillStyle = activeTheme.bg;
    ctx.beginPath(); 
    ctx.arc(-2, -2, 1.5, 0, Math.PI*2); 
    ctx.fill(); 
    ctx.beginPath(); 
    ctx.arc(2, -2, 1.5, 0, Math.PI*2); 
    ctx.fill(); 
    
    ctx.restore();
}

function drawBrokenCrown(ctx, x, y) {
    ctx.save(); 
    ctx.translate(x, y);
    ctx.strokeStyle = activeTheme.border; 
    ctx.lineWidth = 2; 
    ctx.lineCap = 'round'; 
    ctx.lineJoin = 'round';
    
    ctx.beginPath(); 
    ctx.moveTo(-6, -4); 
    ctx.lineTo(-4, 4); 
    ctx.lineTo(4, 4); 
    ctx.lineTo(6, -4);
    ctx.lineTo(2, 0); 
    ctx.lineTo(0, -6); 
    ctx.lineTo(-2, 0); 
    ctx.closePath(); 
    ctx.stroke();
    
    ctx.restore();
}

function drawNotebookRock(ctx, x, y, radius) {
    ctx.save(); 
    ctx.translate(x, y);
    ctx.fillStyle = activeTheme.bg; 
    ctx.strokeStyle = activeTheme.border; 
    ctx.lineWidth = 2; 
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
        let angle = (i / 7) * Math.PI * 2;
        let offset = Math.sin(angle * 4 + x) * 0.25; 
        let currentR = radius * (1 + offset);
        let px = Math.cos(angle) * currentR;
        let py = Math.sin(angle) * currentR;
        if (i === 0) ctx.moveTo(px, py); 
        else ctx.lineTo(px, py);
    }
    ctx.closePath(); 
    ctx.fill(); 
    ctx.stroke();
    
    ctx.lineWidth = 1;
    ctx.beginPath(); 
    ctx.moveTo(-radius * 0.4, -radius * 0.2); 
    ctx.lineTo(radius * 0.3, radius * 0.2); 
    ctx.stroke();
    
    ctx.beginPath(); 
    ctx.moveTo(radius * 0.1, -radius * 0.4); 
    ctx.lineTo(0, radius * 0.5); 
    ctx.stroke();
    
    ctx.restore();
}

// =========================================================================
// FUNKCJE RYSOWANIA PUŁAPEK
// =========================================================================

function drawNotebookPuddle(ctx, x, y, radius, numPoints, randomOffsetLimit) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; 
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 2;
    
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
    ctx.stroke();

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

function drawDeepCrater(ctx, x, y, radius) {
    ctx.save(); 
    ctx.translate(x, y);
    
    ctx.fillStyle = '#111111'; 
    ctx.strokeStyle = '#ffffff'; 
    ctx.lineWidth = 3; 
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    for(let i=0; i<12; i++) {
        let a = (i/12) * Math.PI * 2;
        let r = radius + Math.sin(a * 5 + x) * 10; 
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); 
    ctx.fill(); 
    ctx.stroke();

    ctx.lineWidth = 2;
    for(let i=0; i<4; i++) {
        let a = (i/4) * Math.PI * 2 + (x % 2); 
        ctx.beginPath(); 
        ctx.moveTo(Math.cos(a)*(radius-5), Math.sin(a)*(radius-5));
        ctx.lineTo(Math.cos(a)*(radius+20), Math.sin(a)*(radius+20)); 
        ctx.stroke();
    }

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    for(let i=0; i<10; i++) {
        let a = (i/10) * Math.PI * 2;
        let r = radius * 0.6 + Math.cos(a * 7 + y) * 8;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); 
    ctx.fill();

    ctx.restore();
}

function drawSpikesField(ctx, x, y, radius) {
    ctx.save(); 
    ctx.translate(x, y);
    ctx.strokeStyle = activeTheme.border; 
    ctx.lineWidth = 2.5; 
    ctx.lineJoin = 'round';
    
    let numSpikes = 5 + Math.floor(Math.abs(x + y) % 3);
    for(let i=0; i<numSpikes; i++) {
        let a = (i/numSpikes) * Math.PI * 2 + (x % 1); 
        let dist = radius * 0.5;
        
        ctx.save();
        ctx.translate(Math.cos(a)*dist, Math.sin(a)*dist);
        ctx.rotate(a + Math.PI/2); 
        
        ctx.fillStyle = '#111111'; 
        ctx.beginPath(); 
        ctx.moveTo(-8, 10); 
        ctx.lineTo(0, -25); 
        ctx.lineTo(8, 10); 
        ctx.closePath();
        ctx.fill(); 
        ctx.stroke();
        
        ctx.fillStyle = '#050505'; 
        ctx.beginPath(); 
        ctx.moveTo(0, -25); 
        ctx.lineTo(8, 10); 
        ctx.lineTo(0, 10); 
        ctx.closePath(); 
        ctx.fill();
        
        ctx.restore();
    }
    ctx.restore();
}

// =========================================================================
// FUNKCJE RYSOWANIA PRZESZKÓD
// =========================================================================

function drawNotebookTree(ctx, x, y, radius) {
    ctx.save();
    ctx.translate(x, y);
    
    ctx.fillStyle = activeTheme.bg; 
    ctx.strokeStyle = activeTheme.border;
    ctx.lineJoin = 'miter'; 
    ctx.lineWidth = 2;

    ctx.fillRect(-radius * 0.15, 0, radius * 0.3, radius * 0.8);
    ctx.strokeRect(-radius * 0.15, 0, radius * 0.3, radius * 0.8);

    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.1); 
    ctx.lineTo(radius * 0.9, radius * 0.5); 
    ctx.lineTo(-radius * 0.9, radius * 0.5);
    
    ctx.moveTo(0, -radius * 0.6); 
    ctx.lineTo(radius * 0.7, 0); 
    ctx.lineTo(-radius * 0.7, 0);
    
    ctx.moveTo(0, -radius * 1.2); 
    ctx.lineTo(radius * 0.5, -radius * 0.4); 
    ctx.lineTo(-radius * 0.5, -radius * 0.4);
    
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

function drawSpookyTree(ctx, x, y, radius) {
    ctx.save(); 
    ctx.translate(x, y);
    ctx.strokeStyle = activeTheme.border; 
    ctx.lineWidth = 4; 
    ctx.lineCap = 'round'; 
    ctx.lineJoin = 'round';
    
    ctx.beginPath(); 
    ctx.moveTo(0, radius); 
    ctx.lineTo(0, -radius * 0.3); 
    ctx.stroke();
    
    ctx.lineWidth = 3;
    ctx.beginPath(); 
    ctx.moveTo(0, 0); 
    ctx.lineTo(-radius * 0.6, -radius * 0.5); 
    ctx.lineTo(-radius * 0.9, -radius * 0.1); 
    ctx.stroke();
    
    ctx.beginPath(); 
    ctx.moveTo(0, -radius * 0.1); 
    ctx.lineTo(radius * 0.5, -radius * 0.6); 
    ctx.lineTo(radius * 0.8, -radius * 0.2); 
    ctx.stroke();
    
    ctx.fillStyle = activeTheme.bg;
    ctx.beginPath(); 
    ctx.ellipse(0, radius * 0.4, radius * 0.15, radius * 0.3, 0, 0, Math.PI*2); 
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
}

function drawBrokenColumn(ctx, x, y, radius) {
    ctx.save(); 
    ctx.translate(x, y);
    ctx.fillStyle = activeTheme.bg; 
    ctx.strokeStyle = activeTheme.border; 
    ctx.lineWidth = 3; 
    ctx.lineJoin = 'round';
    
    ctx.beginPath(); 
    ctx.ellipse(0, radius*0.8, radius, radius*0.3, 0, 0, Math.PI*2); 
    ctx.fill(); 
    ctx.stroke();
    
    ctx.beginPath(); 
    ctx.moveTo(-radius*0.8, radius*0.8);
    ctx.lineTo(-radius*0.8, -radius*0.5);
    ctx.lineTo(-radius*0.3, -radius*0.9); 
    ctx.lineTo(0, -radius*0.4);
    ctx.lineTo(radius*0.5, -radius*0.8);
    ctx.lineTo(radius*0.8, radius*0.8);
    ctx.fill(); 
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.beginPath(); 
    ctx.moveTo(-radius*0.4, radius*0.8); 
    ctx.lineTo(-radius*0.4, -radius*0.6); 
    ctx.stroke();
    
    ctx.beginPath(); 
    ctx.moveTo(0, radius*0.8); 
    ctx.lineTo(0, -radius*0.4); 
    ctx.stroke();
    
    ctx.beginPath(); 
    ctx.moveTo(radius*0.4, radius*0.8); 
    ctx.lineTo(radius*0.4, -radius*0.7); 
    ctx.stroke();

    ctx.lineWidth = 2.5;
    ctx.beginPath(); 
    ctx.moveTo(-radius*0.2, 0); 
    ctx.lineTo(radius*0.2, radius*0.3); 
    ctx.lineTo(radius*0.1, radius*0.6); 
    ctx.stroke();

    ctx.restore();
}

// =========================================================================
// FUNKCJE RYSOWANIA BAZ I ZAMKÓW
// =========================================================================

function drawSafeZone(ctx, x, y, radius) {
    ctx.save();
    ctx.translate(x, y);
    
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip(); 
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    
    ctx.restore(); 
    ctx.save();
    ctx.translate(x, y);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 15]); 
    if (!window.isMobile) { ctx.shadowBlur = 10; ctx.shadowColor = '#ffffff'; }
    
    ctx.beginPath();
    for (let i = 0; i < 32; i++) {
        let angle = (i / 32) * Math.PI * 2;
        let offset = Math.sin(angle * 6 + x) * 3; 
        let px = Math.cos(angle) * (radius + offset);
        let py = Math.sin(angle) * (radius + offset);
        
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 16px 'Courier New', monospace";
    ctx.textAlign = 'center';
    ctx.fillText("BEZPIECZNA STREFA", 0, radius - 20);
    
    ctx.restore();
}

function drawCastle(ctx, x, y, radius, teamLetter = 'B') {
    ctx.save();
    ctx.translate(x, y);

    // Wyliczamy kąt mostu (zawsze w stronę centrum mapy 2000x2000)
    let bridgeAngle = Math.atan2(2000 - y, 2000 - x); 
    let moatRadius = radius + 40;

    // 1. FOSA
    ctx.fillStyle = '#020202'; 
    ctx.beginPath();
    for (let i = 0; i < 32; i++) {
        let angle = (i / 32) * Math.PI * 2;
        let offset = Math.sin(angle * 8 + x) * 8; 
        let px = Math.cos(angle) * (moatRadius + offset);
        let py = Math.sin(angle) * (moatRadius + offset);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // 2. SPRAWDZANIE CZY GRACZ JEST W ŚRODKU
    let isPlayerHere = typeof player !== 'undefined' && player && Math.hypot(player.x - x, player.y - y) < radius;

    ctx.beginPath();
    ctx.arc(0, 0, radius + 15, 0, Math.PI * 2);
    
    if (isPlayerHere) {
        // --- RYSOWANIE WNĘTRZA SKLEPU ---
        ctx.save();
        ctx.clip(); 
        
        // Kafelkowa podłoga
        ctx.fillStyle = '#050505';
        ctx.fillRect(-radius-15, -radius-15, (radius+15)*2, (radius+15)*2);
        ctx.fillStyle = '#111111';
        let tileSize = 30;
        for(let tx = -radius-15; tx < radius+15; tx+=tileSize) {
            for(let ty = -radius-15; ty < radius+15; ty+=tileSize) {
                if (Math.abs((tx/tileSize) % 2) === Math.abs((ty/tileSize) % 2)) {
                    ctx.fillRect(tx, ty, tileSize, tileSize);
                }
            }
        }
        
        // Dywan królewski przed ladą
        ctx.fillStyle = '#333333';
        ctx.fillRect(-30, -30, 60, 80);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-30, -30, 60, 80);

        // Lada sklepowa kupca
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-50, -60, 100, 30);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-50, -60, 100, 30);

        ctx.restore();
    } else {
        // Zwykły, biały dziedziniec z zewnątrz
        ctx.fillStyle = activeTheme.bg; 
        ctx.fill();
    }

    // 3. MUR ZAMKOWY Z PRZERWĄ NA MOST
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    if (!window.isMobile) { ctx.shadowBlur = 15; ctx.shadowColor = '#ffffff'; }
    ctx.beginPath();
    // Rysujemy łuk, ale zostawiamy "dziurę" na most (0.35 radiana z każdej strony)
    ctx.arc(0, 0, radius, bridgeAngle + 0.35, bridgeAngle - 0.35 + Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 4. DREWNIANY MOST NAD FOSĄ
    ctx.save();
    ctx.rotate(bridgeAngle);
    ctx.fillStyle = '#050505'; 
    ctx.fillRect(radius - 5, -30, 55, 60);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(radius - 5, -30, 55, 60);
    // Rysowanie desek
    ctx.lineWidth = 1;
    for(let i=1; i<=4; i++) {
        ctx.beginPath(); ctx.moveTo(radius - 5 + i*11, -30); ctx.lineTo(radius - 5 + i*11, 30); ctx.stroke();
    }
    ctx.restore();

    // 5. WIEŻYCZKI NA MURZE
    let numTowers = 8;
    for (let i = 0; i < numTowers; i++) {
        let angle = (i / numTowers) * Math.PI * 2;
        
        // Pomiń wieżyczkę, jeśli wypadłaby na środku mostu!
        let angleDiff = Math.abs(angle - bridgeAngle);
        angleDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
        if (angleDiff < 0.4) continue; 

        let tx = Math.cos(angle) * radius;
        let ty = Math.sin(angle) * radius;

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(angle); 
        ctx.fillStyle = '#050505';
        ctx.fillRect(-12, -12, 24, 24);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-12, -12, 24, 24);
        ctx.restore();
    }

    // 6. LITERA (Tylko jeśli gracz nie jest w sklepie, żeby nie zasłaniać podłogi)
    if (!isPlayerHere && teamLetter && teamLetter !== '') {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${radius * 0.6}px 'Courier New', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(teamLetter, 0, 0); 
    }

    ctx.restore();
}

// =========================================================================
// GŁÓWNA PĘTLA RYSOWANIA CAŁEGO ŚWIATA (Poprawione Warstwy Z-Index)
// =========================================================================

function drawForestMap(ctx, camera, canvasWidth, canvasHeight) {
    ctx.fillStyle = activeTheme.bg;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    ctx.strokeStyle = activeTheme.border; 
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 4000, 4000); 
    ctx.lineWidth = 1; 
    ctx.strokeRect(-10, -10, 4020, 4020);

    // --- 1. DROGI (Na samym spodzie) ---
    ctx.fillStyle = activeTheme.road; 
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    for(let road of mapData.roads) {
        ctx.fillRect(road.x, road.y, road.width, road.height);
        
        ctx.setLineDash([15, 10]);
        ctx.strokeRect(road.x, road.y, road.width, road.height);
        ctx.setLineDash([]);
        
        if (typeof currentQuest !== 'undefined' && currentQuest > 10) {
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            for(let i = road.y + 100; i < road.y + road.height; i += 150) {
                ctx.beginPath(); 
                ctx.moveTo(road.x + 10, i); 
                ctx.lineTo(road.x + road.width - 10, i + Math.sin(i * 123 + road.x) * 20); 
                ctx.stroke();
            }
        }
    }

    // --- 2. DETALE (Trawa, Nagrobki) ---
    let visibleGrass = mapData.grass.filter(g => !(g.x + 10 < camera.x || g.x - 10 > camera.x + canvasWidth || g.y + 10 < camera.y || g.y - 10 > camera.y + canvasHeight));
    for(let g of visibleGrass) {
        if (g.type === 'grave') {
            drawGrave(ctx, g.x, g.y);
        } else if (g.type === 'sword') {
            drawSwordDetail(ctx, g.x, g.y);
        } else if (g.type === 'skull') {
            drawWastelandSkull(ctx, g.x, g.y);
        } else if (g.type === 'crown') {
            drawBrokenCrown(ctx, g.x, g.y);
        } else {
            drawNotebookGrass(ctx, g.x, g.y);
        }
    }

    // --- 3. KROPKI ATRAMENTU ---
    ctx.fillStyle = activeTheme.spotColor;
    let visibleSpots = mapData.spots.filter(s => !(s.x + s.radius < camera.x || s.x - s.radius > camera.x + canvasWidth || s.y + s.radius < camera.y || s.y - s.radius > camera.y + canvasHeight));
    for(let s of visibleSpots) {
        ctx.beginPath(); 
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2); 
        ctx.fill();
    }

    // --- 4. PUŁAPKI (Kałuże leżą na płasko na ziemi) ---
    let visiblePonds = mapData.ponds.filter(pond => {
        return !(pond.x + pond.radius * 2 < camera.x || pond.x - pond.radius * 2 > camera.x + canvasWidth ||
                 pond.y + pond.radius * 2 < camera.y || pond.y - pond.radius * 2 > camera.y + canvasHeight);
    });
    for(let pond of visiblePonds) {
        if (pond.type === 'crater') {
            drawDeepCrater(ctx, pond.x, pond.y, pond.radius);
        } else if (pond.type === 'spikes') {
            drawSpikesField(ctx, pond.x, pond.y, pond.radius);
        } else {
            drawNotebookPuddle(ctx, pond.x, pond.y, pond.radius, pond.numPoints, pond.randomOffsetLimit);
        }
    }

    // --- 5. BAZY I ZAMKI (Przykrywają drogi i kałuże!) ---
    for (let zone of safeZones) {
        if (zone.x + zone.radius < camera.x || zone.x - zone.radius > camera.x + canvasWidth || 
            zone.y + zone.radius < camera.y || zone.y - zone.radius > camera.y + canvasHeight) {
            continue;
        }
            
        if (zone.type === 'castle') {
            drawCastle(ctx, zone.x, zone.y, zone.radius, zone.team);
        } else {
            drawSafeZone(ctx, zone.x, zone.y, zone.radius);
        }
    }

    // --- 6. GŁAZY (Rzucają cień na wszystko poniżej) ---
    let visibleRocks = mapData.rocks.filter(r => !(r.x + r.radius < camera.x || r.x - r.radius > camera.x + canvasWidth || r.y + r.radius < camera.y || r.y - r.radius > camera.y + canvasHeight));
    visibleRocks.sort((a, b) => a.y - b.y); 
    for(let r of visibleRocks) {
        drawNotebookRock(ctx, r.x, r.y, r.radius);
    }

    // --- 7. PRZESZKODY (Drzewa/Kolumny na samym wierzchu) ---
    let visibleTrees = mapData.trees.filter(tree => {
        return !(tree.x + tree.radius * 2 < camera.x || tree.x - tree.radius * 2 > camera.x + canvasWidth ||
                 tree.y + tree.radius * 2 < camera.y || tree.y - tree.radius * 2 > camera.y + canvasHeight);
    });
    visibleTrees.sort((a, b) => a.y - b.y); 
    for(let tree of visibleTrees) {
        if (tree.type === 'dead_tree') {
            drawSpookyTree(ctx, tree.x, tree.y, tree.radius);
        } else if (tree.type === 'column') {
            drawBrokenColumn(ctx, tree.x, tree.y, tree.radius);
        } else {
            drawNotebookTree(ctx, tree.x, tree.y, tree.radius);
        }
    }

    // --- 8. PTAKI NA NIEBIE ---
    let now = Date.now();
    if (now - mapData.lastBirdSpawn > 30000) { 
        mapData.lastBirdSpawn = now;
        let flock = [];
        
        for(let i=0; i<7; i++) {
            flock.push({ offsetX: -Math.abs(i - 3) * 25, offsetY: (i - 3) * 25 }); 
        }
        
        mapData.birds.push({ x: -200, y: Math.random() * 3000 + 500, speed: 2 + Math.random(), flock: flock });
    }

    ctx.strokeStyle = activeTheme.border; 
    ctx.lineWidth = 2; 
    ctx.lineJoin = 'miter';
    for (let i = mapData.birds.length - 1; i >= 0; i--) {
        let b = mapData.birds[i];
        b.x += b.speed; 
        b.y -= b.speed * 0.3; 
        
        b.flock.forEach(f => {
            let bx = b.x + f.offsetX; 
            let by = b.y + f.offsetY;
            ctx.beginPath(); 
            ctx.moveTo(bx - 6, by - 6); 
            ctx.lineTo(bx, by); 
            ctx.lineTo(bx - 6, by + 6); 
            ctx.stroke();
        });
        
        if (b.x > 4500 || b.y < -200) {
            mapData.birds.splice(i, 1); 
        }
    }

    ctx.restore(); 

    // --- 9. EFEKTY POGODOWE (HUD) ---
    let eventName = typeof currentEvent !== 'undefined' ? currentEvent : null;
    
    if (eventName === 'TOXIC_RAIN') {
        ctx.fillStyle = 'rgba(46, 204, 113, 0.15)'; 
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        for(let i = 0; i < 150; i++) {
            let rx = (Math.sin(i * 123) * 10000 - now * 0.5) % canvasWidth;
            let ry = (Math.cos(i * 321) * 10000 + now * 1.5) % canvasHeight;
            
            if (rx < 0) rx += canvasWidth; 
            if (ry < 0) ry += canvasHeight;
            
            ctx.moveTo(rx, ry); 
            ctx.lineTo(rx - 8, ry + 25); 
        }
        ctx.stroke();

    } else if (eventName === 'BLIZZARD') {
        ctx.fillStyle = 'rgba(52, 152, 219, 0.2)'; 
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        
        for(let i = 0; i < 200; i++) {
            let sx = (Math.cos(i * 987) * 10000 + now * 2.0) % canvasWidth; 
            let sy = (Math.sin(i * 654) * 10000 + now * 0.3) % canvasHeight;
            
            if (sx < 0) sx += canvasWidth; 
            if (sy < 0) sy += canvasHeight;
            
            ctx.beginPath(); 
            ctx.arc(sx, sy, 1 + (i % 3), 0, Math.PI * 2); 
            ctx.fill();
        }
    }
}
// =========================================================================
// FUNKCJE SYSTEMOWE
// =========================================================================
window.wrapText = function(context, text, x, y, maxWidth, lineHeight) {
    if (!text) return;
    let words = text.split(' '); 
    let line = '';
    
    for(let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' '; 
        let metrics = context.measureText(testLine); 
        let testWidth = metrics.width;
        
        if (testWidth > maxWidth && n > 0) { 
            context.fillText(line, x, y); 
            line = words[n] + ' '; 
            y += lineHeight; 
        } else { 
            line = testLine; 
        }
    }
    context.fillText(line, x, y);
};

function resize() { 
    canvas.width = window.innerWidth; 
    canvas.height = window.innerHeight; 
    globalScale = Math.min(1, window.innerHeight / 900); 
}
window.onresize = resize; 
resize();