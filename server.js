const express = require('express');
const app = express();
const http = require('http').createServer(app);
// --- TUTAJ JEST MAGIA ---
// Odblokowujemy serwer na ruch z zewnętrznych portali (CORS)
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // Wpuszcza graczy z CrazyGames i każdego innego portalu
        methods: ["GET", "POST"]
    }
});
// ------------------------
app.use(express.static(__dirname));

// --- KONFIGURACJA ŚWIATA ---
const WORLD_SIZE = 4000;
const MAX_FOODS = 200;
const MAX_BOTS = 80; // ZWIĘKSZONA LICZBA BOTÓW (PRAWDZIWA WOJNA!)
const MAX_LOOTS = 15; // Ilość skrzynek na mapie

const players = {};
let foods = [];
let bots = [];
let loots = []; // Tablica skrzynek
let projectiles = []; // Miecze rzucane na E
let entityIdCounter = 0;
let botNameCounter = 0;

// --- ZMIENNE EVENTOWE I DRUŻYNOWE ---
let activeEvent = null; 
let eventTimer = 0;     
let eventTickCounter = 0; // Pomocniczy zegar do zadawania obrażeń od deszczu
let currentKingId = null; 

const TEAM_COLORS = { 'N': '#3498db', 'S': '#e74c3c', 'E': '#f1c40f', 'W': '#2ecc71' };

// --- ZAMKI (BAZY DRUŻYNOWE) ---
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

function killPlayer(pId) {
    const p = players[pId];
    if (p) {
        // --- DETRONIZACJA ---
        if (pId === currentKingId) {
            io.emit('killEvent', { text: `☠️ Król ${p.name} obalony!`, time: 200 });
            currentKingId = null; 
            activeEvent = null;   
        }

        io.to(p.id).emit('gameOver', { finalScore: p.score });
        console.log(`[ŚMIERĆ] Gracz ${p.name} zginął! GAME OVER.`);
        delete players[pId];
    }
}

function spawnFood() {
    return { id: ++entityIdCounter, x: Math.random() * WORLD_SIZE, y: Math.random() * WORLD_SIZE };
}

function spawnLoot() {
    const types = ['mass', 'skill', 'weapon'];
    return {
        id: ++entityIdCounter,
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        type: types[Math.floor(Math.random() * types.length)]
    };
}

function spawnBot() {
    botNameCounter++;
    return {
        id: `bot_${++entityIdCounter}`,
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        score: 0, 
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        name: `Bot AI #${botNameCounter}`,
        angle: Math.random() * Math.PI * 2,
        speed: 2.5,
        ownerId: null, 
        team: null, // Pamięć o przynależności do drużyny (Teams)
        // --- Pamięć formacji RTS ---
        angleOffset: 0, 
        distOffset: 0,  
        targetX: 0,     
        targetY: 0,
        inventory: { bow: 0, knife: 0, shuriken: 0 },
        activeWeapon: 'sword'
    };
}

for (let i = 0; i < MAX_FOODS; i++) foods.push(spawnFood());
for (let i = 0; i < MAX_BOTS; i++) bots.push(spawnBot());
for (let i = 0; i < MAX_LOOTS; i++) loots.push(spawnLoot()); // Spawn startowych skrzynek

io.on('connection', (socket) => {
    console.log(`\n===========================================`);
    console.log(`[SOCKET INFO] Nowe połączenie. ID: ${socket.id}`);
    console.log(`===========================================\n`);

    // --- DOŁĄCZANIE (TRYB FREE) ---
    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            x: 2000,
            y: 2000,
            score: 0, 
            level: 1,
            skillPoints: 0,
            skills: { speed: 0, strength: 0, weapon: 0 },
            // --- NOWOŚĆ: SYSTEM 3 ŚCIEŻEK ---
            paths: { speed: 'none', strength: 'none', weapon: 'none' }, 
            lastWinterUse: 0,   
            lastDashUse: 0, // Do umiejętności ZRYW
            isMoving: false, // Do umiejętności TYTAN
            idleTime: 0,     // Do umiejętności TYTAN
            color: data.color || '#000',
            name: data.name || 'Gracz',
            isSafe: false,
            isShielding: false,
            armorHits: 0,
            inventory: { bow: 0, knife: 0, shuriken: 0 },
            activeWeapon: 'sword',
            // --- NOWOŚCI RTS ---
            isRecruiting: false, // Domyslnie pożera boty
            formation: 0,        // 0: Okrąg, 1: Klin(V), 2: Linia, 3: Własna
            moveAngle: 0,        // Kierunek biegu gracza do formacji
            team: null,
            // --- NOWOŚĆ: PAMIĘĆ MIDASA (TUTORIAL SEKWENCYJNY) ---
            isTutorialActive: true,
            tutorialFlags: { m15: false, m50: false, m100: false },
            tutorialText: ""
        };
        socket.emit('init', { id: socket.id });

        console.log(`\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`);
        console.log(`[NOWY GRACZ FREE] >> ${players[socket.id].name} << wszedł do gry!`);
        console.log(`<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n`);

        // --- WYWOŁANIE MIDASA PO DOŁĄCZENIU ---
        let msg = getTutorialMessage(data.name, 'join');
        players[socket.id].tutorialText = msg;
        io.to(socket.id).emit('tutorialTick', { text: msg });
    });

    // --- DOŁĄCZANIE (TRYB TEAMS) ---
    socket.on('joinTeamGame', (data) => {
        const teams = ['N', 'S', 'E', 'W'];
        let teamCounts = { N: 0, S: 0, E: 0, W: 0 };
        Object.values(players).forEach(p => { if (p.team) teamCounts[p.team]++; });
        
        let chosenTeam = teams.reduce((a, b) => teamCounts[a] <= teamCounts[b] ? a : b);

        players[socket.id] = {
            id: socket.id,
            x: 2000, y: 2000, score: 0, level: 1, skillPoints: 0,
            skills: { speed: 0, strength: 0, weapon: 0 }, 
            paths: { speed: 'none', strength: 'none', weapon: 'none' }, // NOWOŚĆ
            lastWinterUse: 0, lastDashUse: 0, isMoving: false, idleTime: 0,   
            color: TEAM_COLORS[chosenTeam], name: data.name || 'Żołnierz',
            isSafe: false, isShielding: false, armorHits: 0,
            inventory: { bow: 0, knife: 0, shuriken: 0 }, activeWeapon: 'sword',
            isRecruiting: false, formation: 0, moveAngle: 0,
            team: chosenTeam, gameMode: data.mode 
        };
        
        let base = castles.find(c => c.id === chosenTeam);
        if (base) {
            players[socket.id].x = base.x + (Math.random() * 100 - 50);
            players[socket.id].y = base.y + (Math.random() * 100 - 50);
        }

        socket.emit('initTeam', { id: socket.id, team: chosenTeam, color: TEAM_COLORS[chosenTeam] });
        console.log(`[NOWY GRACZ TEAMS] >> ${players[socket.id].name} << dołączył do drużyny ${chosenTeam}`);
    });

    // --- RUCH (TRYB FREE) ---
    socket.on('playerMovement', (data) => {
        const p = players[socket.id];
        if (p) {
            p.isMoving = (data.x !== p.x || data.y !== p.y);
            if (p.isMoving) p.idleTime = 0; // NOWOŚĆ: Reset licznika postoju dla Tytana

            // Obliczamy kąt ruchu dla formacji
            if (p.isMoving) {
                p.moveAngle = Math.atan2(data.y - p.y, data.x - p.x);
            }
            p.x = data.x;
            p.y = data.y;
            p.isSafe = data.isSafe;
            p.isShielding = data.isShielding; 

            let newLevel = Math.floor(p.score / 20) + 1;
            if (newLevel > p.level) {
                p.level = newLevel;
                p.skillPoints++;
                socket.emit('levelUp', { level: p.level, points: p.skillPoints });
            }
        }
    });

    // --- RUCH (TRYB TEAMS) ---
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

    // --- NOWOŚĆ: ZRYW (DASH) ---
    socket.on('dash', (dir) => {
        const p = players[socket.id];
        const now = Date.now();
        // Zryw działa tylko jeśli wybrałeś ścieżkę 'dash' i minął cooldown 3s
        if (p && p.paths.speed === 'dash' && now - p.lastDashUse > 3000) {
            p.lastDashUse = now;
            let dashDist = 150;
            p.x += dir.x * dashDist;
            p.y += dir.y * dashDist;
            // Zabezpieczenie przed wypadnięciem za mapę
            p.x = Math.max(0, Math.min(WORLD_SIZE, p.x));
            p.y = Math.max(0, Math.min(WORLD_SIZE, p.y));
            io.emit('killEvent', { text: `💨 Zryw!`, time: 100 });
        }
    });

    // --- Przełączniki RTS ---
    socket.on('toggleRecruit', () => {
        const p = players[socket.id];
        if (p) {
            p.isRecruiting = !p.isRecruiting;
            socket.emit('recruitToggled', p.isRecruiting);
        }
    });

    socket.on('switchFormation', () => {
        const p = players[socket.id];
        if (p) {
            p.formation = (p.formation + 1) % 4; // Zmiana na 4 stany
            let formName = p.formation === 0 ? "OKRĄG" : (p.formation === 1 ? "KLIN (V)" : (p.formation === 2 ? "LINIA" : "WŁASNA (PPM)"));
            socket.emit('formationSwitched', formName);
        }
    });

    // --- Odbieranie przesuniętych botów z myszki ---
    socket.on('setBotOffset', (data) => {
        const p = players[socket.id];
        let b = bots.find(bot => bot.id === data.botId);
        if (p && b && b.ownerId === p.id) {
            b.angleOffset = data.angleOffset;
            b.distOffset = data.distOffset;
            if (p.formation !== 3) {
                p.formation = 3; // Automatyczna zmiana na "WŁASNA" po dotknięciu
                socket.emit('formationSwitched', "WŁASNA (PPM)");
            }
        }
    });

    // =========================================================
    // POPRAWKA: ULEPSZANIE UMIEJĘTNOŚCI (Zwracamy pełny stan)
    // =========================================================
    socket.on('upgradeSkill', (skillName) => {
        const p = players[socket.id];
        if (p && p.skillPoints > 0) {
            if (skillName === 'strength' && p.score < 100) return; 
            if (skillName === 'weapon' && p.score < 15) return;   

            // LIMIT 20 POZIOMÓW
            let maxLevel = 20;

            if (p.skills[skillName] !== undefined && p.skills[skillName] < maxLevel) {
                p.skills[skillName]++;
                p.skillPoints--;
                // Wysyłamy klientowi CAŁY zaktualizowany obiekt
                socket.emit('skillUpdated', { skills: p.skills, points: p.skillPoints, paths: p.paths });
            }
        }
    });

    // =========================================================
    // POPRAWKA: WYBÓR ŚCIEŻEK (Zwracamy pełny stan)
    // =========================================================
    socket.on('chooseSkillPath', (data) => {
        const p = players[socket.id];
        // data.category = 'weapon'|'speed'|'strength', data.path = 'piercing'|'dash' itp.
        if (p && p.skills[data.category] >= 5 && p.paths[data.category] === 'none') {
            p.paths[data.category] = data.path;
            // Wysyłamy klientowi CAŁY zaktualizowany obiekt
            socket.emit('skillUpdated', { skills: p.skills, points: p.skillPoints, paths: p.paths });
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

        const price = shopPrices[item];

        if (price && p.score >= price) {
            p.score -= price;              
            p.inventory[item] = 1;        
            p.activeWeapon = item;        
            socket.emit('shopSuccess', { item: item });
            
            // --- AKTUALIZACJA ZWERBOWANYCH BOTÓW ---
            // Gdy kupisz sprzęt, przekaż go również zwerbowanym żołnierzom!
            bots.forEach(b => {
                if (b.ownerId === p.id) {
                    b.inventory[item] = 1;
                    b.activeWeapon = item;
                }
            });
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
        
        // Zmiana broni rzutuje na żołnierzy
        bots.forEach(b => {
            if (b.ownerId === p.id) b.activeWeapon = p.activeWeapon;
        });
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
                // --- NOWOŚĆ: ZMIANA Z p.weaponPath NA p.paths.weapon ---
                let isPierce = type === 'sword' ? (p.paths.weapon === 'piercing') : stats.piercing;

                projectiles.push({
                    id: ++entityIdCounter, ownerId: socket.id, ownerTeam: p.team || null, teamInitial: p.team || null,
                    x: data.x, y: data.y, dx: data.dx, dy: data.dy,
                    life: stats.life, speed: stats.speed, isBotSword: false,
                    scoreAtThrow: p.score, isPiercing: isPierce, damage: finalDmg, isWinter: false, projType: type 
                });
            }
        }
    });

    socket.on('throwWinterSword', () => {
        const p = players[socket.id];
        const now = Date.now();
        // --- NOWOŚĆ: ZMIANA Z p.weaponPath NA p.paths.weapon ---
        if (p && p.paths.weapon === 'winter' && now - p.lastWinterUse >= 15000) {
            p.lastWinterUse = now;
            let winterDmg = 15 + (p.skills.weapon * 2);

            projectiles.push({
                id: ++entityIdCounter, ownerId: socket.id, ownerTeam: p.team || null, teamInitial: p.team || null,
                x: p.x, y: p.y - 1000, dx: 0, dy: 1.5, life: 150, speed: 18,
                isBotSword: false, scoreAtThrow: Math.max(700, p.score), isPiercing: true, isWinter: true, damage: winterDmg, projType: 'winter'
            });
        }
    });

    socket.on('disconnect', () => {
        const p = players[socket.id];
        console.log(`\n-------------------------------------------`);
        if (p) console.log(`[WYLOGOWANIE] Gracz >> ${p.name} << opuścił serwer.`);
        delete players[socket.id];
        console.log(`-------------------------------------------\n`);
    });
});

// --- GŁÓWNA PĘTLA SERWERA (30 FPS) ---
setInterval(() => {
    eventTickCounter++;

    // Kary za ucieczkę z mapy
    const pKeysList = Object.keys(players);
    for (let i = pKeysList.length - 1; i >= 0; i--) {
        let pId = pKeysList[i];
        let p = players[pId];
        if (p.x < -10 || p.x > WORLD_SIZE + 10 || p.y < -10 || p.y > WORLD_SIZE + 10) {
            io.emit('killEvent', { text: `${p.name} zginął poza mapą!` }); 
            killPlayer(pId);
        }
    }

    // --- LOGIKA ZAMKÓW I OBLĘŻEŃ (TRYB TEAMS) ---
    Object.values(players).forEach(p => { if (p.team) p.isSafe = false; }); // Reset przed sprawdzeniem

    castles.forEach(c => {
        let defenders = 0;
        let attackers = 0;
        let attackingTeam = null;

        Object.values(players).forEach(p => {
            if (!p.team) return; 
            
            let dist = Math.hypot(p.x - c.x, p.y - c.y);
            if (dist < c.radius) {
                if (p.team === c.owner) {
                    defenders++;
                    p.isSafe = true; // Bezpieczny
                } else {
                    attackers++;
                    attackingTeam = p.team;
                    
                    // PARZENIE INTRUZÓW!
                    if (eventTickCounter % 30 === 0) {
                        let burnDamage = Math.max(2, Math.floor(p.score * 0.05)); 
                        p.score -= burnDamage;
                        if (p.score <= 1) killPlayer(p.id); 
                    }
                }
            }
        });

        // Proces przejmowania (1 sekunda)
        if (eventTickCounter % 30 === 0) {
            if (attackers > defenders && c.owner !== attackingTeam) {
                c.captureProgress += 3.4; // 100% / 3.4 = ~30 sekund
                if (c.captureProgress >= 100) {
                    c.owner = attackingTeam;
                    c.color = TEAM_COLORS[attackingTeam];
                    c.captureProgress = 0;
                    io.emit('killEvent', { text: `🚩 Zamek ${c.id} zdobyty przez drużynę ${attackingTeam}!` });
                }
            } else if (c.captureProgress > 0) {
                c.captureProgress = Math.max(0, c.captureProgress - 3.4); 
            }
        }
    });

    // --- SYSTEM EVENTÓW (Król, Deszcz lub Śnieżyca) ---
    eventTimer++;
    // Odpalaj event co ok. 90 sekund (30 klatek * 90s = 2700)
    if (eventTimer > 2700 && activeEvent === null) {
        let playersArray = Object.values(players);
        let rand = Math.random();
        
        // Losujemy typ eventu (33% szans na Króla, 33% na Deszcz, 33% na Śnieżycę)
        if (rand < 0.33 && playersArray.length > 0) {
            // EVENT: Polowanie na Króla
            playersArray.sort((a, b) => b.score - a.score);
            let topPlayer = playersArray[0];

            if (topPlayer && topPlayer.score >= 50) { 
                currentKingId = topPlayer.id;
                activeEvent = 'KING_HUNT';
                io.emit('killEvent', { text: `👑 EVENT! ${topPlayer.name} ZDOBYŁ KORONĘ! WSZYSCY NA NIEGO!`, time: 300 });

                setTimeout(() => {
                    if (activeEvent === 'KING_HUNT' && players[currentKingId]) {
                        players[currentKingId].score += 500; 
                        io.emit('killEvent', { text: `🛡️ Król ${players[currentKingId].name} przetrwał rzeź! +500 pkt!`, time: 200 });
                    }
                    activeEvent = null;
                    currentKingId = null;
                    eventTimer = 0;
                }, 30000); // 30 sekund
            } else {
                eventTimer = 0; 
            }
        } else if (rand < 0.66) {
            // EVENT: Kwaśny Deszcz
            activeEvent = 'TOXIC_RAIN';
            io.emit('killEvent', { text: `🌧️ KWAŚNY DESZCZ! Uciekaj do bezpiecznej strefy (Zamku)!`, time: 300 });
            
            // Midas ostrzega graczy:
            Object.values(players).forEach(p => {
                if (p.isTutorialActive) io.to(p.id).emit('tutorialTick', { text: getTutorialMessage(p.name, 'toxic_rain') });
            });

            setTimeout(() => {
                activeEvent = null;
                eventTimer = 0;
                io.emit('killEvent', { text: `⛅ Przejaśnia się. Deszcz ustąpił.`, time: 200 });
            }, 25000); // 25 sekund deszczu
        } else {
            // EVENT: Zamięć Śnieżna
            activeEvent = 'BLIZZARD';
            io.emit('killEvent', { text: `❄️ ZAMIĘĆ ŚNIEŻNA! Temperatura spada, wszyscy zwalniają!`, time: 300 });

            // Midas ostrzega graczy:
            Object.values(players).forEach(p => {
                if (p.isTutorialActive) io.to(p.id).emit('tutorialTick', { text: getTutorialMessage(p.name, 'blizzard') });
            });

            setTimeout(() => {
                activeEvent = null;
                eventTimer = 0;
                io.emit('killEvent', { text: `☀️ Śnieżyca ustała. Wracamy do normy.`, time: 200 });
            }, 20000); // 20 sekund śniegu
        }
    }

    // Obrażenia od deszczu (Co około 1 sekundę = 30 ticków)
    if (activeEvent === 'TOXIC_RAIN' && eventTickCounter % 30 === 0) {
        Object.values(players).forEach(p => {
            if (!p.isSafe && p.score > 5) {
                // --- NOWOŚĆ: TYTAN OTRZYMUJE MNIEJ OBRAŻEŃ OD DESZCZU ---
                let dmg = p.paths.strength === 'titan' ? 1 : 2;
                p.score -= dmg;
            }
        });
        bots.forEach(b => {
            if (!b.isSafe && b.score > 5) b.score -= 1;
        });
    }

    // --- NOWOŚĆ: REGENERACJA TYTANA (Gdy stoi w miejscu) ---
    if (eventTickCounter % 30 === 0) { // Co 1 sekundę
        Object.values(players).forEach(p => {
            if (p.paths.strength === 'titan') {
                if (!p.isMoving) p.idleTime++;
                if (p.idleTime >= 3) { // Jeśli stoi 3 sekundy
                    p.score += 2;      // Leczy +2 co sekundę
                }
            }
        });
    }

    // --- SPRAWDZANIE PROGRESU DLA TUTORIALA (SEKWENCJE MIDASA) ---
    Object.values(players).forEach(p => {
        if (!p.isTutorialActive || !p.tutorialFlags) return;

        if (p.score >= 15 && !p.tutorialFlags.m15) {
            p.tutorialFlags.m15 = true;
            io.to(p.id).emit('tutorialTick', { text: getTutorialMessage(p.name, 'mass15') });
        }
        else if (p.score >= 50 && !p.tutorialFlags.m50) {
            p.tutorialFlags.m50 = true;
            io.to(p.id).emit('tutorialTick', { text: getTutorialMessage(p.name, 'mass50') });
        }
        else if (p.score >= 100 && !p.tutorialFlags.m100) {
            p.tutorialFlags.m100 = true;
            io.to(p.id).emit('tutorialTick', { text: getTutorialMessage(p.name, 'mass100') });
        }
    });

    // --- BUDOWA STRUKTURY ARMII DO OBLICZEŃ FORMACJI ---
    let armies = {};
    for(let b of bots) {
        if (b.ownerId) {
            if (!armies[b.ownerId]) armies[b.ownerId] = [];
            armies[b.ownerId].push(b);
        }
    }

    // 1. Logika Ruchu Botów i Formacji
    for (let i = bots.length - 1; i >= 0; i--) {
        let b = bots[i];
        
        let owner = b.ownerId ? players[b.ownerId] : null;

        // --- SKALOWANIE PRĘDKOŚCI BOTA DO GRACZA ---
        let baseBotSpeed = owner ? 2.5 + ((owner.skills.speed || 0) * 0.4) : b.speed;
        
        // --- NOWOŚĆ: LEKKIE STOPY IGNORUJĄ SPADKI SZYBKOŚCI W ŚNIEŻYCY ---
        let isLightweight = owner && owner.paths.speed === 'lightweight';
        let currentBotSpeed = (activeEvent === 'BLIZZARD' && !isLightweight) ? baseBotSpeed * 0.4 : baseBotSpeed;
        
        if (b.ownerId) {
            if (owner && armies[b.ownerId]) {
                // Wyciągamy informacje o roju gracza
                let myIndex = armies[b.ownerId].indexOf(b);
                let total = armies[b.ownerId].length;
                let targetX = owner.x;
                let targetY = owner.y;

                // --- MATEMATYKA FORMACJI WOJSKOWYCH ---
                if (owner.formation === 0) { 
                    // OKRĄG (Rotująca Tarcza)
                    let angleStep = (Math.PI * 2) / total;
                    let currentAngle = (Date.now() / 1500) + (myIndex * angleStep);
                    let radius = 70 + (total * 2); 
                    targetX = owner.x + Math.cos(currentAngle) * radius;
                    targetY = owner.y + Math.sin(currentAngle) * radius;
                } 
                else if (owner.formation === 1) { 
                    // KLIN (Trójkąt V za plecami)
                    let row = Math.floor(myIndex / 2) + 1;
                    let side = myIndex % 2 === 0 ? 1 : -1;
                    if (myIndex === 0) { row = 1; side = 0; } 
                    let spacingX = 45;
                    let spacingY = 35;
                    targetX = owner.x - Math.cos(owner.moveAngle) * (row * spacingX) + Math.cos(owner.moveAngle + Math.PI/2) * (side * row * spacingY);
                    targetY = owner.y - Math.sin(owner.moveAngle) * (row * spacingX) + Math.sin(owner.moveAngle + Math.PI/2) * (side * row * spacingY);
                } 
                else if (owner.formation === 2) { 
                    // LINIA (Falanga pozioma za plecami)
                    let spacing = 45;
                    let offset = (myIndex - (total - 1) / 2) * spacing;
                    targetX = owner.x - Math.cos(owner.moveAngle) * 60 + Math.cos(owner.moveAngle + Math.PI/2) * offset;
                    targetY = owner.y - Math.sin(owner.moveAngle) * 60 + Math.sin(owner.moveAngle + Math.PI/2) * offset;
                }
                else if (owner.formation === 3) {
                    // WŁASNA (Drag & Drop z myszki)
                    targetX = owner.x + Math.cos(owner.moveAngle + b.angleOffset) * b.distOffset;
                    targetY = owner.y + Math.sin(owner.moveAngle + b.angleOffset) * b.distOffset;
                }

                // Przypisanie celu (dla frontu do rysowania "duchów")
                b.targetX = targetX;
                b.targetY = targetY;

                // Fizyka podążania do punktu
                let distToTarget = Math.hypot(targetX - b.x, targetY - b.y);
                if (distToTarget > 10) { 
                    b.angle = Math.atan2(targetY - b.y, targetX - b.x);
                    let speedMult = distToTarget > 120 ? 1.8 : (distToTarget > 40 ? 1.3 : 0.8);
                    b.x += Math.cos(b.angle) * (currentBotSpeed * speedMult);
                    b.y += Math.sin(b.angle) * (currentBotSpeed * speedMult);
                }
                
                // STRZELANIE BOTÓW ZWERBOWANYCH W STRONĘ CELÓW
                if (Math.random() < 0.05) { // 5% szansy w każdej klatce na oddanie rzutu/strzału
                    let type = b.activeWeapon;
                    let stats = weaponStats[type];
                    
                    if (stats && b.score >= stats.cost + 5) { // Muszą mieć zapas punktów na rzut
                        // Poszukiwanie najbliższego wroga w promieniu rażenia (nie z naszej drużyny)
                        let target = null;
                        let minBotDist = 400; // Zasięg "wzroku" botów
                        
                        Object.values(players).forEach(p2 => {
                            if (p2.id !== owner.id && (!owner.team || owner.team !== p2.team)) {
                                let d = Math.hypot(b.x - p2.x, b.y - p2.y);
                                if (d < minBotDist) { minBotDist = d; target = p2; }
                            }
                        });
                        
                        if (!target) {
                            bots.forEach(b2 => {
                                if (b2.id !== b.id && b2.ownerId !== owner.id && (!owner.team || owner.team !== b2.team)) {
                                    let d = Math.hypot(b.x - b2.x, b.y - b2.y);
                                    if (d < minBotDist) { minBotDist = d; target = b2; }
                                }
                            });
                        }

                        // Jeżeli bot namierzył wroga, strzela w jego stronę
                        if (target) {
                            b.score -= stats.cost;
                            let aimAngle = Math.atan2(target.y - b.y, target.x - b.x);

                            // --- SKALOWANIE OBRAŻEŃ BOTA DO GRACZA ---
                            // ZMIANA: p.weaponPath zaktualizowane do owner.paths.weapon
                            let botPierce = type === 'sword' ? (owner.paths.weapon === 'piercing') : stats.piercing;
                            let botFinalDmg = type === 'sword' ? stats.dmg + ((owner.skills.weapon || 0) * 1) : stats.dmg;

                            projectiles.push({
                                id: ++entityIdCounter, ownerId: owner.id, ownerTeam: owner.team || null, teamInitial: owner.team || null,
                                x: b.x, y: b.y, dx: Math.cos(aimAngle), dy: Math.sin(aimAngle),
                                life: stats.life, speed: stats.speed, isBotSword: true,
                                scoreAtThrow: b.score, isPiercing: botPierce, damage: botFinalDmg, isWinter: false, projType: type
                            });
                        }
                    }
                }

            } else if (!owner) {
                // CZYSZCZENIE BOTÓW JEŚLI GRACZ WYSZEDŁ
                b.ownerId = null;
                b.team = null;
                b.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
                botNameCounter++;
                b.name = `Bot AI #${botNameCounter}`;
                b.targetX = 0;
                b.targetY = 0;
                b.inventory = { bow: 0, knife: 0, shuriken: 0 };
                b.activeWeapon = 'sword';
            }
        } else {
            // --- AI DZIKICH BOTÓW ---
            let isHuntingKing = false;
            
            // Jeśli trwa event i Król żyje (i nie chowa się w bezpiecznej strefie)
            if (activeEvent === 'KING_HUNT' && currentKingId && players[currentKingId]) {
                let king = players[currentKingId];
                if (!king.isSafe) {
                    isHuntingKing = true;
                    b.angle = Math.atan2(king.y - b.y, king.x - b.x);
                    b.x += Math.cos(b.angle) * (currentBotSpeed * 1.5);
                    b.y += Math.sin(b.angle) * (currentBotSpeed * 1.5);
                    b.color = '#c0392b'; 
                }
            }

            // Normalny, losowy ruch
            if (!isHuntingKing) {
                if (Math.random() < 0.02) b.angle = Math.random() * Math.PI * 2;
                b.x += Math.cos(b.angle) * currentBotSpeed;
                b.y += Math.sin(b.angle) * currentBotSpeed;
                if (b.color === '#c0392b') b.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
            }

            // Odbijanie od ścian
            if (b.x < 0 || b.x > WORLD_SIZE) b.angle = Math.PI - b.angle;
            if (b.y < 0 || b.y > WORLD_SIZE) b.angle = -b.angle;
            
            // Strzelanie dzikich botów
            if (Math.random() < 0.01) {
                let type = b.activeWeapon;
                let stats = weaponStats[type];
                if (stats && b.score >= stats.cost + 5) {
                    b.score -= stats.cost;
                    projectiles.push({
                        id: ++entityIdCounter, ownerId: b.ownerId || b.id, ownerTeam: null, teamInitial: null,
                        x: b.x, y: b.y, dx: Math.cos(b.angle), dy: Math.sin(b.angle),
                        life: stats.life, speed: stats.speed, isBotSword: true,
                        scoreAtThrow: b.score, isPiercing: stats.piercing, damage: stats.dmg, isWinter: false, projType: type
                    });
                }
            }
        }

        // --- Boty i Zwerbowane Boty Jedzą Kropki ---
        foods.forEach((f, fi) => {
            if (Math.hypot(b.x - f.x, b.y - f.y) < 25) {
                b.score += 1;
                foods[fi] = spawnFood();
            }
        });
        
        // Zwerbowane boty oddają masę właścicielowi, jeśli urosły za duże!
        if (b.ownerId && b.score > 15) {
            let p = players[b.ownerId];
            if (p) {
                let transfer = Math.floor(b.score - 15);
                b.score -= transfer;
                p.score += transfer;
            }
        }
    }

    // 2. Bot zjada Bota 
    for (let i = 0; i < bots.length; i++) {
        for (let j = i + 1; j < bots.length; j++) {
            let b1 = bots[i];
            let b2 = bots[j];
            if (b1.ownerId && b1.ownerId === b2.ownerId) continue;
            
            // --- BLOKADA FRIENDLY FIRE DLA BOTÓW W DRUŻYNIE ---
            if (b1.ownerId && b2.ownerId) {
                let p1 = players[b1.ownerId]; let p2 = players[b2.ownerId];
                if (p1 && p2 && p1.team && p2.team && p1.team === p2.team) continue;
            }

            let dist = Math.hypot(b1.x - b2.x, b1.y - b2.y);
            let r1 = 25 * (1 + Math.pow(Math.max(0, b1.score - 1), 0.45) * 0.15);
            let r2 = 25 * (1 + Math.pow(Math.max(0, b2.score - 1), 0.45) * 0.15);

            if (dist < r1 && b1.score > b2.score * 1.15) {
                io.emit('killEvent', { text: `${b1.name} pożarł ${b2.name}` }); 
                b1.score += Math.floor(b2.score * 0.5);
                bots[j] = spawnBot(); 
            } else if (dist < r2 && b2.score > b1.score * 1.15) {
                io.emit('killEvent', { text: `${b2.name} pożarł ${b1.name}` }); 
                b2.score += Math.floor(b1.score * 0.5);
                bots[i] = spawnBot(); 
            }
        }
    }

    // 3. Kolizje Graczy (Jedzenie, Boty) - ODDZIELONA REKRUTACJA
    Object.values(players).forEach(p => {
        if (!players[p.id]) return; 

        let pRadius = 25 * (1 + Math.pow(Math.max(0, p.score - 1), 0.45) * 0.15);

        foods.forEach((f, fi) => {
            if (Math.hypot(p.x - f.x, p.y - f.y) < pRadius) {
                p.score += 1;
                foods[fi] = spawnFood();
            }
        });

        // --- ZBIERANIE LOOTU (SKRZYNEK) ---
        loots.forEach((l, li) => {
            if (Math.hypot(p.x - l.x, p.y - l.y) < pRadius + 15) {
                if (l.type === 'mass') {
                    p.score += 100;
                    io.emit('killEvent', { text: `🎁 ${p.name} znalazł złoże Masy (+100)!` }); 
                } else if (l.type === 'skill') {
                    p.skillPoints++;
                    io.to(p.id).emit('levelUp', { level: p.level, points: p.skillPoints });
                    io.emit('killEvent', { text: `📘 ${p.name} odnalazł Księgę Wiedzy!` }); 
                } else if (l.type === 'weapon') {
                    p.inventory['knife'] = 1;
                    p.activeWeapon = 'knife';
                    io.emit('killEvent', { text: `🗡️ ${p.name} znalazł Nóż w skrzynce!` }); 
                }
                loots[li] = spawnLoot(); // Odradzamy skrzynkę w nowym miejscu
            }
        });

        bots.forEach((b, bi) => {
            let dist = Math.hypot(p.x - b.x, p.y - b.y);
            let bRadius = 25 * (1 + Math.pow(Math.max(0, b.score - 1), 0.45) * 0.15);

            if (!p.isSafe) {
                if (b.ownerId !== p.id) {
                    // --- BLOKADA JEDZENIA BOTÓW Z TEJ SAMEJ DRUŻYNY ---
                    let ownerPlayer = players[b.ownerId];
                    if (p.team && ownerPlayer && ownerPlayer.team === p.team) return;

                    // ========================================================
                    // NOWOŚĆ: KAMIKAZE BOTY NA KRÓLA (Koniec darmowego jedzenia!)
                    // ========================================================
                    if (activeEvent === 'KING_HUNT' && p.id === currentKingId && b.ownerId !== p.id) {
                        if (dist < pRadius) {
                            p.score = Math.max(10, p.score - 15); // Bot wgryza się w Króla zabierając masę
                            io.emit('damageText', { x: p.x, y: p.y - 30, val: 15, color: '#f1c40f' });
                            bots[bi] = spawnBot(); // Bot ginie w ataku samobójczym
                            return; // Przerywamy logikę jedzenia, Król nie dostaje z niego masy
                        }
                    }

                    if (dist < pRadius && p.score > b.score * 1.15) {
                        if (p.isRecruiting) {
                            // TRYB WERBOWANIA
                            io.emit('killEvent', { text: `${p.name} zwerbował wojownika!` }); 
                            b.ownerId = p.id;
                            b.team = p.team; // Przejęcie koloru / drużyny (dla Teams)
                            b.score = 5; 
                            b.color = p.color; 
                            b.name = `Wojownik`; 
                            
                            // Wyposaża od razu zwerbowanego bota w tę samą broń co gracz!
                            b.activeWeapon = p.activeWeapon;
                            if (p.activeWeapon !== 'sword') b.inventory[p.activeWeapon] = 1;

                            let dx = b.x - p.x;
                            let dy = b.y - p.y;
                            b.distOffset = Math.hypot(dx, dy);
                            b.angleOffset = Math.atan2(dy, dx) - p.moveAngle;

                        } else {
                            // TRYB POŻERANIA
                            io.emit('killEvent', { text: `${p.name} pożarł ${b.name}` }); 
                            p.score += Math.floor(b.score * 0.5);
                            bots[bi] = spawnBot(); 
                        }
                        io.to(p.id).emit('botEaten', { newScore: p.score });
                    }
                    else if (dist < bRadius && b.score > p.score * 1.15) {
                        io.emit('killEvent', { text: `${b.name} pożarł ${p.name}` }); 
                        b.score += Math.floor(p.score * 0.5);
                        killPlayer(p.id); 
                    }
                }
            }
        });
    });

    // Gracz zjada Gracza (PvP)
    const pKeys = Object.keys(players);
    for (let i = 0; i < pKeys.length; i++) {
        for (let j = i + 1; j < pKeys.length; j++) {
            let p1 = players[pKeys[i]];
            let p2 = players[pKeys[j]];
            if (!p1 || !p2 || p1.isSafe || p2.isSafe) continue; 
            
            // --- BLOKADA FRIENDLY FIRE ---
            if (p1.team && p2.team && p1.team === p2.team) continue;

            let dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            let r1 = 25 * (1 + Math.pow(Math.max(0, p1.score - 1), 0.45) * 0.15);
            let r2 = 25 * (1 + Math.pow(Math.max(0, p2.score - 1), 0.45) * 0.15);

            if (dist < r1 && p1.score > p2.score * 1.15) {
                io.emit('killEvent', { text: `${p1.name} wyeliminował ${p2.name}!` }); 
                p1.score += Math.floor(p2.score * 0.5);
                killPlayer(p2.id); 
            } else if (dist < r2 && p2.score > p1.score * 1.15) {
                io.emit('killEvent', { text: `${p2.name} wyeliminował ${p1.name}!` }); 
                p2.score += Math.floor(p1.score * 0.5);
                killPlayer(p1.id); 
            }
        }
    }

    // 4. Fizyka Mieczy
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.dx * p.speed;
        p.y += p.dy * p.speed;
        p.life--;

        bots.forEach((b) => {
            let hitRange = p.isWinter ? 60 : 30; 
            if (p.ownerId !== b.id && p.ownerId !== b.ownerId && Math.hypot(p.x - b.x, p.y - b.y) < hitRange) {
                // Zapobiegaj biciu botów ze swojej drużyny
                if (b.ownerId && players[b.ownerId] && p.ownerTeam === players[b.ownerId].team) return;
                // Zapobiegaj zwerbowanym botom bicia dzikich botów, jeśli nie chcemy by się krzywdziły bezcelowo
                if (p.ownerTeam && !b.team) return;

                b.score = Math.max(1, b.score - p.damage);
                io.emit('damageText', { x: b.x, y: b.y - 20, val: p.damage, color: '#fff' });

                if (!p.isPiercing) p.life = 0; 
            }
        });

        Object.values(players).forEach(pl => {
            let hitRange = p.isWinter ? 60 : 30;
            if (p.ownerId !== pl.id && Math.hypot(p.x - pl.x, p.y - pl.y) < hitRange) {
                // --- BLOKADA FRIENDLY FIRE Z BRONI DYSTANSOWEJ ---
                if (p.ownerTeam && p.ownerTeam === pl.team) return;

                if (pl.isShielding && !p.isWinter) {
                    if (!p.isPiercing) p.life = 0; 
                } else {
                    let damage = p.damage;
                    if (pl.score >= 800) { damage -= 4; if (pl.armorHits < 3 && !p.isWinter) { damage = 0; pl.armorHits++; } } 
                    else if (pl.score >= 400) { damage -= 3; } 
                    else if (pl.score >= 100) { damage -= 2; }

                    let strengthReduction = Math.floor((pl.skills.strength || 0) / 10);
                    damage -= strengthReduction;
                    damage = Math.max(1, damage); 
                    if (p.isWinter) damage = p.damage;

                    pl.score = Math.max(1, pl.score - Math.floor(damage));
                    
                    // Obrażenia po trafieniu gracza
                    io.emit('damageText', { x: pl.x, y: pl.y - 30, val: Math.floor(damage), color: '#ff4757' });
                    
                    // ========================================================
                    // NOWOŚĆ: UMIEJĘTNOŚĆ KOLCE (THORNS) - ODBIJA 25% OBRAŻEŃ
                    // ========================================================
                    if (pl.paths.strength === 'thorns') {
                        let attacker = players[p.ownerId];
                        if (attacker) {
                            let reflectDmg = Math.max(1, Math.floor(damage * 0.25));
                            attacker.score = Math.max(1, attacker.score - reflectDmg);
                            // Pomarańczowe obrażenia jako sygnał odbicia
                            io.emit('damageText', { x: attacker.x, y: attacker.y - 30, val: reflectDmg, color: '#e67e22' });
                        }
                    }

                    if (!p.isPiercing) p.life = 0;
                }
            }
        });
        if (p.life <= 0) projectiles.splice(i, 1);
    }

    Object.values(players).forEach(p => {
        let skillsChanged = false;
        if (p.score < 100 && p.skills.strength > 0) { p.skills.strength = 0; skillsChanged = true; }
        // ZMIANA na paths.weapon
        if (p.score < 15 && (p.skills.weapon > 0 || p.paths.weapon !== 'none' || p.activeWeapon !== 'sword')) {
            p.skills.weapon = 0; p.paths.weapon = 'none'; p.activeWeapon = 'sword'; skillsChanged = true;
        }
        if (skillsChanged) io.to(p.id).emit('skillUpdated', { skills: p.skills, points: p.skillPoints, paths: p.paths });
    });

    let eventTimeLeft = Math.max(0, Math.floor((2700 - eventTimer) / 30));
    io.emit('serverTick', { players, bots, foods, projectiles, loots, activeEvent, eventTimeLeft, castles });
}, 33);

// ==========================================
// MIDAS - WIRTUALNY PRZEWODNIK (ZAPROGRAMOWANY)
// ==========================================
function getTutorialMessage(playerName, eventType) {
    const messages = {
        'join': `Witaj na arenie XD, ${playerName}! Jestem Midas. Zbieraj pomarańczowe kropki i skrzynki z "?", by urosnąć. Uciekaj przed większymi!`,
        'mass15': `Świetnie, masz 15 masy! Odblokowałeś Rzut Mieczem. Kliknij LPM (Myszka), by rzucić. Koszt: 2 pkt masy. Celuj uważnie!`,
        'mass50': `Połowa drogi do potęgi (50 masy)! Możesz teraz używać Tarczy. Przytrzymaj [Q], by odbijać ataki.`,
        'mass100': `Niesamowite, 100 masy (5 poziom)! Szybko, użyj plusików po lewej i wybierz klasę (np. Zryw pod [SHIFT] lub Zimowy Miecz [R]).`,
        'toxic_rain': `Uwaga! Kwaśny Deszcz! 🌧️ Szybko chowaj się pod dachem Zamku, inaczej deszcz wypali Twoją masę!`,
        'blizzard': `Brrr... Śnieżyca! ❄️ Wszyscy zwalniają. To idealny moment, by rzucać mieczami w powolne cele!`
    };
    return messages[eventType] || `Walcz dzielnie, ${playerName}!`;
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` SERWER Xtreme Destiny (XD) DZIAŁA `);
    console.log(` Port nasłuchiwania: ${PORT} `);
    console.log(`=========================================`);
});
