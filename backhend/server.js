// ==========================================
// SERVER.JS - Autorytatywny Sędzia (Vibe Noir - Pancerna Architektura)
// ==========================================

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const path = require('path');

// --- ROUTING FRONTENDU I ASSETÓW ---
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/assety', express.static(path.join(__dirname, '../assety')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));
app.use('/automatyzacja', express.static(path.join(__dirname, '../automatyzacja')));

// ==========================================
// LOKALNE AI (QWEN) - Ekran Śmierci i Wellbeing
// ==========================================
async function getAIWellbeingMessage(mass) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500); // Max 1.5s czekania, by nie lagować
        const response = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen2.5:3b',
                prompt: `Jesteś empatycznym asystentem w grze akcji. Gracz właśnie zginął i zdobył ${mass} punktów masy. Napisz jedno krótkie, pocieszające zdanie w klimatach cyberpunk/noir promujące oddech i relaks przed kolejną próbą. Nie witaj się.`,
                stream: false
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        return data.response.trim();
    } catch (error) {
        return `Zostałeś odłączony. Wynik: ${mass}. Zrób głęboki wdech i zresetuj system.`;
    }
}

// ==========================================
// KONFIGURACJA ŚWIATA I ZMIENNE
// ==========================================
const MAX_MASS = 600;
const MAX_FOODS = 250;
const MAX_BOTS = 60; 
const CELL_SIZE = 400; // Do optymalizacji Spatial Hashing

const state = {
    players: {}, bots: {}, foods: {}, projectiles: {},
    activeEvent: null, eventTimer: 0,
    tickCounter: 0
};

let entityIdCounter = 0;

// Słownik Broni (Zgodny z GDD)
const WEAPONS = {
    'sword': { dmg: 5, life: 15, speed: 18, cost: 2, piercing: false },
    'bow': { dmg: 8, life: 60, speed: 26, cost: 2, piercing: false },
    'knife': { dmg: 12, life: 25, speed: 22, cost: 2, piercing: true },
    'shuriken': { dmg: 4, life: 30, speed: 20, cost: 2, piercing: false }
};

// ==========================================
// SYSTEMY GENEROWANIA ŚWIATA
// ==========================================
function spawnFood() {
    let id = ++entityIdCounter;
    // Jedzenie respi się na obszarze 6000x6000 (obejmuje oba tryby)
    state.foods[id] = { id: id, x: Math.random() * 6000, y: Math.random() * 6000 };
}

function spawnBot() {
    let id = `bot_${++entityIdCounter}`;
    let isBoss = Math.random() < 0.05;
    state.bots[id] = {
        id: id,
        x: Math.random() * 4000, y: Math.random() * 4000,
        score: isBoss ? (150 + Math.random() * 100) : (5 + Math.random() * 20),
        skin: isBoss ? 'ninja' : 'standard',
        name: isBoss ? 'Elita AI' : 'Dron AI',
        angle: Math.random() * Math.PI * 2,
        state: 'IDLE' // IDLE, HUNT, FLEE
    };
}

for (let i = 0; i < MAX_FOODS; i++) spawnFood();
for (let i = 0; i < MAX_BOTS; i++) spawnBot();

// ==========================================
// OBSŁUGA POŁĄCZEŃ KLIENCKICH (SOCKET.IO)
// ==========================================
io.on('connection', (socket) => {
    console.log(`[ połączono ] Terminal: ${socket.id}`);

    socket.on('joinGame', (data) => {
        // Balans Klas według GDD
        let spd = 5.0, mult = 1.0, startMass = 5;
        if (data.skin === 'ninja') { spd = 5.5; mult = 0.9; }
        else if (data.skin === 'arystokrata') { spd = 4.8; mult = 1.1; startMass = 15; }
        else { mult = 1.02; } // Standard ma stały lekki bonus

        state.players[socket.id] = {
            id: socket.id,
            name: data.name || "Nieznany",
            skin: data.skin || 'standard',
            mode: data.mode || 'FREE',
            x: 2000 + (Math.random() * 200 - 100),
            y: 2000 + (Math.random() * 200 - 100),
            score: startMass,
            baseSpeed: spd, massMultiplier: mult,
            inventory: { bow: 0, knife: 0, shuriken: 0 },
            activeWeapon: 'sword',
            overcharge: 0, // Pasek Nova na poziomie 600 masy
            isShielding: false, isSafe: false,
            lastTickX: 2000, lastTickY: 2000
        };
        socket.emit('init', { id: socket.id });
    });

    socket.on('playerInput', (keys) => {
        const p = state.players[socket.id];
        if (!p) return;

        // AUTORYTET SERWERA: Fizyka i Ruch
        let dx = 0, dy = 0;
        if (keys.up) dy--; if (keys.down) dy++;
        if (keys.left) dx--; if (keys.right) dx++;

        // Zwolnienie przy dużej masie (balans!)
        let weightPenalty = Math.max(0, (p.score - 50) / 600) * 2.0; 
        let speed = Math.max(2.0, p.baseSpeed - weightPenalty);
        if (keys.uzywaTarczy && p.score >= 50) { speed *= 0.5; p.isShielding = true; } 
        else { p.isShielding = false; }

        if (dx !== 0 || dy !== 0) {
            let angle = Math.atan2(dy, dx);
            let limit = p.mode === 'TEAMS' ? 6000 : 4000;
            let nextX = p.x + Math.cos(angle) * speed;
            let nextY = p.y + Math.sin(angle) * speed;

            // NAPRAWA: ŚMIERĆ ZA MAPĄ (Krawędź)
            if (nextX < 0 || nextX > limit || nextY < 0 || nextY > limit) {
                triggerZgon(p.id, "Strefę Śmierci (Krawędź)");
            } else {
                p.x = nextX;
                p.y = nextY;
            }
        }

        // Strzelanie
        if (keys.atakuje && p.score >= 30) {
            let wp = WEAPONS[p.activeWeapon] || WEAPONS['sword'];
            if (p.score > wp.cost) {
                p.score -= wp.cost;
                let pid = ++entityIdCounter;
                state.projectiles[pid] = {
                    id: pid, ownerId: p.id,
                    x: p.x, y: p.y,
                    dx: Math.cos(keys.katCelowania), dy: Math.sin(keys.katCelowania),
                    life: wp.life, speed: wp.speed, damage: wp.dmg, piercing: wp.piercing
                };
            }
        }
    });

    // NAPRAWA: Obsługa Sklepu
    socket.on('buyShopItem', (item) => {
        const p = state.players[socket.id];
        if (p && WEAPONS[item]) {
            // Sprawdź czy gracza stać na zakup w sklepie (np. koszt to cena * 10 dla stałej zmiany)
            let shopCost = WEAPONS[item].cost * 25; 
            if (p.score >= shopCost) {
                p.score -= shopCost;
                p.activeWeapon = item;
                socket.emit('shopSuccess', { item: item });
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`[ rozłączono ] Terminal: ${socket.id}`);
        delete state.players[socket.id];
    });
});

// ==========================================
// GŁÓWNA PĘTLA GRY (30 FPS)
// ==========================================
setInterval(async () => {
    state.tickCounter++;

    // 1. SPATIAL HASHING (Optymalizacja kolizji)
    let grid = {};
    function addToGrid(entity, type) {
        if (!entity) return;
        let key = `${Math.floor(entity.x / CELL_SIZE)},${Math.floor(entity.y / CELL_SIZE)}`;
        if (!grid[key]) grid[key] = { players: [], bots: [], foods: [] };
        grid[key][type].push(entity);
    }
    Object.values(state.players).forEach(p => addToGrid(p, 'players'));
    Object.values(state.bots).forEach(b => addToGrid(b, 'bots'));
    Object.values(state.foods).forEach(f => addToGrid(f, 'foods'));

    // Funkcja pomocnicza: pobierz obiekty z okolicznych 9 komórek
    function getNearby(x, y) {
        let cx = Math.floor(x / CELL_SIZE), cy = Math.floor(y / CELL_SIZE);
        let nearby = { players: [], bots: [], foods: [] };
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                let cell = grid[`${cx + dx},${cy + dy}`];
                if (cell) {
                    nearby.players.push(...cell.players);
                    nearby.bots.push(...cell.bots);
                    nearby.foods.push(...cell.foods);
                }
            }
        }
        return nearby;
    }

    // 2. LOGIKA GRACZY (Jedzenie i Overcharge)
    for (let pId in state.players) {
        let p = state.players[pId];
        let pRadius = 15 + Math.sqrt(p.score) * 1.5;
        let nearby = getNearby(p.x, p.y);

        // Zbieranie jedzenia (Arystokrata ma większy magnes)
        let magnetRange = p.skin === 'arystokrata' ? pRadius + 15 : pRadius;
        nearby.foods.forEach(f => {
            if (state.foods[f.id] && Math.hypot(p.x - f.x, p.y - f.y) < magnetRange) {
                dodajMase(p, 1 * p.massMultiplier);
                delete state.foods[f.id]; spawnFood();
            }
        });

        // Kolizje PvP
        nearby.players.forEach(p2 => {
            if (p.id === p2.id || p.isSafe || p2.isSafe) return;
            let dist = Math.hypot(p.x - p2.x, p.y - p2.y);
            let r2 = 15 + Math.sqrt(p2.score) * 1.5;

            if (dist < pRadius && p.score > p2.score * 1.15) {
                dodajMase(p, Math.floor(p2.score * 0.5));
                triggerZgon(p2.id, p.name);
            } else if (dist < r2 && p2.score > p.score * 1.15) {
                dodajMase(p2, Math.floor(p.score * 0.5));
                triggerZgon(p.id, p2.name);
            }
        });

        // NAPRAWA: Kolizje PvE (Gracz vs Bot)
        nearby.bots.forEach(b => {
            if (p.isSafe) return;
            let dist = Math.hypot(p.x - b.x, p.y - b.y);
            let bRadius = 15 + Math.sqrt(b.score) * 1.5;

            // Gracz zjada Bota
            if (dist < pRadius && p.score > b.score * 1.15) {
                dodajMase(p, Math.floor(b.score * 0.5)); // Zastrzyk masy dla gracza
                delete state.bots[b.id]; // Usunięcie bota
                spawnBot(); // Natychmiastowy respawn nowego drona
            } 
            // Bot zjada Gracza
            else if (dist < bRadius && b.score > p.score * 1.15) {
                b.score += Math.floor(p.score * 0.5); // Bot rośnie po zjedzeniu gracza!
                triggerZgon(p.id, b.name);
            }
        });
        
        // Atak obszarowy: OVERCHARGE NOVA
        if (p.overcharge >= 100) {
            io.emit('killEvent', { text: `⚡ TYTAN ${p.name} UWOLNIŁ PRZEŁADOWANIE!` });
            p.overcharge = 0;
            // Odepchnij i zrań wszystko w promieniu 300px
            nearby.players.forEach(p2 => {
                if (p.id !== p2.id && Math.hypot(p.x - p2.x, p.y - p2.y) < 300) p2.score = Math.max(1, p2.score - 50);
            });
            nearby.bots.forEach(b => {
                if (Math.hypot(p.x - b.x, p.y - b.y) < 300) b.score = Math.max(1, b.score - 100);
            });
        }
    }

    // 3. LOGIKA POCISKÓW
    for (let projId in state.projectiles) {
        let proj = state.projectiles[projId];
        proj.x += proj.dx * proj.speed;
        proj.y += proj.dy * proj.speed;
        proj.life--;

        let nearby = getNearby(proj.x, proj.y);
        let hit = false;

        nearby.players.forEach(p => {
            if (p.id !== proj.ownerId && Math.hypot(p.x - proj.x, p.y - proj.y) < 30) {
                if (!p.isShielding) p.score = Math.max(1, p.score - proj.damage);
                hit = true;
            }
        });

        if (hit && !proj.piercing) proj.life = 0;
        if (proj.life <= 0) delete state.projectiles[projId];
    }

    // 4. LOGIKA BOTÓW (Stanowa maszyna sztucznej inteligencji)
    for (let bId in state.bots) {
        let b = state.bots[bId];
        let nearby = getNearby(b.x, b.y);
        
        // Zmiana stanu
        if (Math.random() < 0.05) {
            let hasThreat = false;
            nearby.players.forEach(p => { if (p.score > b.score * 1.2 && Math.hypot(p.x - b.x, p.y - b.y) < 300) hasThreat = true; });
            b.state = hasThreat ? 'FLEE' : 'HUNT';
        }

        let speed = b.score > 100 ? 1.5 : 2.5;
        b.x = Math.max(0, Math.min(4000, b.x + Math.cos(b.angle) * speed));
        b.y = Math.max(0, Math.min(4000, b.y + Math.sin(b.angle) * speed));
        if (Math.random() < 0.02) b.angle = Math.random() * Math.PI * 2; // Losowy skręt
    }

    // 5. WYSYŁKA DANYCH DO KLIENTÓW
    io.emit('serverTick', {
        players: state.players,
        bots: state.bots,
        projectiles: state.projectiles,
        foods: state.tickCounter % 30 === 0 ? state.foods : null // Optymalizacja przesyłu masy
    });

}, 33); // ~30 FPS

// ==========================================
// FUNKCJE POMOCNICZE
// ==========================================

// Inteligentne dodawanie masy (z obsługą Overcharge dla Tytanów)
function dodajMase(gracz, ilosc) {
    if (gracz.score + ilosc <= MAX_MASS) {
        gracz.score += ilosc;
    } else {
        let nadwyzka = (gracz.score + ilosc) - MAX_MASS;
        gracz.score = MAX_MASS;
        gracz.overcharge += nadwyzka; // Ładowanie ataku Nova
    }
}

// Procedura pożarcia z asystentem AI
async function triggerZgon(deadId, killerName) {
    const p = state.players[deadId];
    if (p) {
        let score = Math.floor(p.score);
        console.log(`[ ŚMIERĆ ] ${p.name} poległ. Pytam Qwen o pocieszenie...`);
        let msg = await getAIWellbeingMessage(score);
        io.to(deadId).emit('gameOver', { finalScore: score, killerName: killerName, message: msg });
        delete state.players[deadId];
    }
}

// ==========================================
// URUCHOMIENIE SERWERA
// ==========================================
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` SYSTEM ONLINE: Sędzia Vibe Noir `);
    console.log(` Oczekuję na graczy na porcie ${PORT} `);
    console.log(`=========================================`);
});