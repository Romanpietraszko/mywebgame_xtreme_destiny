// ==========================================
// SERVER.JS - Backend i Symulacja Świata (Zoptymalizowany V3 - PRO)
// ==========================================

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
app.use(express.static(__dirname));

// ==========================================
// INTEGRACJA LOKALNEGO AI (QWEN)
// ==========================================
async function getAIWellbeingMessage(mass) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        const response = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen2.5:3b',
                prompt: `Jesteś empatycznym asystentem w grze akcji. Gracz właśnie zginął i zdobył ${mass} punktów. Napisz jedno krótkie, pocieszające zdanie promujące zdrowie psychiczne, odpoczynek lub relaks przed kolejną próbą. Nie witaj się. Zwróć tylko samo zdanie.`,
                stream: false
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const data = await response.json();
        return data.response.trim();
    } catch (error) {
        const fallbacks = [
            `Koniec misji z wynikiem ${mass}. Zrób sobie przerwę na łyk wody i przewietrz głowę.`,
            `Niestety, zostałeś pożarty. Masa: ${mass}. Pamiętaj, gra to nie życie. Wróć, jak odpoczniesz.`,
            `Wynik: ${mass}. Odetchnij głęboko, oderwij wzrok od ekranu na 10 sekund i spróbuj ponownie.`
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
}

// --- KONFIGURACJA ŚWIATA ---
const WORLD_SIZE = 4000;
const MAX_FOODS = 200;
const MAX_BOTS = 80; 
const MAX_LOOTS = 15; 

// OPTYMALIZACJA V1: Przejście na słowniki dla szybkiego usunięcia z pamięci
const players = {};
let foods = {};
let bots = {};
let loots = {}; 
let projectiles = {}; 
let entityIdCounter = 0;
let botNameCounter = 0;

// --- ŚRODOWISKO I TRUDNOŚĆ BOTÓW ---
let bushes = [];
let meteorZones = [];
let botDifficultyMultiplier = 1.0; 

for (let i = 0; i < 35; i++) {
    bushes.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        radius: 60 + Math.random() * 60
    });
}

// --- ZMIENNE EVENTOWE I DRUŻYNOWE ---
let activeEvent = null; 
let eventTimer = 0;      
let eventTickCounter = 0; 
let currentKingId = null; 

const TEAM_COLORS = { 'N': '#3498db', 'S': '#e74c3c', 'E': '#f1c40f', 'W': '#2ecc71' };

let castles = [
    { id: 'N', team: 'N', x: 2000, y: 300, radius: 250, color: TEAM_COLORS['N'], captureProgress: 0, owner: 'N' },
    { id: 'S', team: 'S', x: 2000, y: 3700, radius: 250, color: TEAM_COLORS['S'], captureProgress: 0, owner: 'S' },
    { id: 'E', team: 'E', x: 3700, y: 2000, radius: 250, color: TEAM_COLORS['E'], captureProgress: 0, owner: 'E' },
    { id: 'W', team: 'W', x: 300, y: 2000, radius: 250, color: TEAM_COLORS['W'], captureProgress: 0, owner: 'W' }
];

const weaponStats = {
    'sword': { dmg: 5, life: 60, speed: 18, cost: 2, piercing: false },
    'bow': { dmg: 8, life: 90, speed: 26, cost: 2, piercing: false },
    'golden_bow': { dmg: 16, life: 100, speed: 30, cost: 5, piercing: false },
    'diamond_bow': { dmg: 30, life: 120, speed: 35, cost: 10, piercing: true },
    'crossbow': { dmg: 50, life: 140, speed: 45, cost: 20, piercing: true },
    'shotgun': { dmg: 100, life: 40, speed: 50, cost: 50, piercing: true },
    'knife': { dmg: 12, life: 30, speed: 22, cost: 2, piercing: false },
    'golden_knife': { dmg: 24, life: 35, speed: 25, cost: 5, piercing: false },
    'diamond_knife': { dmg: 45, life: 40, speed: 28, cost: 10, piercing: true },
    'hunting_knife': { dmg: 80, life: 45, speed: 32, cost: 20, piercing: true },
    'cleaver': { dmg: 150, life: 50, speed: 35, cost: 40, piercing: true },
    'shuriken': { dmg: 4, life: 45, speed: 20, cost: 2, piercing: false },
    'golden_shuriken': { dmg: 10, life: 55, speed: 24, cost: 4, piercing: false },
    'diamond_shuriken': { dmg: 20, life: 65, speed: 28, cost: 8, piercing: true },
    'chakram': { dmg: 40, life: 75, speed: 32, cost: 15, piercing: true },
    'explosive_kunai': { dmg: 75, life: 85, speed: 38, cost: 30, piercing: true }
};

async function killPlayer(pId) {
    const p = players[pId];
    if (p) {
        if (pId === currentKingId) {
            io.emit('killEvent', { text: `☠️ Król ${p.name} obalony!`, time: 200 });
            currentKingId = null; 
            activeEvent = null;   
        }

        console.log(`[ŚMIERĆ] Gracz ${p.name} zginął! Odpytuję AI...`);
        const finalMass = Math.floor(p.score || 0);
        p.isSafe = true; 
        const deathMessage = await getAIWellbeingMessage(finalMass);
        io.to(p.id).emit('gameOver', { finalScore: finalMass, message: deathMessage });
        console.log(`[GAME OVER] Wysłałem wiadomość: "${deathMessage}"`);
        delete players[pId];
    }
}

function spawnFood() {
    let id = ++entityIdCounter;
    foods[id] = { id: id, x: Math.random() * WORLD_SIZE, y: Math.random() * WORLD_SIZE };
}

function spawnLoot() {
    let id = ++entityIdCounter;
    const types = ['mass', 'skill', 'weapon'];
    loots[id] = {
        id: id,
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        type: types[Math.floor(Math.random() * types.length)]
    };
}

function spawnBot() {
    botNameCounter++;
    let botScore = 1 + Math.random() * 10;
    let botName = `Bot AI #${botNameCounter}`;
    let botColor = `hsl(${Math.random() * 360}, 70%, 50%)`;
    
    const randBoss = Math.random();
    if (randBoss < 0.01) { 
        botScore = 150 + Math.random() * 50; 
        botName = `Czarny Tytan AI`;
        botColor = '#111'; 
    } else if (randBoss < 0.05) { 
        botScore = 50 + Math.random() * 30;
        botName = `Wędrowny Rycerz AI`;
        botColor = '#34495e'; 
    }

    let id = `bot_${++entityIdCounter}`;
    bots[id] = {
        id: id,
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        score: botScore, color: botColor, name: botName,
        angle: Math.random() * Math.PI * 2, speed: 2.5,
        ownerId: null, team: null, angleOffset: 0, distOffset: 0,  
        targetX: 0, targetY: 0,
        inventory: { bow: 0, knife: 0, shuriken: 0 }, activeWeapon: 'sword',
        lastShootTime: 0
    };
}

for (let i = 0; i < MAX_FOODS; i++) spawnFood();
for (let i = 0; i < MAX_BOTS; i++) spawnBot();
for (let i = 0; i < MAX_LOOTS; i++) spawnLoot();

io.on('connection', (socket) => {
    console.log(`\n===========================================`);
    console.log(`[SOCKET INFO] Nowe połączenie. ID: ${socket.id}`);
    console.log(`===========================================\n`);

    socket.on('joinGame', (data) => {
        const skinType = data.skin || 'standard';
        let baseSpeed = skinType === 'ninja' ? 5.5 : (skinType === 'arystokrata' ? 4.8 : 5);
        let massGainMult = skinType === 'arystokrata' ? 1.15 : 1.0; 
        
        players[socket.id] = {
            id: socket.id, x: 2000, y: 2000, score: 0, baseSpeed: baseSpeed, massMultiplier: massGainMult, 
            level: 1, skillPoints: 0, skills: { speed: 0, strength: 0, weapon: 0 },
            paths: { speed: 'none', strength: 'none', weapon: 'none' }, 
            lastWinterUse: 0, lastDashUse: 0, isMoving: false, idleTime: 0,     
            color: data.color || '#000', name: data.name || 'Gracz', skin: skinType, 
            isSafe: false, isShielding: false, armorHits: 0,
            inventory: { bow: 0, knife: 0, shuriken: 0 }, activeWeapon: 'sword',
            isRecruiting: false, formation: 0, moveAngle: 0, team: null,
            isTutorialActive: true, tutorialFlags: { m15: false, m50: false, m100: false }, tutorialText: ""
        };
        // Wysyłamy statyczne dane tylko raz (razem z krzakami)
        socket.emit('init', { id: socket.id, castles: castles, bushes: bushes });

        console.log(`[NOWY GRACZ FREE] >> ${players[socket.id].name} << wszedł jako ${skinType.toUpperCase()}!`);
        let msg = getTutorialMessage(data.name, `join_${skinType}`);
        players[socket.id].tutorialText = msg;
        io.to(socket.id).emit('tutorialTick', { text: msg });
    });

    socket.on('joinTeamGame', (data) => {
        const skinType = data.skin || 'standard';
        let baseSpeed = skinType === 'ninja' ? 5.5 : (skinType === 'arystokrata' ? 4.8 : 5);
        let massGainMult = skinType === 'arystokrata' ? 1.15 : 1.0; 

        const teams = ['N', 'S', 'E', 'W'];
        let teamCounts = { N: 0, S: 0, E: 0, W: 0 };
        Object.values(players).forEach(p => { if (p.team) teamCounts[p.team]++; });
        let chosenTeam = teams.reduce((a, b) => teamCounts[a] <= teamCounts[b] ? a : b);

        players[socket.id] = {
            id: socket.id, x: 2000, y: 2000, score: 0, level: 1, skillPoints: 0,
            baseSpeed: baseSpeed, massMultiplier: massGainMult, 
            skills: { speed: 0, strength: 0, weapon: 0 }, paths: { speed: 'none', strength: 'none', weapon: 'none' }, 
            lastWinterUse: 0, lastDashUse: 0, isMoving: false, idleTime: 0,   
            color: TEAM_COLORS[chosenTeam], name: data.name || 'Żołnierz', skin: skinType, 
            isSafe: false, isShielding: false, armorHits: 0,
            inventory: { bow: 0, knife: 0, shuriken: 0 }, activeWeapon: 'sword',
            isRecruiting: false, formation: 0, moveAngle: 0,
            team: chosenTeam, gameMode: data.mode, isTutorialActive: true, 
            tutorialFlags: { m15: false, m50: false, m100: false }, tutorialText: ""
        };
        
        let base = castles.find(c => c.id === chosenTeam);
        if (base) {
            players[socket.id].x = base.x + (Math.random() * 100 - 50);
            players[socket.id].y = base.y + (Math.random() * 100 - 50);
        }

        socket.emit('initTeam', { id: socket.id, team: chosenTeam, color: TEAM_COLORS[chosenTeam], castles: castles, bushes: bushes });
        
        let msg = getTutorialMessage(data.name, `join_${skinType}`);
        players[socket.id].tutorialText = msg;
        io.to(socket.id).emit('tutorialTick', { text: msg });
        console.log(`[NOWY GRACZ TEAMS] >> ${players[socket.id].name} << dołączył do drużyny ${chosenTeam}`);
    });

    socket.on('setBotDifficulty', (levelIndex) => {
        if (levelIndex === 0) botDifficultyMultiplier = 0.6;
        else if (levelIndex === 1) botDifficultyMultiplier = 1.0; 
        else if (levelIndex === 2) botDifficultyMultiplier = 1.5; 
        io.emit('killEvent', { text: `⚙️ Zmiana trudności AI: ${levelIndex === 0 ? 'ŁATWY' : levelIndex === 1 ? 'NORMALNY' : 'TRUDNY'}`, time: 150 });
    });

    socket.on('setFormation', (formationIndex) => {
        const p = players[socket.id];
        if (p) {
            p.formation = formationIndex;
            let formName = p.formation === 0 ? "OKRĄG" : (p.formation === 1 ? "KLIN (V)" : (p.formation === 2 ? "LINIA" : "WŁASNA (PPM)"));
            socket.emit('formationSwitched', formName);
        }
    });

    socket.on('playerMovement', (data) => {
        const p = players[socket.id];
        if (p) {
            p.isMoving = (data.x !== p.x || data.y !== p.y);
            if (p.isMoving) p.idleTime = 0; 
            if (p.isMoving) p.moveAngle = Math.atan2(data.y - p.y, data.x - p.x);
            p.x = data.x; p.y = data.y; p.isSafe = data.isSafe; p.isShielding = data.isShielding; 

            let newLevel = Math.floor(p.score / 20) + 1;
            if (newLevel > p.level) {
                p.level = newLevel; p.skillPoints++;
                socket.emit('levelUp', { level: p.level, points: p.skillPoints });
            }
        }
    });

    socket.on('playerMovementTeam', (data) => {
        const p = players[socket.id];
        if (p) {
            p.isMoving = (data.x !== p.x || data.y !== p.y);
            if (p.isMoving) p.idleTime = 0;
            if (p.isMoving) p.moveAngle = Math.atan2(data.y - p.y, data.x - p.x);
            p.x = data.x; p.y = data.y; p.isShielding = data.isShielding; 
            let newLevel = Math.floor(p.score / 20) + 1;
            if (newLevel > p.level) { p.level = newLevel; p.skillPoints++; socket.emit('levelUp', { level: p.level, points: p.skillPoints }); }
        }
    });

    socket.on('dash', (dir) => {
        const p = players[socket.id];
        const now = Date.now();
        if (p && p.paths.speed === 'dash' && now - p.lastDashUse > 3000) {
            p.lastDashUse = now; let dashDist = 150;
            p.x += dir.x * dashDist; p.y += dir.y * dashDist;
            p.x = Math.max(0, Math.min(WORLD_SIZE, p.x)); p.y = Math.max(0, Math.min(WORLD_SIZE, p.y));
            io.emit('killEvent', { text: `💨 Zryw!`, time: 100 });
        }
    });

    socket.on('toggleRecruit', () => {
        const p = players[socket.id];
        if (p) { p.isRecruiting = !p.isRecruiting; socket.emit('recruitToggled', p.isRecruiting); }
    });

    socket.on('switchFormation', () => {
        const p = players[socket.id];
        if (p) {
            p.formation = (p.formation + 1) % 4; 
            let formName = p.formation === 0 ? "OKRĄG" : (p.formation === 1 ? "KLIN (V)" : (p.formation === 2 ? "LINIA" : "WŁASNA (PPM)"));
            socket.emit('formationSwitched', formName);
        }
    });

    socket.on('setBotOffset', (data) => {
        const p = players[socket.id];
        let b = bots[data.botId];
        if (p && b && b.ownerId === p.id) {
            b.angleOffset = data.angleOffset; b.distOffset = data.distOffset;
            if (p.formation !== 3) { p.formation = 3; socket.emit('formationSwitched', "WŁASNA (PPM)"); }
        }
    });

    socket.on('upgradeSkill', (skillName) => {
        const p = players[socket.id];
        if (p && p.skillPoints > 0) {
            if (skillName === 'strength' && p.score < 100) return; 
            if (skillName === 'weapon' && p.score < 15) return;   
            if (p.skills[skillName] !== undefined && p.skills[skillName] < 20) {
                p.skills[skillName]++; p.skillPoints--;
                socket.emit('skillUpdated', { skills: p.skills, points: p.skillPoints, paths: p.paths });
            }
        }
    });

    socket.on('chooseSkillPath', (data) => {
        const p = players[socket.id];
        if (p && p.skills[data.category] >= 5 && p.paths[data.category] === 'none') {
            p.paths[data.category] = data.path;
            socket.emit('skillUpdated', { skills: p.skills, points: p.skillPoints, paths: p.paths });
        }
    });

    socket.on('claimGachaReward', (data) => {
        const p = players[socket.id];
        if (!p) return;
        if (data.type === 'weapon') {
            p.inventory[data.item] = 1; p.activeWeapon = data.item;
            io.emit('killEvent', { text: `🔥 ${p.name} wylosował z Gacha potężną broń: ${data.itemName}!` });
        } else if (data.type === 'skin_fragment') {
            io.emit('killEvent', { text: `🌟 ${p.name} zdobył z Gacha fragment: ${data.itemName}!` });
        }
    });

    socket.on('buyShopItem', (item) => {
        const p = players[socket.id];
        if (!p || !p.isSafe) return;
        const shopPrices = {
            'bow': 100, 'golden_bow': 250, 'diamond_bow': 500, 'crossbow': 1000, 'shotgun': 2000,
            'knife': 50, 'golden_knife': 150, 'diamond_knife': 350, 'hunting_knife': 700, 'cleaver': 1200,
            'shuriken': 20, 'golden_shuriken': 80, 'diamond_shuriken': 200, 'chakram': 500, 'explosive_kunai': 1000
        };
        let price = shopPrices[item];
        if (p.skin === 'arystokrata') price = Math.floor(price * 0.95);

        if (price && p.score >= price) {
            p.score -= price; p.inventory[item] = 1; p.activeWeapon = item;              
            socket.emit('shopSuccess', { item: item });
            
            for (let bId in bots) {
                if (bots[bId].ownerId === p.id) { bots[bId].inventory[item] = 1; bots[bId].activeWeapon = item; }
            }
        } else {
            socket.emit('shopError', { message: "Za mało punktów masy!" });
        }
    });

    socket.on('switchWeapon', (slot) => {
        const p = players[socket.id];
        if(!p) return;
        if (slot === 1) p.activeWeapon = 'sword';
        else if (slot === 2) {
            const types = ['shotgun', 'crossbow', 'diamond_bow', 'golden_bow', 'bow', 'cleaver', 'hunting_knife', 'diamond_knife', 'golden_knife', 'knife', 'explosive_kunai', 'chakram', 'diamond_shuriken', 'golden_shuriken', 'shuriken'];
            for(let t of types) if(p.inventory[t]) { p.activeWeapon = t; break; }
        }
        for (let bId in bots) { if (bots[bId].ownerId === p.id) bots[bId].activeWeapon = p.activeWeapon; }
    });

    socket.on('equipFromInventory', (data) => {
        const p = players[socket.id];
        if (!p || !data.weaponId) return;
        if (p.inventory[data.weaponId] > 0) {
            p.activeWeapon = data.weaponId;
            for (let bId in bots) { if (bots[bId].ownerId === p.id) bots[bId].activeWeapon = p.activeWeapon; }
        }
    });

    socket.on('throwSword', (data) => {
        const p = players[socket.id];
        if (!p) return;
        let type = p.activeWeapon;
        let stats = weaponStats[type];
        
        if (stats && p.score >= stats.cost) {
            let canShoot = false;
            if (type === 'sword' && p.score >= 15) canShoot = true;
            else if (type !== 'sword' && p.inventory[type] > 0) canShoot = true;

            if (canShoot) {
                p.score -= stats.cost;
                let finalDmg = type === 'sword' ? stats.dmg + (p.skills.weapon * 1) : stats.dmg;
                let isPierce = type === 'sword' ? (p.paths.weapon === 'piercing') : stats.piercing;
                
                let pid = ++entityIdCounter;
                projectiles[pid] = {
                    id: pid, ownerId: socket.id, ownerTeam: p.team || null, teamInitial: p.team || null,
                    x: data.x, y: data.y, dx: data.dx, dy: data.dy,
                    life: stats.life, speed: stats.speed, isBotSword: false,
                    scoreAtThrow: p.score, isPiercing: isPierce, damage: finalDmg, isWinter: false, projType: type 
                };
            }
        }
    });

    socket.on('throwWinterSword', () => {
        const p = players[socket.id];
        const now = Date.now();
        if (p && p.paths.weapon === 'winter' && now - p.lastWinterUse >= 15000) {
            p.lastWinterUse = now;
            let winterDmg = 15 + (p.skills.weapon * 2);
            let pid = ++entityIdCounter;
            projectiles[pid] = {
                id: pid, ownerId: socket.id, ownerTeam: p.team || null, teamInitial: p.team || null,
                x: p.x, y: p.y - 1000, dx: 0, dy: 1.5, life: 150, speed: 18,
                isBotSword: false, scoreAtThrow: Math.max(700, p.score), isPiercing: true, isWinter: true, damage: winterDmg, projType: 'winter'
            };
        }
    });

    socket.on('disconnect', () => {
        const p = players[socket.id];
        if (p) {
            console.log(`[WYLOGOWANIE] Gracz >> ${p.name} << opuścił serwer.`);
            delete players[socket.id];
        }
    });
});

// ==========================================
// OPTYMALIZACJA V2: SIATKA PRZESTRZENNA (Spatial Hash Grid)
// ==========================================
const CELL_SIZE = 400; 

function getNearbyEntities(x, y, grid) {
    let cx = Math.floor(x / CELL_SIZE);
    let cy = Math.floor(y / CELL_SIZE);
    let nearby = { players: [], bots: [], foods: [], loots: [] };
    
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            let cell = grid[`${cx + dx},${cy + dy}`];
            if (cell) {
                nearby.players.push(...cell.players);
                nearby.bots.push(...cell.bots);
                nearby.foods.push(...cell.foods);
                nearby.loots.push(...cell.loots);
            }
        }
    }
    return nearby;
}

// --- GŁÓWNA PĘTLA SERWERA (30 FPS) ---
setInterval(() => {
    eventTickCounter++;

    for (let pId in players) {
        let p = players[pId];
        if (!p.isSafe && (p.x < -10 || p.x > WORLD_SIZE + 10 || p.y < -10 || p.y > WORLD_SIZE + 10)) {
            io.emit('killEvent', { text: `${p.name} zginął poza mapą!` }); 
            killPlayer(pId);
        }
    }

    // --- LOGIKA ZAMKÓW I OBLĘŻEŃ ---
    Object.values(players).forEach(p => { if (p.team && !p.isSafe) p.isSafe = false; }); 

    castles.forEach(c => {
        let defenders = 0, attackers = 0, attackingTeam = null;
        Object.values(players).forEach(p => {
            if (!p.team) return; 
            if (Math.hypot(p.x - c.x, p.y - c.y) < c.radius) {
                if (p.team === c.owner) { defenders++; p.isSafe = true; } 
                else {
                    attackers++; attackingTeam = p.team;
                    if (eventTickCounter % 30 === 0 && !p.isSafe) {
                        let burnDamage = Math.max(2, Math.floor(p.score * 0.05)); 
                        p.score -= burnDamage;
                        if (p.score <= 1) killPlayer(p.id); 
                    }
                }
            }
        });

        if (eventTickCounter % 30 === 0) {
            if (attackers > defenders && c.owner !== attackingTeam) {
                c.captureProgress += 3.4;
                if (c.captureProgress >= 100) {
                    c.owner = attackingTeam; c.color = TEAM_COLORS[attackingTeam]; c.captureProgress = 0;
                    io.emit('killEvent', { text: `🚩 Zamek ${c.id} zdobyty przez drużynę ${attackingTeam}!` });
                }
            } else if (c.captureProgress > 0) {
                c.captureProgress = Math.max(0, c.captureProgress - 3.4); 
            }
        }
    });

    // --- SYSTEM EVENTÓW ---
    eventTimer++;
    if (eventTimer > 2700 && activeEvent === null) {
        let playersArray = Object.values(players);
        let rand = Math.random();
        
        if (rand < 0.25 && playersArray.length > 0) {
            playersArray.sort((a, b) => b.score - a.score);
            let topPlayer = playersArray[0];
            if (topPlayer && topPlayer.score >= 50) { 
                currentKingId = topPlayer.id; activeEvent = 'KING_HUNT';
                io.emit('killEvent', { text: `👑 EVENT! ${topPlayer.name} ZDOBYŁ KORONĘ! WSZYSCY NA NIEGO!`, time: 300 });
                setTimeout(() => {
                    if (activeEvent === 'KING_HUNT' && players[currentKingId]) {
                        players[currentKingId].score += 500; 
                        io.emit('killEvent', { text: `🛡️ Król ${players[currentKingId].name} przetrwał rzeź! +500 pkt!`, time: 200 });
                    }
                    activeEvent = null; currentKingId = null; eventTimer = 0;
                }, 30000);
            } else eventTimer = 0; 
        } else if (rand < 0.5) {
            activeEvent = 'TOXIC_RAIN';
            io.emit('killEvent', { text: `🌧️ KWAŚNY DESZCZ! Uciekaj do bezpiecznej strefy (Zamku)!`, time: 300 });
            Object.values(players).forEach(p => { if (p.isTutorialActive) io.to(p.id).emit('tutorialTick', { text: getTutorialMessage(p.name, 'toxic_rain') }); });
            setTimeout(() => { activeEvent = null; eventTimer = 0; io.emit('killEvent', { text: `⛅ Przejaśnia się. Deszcz ustąpił.`, time: 200 }); }, 25000);
        } else if (rand < 0.75) {
            activeEvent = 'BLIZZARD';
            io.emit('killEvent', { text: `❄️ ZAMIĘĆ ŚNIEŻNA! Temperatura spada, wszyscy zwalniają!`, time: 300 });
            Object.values(players).forEach(p => { if (p.isTutorialActive) io.to(p.id).emit('tutorialTick', { text: getTutorialMessage(p.name, 'blizzard') }); });
            setTimeout(() => { activeEvent = null; eventTimer = 0; io.emit('killEvent', { text: `☀️ Śnieżyca ustała. Wracamy do normy.`, time: 200 }); }, 20000);
        } else {
            activeEvent = 'METEOR_SHOWER';
            io.emit('killEvent', { text: `☄️ UWAGA! Zbliża się deszcz meteorytów! Omijajcie czerwone strefy!`, time: 300 });
            for(let m = 0; m < 10; m++) meteorZones.push({ x: Math.random() * WORLD_SIZE, y: Math.random() * WORLD_SIZE, radius: 150 + Math.random() * 100, timer: 90 });
            setTimeout(() => { activeEvent = null; eventTimer = 0; io.emit('killEvent', { text: `💨 Zagrożenie minęło. Meteoryty spadły.`, time: 200 }); }, 15000); 
        }
    }

    for (let i = meteorZones.length - 1; i >= 0; i--) {
        let m = meteorZones[i];
        m.timer--;
        if (m.timer <= 0) {
            Object.values(players).forEach(p => {
                if (!p.isSafe && Math.hypot(p.x - m.x, p.y - m.y) < m.radius) {
                    p.score = Math.max(1, p.score - 100); 
                    io.emit('damageText', { x: p.x, y: p.y - 30, val: 100, color: '#e74c3c' });
                    io.emit('deathMarker', { x: p.x, y: p.y });
                    if(p.score <= 1) killPlayer(p.id);
                }
            });
            for (let bId in bots) {
                if (Math.hypot(bots[bId].x - m.x, bots[bId].y - m.y) < m.radius) {
                    bots[bId].score = Math.max(1, bots[bId].score - 100);
                    io.emit('damageText', { x: bots[bId].x, y: bots[bId].y - 30, val: 100, color: '#e74c3c' });
                }
            }
            meteorZones.splice(i, 1);
        }
    }

    if (activeEvent === 'TOXIC_RAIN' && eventTickCounter % 30 === 0) {
        Object.values(players).forEach(p => { if (!p.isSafe && p.score > 5) { p.score -= (p.paths.strength === 'titan' ? 1 : 2); } });
        for (let bId in bots) { if (!bots[bId].isSafe && bots[bId].score > 5) bots[bId].score -= 1; }
    }

    if (eventTickCounter % 30 === 0) { 
        Object.values(players).forEach(p => {
            if (p.paths.strength === 'titan') {
                if (!p.isMoving) p.idleTime++;
                if (p.idleTime >= 3) p.score += 2; 
            }
        });
        for (let bId in bots) {
            if (!bots[bId].ownerId) { 
                let growthChance = (bots[bId].score < 30 ? 0.4 : 0.1) * botDifficultyMultiplier;
                if (Math.random() < growthChance) bots[bId].score += 1;
            }
        }
    }

    Object.values(players).forEach(p => {
        if (!p.isTutorialActive || !p.tutorialFlags) return;
        if (p.score >= 15 && !p.tutorialFlags.m15) { p.tutorialFlags.m15 = true; io.to(p.id).emit('tutorialTick', { text: getTutorialMessage(p.name, 'mass15') }); }
        else if (p.score >= 50 && !p.tutorialFlags.m50) { p.tutorialFlags.m50 = true; io.to(p.id).emit('tutorialTick', { text: getTutorialMessage(p.name, 'mass50') }); }
        else if (p.score >= 100 && !p.tutorialFlags.m100) { p.tutorialFlags.m100 = true; io.to(p.id).emit('tutorialTick', { text: getTutorialMessage(p.name, 'mass100') }); }
    });

    let armies = {};
    for (let bId in bots) {
        let b = bots[bId];
        if (b.ownerId) {
            if (!armies[b.ownerId]) armies[b.ownerId] = [];
            armies[b.ownerId].push(b);
        }
    }

    // --- 1. RUCH BOTÓW ---
    for (let bId in bots) {
        let b = bots[bId];
        let owner = b.ownerId ? players[b.ownerId] : null;

        let botSpeedFromOwner = owner ? owner.baseSpeed : (2.5 * botDifficultyMultiplier); 
        let baseBotSpeed = botSpeedFromOwner + ((owner ? owner.skills.speed : 0) * 0.4);
        let isLightweight = owner && owner.paths.speed === 'lightweight';
        let currentBotSpeed = (activeEvent === 'BLIZZARD' && !isLightweight) ? baseBotSpeed * 0.4 : baseBotSpeed;
        
        if (b.ownerId) {
            if (owner && armies[b.ownerId]) {
                let myIndex = armies[b.ownerId].indexOf(b);
                let total = armies[b.ownerId].length;
                let targetX = owner.x; let targetY = owner.y;

                if (owner.formation === 0) { 
                    let angleStep = (Math.PI * 2) / total;
                    let currentAngle = (Date.now() / 1500) + (myIndex * angleStep);
                    let radius = 70 + (total * 2); 
                    targetX = owner.x + Math.cos(currentAngle) * radius; targetY = owner.y + Math.sin(currentAngle) * radius;
                } else if (owner.formation === 1) { 
                    let row = Math.floor(myIndex / 2) + 1; let side = myIndex % 2 === 0 ? 1 : -1;
                    if (myIndex === 0) { row = 1; side = 0; } 
                    targetX = owner.x - Math.cos(owner.moveAngle) * (row * 45) + Math.cos(owner.moveAngle + Math.PI/2) * (side * row * 35);
                    targetY = owner.y - Math.sin(owner.moveAngle) * (row * 45) + Math.sin(owner.moveAngle + Math.PI/2) * (side * row * 35);
                } else if (owner.formation === 2) { 
                    let offset = (myIndex - (total - 1) / 2) * 45;
                    targetX = owner.x - Math.cos(owner.moveAngle) * 60 + Math.cos(owner.moveAngle + Math.PI/2) * offset;
                    targetY = owner.y - Math.sin(owner.moveAngle) * 60 + Math.sin(owner.moveAngle + Math.PI/2) * offset;
                } else if (owner.formation === 3) {
                    targetX = owner.x + Math.cos(owner.moveAngle + b.angleOffset) * b.distOffset;
                    targetY = owner.y + Math.sin(owner.moveAngle + b.angleOffset) * b.distOffset;
                }

                b.targetX = targetX; b.targetY = targetY;
                let distToTarget = Math.hypot(targetX - b.x, targetY - b.y);
                if (distToTarget > 10) { 
                    b.angle = Math.atan2(targetY - b.y, targetX - b.x);
                    let speedMult = distToTarget > 120 ? 1.8 : (distToTarget > 40 ? 1.3 : 0.8);
                    b.x += Math.cos(b.angle) * (currentBotSpeed * speedMult); b.y += Math.sin(b.angle) * (currentBotSpeed * speedMult);
                }
            } else if (!owner) {
                b.ownerId = null; b.team = null; b.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
                botNameCounter++; b.name = `Bot AI #${botNameCounter}`; b.inventory = { bow: 0, knife: 0, shuriken: 0 }; b.activeWeapon = 'sword';
            }
        } else {
            let isHuntingKing = false;
            if (activeEvent === 'KING_HUNT' && currentKingId && players[currentKingId]) {
                let king = players[currentKingId];
                if (!king.isSafe) {
                    isHuntingKing = true; b.angle = Math.atan2(king.y - b.y, king.x - b.x);
                    b.x += Math.cos(b.angle) * (currentBotSpeed * 1.5); b.y += Math.sin(b.angle) * (currentBotSpeed * 1.5);
                    b.color = '#c0392b'; 
                }
            }
            if (!isHuntingKing) {
                if (Math.random() < 0.02) b.angle = Math.random() * Math.PI * 2;
                b.x += Math.cos(b.angle) * currentBotSpeed; b.y += Math.sin(b.angle) * currentBotSpeed;
                if (b.color === '#c0392b') b.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
            }
            if (b.x < 0 || b.x > WORLD_SIZE) b.angle = Math.PI - b.angle;
            if (b.y < 0 || b.y > WORLD_SIZE) b.angle = -b.angle;
        }
    }

    // --- BUDOWA SIATKI (GRIDU) NA TĄ KLATKĘ ---
    let grid = {};
    function addToGrid(entity, type) {
        let key = `${Math.floor(entity.x / CELL_SIZE)},${Math.floor(entity.y / CELL_SIZE)}`;
        if (!grid[key]) grid[key] = { players: [], bots: [], foods: [], loots: [] };
        grid[key][type].push(entity);
    }
    Object.values(players).forEach(p => addToGrid(p, 'players'));
    Object.values(bots).forEach(b => addToGrid(b, 'bots'));
    Object.values(foods).forEach(f => addToGrid(f, 'foods'));
    Object.values(loots).forEach(l => addToGrid(l, 'loots'));

    // --- 2. KOLIZJE BOTÓW Z WYKORZYSTANIEM SIATKI ---
    for (let bId in bots) {
        let b = bots[bId];
        if (!b) continue;
        let owner = b.ownerId ? players[b.ownerId] : null;
        let nearby = getNearbyEntities(b.x, b.y, grid);

        // Strzelanie
        let shootChance = 0.03 * botDifficultyMultiplier;
        if (b.score >= 15 && Math.random() < shootChance) {
            let stats = weaponStats[b.activeWeapon];
            let now = Date.now();
            if (stats && b.score >= stats.cost + 5 && now - b.lastShootTime > 2000) {
                let target = null; let minBotDist = 400; 
                
                nearby.players.forEach(p2 => {
                    if (p2.id !== (owner ? owner.id : null) && (!b.team || b.team !== p2.team)) {
                        let d = Math.hypot(b.x - p2.x, b.y - p2.y);
                        if (d < minBotDist) { minBotDist = d; target = p2; }
                    }
                });
                if (!target) {
                    nearby.bots.forEach(b2 => {
                        if (b2.id !== b.id && b2.ownerId !== (owner ? owner.id : null) && (!b.team || b.team !== b2.team)) {
                            let d = Math.hypot(b.x - b2.x, b.y - b2.y);
                            if (d < minBotDist) { minBotDist = d; target = b2; }
                        }
                    });
                }
                if (target) {
                    b.lastShootTime = now; b.score -= stats.cost;
                    let aimAngle = Math.atan2(target.y - b.y, target.x - b.x);
                    let botPierce = b.activeWeapon === 'sword' ? (owner && owner.paths.weapon === 'piercing') : stats.piercing;
                    let botFinalDmg = b.activeWeapon === 'sword' ? stats.dmg + ((owner ? owner.skills.weapon : 0) * 1) : stats.dmg;
                    let pid = ++entityIdCounter;
                    projectiles[pid] = {
                        id: pid, ownerId: owner ? owner.id : b.id, ownerTeam: b.team || null, teamInitial: b.team || null,
                        x: b.x, y: b.y, dx: Math.cos(aimAngle), dy: Math.sin(aimAngle),
                        life: stats.life, speed: stats.speed, isBotSword: true,
                        scoreAtThrow: b.score, isPiercing: botPierce, damage: botFinalDmg, isWinter: false, projType: b.activeWeapon
                    };
                }
            }
        }

        // Bot je jedzenie
        nearby.foods.forEach(f => {
            if (foods[f.id] && Math.hypot(b.x - f.x, b.y - f.y) < 25) {
                b.score += 1; delete foods[f.id]; spawnFood();
            }
        });

        // Bot zjada Bota
        nearby.bots.forEach(b2 => {
            if (!bots[b.id] || !bots[b2.id] || b.id === b2.id) return;
            if (b.ownerId && b.ownerId === b2.ownerId) return;
            if (b.team && b2.team && b.team === b2.team) return;

            let dist = Math.hypot(b.x - b2.x, b.y - b2.y);
            let r1 = 25 * (1 + Math.pow(Math.max(0, b.score - 1), 0.45) * 0.15);
            let r2 = 25 * (1 + Math.pow(Math.max(0, b2.score - 1), 0.45) * 0.15);

            if (dist < r1 && b.score > b2.score * 1.15) {
                io.emit('killEvent', { text: `${b.name} pożarł ${b2.name}` }); 
                b.score += Math.floor(b2.score * 0.5);
                io.emit('deathMarker', { x: b2.x, y: b2.y }); 
                delete bots[b2.id]; spawnBot(); 
            } else if (dist < r2 && b2.score > b.score * 1.15) {
                io.emit('killEvent', { text: `${b2.name} pożarł ${b.name}` }); 
                b2.score += Math.floor(b.score * 0.5);
                io.emit('deathMarker', { x: b.x, y: b.y }); 
                delete bots[b.id]; spawnBot(); 
            }
        });

        // Przelew masy do Gracza
        if (bots[b.id] && b.ownerId && b.score > 15) {
            let p = players[b.ownerId];
            if (p) { let transfer = Math.floor(b.score - 15); b.score -= transfer; p.score += transfer; }
        }
    }

    // --- 3. KOLIZJE GRACZY Z WYKORZYSTANIEM SIATKI ---
    Object.values(players).forEach(p => {
        if (!players[p.id]) return; 
        let pRadius = 25 * (1 + Math.pow(Math.max(0, p.score - 1), 0.45) * 0.15);
        let nearby = getNearbyEntities(p.x, p.y, grid);

        nearby.foods.forEach(f => {
            if (foods[f.id] && Math.hypot(p.x - f.x, p.y - f.y) < pRadius) {
                p.score += (p.skin === 'standard' ? 1.02 : 1 * p.massMultiplier);
                delete foods[f.id]; spawnFood();
            }
        });

        nearby.loots.forEach(l => {
            if (loots[l.id] && Math.hypot(p.x - l.x, p.y - l.y) < pRadius + 15) {
                if (l.type === 'mass') {
                    let lootMass = 30 * (p.skin === 'standard' ? 1.02 : p.massMultiplier);
                    p.score += lootMass; io.emit('killEvent', { text: `🎁 ${p.name} znalazł złoże Masy (+${Math.floor(lootMass)})!` }); 
                } else if (l.type === 'skill') {
                    p.skillPoints++; io.to(p.id).emit('levelUp', { level: p.level, points: p.skillPoints }); io.emit('killEvent', { text: `📘 ${p.name} odnalazł Księgę Wiedzy!` }); 
                } else if (l.type === 'weapon') {
                    p.inventory['knife'] = 1; p.activeWeapon = 'knife'; io.emit('killEvent', { text: `🗡️ ${p.name} znalazł Nóż w skrzynce!` }); 
                }
                delete loots[l.id]; spawnLoot(); 
            }
        });

        nearby.bots.forEach(b => {
            if (!bots[b.id] || !players[p.id] || p.isSafe) return;
            let dist = Math.hypot(p.x - b.x, p.y - b.y);
            let bRadius = 25 * (1 + Math.pow(Math.max(0, b.score - 1), 0.45) * 0.15);

            if (b.ownerId !== p.id) {
                let ownerPlayer = players[b.ownerId];
                if (p.team && ownerPlayer && ownerPlayer.team === p.team) return;

                if (activeEvent === 'KING_HUNT' && p.id === currentKingId && b.ownerId !== p.id) {
                    if (dist < pRadius) {
                        p.score = Math.max(10, p.score - 15); 
                        io.emit('damageText', { x: p.x, y: p.y - 30, val: 15, color: '#f1c40f' });
                        delete bots[b.id]; spawnBot(); return; 
                    }
                }

                if (dist < pRadius && p.score > b.score * 1.15) {
                    if (p.isRecruiting) {
                        io.emit('killEvent', { text: `${p.name} zwerbował wojownika!` }); 
                        b.ownerId = p.id; b.team = p.team; b.score = 5; b.color = p.color; b.name = `Wojownik`; 
                        b.activeWeapon = p.activeWeapon;
                        if (p.activeWeapon !== 'sword') b.inventory[p.activeWeapon] = 1;
                        b.distOffset = Math.hypot(b.x - p.x, b.y - p.y); b.angleOffset = Math.atan2(b.y - p.y, b.x - p.x) - p.moveAngle;
                    } else {
                        io.emit('killEvent', { text: `${p.name} pożarł ${b.name}` }); 
                        p.score += Math.floor(b.score * 0.5);
                        io.emit('deathMarker', { x: b.x, y: b.y });
                        delete bots[b.id]; spawnBot(); 
                    }
                    io.to(p.id).emit('botEaten', { newScore: p.score });
                }
                else if (dist < bRadius && b.score > p.score * 1.15) {
                    io.emit('killEvent', { text: `${b.name} pożarł ${p.name}` }); 
                    b.score += Math.floor(p.score * 0.5);
                    io.emit('deathMarker', { x: p.x, y: p.y }); 
                    killPlayer(p.id); 
                }
            }
        });

        nearby.players.forEach(p2 => {
            if (!players[p.id] || !players[p2.id] || p.id === p2.id) return;
            if (p.isSafe || p2.isSafe) return; 
            if (p.team && p2.team && p.team === p2.team) return;

            let dist = Math.hypot(p.x - p2.x, p.y - p2.y);
            let r1 = 25 * (1 + Math.pow(Math.max(0, p.score - 1), 0.45) * 0.15);
            let r2 = 25 * (1 + Math.pow(Math.max(0, p2.score - 1), 0.45) * 0.15);

            if (dist < r1 && p.score > p2.score * 1.15) {
                io.emit('killEvent', { text: `${p.name} wyeliminował ${p2.name}!` }); 
                p.score += Math.floor(p2.score * 0.5); io.emit('deathMarker', { x: p2.x, y: p2.y }); killPlayer(p2.id); 
            } else if (dist < r2 && p2.score > p.score * 1.15) {
                io.emit('killEvent', { text: `${p2.name} wyeliminował ${p.name}!` }); 
                p2.score += Math.floor(p.score * 0.5); io.emit('deathMarker', { x: p.x, y: p.y }); killPlayer(p.id); 
            }
        });
    });

    // --- 4. FIZYKA MIECZY Z WYKORZYSTANIEM SIATKI ---
    for (let pId in projectiles) {
        let proj = projectiles[pId];
        proj.x += proj.dx * proj.speed;
        proj.y += proj.dy * proj.speed;
        proj.life--;

        let nearby = getNearbyEntities(proj.x, proj.y, grid);

        nearby.bots.forEach(b => {
            if (!bots[b.id] || !projectiles[pId]) return;
            let hitRange = proj.isWinter ? 60 : 30; 
            if (proj.ownerId !== b.id && proj.ownerId !== b.ownerId && Math.hypot(proj.x - b.x, proj.y - b.y) < hitRange) {
                if (b.ownerId && players[b.ownerId] && proj.ownerTeam === players[b.ownerId].team) return;
                if (proj.ownerTeam && !b.team) return;

                b.score = Math.max(1, b.score - proj.damage);
                io.emit('damageText', { x: b.x, y: b.y - 20, val: proj.damage, color: '#fff' });
                if (!proj.isPiercing) proj.life = 0; 
            }
        });

        nearby.players.forEach(pl => {
            if (!players[pl.id] || !projectiles[pId]) return;
            let hitRange = proj.isWinter ? 60 : 30;
            if (proj.ownerId !== pl.id && Math.hypot(proj.x - pl.x, proj.y - pl.y) < hitRange) {
                if (proj.ownerTeam && proj.ownerTeam === pl.team) return;

                if (pl.isShielding && !proj.isWinter) {
                    if (!proj.isPiercing) proj.life = 0; 
                } else {
                    let damage = proj.damage;
                    if (pl.score >= 800) { damage -= 4; if (pl.armorHits < 3 && !proj.isWinter) { damage = 0; pl.armorHits++; } } 
                    else if (pl.score >= 400) { damage -= 3; } 
                    else if (pl.score >= 100) { damage -= 2; }

                    let strengthReduction = Math.floor((pl.skills.strength || 0) / 10);
                    damage -= strengthReduction;
                    damage = Math.max(1, damage); 
                    if (proj.isWinter) damage = proj.damage;

                    pl.score = Math.max(1, pl.score - Math.floor(damage));
                    io.emit('damageText', { x: pl.x, y: pl.y - 30, val: Math.floor(damage), color: '#ff4757' });
                    
                    if (pl.paths.strength === 'thorns') {
                        let attacker = players[proj.ownerId];
                        if (attacker) {
                            let reflectDmg = Math.max(1, Math.floor(damage * 0.25));
                            attacker.score = Math.max(1, attacker.score - reflectDmg);
                            io.emit('damageText', { x: attacker.x, y: attacker.y - 30, val: reflectDmg, color: '#e67e22' });
                        }
                    }
                    if (!proj.isPiercing) proj.life = 0;
                }
            }
        });

        if (proj.life <= 0) delete projectiles[pId];
    }

    Object.values(players).forEach(p => {
        let skillsChanged = false;
        if (p.score < 100 && p.skills.strength > 0) { p.skills.strength = 0; skillsChanged = true; }
        if (p.score < 15 && (p.skills.weapon > 0 || p.paths.weapon !== 'none' || p.activeWeapon !== 'sword')) {
            p.skills.weapon = 0; p.paths.weapon = 'none'; p.activeWeapon = 'sword'; skillsChanged = true;
        }
        if (skillsChanged) io.to(p.id).emit('skillUpdated', { skills: p.skills, points: p.skillPoints, paths: p.paths });
    });

    let eventTimeLeft = Math.max(0, Math.floor((2700 - eventTimer) / 30));
    
    // Wysyłamy do klientów dane o obiektach jako słowniki (bez statycznych krzaków).
    io.emit('serverTick', { 
        players, bots, foods, projectiles, loots, 
        activeEvent, eventTimeLeft, castles, meteorZones 
    });
}, 33);

// ==========================================
// MIDAS - WIRTUALNY PRZEWODNIK 
// ==========================================
function getTutorialMessage(playerName, eventType) {
    const messages = {
        'join_standard': `Witaj na arenie XD, ${playerName}! Jako Zwykły Wojownik rośniesz odrobinę szybciej. Zbieraj pomarańczowe kropki i skrzynki!`,
        'join_ninja': `Witaj w cieniach, ${playerName}. Jesteś zwinny jak Ninja, ale uważaj, jesteś bardzo delikatny na starcie! Zbieraj kropki, by przetrwać!`,
        'join_arystokrata': `Ah, Wasza Wysokość ${playerName}! Witamy na arenie. Jako Arystokrata masz zniżki w Zamkowym Sklepie i zbijasz fortunę na kropkach!`,
        'join': `Witaj na arenie XD, ${playerName}! Jestem Midas. Zbieraj pomarańczowe kropki i skrzynki z "?", by urosnąć. Uciekaj przed większymi!`,
        'mass15': `Świetnie, masz 15 masy! Odblokowałeś Rzut Mieczem. Kliknij LPM (Myszka) lub czerwony miecz na ekranie (Telefon), by rzucić. Koszt: 2 pkt masy.`,
        'mass50': `Połowa drogi do potęgi (50 masy)! Możesz teraz używać Tarczy. Przytrzymaj [Q] lub ikonę tarczy, by odbijać ataki.`,
        'mass100': `Niesamowite, 100 masy (5 poziom)! Szybko, użyj plusików po lewej i wybierz klasę (np. Zryw pod [SHIFT] lub Zimowy Miecz [R]).`,
        'toxic_rain': `Uwaga! Kwaśny Deszcz! 🌧️ Szybko chowaj się pod dachem Zamku, inaczej deszcz wypali Twoją masę!`,
        'blizzard': `Brrr... Śnieżyca! ❄️ Wszyscy zwalniają. To idealny moment, by rzucać mieczami w powolne cele!`
    };
    return messages[eventType] || `Walcz dzielnie, ${playerName}!`;
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` SERWER Xtreme Destiny DZIAŁA W TRYBIE PRO `);
    console.log(` Port nasłuchiwania: ${PORT} `);
    console.log(`=========================================`);
});
