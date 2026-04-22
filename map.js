// ==========================================
// MAP.JS - MEGA UPDATE: VIBE NOIR & MOBA
// ==========================================

// --- SYSTEM MOTYWÓW WIZUALNYCH ---
const MAP_THEMES = {
    'FREE': { bg: '#050505', road: 'rgba(255, 255, 255, 0.05)', border: '#ffffff', spotColor: '#ffffff', glow: '#3498db' },
    'PvP': { bg: '#050505', road: 'rgba(52, 152, 219, 0.05)', border: '#3498db', spotColor: '#ffffff', glow: '#2980b9' },
    'TRAINING': { bg: '#050505', road: 'rgba(52, 152, 219, 0.05)', border: '#3498db', spotColor: '#ffffff', glow: '#2ecc71' },
    
    // AKT 1: Ruiny (Mroczny Las - Vibe Noir z neonowym zielonym zarysem)
    'campaign_1': { bg: '#050505', road: 'rgba(46, 204, 113, 0.05)', border: '#2ecc71', spotColor: '#ffffff', glow: '#27ae60' },
    
    // AKT 2: Dolina Cieni (Głęboki mrok z fioletowym neonem)
    'campaign_2': { bg: '#020205', road: 'rgba(155, 89, 182, 0.05)', border: '#9b59b6', spotColor: '#ffffff', glow: '#8e44ad' },
    
    // AKT 3: Pustkowia Królów (Czarna otchłań z krwistoczerwonymi akcentami)
    'campaign_3': { bg: '#0a0505', road: 'rgba(231, 76, 60, 0.05)', border: '#e74c3c', spotColor: '#ffffff', glow: '#c0392b' }
};

let activeTheme = MAP_THEMES['FREE'];

// Główne kontenery z danymi mapy
const safeZones = []; 
const mapData = { 
    trees: [], roads: [], ponds: [], spots: [], rocks: [], grass: [], 
    bushes: [], camps: [], fireflies: [], // NOWE
    birds: [], lastBirdSpawn: 0 
}; 

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
        mapData.bushes.length = 0;
        mapData.camps.length = 0;
        mapData.fireflies.length = 0;
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
    
    addCamp(x, y) { 
        mapData.camps.push({x: x, y: y, radius: 80}); 
    }

    populateWorld(config) {
        const checkCollision = (px, py, r) => {
            for(let road of mapData.roads) if (px > road.x - r - 10 && px < road.x + road.width + r + 10 && py > road.y - r - 10 && py < road.y + road.height + r + 10) return true;
            for(let zone of safeZones) if (Math.hypot(px - zone.x, py - zone.y) < r + zone.radius + 20) return true;
            for(let pond of mapData.ponds) if (Math.hypot(px - pond.x, py - pond.y) < r + pond.radius + 15) return true;
            for(let camp of mapData.camps) if (Math.hypot(px - camp.x, py - camp.y) < r + camp.radius + 10) return true;
            return false;
        };

        // 1. Detale (Trawa, Nagrobki, Czaszki)
        for(let i = 0; i < config.numGrass; i++) {
            let type = config.grassTypes[Math.floor(Math.random() * config.grassTypes.length)];
            mapData.grass.push({ 
                x: Math.random() * this.worldSize, 
                y: Math.random() * this.worldSize, 
                type: type 
            });
        }

        // 2. Kropki (Masa)
        for(let i = 0; i < config.numSpots; i++) {
            mapData.spots.push({ 
                x: Math.random() * this.worldSize, 
                y: Math.random() * this.worldSize, 
                radius: 3 + Math.random() * 5 
            });
        }

        // 3. Głazy w losowych skupiskach (Cluster generation)
        let totalRocks = config.numRocks || 20;
        for(let i = 0; i < totalRocks; i++) {
            let cx = Math.random() * this.worldSize;
            let cy = Math.random() * this.worldSize;
            let clusterSize = 3 + Math.floor(Math.random() * 5);
            for(let j = 0; j < clusterSize; j++) {
                mapData.rocks.push({ x: cx + (Math.random() * 200 - 100), y: cy + (Math.random() * 200 - 100), radius: 10 + Math.random() * 25 });
            }
        }

        // 4. Pułapki (Kałuże, Kratery, Kolce)
        for (let i = 0; i < config.numPonds; i++) {
            let r = 30 + Math.random() * 40, px, py;
            do { px = Math.random() * this.worldSize; py = Math.random() * this.worldSize; } while(checkCollision(px, py, r));
            mapData.ponds.push({ x: px, y: py, radius: r, numPoints: 12 + Math.floor(Math.random() * 8), randomOffsetLimit: 0.15 + Math.random() * 0.1, type: config.pondType });
        }

        // 5. Przeszkody (Drzewa, Kolumny)
        for (let i = 0; i < config.numTrees; i++) {
            let r = 25 + Math.random() * 20, tx, ty;
            do { tx = Math.random() * this.worldSize; ty = Math.random() * this.worldSize; } while(checkCollision(tx, ty, r));
            mapData.trees.push({ x: tx, y: ty, radius: r, type: config.treeType });
        }
        
        // 6. Krzaki (Bushes)
        if (typeof bushes !== 'undefined' && bushes.length > 0) {
            mapData.bushes = bushes; // Z serwera
        } else {
            let numBushes = config.numBushes || 40;
            for (let i = 0; i < numBushes; i++) {
                let r = 60 + Math.random() * 60, bx, by;
                do { bx = Math.random() * this.worldSize; by = Math.random() * this.worldSize; } while(checkCollision(bx, by, r));
                mapData.bushes.push({ x: bx, y: by, radius: r });
            }
        }

        // 7. Świetliki (Tylko w lasach)
        if (config.treeType === 'choinka') {
            for(let i=0; i<80; i++) {
                mapData.fireflies.push({ 
                    x: Math.random() * this.worldSize, y: Math.random() * this.worldSize, 
                    offset: Math.random() * Math.PI * 2, speed: 0.02 + Math.random() * 0.03, radius: 2 + Math.random() * 3 
                });
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
        
        let center = this.worldSize / 2;

        // JEDEN EPICKI ZAMEK NA ŚRODKU (Królewskie Wzgórze)
        this.addSafeZone(center, center, 350, 'epic_castle', ''); 
        
        // 4 Główne drogi przecinające las i kończące się na krawędzi fosy zamku
        this.addRoad(center - 100, 0, 200, center - 400); // Północ
        this.addRoad(center - 100, center + 400, 200, center - 400); // Południe
        this.addRoad(0, center - 100, center - 400, 200); // Zachód
        this.addRoad(center + 400, center - 100, center - 400, 200); // Wschód

        // Obozowiska w rogach
        this.addCamp(center - 800, center - 800); 
        this.addCamp(center + 800, center + 800);

        this.populateWorld({
            numGrass: 400, grassTypes: ['grass'],
            numSpots: 100, numRocks: 40,
            numPonds: 30, pondType: 'puddle',
            numTrees: 400, treeType: 'choinka',
            numBushes: 50
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
        this.addRoad(1880, 200, 240, 3600); 
        this.addRoad(500, 2000, 3000, 150); 
        this.addCamp(1000, 1000); this.addCamp(3000, 1000);

        this.populateWorld({
            numGrass: 600, grassTypes: ['grass'],
            numSpots: 150, numRocks: 30,
            numPonds: 20, pondType: 'puddle',
            numTrees: 450, treeType: 'choinka',
            numBushes: 50
        });
    }

    generateAct2() {
        this.addSafeZone(2000, 2000, 300, 'safezone'); 
        this.addRoad(0, 1880, 4000, 240);
        this.addRoad(1880, 0, 240, 4000);
        this.addRoad(800, 800, 2400, 150);
        this.addRoad(800, 3000, 2400, 150);

        this.populateWorld({
            numGrass: 300, grassTypes: ['grave', 'sword'],
            numSpots: 250, numRocks: 50,
            numPonds: 45, pondType: 'crater', 
            numTrees: 300, treeType: 'dead_tree',
            numBushes: 20
        });
    }

    generateAct3() {
        this.addSafeZone(2000, 3800, 150, 'safezone'); 
        this.addRoad(1800, 400, 400, 3400); 
        this.addRoad(1000, 400, 2000, 200); 

        this.populateWorld({
            numGrass: 100, grassTypes: ['skull', 'crown'],
            numSpots: 600, numRocks: 100,
            numPonds: 70, pondType: 'spikes', 
            numTrees: 400, treeType: 'column',
            numBushes: 10
        });
    }
}

// -------------------------------------------------------------------------
// KLASA: TEAMS (Potężna rozbudowa MOBA - E-sportowa Arena)
// -------------------------------------------------------------------------
class TeamsMap extends MapGenerator {
    generate(modeType) {
        this.clearData(); 
        activeTheme = MAP_THEMES[modeType] || MAP_THEMES['PvP'];
        
        let w = this.worldSize; 
        let c = w / 2;

        // --- 1. LINIE GŁÓWNE (LANES) ---
        this.addRoad(c - 250, 0, 500, w); // MID Pion
        this.addRoad(0, c - 250, w, 500); // MID Poziom
        this.addRoad(150, 150, w-300, 300); // TOP Line
        this.addRoad(150, w-450, w-300, 300); // BOT Line
        this.addRoad(150, 150, 300, w-300); // LEFT Line
        this.addRoad(w-450, 150, 300, w-300); // RIGHT Line

        // --- 2. ARENA CENTRALNA ---
        this.addRoad(c - 600, c - 600, 1200, 1200);
        for(let i = 0; i < 8; i++) {
            let angle = (i / 8) * Math.PI * 2 + (Math.PI/8);
            mapData.rocks.push({x: c + Math.cos(angle)*650, y: c + Math.sin(angle)*650, radius: 50 + Math.random()*20});
        }

        // --- 3. OBOZOWISKA (JUNGLE CAMPS) ---
        this.addCamp(c - 800, c - 800); 
        this.addCamp(c + 800, c + 800); 
        this.addCamp(c - 800, c + 800); 
        this.addCamp(c + 800, c - 800); 

        // --- 4. UFORYFIKOWANE BAZY ---
        let baseCoords = [{x: 1000, y: 1000}, {x: w-1000, y: 1000}, {x: 1000, y: w-1000}, {x: w-1000, y: w-1000}];
        baseCoords.forEach(base => {
            this.addRoad(base.x - 450, base.y - 450, 900, 900);
            for(let i = 0; i < 16; i++) {
                let angle = (i/16) * Math.PI * 2;
                let tx = base.x + Math.cos(angle) * 350;
                let ty = base.y + Math.sin(angle) * 350;
                if (i % 4 !== 0) mapData.trees.push({x: tx, y: ty, radius: 45 + Math.random()*10, type: 'column'});
            }
            mapData.rocks.push({x: base.x - 200, y: base.y - 200, radius: 45});
            mapData.rocks.push({x: base.x + 200, y: base.y + 200, radius: 45});
        });

        // --- 5. TWARDE PRZESZKODY W DŻUNGLI ---
        for(let i=0; i<15; i++) {
            let wx = 500 + Math.random() * (w - 1000), wy = 500 + Math.random() * (w - 1000);
            if(Math.hypot(wx - c, wy - c) > 700) {
                for(let k=0; k<3; k++) mapData.trees.push({x: wx + k*60, y: wy + k*20, radius: 35, type: 'column'});
            }
        }

        // --- 6. WYPEŁNIENIE ŚWIATA ---
        this.populateWorld({
            numGrass: 1500, grassTypes: ['grass', 'sword', 'skull', 'grave'], 
            numSpots: 400, numRocks: 250, numPonds: 50, pondType: 'crater', 
            numTrees: 1200, treeType: 'dead_tree', numBushes: 150 
        });
    }
}

// =========================================================================
// INICJALIZATOR
// =========================================================================
function initMap(worldSize, mapType = 'FREE') {
    if (mapType === 'FREE') {
        new FreeModeMap(worldSize).generate();
    } else if (mapType.startsWith('campaign_')) {
        new CampaignMap(worldSize).generate(mapType);
    } else if (mapType === 'PvP' || mapType === 'TRAINING') {
        new TeamsMap(worldSize).generate(mapType); 
    } else {
        new FreeModeMap(worldSize).generate(); 
    }
}

// =========================================================================
// FUNKCJE RYSOWANIA DETALI MAPY 
// =========================================================================

function drawCamp(ctx, camp) {
    ctx.save(); ctx.translate(camp.x, camp.y);
    ctx.fillStyle = 'rgba(20, 10, 5, 0.4)'; ctx.beginPath(); ctx.arc(0, 0, camp.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#2c3e50'; ctx.strokeStyle = activeTheme.border; ctx.lineWidth = 2;
    for(let i=0; i<3; i++) {
        ctx.save(); ctx.rotate(i * (Math.PI*2/3)); ctx.translate(0, -camp.radius * 0.6);
        ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(-20, 15); ctx.lineTo(20, 15); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
    }
    ctx.fillStyle = '#8B4513'; ctx.fillRect(-15, -5, 30, 10); ctx.fillRect(-5, -15, 10, 30); 
    let firePulse = (Math.sin(Date.now() / 150) + 1) / 2;
    window.MapOptimizer.applyGlow(ctx, 30 + firePulse * 20, '#e67e22');
    ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.moveTo(0, -25 - firePulse*10); ctx.lineTo(-15, 10); ctx.lineTo(15, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.moveTo(0, -15 - firePulse*5); ctx.lineTo(-8, 10); ctx.lineTo(8, 10); ctx.closePath(); ctx.fill();
    window.MapOptimizer.resetGlow(ctx);
    ctx.restore();
}

function drawBush(ctx, bush) {
    ctx.save(); ctx.translate(bush.x, bush.y);
    ctx.fillStyle = 'rgba(5, 20, 10, 0.8)';
    ctx.strokeStyle = activeTheme.border; ctx.lineWidth = 2;
    let windOffset = Math.sin(Date.now() / 1000 + bush.x) * 0.05;
    ctx.rotate(windOffset);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
        let angle = (i / 12) * Math.PI * 2; 
        let currentR = bush.radius * (0.8 + Math.sin(i * 3) * 0.2); 
        let px = Math.cos(angle) * currentR; let py = Math.sin(angle) * currentR;
        if (i === 0) ctx.moveTo(px, py); else ctx.quadraticCurveTo(0, 0, px, py); 
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
}

function drawNotebookGrass(ctx, x, y) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = activeTheme.border; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(-5, -8); ctx.moveTo(2, 6); ctx.lineTo(1, -12); ctx.moveTo(4, 5); ctx.lineTo(8, -6); ctx.stroke();
    ctx.restore();
}

function drawGrave(ctx, x, y) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = activeTheme.border; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = activeTheme.bg; ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(-6, -4); ctx.arc(0, -4, 6, Math.PI, 0); ctx.lineTo(6, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 2); ctx.moveTo(-3, -2); ctx.lineTo(3, -2); ctx.stroke(); ctx.restore();
}

function drawSwordDetail(ctx, x, y) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.3); ctx.strokeStyle = activeTheme.border; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -10); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(5, -6); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -11, 1.5, 0, Math.PI*2); ctx.stroke(); ctx.restore();
}

function drawWastelandSkull(ctx, x, y) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = activeTheme.border; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.arc(0, -2, 5, 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-3, 3); ctx.lineTo(-3, 6); ctx.lineTo(3, 6); ctx.lineTo(3, 3); ctx.stroke(); 
    ctx.fillStyle = activeTheme.bg; ctx.beginPath(); ctx.arc(-2, -2, 1.5, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(2, -2, 1.5, 0, Math.PI*2); ctx.fill(); ctx.restore();
}

function drawBrokenCrown(ctx, x, y) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = activeTheme.border; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-4, 4); ctx.lineTo(4, 4); ctx.lineTo(6, -4); ctx.lineTo(2, 0); ctx.lineTo(0, -6); ctx.lineTo(-2, 0); ctx.closePath(); ctx.stroke(); ctx.restore();
}

function drawNotebookRock(ctx, x, y, radius) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = activeTheme.bg; ctx.strokeStyle = activeTheme.border; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
        let angle = (i / 7) * Math.PI * 2; let offset = Math.sin(angle * 4 + x) * 0.25; let currentR = radius * (1 + offset);
        let px = Math.cos(angle) * currentR; let py = Math.sin(angle) * currentR;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-radius * 0.4, -radius * 0.2); ctx.lineTo(radius * 0.3, radius * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(radius * 0.1, -radius * 0.4); ctx.lineTo(0, radius * 0.5); ctx.stroke(); ctx.restore();
}

function drawNotebookPuddle(ctx, x, y, radius, numPoints, randomOffsetLimit) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < numPoints; i++) {
        let angle = (i / numPoints) * Math.PI * 2;
        let offset1 = Math.sin(angle * 3 + x) * randomOffsetLimit; let offset2 = Math.cos(angle * 4 + y) * (randomOffsetLimit * 0.7);
        let currentRadius = radius * (1 + offset1 + offset2);
        let px = Math.cos(angle) * currentRadius; let py = Math.sin(angle) * currentRadius;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    let drop1X = Math.cos(x) * (radius * 1.3); let drop1Y = Math.sin(y) * (radius * 1.3); ctx.arc(drop1X, drop1Y, radius * 0.15, 0, Math.PI * 2);
    let drop2X = Math.cos(y) * (radius * 1.5); let drop2Y = Math.sin(x) * (radius * 1.5); ctx.arc(drop2X, drop2Y, radius * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawDeepCrater(ctx, x, y, radius) {
    ctx.save(); ctx.translate(x, y); 
    let pulse = (Math.sin(Date.now()/500 + x) + 1) / 2;
    window.MapOptimizer.applyGlow(ctx, 20 * pulse, activeTheme.glow);
    
    ctx.fillStyle = '#0a0a0a'; ctx.strokeStyle = activeTheme.glow; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    for(let i=0; i<12; i++) { let a = (i/12) * Math.PI * 2; let r = radius + Math.sin(a * 5 + x) * 10; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    window.MapOptimizer.resetGlow(ctx);

    ctx.lineWidth = 2; ctx.strokeStyle = '#333';
    for(let i=0; i<4; i++) { let a = (i/4) * Math.PI * 2 + (x % 2); ctx.beginPath(); ctx.moveTo(Math.cos(a)*(radius-5), Math.sin(a)*(radius-5)); ctx.lineTo(Math.cos(a)*(radius+20), Math.sin(a)*(radius+20)); ctx.stroke(); }
    
    ctx.fillStyle = `rgba(46, 204, 113, ${0.2 + pulse * 0.3})`; ctx.beginPath();
    for(let i=0; i<10; i++) { let a = (i/10) * Math.PI * 2 + (Date.now()/2000); let r = radius * 0.6 + Math.cos(a * 7 + y) * 8; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.restore();
}

function drawSpikesField(ctx, x, y, radius) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = activeTheme.border; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    let numSpikes = 5 + Math.floor(Math.abs(x + y) % 3);
    for(let i=0; i<numSpikes; i++) {
        let a = (i/numSpikes) * Math.PI * 2 + (x % 1); let dist = radius * 0.5;
        ctx.save(); ctx.translate(Math.cos(a)*dist, Math.sin(a)*dist); ctx.rotate(a + Math.PI/2); 
        ctx.fillStyle = '#111111'; ctx.beginPath(); ctx.moveTo(-8, 10); ctx.lineTo(0, -25); ctx.lineTo(8, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.moveTo(0, -25); ctx.lineTo(8, 10); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.restore();
}

function drawNotebookTree(ctx, x, y, radius) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = activeTheme.bg; ctx.strokeStyle = activeTheme.border; ctx.lineJoin = 'miter'; ctx.lineWidth = 2;
    ctx.fillRect(-radius * 0.15, 0, radius * 0.3, radius * 0.8); ctx.strokeRect(-radius * 0.15, 0, radius * 0.3, radius * 0.8);
    ctx.beginPath(); ctx.moveTo(0, -radius * 0.1); ctx.lineTo(radius * 0.9, radius * 0.5); ctx.lineTo(-radius * 0.9, radius * 0.5);
    ctx.moveTo(0, -radius * 0.6); ctx.lineTo(radius * 0.7, 0); ctx.lineTo(-radius * 0.7, 0);
    ctx.moveTo(0, -radius * 1.2); ctx.lineTo(radius * 0.5, -radius * 0.4); ctx.lineTo(-radius * 0.5, -radius * 0.4);
    ctx.fill(); ctx.stroke(); ctx.restore();
}

function drawSpookyTree(ctx, x, y, radius) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = activeTheme.border; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(0, radius); ctx.lineTo(0, -radius * 0.3); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-radius * 0.6, -radius * 0.5); ctx.lineTo(-radius * 0.9, -radius * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -radius * 0.1); ctx.lineTo(radius * 0.5, -radius * 0.6); ctx.lineTo(radius * 0.8, -radius * 0.2); ctx.stroke();
    ctx.fillStyle = activeTheme.bg; ctx.beginPath(); ctx.ellipse(0, radius * 0.4, radius * 0.15, radius * 0.3, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore();
}

function drawBrokenColumn(ctx, x, y, radius) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = activeTheme.bg; ctx.strokeStyle = activeTheme.border; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.ellipse(0, radius*0.8, radius, radius*0.3, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-radius*0.8, radius*0.8); ctx.lineTo(-radius*0.8, -radius*0.5); ctx.lineTo(-radius*0.3, -radius*0.9); ctx.lineTo(0, -radius*0.4); ctx.lineTo(radius*0.5, -radius*0.8); ctx.lineTo(radius*0.8, radius*0.8); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-radius*0.4, radius*0.8); ctx.lineTo(-radius*0.4, -radius*0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, radius*0.8); ctx.lineTo(0, -radius*0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(radius*0.4, radius*0.8); ctx.lineTo(radius*0.4, -radius*0.7); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-radius*0.2, 0); ctx.lineTo(radius*0.2, radius*0.3); ctx.lineTo(radius*0.1, radius*0.6); ctx.stroke(); ctx.restore();
}

// =========================================================================
// 🏰 MONUMENTALNA TWIERDZA
// =========================================================================

function drawEpicCastle(ctx, x, y, radius) {
    ctx.save();
    ctx.translate(x, y);

    let abyssRadius = radius + 60;
    ctx.fillStyle = '#010102'; 
    ctx.beginPath();
    for (let i = 0; i < 48; i++) {
        let angle = (i / 48) * Math.PI * 2;
        let offset = (i % 2 === 0) ? 15 : -15; 
        let px = Math.cos(angle) * (abyssRadius + offset);
        let py = Math.sin(angle) * (abyssRadius + offset);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    window.MapOptimizer.applyGlow(ctx, 20, activeTheme.border);
    ctx.strokeStyle = activeTheme.border;
    ctx.lineWidth = 2;
    ctx.stroke();
    window.MapOptimizer.resetGlow(ctx);

    ctx.fillStyle = '#050505';
    ctx.beginPath();
    for(let i=0; i<8; i++) {
        let angle = (i / 8) * Math.PI * 2 + (Math.PI/8); 
        let px = Math.cos(angle) * radius;
        let py = Math.sin(angle) * radius;
        if(i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.stroke();

    let innerRadius = radius - 40;
    ctx.beginPath();
    for(let i=0; i<8; i++) {
        let angle = (i / 8) * Math.PI * 2 + (Math.PI/8);
        let px = Math.cos(angle) * innerRadius;
        let py = Math.sin(angle) * innerRadius;
        if(i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineWidth = 1;
    for(let i=0; i<8; i++) {
        let angle = (i / 8) * Math.PI * 2 + (Math.PI/8);
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        ctx.lineTo(Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
        ctx.stroke();
    }

    ctx.fillStyle = '#050505';
    ctx.strokeStyle = activeTheme.border;
    let bridgeAngles = [0, Math.PI/2, Math.PI, Math.PI*1.5]; 
    
    for(let angle of bridgeAngles) {
        ctx.save();
        ctx.rotate(angle);
        ctx.lineWidth = 3;
        ctx.fillRect(innerRadius, -40, abyssRadius - innerRadius + 20, 80);
        ctx.strokeRect(innerRadius, -40, abyssRadius - innerRadius + 20, 80);
        
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        for(let i=1; i<=4; i++) {
            ctx.beginPath();
            ctx.moveTo(innerRadius + i*20, -40);
            ctx.lineTo(innerRadius + i*20, 40);
            ctx.stroke();
        }
        ctx.restore();
    }

    ctx.fillStyle = '#080808';
    ctx.fillRect(-120, -innerRadius + 10, 240, 100);
    ctx.strokeStyle = activeTheme.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(-120, -innerRadius + 10, 240, 100);
    
    ctx.beginPath(); ctx.moveTo(-120, -innerRadius + 10); ctx.lineTo(0, -innerRadius + 60); ctx.lineTo(120, -innerRadius + 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -innerRadius + 10); ctx.lineTo(0, -innerRadius + 60); ctx.stroke();

    window.MapOptimizer.applyGlow(ctx, 10, '#e74c3c');
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-40, -innerRadius + 75, 20, 20);
    ctx.fillRect(20, -innerRadius + 75, 20, 20);
    window.MapOptimizer.resetGlow(ctx);

    drawSpookyTree(ctx, -140, -80, 25);
    drawSpookyTree(ctx, 140, -80, 25);

    let isPlayerHere = typeof player !== 'undefined' && player && Math.hypot(player.x - x, player.y - y) < 80;
    
    if (isPlayerHere) {
        window.MapOptimizer.applyGlow(ctx, 25, '#f1c40f');
    }
    
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.fillStyle = isPlayerHere ? 'rgba(241, 196, 15, 0.2)' : 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = isPlayerHere ? '#f1c40f' : 'rgba(255, 255, 255, 0.5)';
    ctx.setLineDash([10, 10]);
    ctx.stroke();
    ctx.setLineDash([]);
    window.MapOptimizer.resetGlow(ctx);
    
    ctx.fillStyle = isPlayerHere ? '#f1c40f' : '#555555';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("👑", 0, 0);

    ctx.restore();
}

function drawSafeZone(ctx, x, y, radius) {
    ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.clip(); 
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'; ctx.fillRect(-radius, -radius, radius * 2, radius * 2); ctx.restore(); 
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.lineWidth = 4; ctx.setLineDash([20, 15]); 
    window.MapOptimizer.applyGlow(ctx, 10, '#ffffff');
    ctx.beginPath();
    for (let i = 0; i < 32; i++) {
        let angle = (i / 32) * Math.PI * 2; let offset = Math.sin(angle * 6 + x) * 3; let px = Math.cos(angle) * (radius + offset); let py = Math.sin(angle) * (radius + offset);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.stroke(); ctx.setLineDash([]); window.MapOptimizer.resetGlow(ctx);
    ctx.fillStyle = '#ffffff'; ctx.font = "bold 16px 'Courier New', monospace"; ctx.textAlign = 'center'; ctx.fillText("BEZPIECZNA STREFA", 0, radius - 20); ctx.restore();
}

function drawCastle(ctx, x, y, radius, teamLetter = 'B') {
    ctx.save(); ctx.translate(x, y);
    let bridgeAngle = Math.atan2(2000 - y, 2000 - x); let moatRadius = radius + 40;

    ctx.fillStyle = '#020202'; ctx.beginPath();
    for (let i = 0; i < 32; i++) {
        let angle = (i / 32) * Math.PI * 2; let offset = Math.sin(angle * 8 + x) * 8; let px = Math.cos(angle) * (moatRadius + offset); let py = Math.sin(angle) * (moatRadius + offset);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();

    let isPlayerHere = typeof player !== 'undefined' && player && Math.hypot(player.x - x, player.y - y) < radius;
    ctx.beginPath(); ctx.arc(0, 0, radius + 15, 0, Math.PI * 2);
    
    if (isPlayerHere) {
        ctx.save(); ctx.clip(); ctx.fillStyle = '#050505'; ctx.fillRect(-radius-15, -radius-15, (radius+15)*2, (radius+15)*2); ctx.fillStyle = '#111111';
        let tileSize = 30;
        for(let tx = -radius-15; tx < radius+15; tx+=tileSize) {
            for(let ty = -radius-15; ty < radius+15; ty+=tileSize) { if (Math.abs((tx/tileSize) % 2) === Math.abs((ty/tileSize) % 2)) ctx.fillRect(tx, ty, tileSize, tileSize); }
        }
        ctx.fillStyle = '#333333'; ctx.fillRect(-30, -30, 60, 80); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(-30, -30, 60, 80);
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-50, -60, 100, 30); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.strokeRect(-50, -60, 100, 30); ctx.restore();
    } else {
        ctx.fillStyle = activeTheme.bg; ctx.fill();
    }

    ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff';
    window.MapOptimizer.applyGlow(ctx, 15, '#ffffff');
    ctx.beginPath(); ctx.arc(0, 0, radius, bridgeAngle + 0.35, bridgeAngle - 0.35 + Math.PI * 2); ctx.stroke(); window.MapOptimizer.resetGlow(ctx);

    ctx.save(); ctx.rotate(bridgeAngle); ctx.fillStyle = '#050505'; ctx.fillRect(radius - 5, -30, 55, 60); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(radius - 5, -30, 55, 60);
    ctx.lineWidth = 1; for(let i=1; i<=4; i++) { ctx.beginPath(); ctx.moveTo(radius - 5 + i*11, -30); ctx.lineTo(radius - 5 + i*11, 30); ctx.stroke(); } ctx.restore();

    let numTowers = 8;
    for (let i = 0; i < numTowers; i++) {
        let angle = (i / numTowers) * Math.PI * 2; let angleDiff = Math.abs(angle - bridgeAngle); angleDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);
        if (angleDiff < 0.4) continue; 
        let tx = Math.cos(angle) * radius; let ty = Math.sin(angle) * radius;
        ctx.save(); ctx.translate(tx, ty); ctx.rotate(angle); ctx.fillStyle = '#050505'; ctx.fillRect(-12, -12, 24, 24); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeRect(-12, -12, 24, 24); ctx.restore();
    }

    if (!isPlayerHere && teamLetter && teamLetter !== '') {
        ctx.fillStyle = '#ffffff'; ctx.font = `bold ${radius * 0.6}px 'Courier New', monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(teamLetter, 0, 0); 
    }
    ctx.restore();
}

// =========================================================================
// GŁÓWNA PĘTLA RYSOWANIA CAŁEGO ŚWIATA (WSZYSTKO W JEDNYM MIEJSCU!)
// =========================================================================

function drawForestMap(ctx, camera, canvasWidth, canvasHeight) {
    ctx.fillStyle = activeTheme.bg;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    ctx.strokeStyle = activeTheme.border; 
    ctx.lineWidth = 4;
    let wSize = typeof WORLD_SIZE !== 'undefined' ? WORLD_SIZE : 4000;
    ctx.strokeRect(0, 0, wSize, wSize); 
    ctx.lineWidth = 1; 
    ctx.strokeRect(-10, -10, wSize + 20, wSize + 20);

    // --- 1. DROGI ---
    ctx.fillStyle = activeTheme.road; 
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    for(let i = 0; i < mapData.roads.length; i++) {
        let road = mapData.roads[i];
        if (!window.MapOptimizer.isVisible(road.x + road.width/2, road.y + road.height/2, Math.max(road.width, road.height)/2, camera, canvasWidth, canvasHeight)) continue;
        ctx.fillRect(road.x, road.y, road.width, road.height);
        ctx.setLineDash([15, 10]);
        ctx.strokeRect(road.x, road.y, road.width, road.height);
        ctx.setLineDash([]);
        
        if (typeof currentQuest !== 'undefined' && currentQuest > 10) {
            ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            for(let j = road.y + 100; j < road.y + road.height; j += 150) { 
                ctx.beginPath(); ctx.moveTo(road.x + 10, j); ctx.lineTo(road.x + road.width - 10, j + Math.sin(j * 123 + road.x) * 20); ctx.stroke(); 
            }
        }
    }

    // --- 2. DETALE (Trawa, Nagrobki) ---
    for(let i = 0; i < mapData.grass.length; i++) {
        let g = mapData.grass[i];
        if (!window.MapOptimizer.isVisible(g.x, g.y, 10, camera, canvasWidth, canvasHeight)) continue;
        if (g.type === 'grave') drawGrave(ctx, g.x, g.y);
        else if (g.type === 'sword') drawSwordDetail(ctx, g.x, g.y);
        else if (g.type === 'skull') drawWastelandSkull(ctx, g.x, g.y);
        else if (g.type === 'crown') drawBrokenCrown(ctx, g.x, g.y);
        else drawNotebookGrass(ctx, g.x, g.y);
    }

    // --- 3. KROPKI ATRAMENTU ---
    ctx.fillStyle = activeTheme.spotColor;
    for(let i = 0; i < mapData.spots.length; i++) {
        let s = mapData.spots[i];
        if (!window.MapOptimizer.isVisible(s.x, s.y, s.radius, camera, canvasWidth, canvasHeight)) continue;
        window.MapOptimizer.applyGlow(ctx, 10, activeTheme.spotColor);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2); ctx.fill(); 
        window.MapOptimizer.resetGlow(ctx);
    }

    // --- 4. PUŁAPKI & OBOZOWISKA ---
    for(let i = 0; i < mapData.ponds.length; i++) {
        let pond = mapData.ponds[i];
        if (!window.MapOptimizer.isVisible(pond.x, pond.y, pond.radius, camera, canvasWidth, canvasHeight)) continue;
        if (pond.type === 'crater') drawDeepCrater(ctx, pond.x, pond.y, pond.radius);
        else if (pond.type === 'spikes') drawSpikesField(ctx, pond.x, pond.y, pond.radius);
        else drawNotebookPuddle(ctx, pond.x, pond.y, pond.radius, pond.numPoints, pond.randomOffsetLimit);
    }

    for(let i = 0; i < mapData.camps.length; i++) {
        let camp = mapData.camps[i];
        if (window.MapOptimizer.isVisible(camp.x, camp.y, camp.radius, camera, canvasWidth, canvasHeight)) drawCamp(ctx, camp);
    }

    // --- 5. BAZY I ZAMKI ---
    for (let i = 0; i < safeZones.length; i++) {
        let zone = safeZones[i];
        if (!window.MapOptimizer.isVisible(zone.x, zone.y, zone.radius, camera, canvasWidth, canvasHeight)) continue;
        if (zone.type === 'epic_castle') drawEpicCastle(ctx, zone.x, zone.y, zone.radius);
        else if (zone.type === 'castle') drawCastle(ctx, zone.x, zone.y, zone.radius, zone.team);
        else drawSafeZone(ctx, zone.x, zone.y, zone.radius);
    }

    // --- 6. GŁAZY & PRZESZKODY (Z-Sorting) ---
    let visibleObstacles = [];
    for(let i = 0; i < mapData.rocks.length; i++) {
        let r = mapData.rocks[i];
        if (window.MapOptimizer.isVisible(r.x, r.y, r.radius, camera, canvasWidth, canvasHeight)) visibleObstacles.push(r);
    }
    for(let i = 0; i < mapData.trees.length; i++) {
        let tree = mapData.trees[i];
        if (window.MapOptimizer.isVisible(tree.x, tree.y, tree.radius, camera, canvasWidth, canvasHeight)) visibleObstacles.push(tree);
    }

    visibleObstacles.sort((a, b) => a.y - b.y); 
    
    for(let i = 0; i < visibleObstacles.length; i++) {
        let o = visibleObstacles[i];
        if (o.type) { 
            if (o.type === 'dead_tree') drawSpookyTree(ctx, o.x, o.y, o.radius);
            else if (o.type === 'column') drawBrokenColumn(ctx, o.x, o.y, o.radius);
            else drawNotebookTree(ctx, o.x, o.y, o.radius);
        } else {
            drawNotebookRock(ctx, o.x, o.y, o.radius);
        }
    }

    // --- 7. KRZAKI (Mechanika Ukrycia) ---
    let playerInBush = false;
    for(let i = 0; i < mapData.bushes.length; i++) {
        let bush = mapData.bushes[i];
        if (window.MapOptimizer.isVisible(bush.x, bush.y, bush.radius, camera, canvasWidth, canvasHeight)) {
            drawBush(ctx, bush);
            if (typeof player !== 'undefined' && player && Math.hypot(player.x - bush.x, player.y - bush.y) < bush.radius) {
                playerInBush = true;
            }
        }
    }
    if (playerInBush) document.body.classList.add('hidden-in-bush');
    else document.body.classList.remove('hidden-in-bush');

    // --- 8. PTAKI & ŚWIETLIKI NA NIEBIE ---
    let now = Date.now();
    if (now - mapData.lastBirdSpawn > 30000) { 
        mapData.lastBirdSpawn = now; let flock = [];
        for(let i=0; i<7; i++) flock.push({ offsetX: -Math.abs(i - 3) * 25, offsetY: (i - 3) * 25 }); 
        mapData.birds.push({ x: -200, y: Math.random() * 3000 + 500, speed: 2 + Math.random(), flock: flock });
    }

    ctx.strokeStyle = activeTheme.border; ctx.lineWidth = 2; ctx.lineJoin = 'miter';
    for (let i = mapData.birds.length - 1; i >= 0; i--) {
        let b = mapData.birds[i]; b.x += b.speed; b.y -= b.speed * 0.3; 
        b.flock.forEach(f => {
            let bx = b.x + f.offsetX; let by = b.y + f.offsetY;
            ctx.beginPath(); ctx.moveTo(bx - 6, by - 6); ctx.lineTo(bx, by); ctx.lineTo(bx - 6, by + 6); ctx.stroke();
        });
        if (b.x > wSize + 500 || b.y < -200) mapData.birds.splice(i, 1); 
    }

    ctx.fillStyle = activeTheme.glow;
    window.MapOptimizer.applyGlow(ctx, 10, activeTheme.glow);
    for (let i = 0; i < mapData.fireflies.length; i++) {
        let f = mapData.fireflies[i];
        f.x += Math.sin(now * f.speed + f.offset) * 2;
        f.y -= 0.5; 
        if (f.y < 0) f.y = wSize;
        if (window.MapOptimizer.isVisible(f.x, f.y, f.radius, camera, canvasWidth, canvasHeight)) {
            ctx.globalAlpha = Math.abs(Math.sin(now * f.speed));
            ctx.beginPath(); ctx.arc(f.x, f.y, f.radius, 0, Math.PI*2); ctx.fill();
        }
    }
    ctx.globalAlpha = 1.0;
    window.MapOptimizer.resetGlow(ctx);

    ctx.restore(); 

    // --- 9. EFEKTY POGODOWE (HUD) ---
    let eventName = typeof currentEvent !== 'undefined' ? currentEvent : null;
    if (eventName === 'TOXIC_RAIN') {
        ctx.fillStyle = 'rgba(46, 204, 113, 0.15)'; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for(let i = 0; i < 150; i++) {
            let rx = (Math.sin(i * 123) * 10000 - now * 0.5) % canvasWidth; let ry = (Math.cos(i * 321) * 10000 + now * 1.5) % canvasHeight;
            if (rx < 0) rx += canvasWidth; if (ry < 0) ry += canvasHeight;
            ctx.moveTo(rx, ry); ctx.lineTo(rx - 8, ry + 25); 
        }
        ctx.stroke();
    } else if (eventName === 'BLIZZARD') {
        ctx.fillStyle = 'rgba(52, 152, 219, 0.2)'; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        for(let i = 0; i < 200; i++) {
            let sx = (Math.cos(i * 987) * 10000 + now * 2.0) % canvasWidth; let sy = (Math.sin(i * 654) * 10000 + now * 0.3) % canvasHeight;
            if (sx < 0) sx += canvasWidth; if (sy < 0) sy += canvasHeight;
            ctx.beginPath(); ctx.arc(sx, sy, 1 + (i % 3), 0, Math.PI * 2); ctx.fill();
        }
    }

    window.MapOptimizer.cleanUpMemory();
}

// =========================================================================
// FUNKCJE SYSTEMOWE
// =========================================================================
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