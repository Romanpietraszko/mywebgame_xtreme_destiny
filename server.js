const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

// --- KONFIGURACJA ŚWIATA ---
const WORLD_SIZE = 4000;
const MAX_FOODS = 200;
const MAX_BOTS = 80; // <--- ZWIĘKSZONA LICZBA BOTÓW (PRAWDZIWA WOJNA!)

const players = {};
let foods = [];
let bots = [];
let projectiles = []; // Miecze rzucane na E
let entityIdCounter = 0;
let botNameCounter = 0;

// --- ZMIENNE EVENTOWE (NOWOŚĆ) ---
let activeEvent = null; 
let eventTimer = 0;     
let currentKingId = null; 

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
        // --- DETRONIZACJA (NOWOŚĆ) ---
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

io.on('connection', (socket) => {
    console.log(`\n===========================================`);
    console.log(`[SOCKET INFO] Nowe połączenie. ID: ${socket.id}`);
    console.log(`===========================================\n`);

    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            x: 2000,
            y: 2000,
            score: 0, 
            level: 1,
            skillPoints: 0,
            skills: { speed: 0, strength: 0, weapon: 0 },
            weaponPath: 'none', 
            lastWinterUse: 0,   
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
            moveAngle: 0         // Kierunek biegu gracza do formacji
        };
        socket.emit('init', { id: socket.id });

        console.log(`\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`);
        console.log(`[NOWY GRACZ] >> ${players[socket.id].name} << wszedł do gry!`);
        console.log(`<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n`);
    });

    socket.on('playerMovement', (data) => {
        const p = players[socket.id];
        if (p) {
            // Obliczamy kąt ruchu dla formacji
            if (data.x !== p.x || data.y !== p.y) {
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

    socket.on('upgradeSkill', (skillName) => {
        const p = players[socket.id];
        if (p && p.skillPoints > 0) {
            if (skillName === 'strength' && p.score < 100) return; 
            if (skillName === 'weapon' && p.score < 15) return;   

            let maxLevel = (skillName === 'speed') ? 10 : 100;

            if (p.skills[skillName] !== undefined && p.skills[skillName] < maxLevel) {
                p.skills[skillName]++;
                p.skillPoints--;
                socket.emit('skillUpdated', { skills: p.skills, points: p.skillPoints, weaponPath: p.weaponPath });
            }
        }
    });

    socket.on('chooseWeaponPath', (path) => {
        const p = players[socket.id];
        if (p && p.skills.weapon >= 5 && p.weaponPath === 'none') {
            if (path === 'piercing' || path === 'winter') {
                p.weaponPath = path;
                socket.emit('skillUpdated', { skills: p.skills, points: p.skillPoints, weaponPath: p.weaponPath });
            }
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
                let isPierce = type === 'sword' ? (p.weaponPath === 'piercing') : stats.piercing;

                projectiles.push({
                    id: ++entityIdCounter, ownerId: socket.id,
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
        if (p && p.weaponPath === 'winter' && now - p.lastWinterUse >= 15000) {
            p.lastWinterUse = now;
            let winterDmg = 15 + (p.skills.weapon * 2);

            projectiles.push({
                id: ++entityIdCounter, ownerId: socket.id,
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

    // --- EVENTY SERWEROWE (NOWOŚĆ) ---
    eventTimer++;
    // Odpalaj event co ok. 90 sekund (30 klatek * 90s = 2700)
    if (eventTimer > 2700 && activeEvent === null) {
        let playersArray = Object.values(players);
        if (playersArray.length > 0) {
            // Znajdź gracza z największą liczbą punktów
            playersArray.sort((a, b) => b.score - a.score);
            let topPlayer = playersArray[0];

            if (topPlayer && topPlayer.score >= 50) { // Król musi mieć chociaż 50 pkt
                currentKingId = topPlayer.id;
                activeEvent = 'KING_HUNT';
                io.emit('killEvent', { text: `👑 EVENT! ${topPlayer.name} ZDOBYŁ KORONĘ! WSZYSCY NA NIEGO!`, time: 300 });

                // Event trwa 30 sekund
                setTimeout(() => {
                    if (activeEvent === 'KING_HUNT' && players[currentKingId]) {
                        // Król przetrwał!
                        players[currentKingId].score += 500; // Nagroda za przetrwanie
                        io.emit('killEvent', { text: `🛡️ Król ${players[currentKingId].name} przetrwał rzeź! +500 pkt!`, time: 200 });
                    }
                    activeEvent = null;
                    currentKingId = null;
                    eventTimer = 0;
                }, 30000);
            } else {
                eventTimer = 0; // Nikt nie spełnia warunków, resetujemy i czekamy dalej
            }
        }
    }

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
        
        if (b.ownerId) {
            let owner = players[b.ownerId];
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
                    let radius = 70 + (total * 2); // Koło rośnie wraz z ilością
                    targetX = owner.x + Math.cos(currentAngle) * radius;
                    targetY = owner.y + Math.sin(currentAngle) * radius;
                } 
                else if (owner.formation === 1) { 
                    // KLIN (Trójkąt V za plecami)
                    let row = Math.floor(myIndex / 2) + 1;
                    let side = myIndex % 2 === 0 ? 1 : -1;
                    if (myIndex === 0) { row = 1; side = 0; } // Dowódca tuż za graczem
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
                    // Płynne dostosowanie prędkości (doganianie)
                    let speedMult = distToTarget > 120 ? 1.8 : (distToTarget > 40 ? 1.3 : 0.8);
                    b.x += Math.cos(b.angle) * (b.speed * speedMult);
                    b.y += Math.sin(b.angle) * (b.speed * speedMult);
                }
            } else {
                b.ownerId = null;
                b.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
                botNameCounter++;
                b.name = `Bot AI #${botNameCounter}`;
                b.targetX = 0;
                b.targetY = 0;
            }
        } else {
            // --- AI DZIKICH BOTÓW (NOWOŚĆ - POLOWANIE NA KRÓLA) ---
            let isHuntingKing = false;
            
            // Jeśli trwa event i Król żyje (i nie chowa się w bezpiecznej strefie)
            if (activeEvent === 'KING_HUNT' && currentKingId && players[currentKingId]) {
                let king = players[currentKingId];
                if (!king.isSafe) {
                    isHuntingKing = true;
                    // Bot kieruje się prosto na Króla!
                    b.angle = Math.atan2(king.y - b.y, king.x - b.x);
                    // Szał bitewny - szybszy bieg i czerwony kolor
                    b.x += Math.cos(b.angle) * (b.speed * 1.5);
                    b.y += Math.sin(b.angle) * (b.speed * 1.5);
                    b.color = '#c0392b'; 
                }
            }

            // Normalny, losowy ruch, jeśli nie gonią Króla
            if (!isHuntingKing) {
                if (Math.random() < 0.02) b.angle = Math.random() * Math.PI * 2;
                b.x += Math.cos(b.angle) * b.speed;
                b.y += Math.sin(b.angle) * b.speed;
                // Powrót do losowego koloru, jeśli event się skończył
                if (b.color === '#c0392b') b.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
            }

            // Odbijanie od ścian
            if (b.x < 0 || b.x > WORLD_SIZE) b.angle = Math.PI - b.angle;
            if (b.y < 0 || b.y > WORLD_SIZE) b.angle = -b.angle;
        }

        // Strzelanie dzikich botów
        if (Math.random() < 0.01) {
            let type = b.activeWeapon;
            let stats = weaponStats[type];
            if (stats && b.score >= stats.cost + 5) {
                b.score -= stats.cost;
                projectiles.push({
                    id: ++entityIdCounter, ownerId: b.ownerId || b.id,
                    x: b.x, y: b.y, dx: Math.cos(b.angle), dy: Math.sin(b.angle),
                    life: stats.life, speed: stats.speed, isBotSword: true,
                    scoreAtThrow: b.score, isPiercing: stats.piercing, damage: stats.dmg, isWinter: false, projType: type
                });
            }
        }

        foods.forEach((f, fi) => {
            if (Math.hypot(b.x - f.x, b.y - f.y) < 25) {
                b.score += 1;
                foods[fi] = spawnFood();
            }
        });
    }

    // 2. Bot zjada Bota 
    for (let i = 0; i < bots.length; i++) {
        for (let j = i + 1; j < bots.length; j++) {
            let b1 = bots[i];
            let b2 = bots[j];
            if (b1.ownerId && b1.ownerId === b2.ownerId) continue;
            
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

        bots.forEach((b, bi) => {
            let dist = Math.hypot(p.x - b.x, p.y - b.y);
            let bRadius = 25 * (1 + Math.pow(Math.max(0, b.score - 1), 0.45) * 0.15);

            if (!p.isSafe) {
                if (dist < pRadius && p.score > b.score * 1.15 && b.ownerId !== p.id) {
                    
                    if (p.isRecruiting) {
                        // TRYB WERBOWANIA (Zero zdobywanej masy, armia rośnie)
                        io.emit('killEvent', { text: `${p.name} zwerbował wojownika!` }); 
                        b.ownerId = p.id;
                        b.score = 5; 
                        b.color = p.color; 
                        b.name = `Wojownik`; 
                        
                        // Zapisanie relatywnej pozycji w momencie rekrutacji
                        let dx = b.x - p.x;
                        let dy = b.y - p.y;
                        b.distOffset = Math.hypot(dx, dy);
                        b.angleOffset = Math.atan2(dy, dx) - p.moveAngle;

                    } else {
                        // TRYB POŻERANIA (Brak rekrutacji, nowa masa, bot się odradza)
                        io.emit('killEvent', { text: `${p.name} pożarł ${b.name}` }); 
                        p.score += Math.floor(b.score * 0.5);
                        bots[bi] = spawnBot(); // Ważne: Respawnujemy bota na mapie!
                    }
                    io.to(p.id).emit('botEaten', { newScore: p.score });
                }
                else if (dist < bRadius && b.score > p.score * 1.15 && b.ownerId !== p.id) {
                    io.emit('killEvent', { text: `${b.name} pożarł ${p.name}` }); 
                    b.score += Math.floor(p.score * 0.5);
                    killPlayer(p.id); 
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
                b.score = Math.max(1, b.score - p.damage);
                if (!p.isPiercing) p.life = 0; 
            }
        });

        Object.values(players).forEach(pl => {
            let hitRange = p.isWinter ? 60 : 30;
            if (p.ownerId !== pl.id && Math.hypot(p.x - pl.x, p.y - pl.y) < hitRange) {
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
                    if (!p.isPiercing) p.life = 0;
                }
            }
        });
        if (p.life <= 0) projectiles.splice(i, 1);
    }

    Object.values(players).forEach(p => {
        let skillsChanged = false;
        if (p.score < 100 && p.skills.strength > 0) { p.skills.strength = 0; skillsChanged = true; }
        if (p.score < 15 && (p.skills.weapon > 0 || p.weaponPath !== 'none' || p.activeWeapon !== 'sword')) {
            p.skills.weapon = 0; p.weaponPath = 'none'; p.activeWeapon = 'sword'; skillsChanged = true;
        }
        if (skillsChanged) io.to(p.id).emit('skillUpdated', { skills: p.skills, points: p.skillPoints, weaponPath: p.weaponPath });
    });

    io.emit('serverTick', { players, bots, foods, projectiles });
}, 33);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` SERWER Xtreme Destiny (XD) DZIAŁA `);
    console.log(` Port nasłuchiwania: ${PORT} `);
    console.log(`=========================================`);
});
