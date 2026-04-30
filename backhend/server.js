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
        const timeoutId = setTimeout(() => controller.abort(), 1500); // Max 1.5s czekania
        const response = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen2.5:3b',
                prompt: `Jesteś empatycznym asystentem w grze akcji. Gracz właśnie zginął i zdobył ${mass} punktów. Napisz jedno krótkie, pocieszające zdanie w klimatach cyberpunk/noir promujące relaks przed kolejną próbą. Nie witaj się.`,
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
const CELL_SIZE = 400; // Spatial Hashing

const state = {
    players: {}, bots: {}, foods: {}, projectiles: {},
    activeEvent: null, eventTimer: 0,
    tickCounter: 0
};

let entityIdCounter = 0;

// Słownik Broni (Dla trybu FREE)
const WEAPONS = {
    'sword': { dmg: 5, life: 15, speed: 18, cost: 2, piercing: false },
    'bow': { dmg: 8, life: 60, speed: 26, cost: 2, piercing: false },
    'knife': { dmg: 12, life: 25, speed: 22, cost: 2, piercing: true },
    'shuriken': { dmg: 4, life: 30, speed: 20, cost: 2, piercing: false }
};

function spawnFood() {
    let id = ++entityIdCounter;
    state.foods[id] = { id: id, x: Math.random() * 6000, y: Math.random() * 6000 };
}

function spawnBot() {
    let id = `bot_${++entityIdCounter}`;
    let isBoss = Math.random() < 0.05;
    state.bots[id] = {
        id: id,
        x: Math.random() * 6000, y: Math.random() * 6000,
        score: isBoss ? (150 + Math.random() * 100) : (5 + Math.random() * 20),
        skin: isBoss ? 'ninja' : 'standard',
        name: isBoss ? 'Elita AI' : 'Dron AI',
        angle: Math.random() * Math.PI * 2,
        state: 'IDLE', // AI neutralne
        ownerId: null, // Jeśli ma właściciela, wchodzi w formację TEAMS
        typBroni: null // Typ dla "Army Draft"
    };
}

for (let i = 0; i < MAX_FOODS; i++) spawnFood();
for (let i = 0; i < MAX_BOTS; i++) spawnBot();

// ==========================================
// HERMETYCZNE KLASY TRYBÓW GRY (Zero Wycieków Logiki)
// ==========================================
class TrybFree {
    static aktualizuj(p, nearby) {
        let pRadius = 15 + Math.sqrt(p.score) * 1.5;
        let magnetRange = p.skin === 'arystokrata' ? pRadius + 15 : pRadius;

        // Jedzenie
        nearby.foods.forEach(f => {
            if (state.foods[f.id] && Math.hypot(p.x - f.x, p.y - f.y) < magnetRange) {
                dodajMase(p, 1 * p.massMultiplier);
                delete state.foods[f.id]; spawnFood();
            }
        });

        // Kolizje Graczy (PvP Zjadanie)
        nearby.players.forEach(p2 => {
            if (p.id === p2.id || p.isSafe || p2.isSafe || p2.mode !== 'FREE') return;
            let dist = Math.hypot(p.x - p2.x, p.y - p2.y);
            let r2 = 15 + Math.sqrt(p2.score) * 1.5;
            if (dist < pRadius && p.score > p2.score * 1.15) {
                io.emit('killEvent', { zabojca: p.name, ofiara: p2.name });
                dodajMase(p, Math.floor(p2.score * 0.5));
                triggerZgon(p2.id, p.name);
            }
        });

        // Kolizje z Dzikimi Botami (PvE Zjadanie)
        nearby.bots.forEach(b => {
            if (p.isSafe || b.ownerId) return;
            let dist = Math.hypot(p.x - b.x, p.y - b.y);
            let bRadius = 15 + Math.sqrt(b.score) * 1.5;
            if (dist < pRadius && p.score > b.score * 1.15) {
                io.emit('killEvent', { zabojca: p.name, ofiara: b.name });
                dodajMase(p, Math.floor(b.score * 0.5));
                delete state.bots[b.id]; spawnBot();
            } else if (dist < bRadius && b.score > p.score * 1.15) {
                io.emit('killEvent', { zabojca: b.name, ofiara: p.name });
                b.score += Math.floor(p.score * 0.5);
                triggerZgon(p.id, b.name);
            }
        });

        // Atak obszarowy NOVA
        if (p.overcharge >= 100) {
            io.emit('killEvent', { zabojca: "SYSTEM", ofiara: `TYTAN ${p.name} UŻYWA NOVA!` });
            p.overcharge = 0;
            nearby.players.forEach(p2 => {
                if (p.id !== p2.id && Math.hypot(p.x - p2.x, p.y - p2.y) < 300) p2.score = Math.max(1, p2.score - 50);
            });
            nearby.bots.forEach(b => {
                if (Math.hypot(p.x - b.x, p.y - b.y) < 300) b.score = Math.max(1, b.score - 100);
            });
        }
    }
}

class TrybTeams {
    static aktualizuj(p, nearby) {
        let pRadius = 25; // Generał jest zwinną stałą wielkością
        let magnetRange = pRadius + 20;

        // Jedzenie (Zbieranie masy/waluty)
        nearby.foods.forEach(f => {
            if (state.foods[f.id] && Math.hypot(p.x - f.x, p.y - f.y) < magnetRange) {
                dodajMase(p, 2 * p.massMultiplier); 
                delete state.foods[f.id]; spawnFood();
            }
        });

        // Werbowanie (Hakowanie dzikich botów)
        nearby.bots.forEach(b => {
            if(b.ownerId) return; // Ten już ma właściciela
            let dist = Math.hypot(p.x - b.x, p.y - b.y);
            if(dist < 80) { // Zasięg wiązki hakującej
                b.score -= 2; 
                if(b.score <= 0) {
                    b.ownerId = p.id;
                    b.team = p.team;
                    b.score = 25; // Standardowe HP rekruta
                    b.typBroni = 'miecz'; // Rekrut zawsze zaczyna jako miecznik
                    spawnBot(); // Natychmiastowe zrespienie dzikiego dla zachowania balansu na mapie
                }
            }
        });
        
        // Kolizje pancerza Generała z wrogą formacją (Generał dostaje obrażenia!) - TYLKO POZA BAZĄ
        if (!p.isSafe) {
            nearby.bots.forEach(b => {
                if(b.ownerId && b.team !== p.team) {
                    let dist = Math.hypot(p.x - b.x, p.y - b.y);
                    if(dist < 30) {
                        p.score -= 2; // Armia wroga wysysa życie/zasoby z Dowódcy
                        if(p.score <= 0) {
                            io.emit('killEvent', { zabojca: "Wroga Armia", ofiara: p.name });
                            triggerZgon(p.id, "Wroga Armia");
                        }
                    }
                }
            });
        }
    }

    static aktualizujRoj(b, lider, nearby) {
        let targetX = lider.x;
        let targetY = lider.y;
        let distToLeader = Math.hypot(lider.x - b.x, lider.y - b.y);
        let speed = 4.5;
        
        // REAKCJA NA ROZKAZ SPECJALNY (Klawisz 'E' / Ostrzał Skupiony)
        if (lider.rozkazAktywny) {
            if (b.typBroni === 'miecz') {
                targetX = lider.x + Math.cos(lider.katRuchu) * 400; // Szarża przed Generała
                targetY = lider.y + Math.sin(lider.katRuchu) * 400;
                speed = 10;
            } else if (b.typBroni === 'luk') {
                speed = 0; // Łucznicy stają w miejscu i zasypują wroga ogniem
                if (Math.random() < 0.05) {
                     let pid = ++entityIdCounter;
                     state.projectiles[pid] = {
                         id: pid, ownerId: lider.id, team: lider.team, mode: lider.mode,
                         x: b.x, y: b.y, dx: Math.cos(lider.katRuchu), dy: Math.sin(lider.katRuchu),
                         life: 30, speed: 20, damage: 8, piercing: false, type: 'laser'
                     };
                }
            }
        } else {
            // STANDARDOWA FORMACJA "MUR TARCZ"
            if (distToLeader < 70) speed = 0; // Martwa strefa - robią miejsce Generałowi
            else speed = Math.min(6, distToLeader * 0.08); 
            
            // Odpychanie Boids (żeby drony nie wchodziły w siebie)
            nearby.bots.forEach(otherB => {
                if (otherB.id !== b.id && otherB.ownerId === b.ownerId) {
                    if (Math.hypot(otherB.x - b.x, otherB.y - b.y) < 25) {
                        targetX -= (otherB.x - b.x) * 0.5;
                        targetY -= (otherB.y - b.y) * 0.5;
                    }
                }
            });
        }
        
        // Zastosowanie wektora lotu
        if(speed > 0) {
            let moveAngle = Math.atan2(targetY - b.y, targetX - b.x);
            b.x += Math.cos(moveAngle) * speed;
            b.y += Math.sin(moveAngle) * speed;
            b.angle = moveAngle;
        }

        // FIZYKA WALKI ROJU (Zderzenia 1na1 z wrogimi botami)
        nearby.bots.forEach(enemyB => {
            if (enemyB.ownerId && enemyB.team !== b.team) {
                if (Math.hypot(b.x - enemyB.x, b.y - enemyB.y) < 25) {
                    b.score -= 5;
                    enemyB.score -= 5;
                }
            }
        });
    }
}

// ==========================================
// OBSŁUGA KLIENCKA (SOCKET.IO)
// ==========================================
io.on('connection', (socket) => {
    console.log(`[ połączono ] Terminal: ${socket.id}`);

    socket.on('joinGame', (data) => {
        let spd = 5.0, mult = 1.0, startMass = 5;
        if (data.skin === 'ninja') { spd = 5.5; mult = 0.9; }
        else if (data.skin === 'arystokrata') { spd = 4.8; mult = 1.1; startMass = 15; }
        else { mult = 1.02; } 

        let pTeam = 'NONE';
        let spawnX = 2000 + (Math.random() * 200 - 100);
        let spawnY = 2000 + (Math.random() * 200 - 100);

        if (data.mode === 'TEAMS') {
            let redCount = 0, blueCount = 0;
            for (let id in state.players) {
                if (state.players[id].mode === 'TEAMS') {
                    if (state.players[id].team === 'RED') redCount++;
                    if (state.players[id].team === 'BLUE') blueCount++;
                }
            }
            pTeam = redCount <= blueCount ? 'RED' : 'BLUE';
            spawnX = pTeam === 'RED' ? 500 + (Math.random() * 400 - 200) : 5500 + (Math.random() * 400 - 200);
            spawnY = 3000 + (Math.random() * 400 - 200);
        } else if (data.mode === 'FREE' && data.spawnZone) {
            if (data.spawnZone === 'nw') { spawnX = Math.random() * 2000; spawnY = Math.random() * 2000; }
            else if (data.spawnZone === 'ne') { spawnX = 2000 + Math.random() * 2000; spawnY = Math.random() * 2000; }
            else if (data.spawnZone === 'sw') { spawnX = Math.random() * 2000; spawnY = 2000 + Math.random() * 2000; }
            else if (data.spawnZone === 'se') { spawnX = 2000 + Math.random() * 2000; spawnY = 2000 + Math.random() * 2000; }
        }

        state.players[socket.id] = {
            id: socket.id,
            name: data.name || "Nieznany",
            skin: data.skin || 'standard',
            mode: data.mode || 'FREE',
            team: pTeam,
            x: spawnX, y: spawnY,
            score: startMass,
            baseSpeed: spd, massMultiplier: mult,
            activeWeapon: 'sword',
            overcharge: 0,
            isShielding: false, isSafe: false,
            katRuchu: 0, dystansKursora: 0, rozkazAktywny: false
        };
        socket.emit('init', { id: socket.id, team: pTeam });
    });

    // NOWE STEROWANIE MYSZKĄ 
    socket.on('ruchGraczaMyszka', (dane) => {
        let p = state.players[socket.id];
        if (p) {
            p.katRuchu = dane.kat;
            p.dystansKursora = dane.dystans;
        }
    });

    // MIOTANIE OSZCZEPEM (Lewy Przycisk Myszy)
    socket.on('rzutOszczepem', (dane) => {
        let p = state.players[socket.id];
        if (p && !p.isSafe) { // NIE MOŻNA RZUCAĆ BĘDĄC W BEZPIECZNEJ STREFIE
            let koszt = p.mode === 'TEAMS' ? 5 : (WEAPONS[p.activeWeapon]?.cost || 2);
            if (p.score > koszt) {
                p.score -= koszt;
                let pid = ++entityIdCounter;
                state.projectiles[pid] = {
                    id: pid, ownerId: p.id, team: p.team, mode: p.mode,
                    x: p.x, y: p.y,
                    dx: Math.cos(dane.kat), dy: Math.sin(dane.kat),
                    life: 50, speed: 25, damage: p.mode === 'TEAMS' ? 25 : WEAPONS[p.activeWeapon].dmg, 
                    piercing: true, type: 'oszczep'
                };
            }
        }
    });

    // ROZKAZ SPECJALNY DLA ROJU (Przycisk 'E' / Środkowy przycisk myszy)
    socket.on('rozkazSpecjalny', () => {
        let p = state.players[socket.id];
        if (p && p.mode === 'TEAMS') {
            p.rozkazAktywny = true;
            setTimeout(() => { if(state.players[p.id]) p.rozkazAktywny = false; }, 2000); 
        }
    });

    // ULEPSZANIE ZBROJOWNI I BOTÓW W BAZIE
    socket.on('buyShopItem', (item) => {
        let p = state.players[socket.id];
        if (p && p.isSafe) { // ZAKUPY TYLKO W BEZPIECZNEJ STREFIE
            if (p.mode === 'TEAMS') {
                let shopCost = 50; 
                if (p.score >= shopCost) {
                    p.score -= shopCost;
                    // Draftujemy armię - zmieniamy połowę posiadanych botów na nową klasę
                    Object.values(state.bots).forEach(b => {
                        if (b.ownerId === p.id && Math.random() > 0.5) b.typBroni = item;
                    });
                    socket.emit('shopSuccess', { item: item });
                }
            } else {
                let shopCost = (WEAPONS[item]?.cost || 2) * 25; 
                if (p.score >= shopCost) {
                    p.score -= shopCost;
                    p.activeWeapon = item;
                    socket.emit('shopSuccess', { item: item });
                }
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`[ rozłączono ] Terminal: ${socket.id}`);
        // W trybie TEAMS zwerbowane boty padają po wylogowaniu Generała
        for(let bId in state.bots) { if(state.bots[bId].ownerId === socket.id) delete state.bots[bId]; }
        delete state.players[socket.id];
    });
});

// ==========================================
// GŁÓWNA PĘTLA GRY (30 FPS)
// ==========================================
setInterval(() => {
    state.tickCounter++;

    // 1. SPATIAL HASHING (Optymalizacja)
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

    // 2. LOGIKA GRACZY & RUCH MYSZKĄ & STREFA BEZPIECZNA
    for (let pId in state.players) {
        let p = state.players[pId];
        
        p.isSafe = false; // Reset tarczy co klatkę

        // LOGIKA BAZY I TARCZY OCHRONNEJ
        if (p.mode === 'FREE') {
            // Zamek na środku mapy
            if (Math.hypot(p.x - 2000, p.y - 2000) < 400) { p.isSafe = true; }
        } else if (p.mode === 'TEAMS') {
            let mojaBazaX = p.team === 'RED' ? 500 : 5500;
            let wrogaBazaX = p.team === 'RED' ? 5500 : 500;
            let bazaY = 3000;

            // Tarcza wewnątrz własnej bazy
            if (Math.hypot(p.x - mojaBazaX, p.y - bazaY) < 400) { p.isSafe = true; }
            
            // Pole siłowe wrogiej bazy zadające potężne obrażenia
            if (Math.hypot(p.x - wrogaBazaX, p.y - bazaY) < 400) {
                p.score -= 2; // Płonie w wrogiej bazie!
                if (p.score <= 0) {
                    io.emit('killEvent', { zabojca: "System Obronny Bazy", ofiara: p.name });
                    triggerZgon(p.id, "System Obronny Bazy");
                    continue; // Jeśli umrze, przerywamy resztę logiki dla tego gracza
                }
            }
        }

        let nearby = getNearby(p.x, p.y);

        // Aplikujemy hermetyczną logikę zależnie od wybranego wariantu
        if (p.mode === 'FREE') TrybFree.aktualizuj(p, nearby);
        else if (p.mode === 'TEAMS') TrybTeams.aktualizuj(p, nearby);

        // Autorytatywny Ruch oparty o kursor myszki
        const MARTWA_STREFA = 30; 
        let speed = Math.max(2.0, p.baseSpeed - (p.mode === 'FREE' ? Math.max(0, (p.score - 50) / 600) * 2.0 : 0));
        
        if (p.dystansKursora !== undefined && p.dystansKursora > MARTWA_STREFA) {
            let limit = p.mode === 'TEAMS' ? 6000 : 4000;
            let nextX = p.x + Math.cos(p.katRuchu) * speed;
            let nextY = p.y + Math.sin(p.katRuchu) * speed;

            if (nextX < 0 || nextX > limit || nextY < 0 || nextY > limit) {
                triggerZgon(p.id, "Strefę Śmierci (Krawędź)");
            } else {
                p.x = nextX;
                p.y = nextY;
            }
        }
    }

    // 3. LOGIKA POCISKÓW I OSZCZEPÓW
    for (let projId in state.projectiles) {
        let proj = state.projectiles[projId];
        proj.x += proj.dx * proj.speed;
        proj.y += proj.dy * proj.speed;
        proj.life--;

        let nearby = getNearby(proj.x, proj.y);
        let hit = false;

        nearby.players.forEach(p => {
            if (p.isSafe) return; // BLOKADA: Pociski ignorują graczy w bezpiecznej strefie
            if (p.id !== proj.ownerId && Math.hypot(p.x - proj.x, p.y - proj.y) < 30) {
                if (proj.mode === 'TEAMS' && p.team === proj.team) return; // Blokada Friendly Fire
                if (!p.isShielding) p.score = Math.max(1, p.score - proj.damage);
                hit = true;
            }
        });

        // Oszczepy ranią drony
        nearby.bots.forEach(b => {
            if (Math.hypot(b.x - proj.x, b.y - proj.y) < 30) {
                if (proj.mode === 'TEAMS' && b.team === proj.team) return;
                b.score -= proj.damage;
                hit = true;
            }
        });

        if (hit && !proj.piercing) proj.life = 0;
        if (proj.life <= 0) delete state.projectiles[projId];
    }

    // 4. LOGIKA DRONÓW (Klasyczne AI vs Rój Formacji)
    for (let bId in state.bots) {
        let b = state.bots[bId];
        
        // Zdejmowanie botów o zerowym HP (niezależnie czy dzikie czy zwerbowane)
        if (b.score <= 0) {
            delete state.bots[bId];
            continue;
        }

        if (b.ownerId && state.players[b.ownerId]) {
            // Algorytm Formacji dla podbitych dronów
            let nearby = getNearby(b.x, b.y);
            TrybTeams.aktualizujRoj(b, state.players[b.ownerId], nearby);
        } else {
            // Klasyczne, agresywne AI Dzikiego Bota
            let nearby = getNearby(b.x, b.y);
            let targetPlayer = null, predatorPlayer = null, closestDist = Infinity;

            nearby.players.forEach(p => {
                if (p.isSafe) return; // AI Dzikich botów ignoruje graczy w strefie bezpiecznej
                let dist = Math.hypot(p.x - b.x, p.y - b.y);
                if (dist < 500) { 
                    if (b.score > p.score * 1.15) {
                        if (dist < closestDist) { closestDist = dist; targetPlayer = p; }
                    } else if (p.score > b.score * 1.15) {
                        predatorPlayer = p;
                    }
                }
            });

            if (predatorPlayer) {
                b.state = 'FLEE';
                b.angle = Math.atan2(b.y - predatorPlayer.y, b.x - predatorPlayer.x); 
            } else if (targetPlayer) {
                b.state = 'HUNT';
                b.angle = Math.atan2(targetPlayer.y - b.y, targetPlayer.x - b.x); 
            } else {
                b.state = 'IDLE';
                if (Math.random() < 0.05) b.angle = Math.random() * Math.PI * 2; 
            }

            let speed = b.state === 'FLEE' ? 3.5 : (b.state === 'HUNT' ? 2.8 : 1.5);
            if (b.skin === 'ninja') speed += 1.0; 

            b.x = Math.max(0, Math.min(6000, b.x + Math.cos(b.angle) * speed));
            b.y = Math.max(0, Math.min(6000, b.y + Math.sin(b.angle) * speed));
        }
    }

    // 5. WYSYŁKA
    io.emit('serverTick', {
        players: state.players,
        bots: state.bots,
        projectiles: state.projectiles,
        foods: state.tickCounter % 30 === 0 ? state.foods : null 
    });

}, 33); 

// ==========================================
// FUNKCJE POMOCNICZE
// ==========================================
function dodajMase(gracz, ilosc) {
    if (gracz.score + ilosc <= MAX_MASS) {
        gracz.score += ilosc;
    } else {
        let nadwyzka = (gracz.score + ilosc) - MAX_MASS;
        gracz.score = MAX_MASS;
        gracz.overcharge += nadwyzka; 
    }
}

async function triggerZgon(deadId, killerName) {
    const p = state.players[deadId];
    if (p) {
        let score = Math.floor(p.score);
        console.log(`[ ŚMIERĆ ] ${p.name} poległ. Pytam Qwen o pocieszenie...`);
        
        // Zwerbowane drony w trybie TEAMS padają razem z poległym Generałem
        if(p.mode === 'TEAMS') {
            for(let bId in state.bots) { if(state.bots[bId].ownerId === deadId) delete state.bots[bId]; }
        }

        let msg = await getAIWellbeingMessage(score);
        io.to(deadId).emit('gameOver', { finalScore: score, killerName: killerName, message: msg });
        delete state.players[deadId];
    }
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` SYSTEM ONLINE: Sędzia Vibe Noir `);
    console.log(` Oczekuję na graczy na porcie ${PORT} `);
    console.log(`=========================================`);
});