const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

// --- KONFIGURACJA ŚWIATA ---
const WORLD_SIZE = 4000;
const MAX_FOODS = 200;
const MAX_BOTS = 25;

const players = {};
let foods = [];
let bots = [];
let projectiles = []; // Miecze rzucane na E
let entityIdCounter = 0;
let botNameCounter = 0; // NOWOŚĆ: Numery dla botów

// --- NOWOŚĆ: Statystyki wszystkich poziomów broni ---
const weaponStats = {
    'sword': { dmg: 5, life: 60, speed: 18, cost: 2, piercing: false },
    // Łuki
    'bow': { dmg: 8, life: 90, speed: 26, cost: 2, piercing: false },
    'golden_bow': { dmg: 16, life: 100, speed: 30, cost: 5, piercing: false },
    'diamond_bow': { dmg: 30, life: 120, speed: 35, cost: 10, piercing: true },
    'crossbow': { dmg: 50, life: 140, speed: 45, cost: 20, piercing: true },
    'shotgun': { dmg: 100, life: 40, speed: 50, cost: 50, piercing: true }, // Krótki zasięg, miazga!
    // Noże
    'knife': { dmg: 12, life: 30, speed: 22, cost: 2, piercing: false },
    'golden_knife': { dmg: 24, life: 35, speed: 25, cost: 5, piercing: false },
    'diamond_knife': { dmg: 45, life: 40, speed: 28, cost: 10, piercing: true },
    'hunting_knife': { dmg: 80, life: 45, speed: 32, cost: 20, piercing: true },
    'cleaver': { dmg: 150, life: 50, speed: 35, cost: 40, piercing: true },
    // Shurikeny
    'shuriken': { dmg: 4, life: 45, speed: 20, cost: 2, piercing: false },
    'golden_shuriken': { dmg: 10, life: 55, speed: 24, cost: 4, piercing: false },
    'diamond_shuriken': { dmg: 20, life: 65, speed: 28, cost: 8, piercing: true },
    'chakram': { dmg: 40, life: 75, speed: 32, cost: 15, piercing: true },
    'explosive_kunai': { dmg: 75, life: 85, speed: 38, cost: 30, piercing: true }
};

// --- POMOCNICZA FUNKCJA: PERMANENTNA ŚMIERĆ ---
function killPlayer(pId) {
    const p = players[pId];
    if (p) {
        // Wysyłamy informację o końcu gry tylko do zabitego gracza
        io.to(p.id).emit('gameOver', { finalScore: p.score });
        console.log(`Gracz ${p.name} został zjedzony lub zginął poza mapą! GAME OVER.`);
        // Bezlitośnie usuwamy gracza z serwera
        delete players[pId];
    }
}

// --- FUNKCJE GENERUJĄCE ---
function spawnFood() {
    return { id: ++entityIdCounter, x: Math.random() * WORLD_SIZE, y: Math.random() * WORLD_SIZE };
}

function spawnBot() {
    botNameCounter++;
    return {
        id: `bot_${++entityIdCounter}`,
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        score: 0, // ZMIANA: Boty też zaczynają od zera!
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        name: `Bot AI #${botNameCounter}`, // Unikalne numery!
        angle: Math.random() * Math.PI * 2,
        speed: 2.5,
        // Boty rodzą się z ekwipunkiem
        inventory: { bow: 0, knife: 0, shuriken: 0 },
        activeWeapon: 'sword'
    };
}

// Inicjalizacja zasobów na starcie serwera
for (let i = 0; i < MAX_FOODS; i++) foods.push(spawnFood());
for (let i = 0; i < MAX_BOTS; i++) bots.push(spawnBot());

// --- LOGIKA POŁĄCZEŃ ---
io.on('connection', (socket) => {
    console.log(`Nowy gracz połączony: ${socket.id}`);

    socket.on('joinGame', (data) => {
        players[socket.id] = {
            id: socket.id,
            x: 2000,
            y: 2000,
            score: 0, // ZMIANA: Zmiana startowego score (masa 0)
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
            // Baza pod sklep zamkowy i ekwipunek
            inventory: { bow: 0, knife: 0, shuriken: 0 },
            activeWeapon: 'sword'
        };
        socket.emit('init', { id: socket.id });
    });

    // Ruch gracza i synchronizacja progresji
    socket.on('playerMovement', (data) => {
        const p = players[socket.id];
        if (p) {
            p.x = data.x;
            p.y = data.y;
            p.isSafe = data.isSafe;
            p.isShielding = data.isShielding; 

            // Logika awansu (Level Up)
            let newLevel = Math.floor(p.score / 20) + 1;
            if (newLevel > p.level) {
                p.level = newLevel;
                p.skillPoints++;
                socket.emit('levelUp', { level: p.level, points: p.skillPoints });
            }
        }
    });

    // --- SYSTEM ULEPSZANIA Z BLOKADAMI ---
    socket.on('upgradeSkill', (skillName) => {
        const p = players[socket.id];
        if (p && p.skillPoints > 0) {
            
            // Wymagania posiadania ekwipunku
            if (skillName === 'strength' && p.score < 100) return; // Wymaga Zbroi
            if (skillName === 'weapon' && p.score < 15) return;    // Wymaga Miecza

            // Szybkość do 10, Siła i Broń do 100
            let maxLevel = (skillName === 'speed') ? 10 : 100;

            if (p.skills[skillName] !== undefined && p.skills[skillName] < maxLevel) {
                p.skills[skillName]++;
                p.skillPoints--;
                socket.emit('skillUpdated', { skills: p.skills, points: p.skillPoints, weaponPath: p.weaponPath });
            }
        }
    });

    // --- WYBÓR ŚCIEŻKI BRONI ---
    socket.on('chooseWeaponPath', (path) => {
        const p = players[socket.id];
        if (p && p.skills.weapon >= 5 && p.weaponPath === 'none') {
            if (path === 'piercing' || path === 'winter') {
                p.weaponPath = path;
                socket.emit('skillUpdated', { skills: p.skills, points: p.skillPoints, weaponPath: p.weaponPath });
            }
        }
    });

    // --- LOGIKA SKLEPU ZAMKOWEGO (ZAKTUALIZOWANA) ---
    socket.on('buyShopItem', (item) => {
        const p = players[socket.id];
        
        // 1. Zabezpieczenie: Czy gracz istnieje i CZY JEST W ZAMKU?
        if (!p || !p.isSafe) {
            socket.emit('shopError', { message: "Musisz być w zamku, aby kupować!" });
            return;
        }

        // NOWY Cennik broni (ze wszystkimi tierami)
        const shopPrices = {
            'bow': 100, 'golden_bow': 250, 'diamond_bow': 500, 'crossbow': 1000, 'shotgun': 2000,
            'knife': 50, 'golden_knife': 150, 'diamond_knife': 350, 'hunting_knife': 700, 'cleaver': 1200,
            'shuriken': 20, 'golden_shuriken': 80, 'diamond_shuriken': 200, 'chakram': 500, 'explosive_kunai': 1000
        };

        const price = shopPrices[item];

        // 2. Transakcja i dodanie do ekwipunku
        if (price && p.score >= price) {
            p.score -= price;             
            p.inventory[item] = 1;        
            p.activeWeapon = item;        
            
            socket.emit('shopSuccess', { item: item });
            console.log(`${p.name} kupił ${item}. Zostało mu ${p.score} masy.`);
        } else {
            socket.emit('shopError', { message: "Za mało punktów masy!" });
        }
    });

    // --- ZMIANA BRONI (Klawisze 1 i 2) ---
    socket.on('switchWeapon', (slot) => {
        const p = players[socket.id];
        if(!p) return;
        
        if (slot === 1) {
            p.activeWeapon = 'sword';
        } else if (slot === 2) {
            // Szukamy najlepszej broni jaką gracz posiada
            const types = ['shotgun', 'crossbow', 'diamond_bow', 'golden_bow', 'bow',
                           'cleaver', 'hunting_knife', 'diamond_knife', 'golden_knife', 'knife',
                           'explosive_kunai', 'chakram', 'diamond_shuriken', 'golden_shuriken', 'shuriken'];
            for(let t of types) {
                if(p.inventory[t]) { p.activeWeapon = t; break; }
            }
        }
    });

    // --- MECHANIKA RZUTU RÓŻNYMI BRONIAMI (Klawisz E) ---
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
                
                // Miecz dziedziczy bonus z umiejętności, reszta ma bazowe mocne DMG
                let finalDmg = type === 'sword' ? stats.dmg + (p.skills.weapon * 1) : stats.dmg;
                let isPierce = type === 'sword' ? (p.weaponPath === 'piercing') : stats.piercing;

                projectiles.push({
                    id: ++entityIdCounter,
                    ownerId: socket.id,
                    x: data.x,
                    y: data.y,
                    dx: data.dx,
                    dy: data.dy,
                    life: stats.life,
                    speed: stats.speed, 
                    isBotSword: false,
                    scoreAtThrow: p.score,
                    isPiercing: isPierce, 
                    damage: finalDmg,
                    isWinter: false,
                    projType: type 
                });
            }
        }
    });

    // Zimowy Miecz z nieba
    socket.on('throwWinterSword', () => {
        const p = players[socket.id];
        const now = Date.now();
        if (p && p.weaponPath === 'winter' && now - p.lastWinterUse >= 15000) {
            p.lastWinterUse = now;
            let winterDmg = 15 + (p.skills.weapon * 2);

            projectiles.push({
                id: ++entityIdCounter,
                ownerId: socket.id,
                x: p.x, 
                y: p.y - 1000, 
                dx: 0,
                dy: 1.5, 
                life: 150, 
                speed: 18,
                isBotSword: false,
                scoreAtThrow: Math.max(700, p.score), 
                isPiercing: true, 
                isWinter: true, 
                damage: winterDmg,
                projType: 'winter'
            });
        }
    });

    // Mechanika Podziału
    socket.on('splitMass', (data) => {
        const p = players[socket.id];
        if (p && p.score >= 20) {
            p.score -= data.mass;
            console.log(`${p.name} podzielił się.`);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Gracz rozłączony: ${socket.id}`);
        delete players[socket.id];
    });
});

// --- GŁÓWNA PĘTLA SERWERA (30 FPS) ---
setInterval(() => {
    // ZABÓJCZE MARGINESY DLA GRACZY (Ściany Śmierci)
    const pKeysList = Object.keys(players);
    for (let i = pKeysList.length - 1; i >= 0; i--) {
        let pId = pKeysList[i];
        let p = players[pId];
        
        // Zostawiamy delikatny bufor tolerancji dla lagów (np. 10px), żeby nie zabić za szybko
        if (p.x < -10 || p.x > WORLD_SIZE + 10 || p.y < -10 || p.y > WORLD_SIZE + 10) {
            io.emit('killEvent', { text: `${p.name} zginął w lesie (poza mapą)!` }); 
            killPlayer(pId);
        }
    }

    // 1. Logika Botów 
    for (let i = bots.length - 1; i >= 0; i--) {
        let b = bots[i];
        
        // Ruch bota
        if (Math.random() < 0.02) b.angle = Math.random() * Math.PI * 2;
        
        b.x += Math.cos(b.angle) * b.speed;
        b.y += Math.sin(b.angle) * b.speed;

        // Odbijanie botów od ścian
        if (b.x < 0 || b.x > WORLD_SIZE) b.angle = Math.PI - b.angle;
        if (b.y < 0 || b.y > WORLD_SIZE) b.angle = -b.angle;

        // Strzelanie (bardzo uproszczona logika strzelania mieczem, jeśli go stać)
        if (Math.random() < 0.01) {
            let type = b.activeWeapon;
            let stats = weaponStats[type];
            
            // Bot strzela tylko wtedy, gdy ma wystarczającą ilość pkt (żeby nie był maszyną do samobójstw)
            if (stats && b.score >= stats.cost + 5) {
                b.score -= stats.cost;
                projectiles.push({
                    id: ++entityIdCounter, ownerId: b.id,
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

    // 2. Bot zjada Bota (Powiadomienia Kill Feed!)
    for (let i = 0; i < bots.length; i++) {
        for (let j = i + 1; j < bots.length; j++) {
            let b1 = bots[i];
            let b2 = bots[j];
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

    // 3. Kolizje Graczy (Jedzenie, Boty) + Powiadomienia Kill Feed!
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
                if (dist < pRadius && p.score > b.score * 1.15) {
                    io.emit('killEvent', { text: `${p.name} pożarł ${b.name}` }); 
                    p.score += Math.floor(b.score * 0.5);
                    bots[bi] = spawnBot();
                    io.to(p.id).emit('botEaten', { newScore: p.score });
                }
                else if (dist < bRadius && b.score > p.score * 1.15) {
                    io.emit('killEvent', { text: `${b.name} pożarł ${p.name}` }); 
                    b.score += Math.floor(p.score * 0.5);
                    killPlayer(p.id); 
                }
            }
        });
    });

    // Gracz zjada Gracza (PvP) + Powiadomienia Kill Feed!
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

    // 4. Fizyka Mieczy (Projectiles) + LOGIKA TARCZY I PANCERZA
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        
        p.x += p.dx * p.speed;
        p.y += p.dy * p.speed;
        p.life--;

        bots.forEach((b) => {
            let hitRange = p.isWinter ? 60 : 30; 
            if (p.ownerId !== b.id && Math.hypot(p.x - b.x, p.y - b.y) < hitRange) {
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

    // --- 5. BEZLITOSNY SYSTEM KAR (SKILL RESET) ---
    Object.values(players).forEach(p => {
        let skillsChanged = false;

        if (p.score < 100 && p.skills.strength > 0) {
            p.skills.strength = 0;
            skillsChanged = true;
        }

        if (p.score < 15 && (p.skills.weapon > 0 || p.weaponPath !== 'none' || p.activeWeapon !== 'sword')) {
            p.skills.weapon = 0;
            p.weaponPath = 'none';
            p.activeWeapon = 'sword'; 
            skillsChanged = true;
        }

        if (skillsChanged) {
            io.to(p.id).emit('skillUpdated', { skills: p.skills, points: p.skillPoints, weaponPath: p.weaponPath });
        }
    });

    // 6. Wysłanie stanu świata do wszystkich
    io.emit('serverTick', {
        players,
        bots,
        foods,
        projectiles
    });
}, 33);

// ZAKTUALIZOWANY PORT NA POTRZEBY HOSTINGU (RENDER)
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` SERWER Xtreme Destiny (XD) DZIAŁA `);
    console.log(` Port nasłuchiwania: ${PORT} `);
    console.log(`=========================================`);
});
