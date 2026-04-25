// ==========================================
// FreeMode.js - Logika trybu "Każdy na Każdego" (Battle Royale + KotL)
// ==========================================
const BaseMode = require('./BaseMode');

class FreeMode extends BaseMode {
    constructor(io) {
        super(io); 
        this.modeName = 'FREE';
        this.epicCastleKing = null;
        this.MAX_BOTS = 80;

        // Inicjalizacja botów specyficznych dla tego trybu
        for (let i = 0; i < this.MAX_BOTS; i++) {
            this.spawnBot();
        }
    }

    // Zastępujemy domyślną funkcję z BaseMode fizyką Epickiego Zamku
    canCrossCastleWall(oldX, oldY, newX, newY) {
        let cx = this.WORLD_SIZE / 2;
        let cy = this.WORLD_SIZE / 2;
        let radius = 350; 

        let distNow = Math.hypot(oldX - cx, oldY - cy);
        let distNext = Math.hypot(newX - cx, newY - cy);

        let isCrossingWall = (distNow >= radius && distNext < radius) || (distNow <= radius && distNext > radius);
        let isOnWallLine = Math.abs(distNext - radius) < 10;

        if (isCrossingWall || isOnWallLine) {
            let moveAngle = Math.atan2(newY - cy, newX - cx);
            let angleMod = (moveAngle + Math.PI * 2) % (Math.PI / 2);
            let isOnBridge = (angleMod < 0.35 || angleMod > (Math.PI / 2) - 0.35);
            
            if (!isOnBridge) return false; 
        }
        return true;
    }

    // Czyszczenie Króla, jeśli zginie lub wyjdzie
    onPlayerDeath(pId) {
        if (pId === this.epicCastleKing) this.epicCastleKing = null;
    }

    spawnBot() {
        this.botNameCounter++;
        let botScore = 1 + Math.random() * 10;
        let id = `bot_${++this.entityIdCounter}`;
        
        this.bots[id] = {
            id: id,
            x: Math.random() * this.WORLD_SIZE, y: Math.random() * this.WORLD_SIZE,
            score: botScore, color: `hsl(${Math.random() * 360}, 70%, 50%)`, name: `Bot AI #${this.botNameCounter}`,
            angle: Math.random() * Math.PI * 2, speed: 2.5,
            ownerId: null, team: null, isHyperboss: false, inventory: { bow: 0, knife: 0, shuriken: 0 }, activeWeapon: 'sword'
        };
    }

    // GŁÓWNA LOGIKA TRYBU (Uruchamiana co klatkę z BaseMode)
    processModeRules() {
        // ==========================================
        // 1. LOGIKA KOTL (Król Wzgórza - Rdzeń)
        // ==========================================
        let playersInCore = [];
        Object.values(this.players).forEach(p => {
            if (Math.hypot(p.x - this.WORLD_SIZE/2, p.y - this.WORLD_SIZE/2) < 80) {
                playersInCore.push(p);
            }
        });

        if (playersInCore.length > 0) {
            playersInCore.sort((a, b) => b.score - a.score);
            let king = playersInCore[0];
            
            if (this.eventTickCounter % 30 === 0) { 
                king.score += 5; 
                if (this.epicCastleKing !== king.id) {
                    this.epicCastleKing = king.id;
                    this.io.emit('killEvent', { text: `👑 ${king.name} okupuje Rdzeń! (+5 masy/s)`, time: 200 });
                }
            }
        } else {
            this.epicCastleKing = null;
        }

        // ==========================================
        // 2. SIATKA KOLIZJI (Grid - optymalizacja szukania)
        // ==========================================
        const CELL_SIZE = 400;
        let grid = {};
        
        const addToGrid = (entity, type) => {
            if(!entity) return;
            let key = `${Math.floor(entity.x / CELL_SIZE)},${Math.floor(entity.y / CELL_SIZE)}`;
            if (!grid[key]) grid[key] = { players: [], bots: [], foods: [], loots: [] };
            grid[key][type].push(entity);
        };

        Object.values(this.players).forEach(p => addToGrid(p, 'players'));
        Object.values(this.bots).forEach(b => addToGrid(b, 'bots'));
        Object.values(this.foods).forEach(f => addToGrid(f, 'foods'));
        Object.values(this.loots).forEach(l => addToGrid(l, 'loots'));

        const getNearbyEntities = (x, y) => {
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
        };

        // ==========================================
        // 3. LOGIKA BOTÓW (Jedzenie Kropek i Innych Botów)
        // ==========================================
        for (let bId in this.bots) {
            let b = this.bots[bId];
            if (!b) continue;
            let nearby = getNearbyEntities(b.x, b.y);

            // Bot je kropki
            nearby.foods.forEach(f => {
                if (this.foods[f.id] && Math.hypot(b.x - f.x, b.y - f.y) < 25) {
                    b.score += 1; delete this.foods[f.id]; this.spawnFood();
                }
            });

            // Bot zjada innego bota
            nearby.bots.forEach(b2 => {
                if (!this.bots[b.id] || !this.bots[b2.id] || b.id === b2.id) return;
                // Ignoruj boty z tego samego gangu
                if (b.ownerId && b.ownerId === b2.ownerId) return;

                let dist = Math.hypot(b.x - b2.x, b.y - b2.y);
                let r1 = 25 * (1 + Math.pow(Math.max(0, b.score - 1), 0.45) * 0.15);
                let r2 = 25 * (1 + Math.pow(Math.max(0, b2.score - 1), 0.45) * 0.15);

                if (dist < r1 && b.score > b2.score * 1.15) {
                    this.io.emit('killEvent', { text: `${b.name} pożarł ${b2.name}` }); 
                    b.score += Math.floor(b2.score * 0.5); 
                    this.io.emit('deathMarker', { x: b2.x, y: b2.y }); 
                    delete this.bots[b2.id]; this.spawnBot(); 
                } else if (dist < r2 && b2.score > b.score * 1.15) {
                    this.io.emit('killEvent', { text: `${b2.name} pożarł ${b.name}` }); 
                    b2.score += Math.floor(b.score * 0.5); 
                    this.io.emit('deathMarker', { x: b.x, y: b.y }); 
                    delete this.bots[b.id]; this.spawnBot(); 
                }
            });
        }

        // ==========================================
        // 4. LOGIKA GRACZY (Zjadanie Botów i Graczy)
        // ==========================================
        Object.values(this.players).forEach(p => {
            if (!this.players[p.id]) return; 
            let pRadius = 25 * (1 + Math.pow(Math.max(0, p.score - 1), 0.45) * 0.15);
            let nearby = getNearbyEntities(p.x, p.y);

            // Gracz je kropki
            nearby.foods.forEach(f => {
                if (this.foods[f.id] && Math.hypot(p.x - f.x, p.y - f.y) < pRadius) {
                    p.score += (p.skin === 'standard' ? 1.02 : 1 * p.massMultiplier);
                    delete this.foods[f.id]; this.spawnFood();
                }
            });

            // Gracz je skrzynki (Loots)
            nearby.loots.forEach(l => {
                if (this.loots[l.id] && Math.hypot(p.x - l.x, p.y - l.y) < pRadius + 15) {
                    if (l.type === 'mass') {
                        let lootMass = 30 * (p.skin === 'standard' ? 1.02 : p.massMultiplier);
                        p.score += lootMass; this.io.emit('killEvent', { text: `🎁 ${p.name} znalazł złoże Masy (+${Math.floor(lootMass)})!` }); 
                    } else if (l.type === 'skill') {
                        p.skillPoints++; this.io.to(p.id).emit('levelUp', { level: p.level, points: p.skillPoints }); this.io.emit('killEvent', { text: `📘 ${p.name} odnalazł Księgę Wiedzy!` }); 
                    } else if (l.type === 'weapon') {
                        p.inventory['knife'] = 1; p.activeWeapon = 'knife'; this.io.emit('killEvent', { text: `🗡️ ${p.name} znalazł Nóż w skrzynce!` }); 
                    }
                    delete this.loots[l.id]; this.spawnLoot(); 
                }
            });

            // Gracz vs Bot
            nearby.bots.forEach(b => {
                if (!this.bots[b.id] || !this.players[p.id] || p.isSafe) return;
                let dist = Math.hypot(p.x - b.x, p.y - b.y);
                let bRadius = 25 * (1 + Math.pow(Math.max(0, b.score - 1), 0.45) * 0.15);

                if (b.ownerId !== p.id) { // Jeśli to nie jest bot tego gracza
                    if (dist < pRadius && p.score > b.score * 1.15) {
                        if (p.isRecruiting) { // Zwerbowanie
                            this.io.emit('killEvent', { text: `${p.name} zwerbował wojownika!` }); 
                            b.ownerId = p.id; b.score = 5; b.color = p.color; b.name = `Wojownik`; 
                            b.activeWeapon = p.activeWeapon;
                            if (p.activeWeapon !== 'sword') b.inventory[p.activeWeapon] = 1;
                            b.distOffset = Math.hypot(b.x - p.x, b.y - p.y); b.angleOffset = Math.atan2(b.y - p.y, b.x - p.x) - p.moveAngle;
                        } else { // Zjedzenie
                            this.io.emit('killEvent', { text: `${p.name} pożarł ${b.name}` }); 
                            p.score += Math.floor(b.score * 0.5);
                            this.io.emit('deathMarker', { x: b.x, y: b.y });
                            delete this.bots[b.id]; this.spawnBot(); 
                        }
                        this.io.to(p.id).emit('botEaten', { newScore: p.score });
                    }
                    else if (dist < bRadius && b.score > p.score * 1.15) { // Bot zjada gracza
                        this.io.emit('killEvent', { text: `${b.name} pożarł ${p.name}` }); 
                        b.score += Math.floor(p.score * 0.5);
                        this.io.emit('deathMarker', { x: p.x, y: p.y }); 
                        this.killPlayer(p.id); 
                    }
                }
            });

            // Gracz vs Gracz (PvP w trybie Free)
            nearby.players.forEach(p2 => {
                if (!this.players[p.id] || !this.players[p2.id] || p.id === p2.id) return;
                if (p.isSafe || p2.isSafe) return; 

                let dist = Math.hypot(p.x - p2.x, p.y - p2.y);
                let r1 = 25 * (1 + Math.pow(Math.max(0, p.score - 1), 0.45) * 0.15);
                let r2 = 25 * (1 + Math.pow(Math.max(0, p2.score - 1), 0.45) * 0.15);

                if (dist < r1 && p.score > p2.score * 1.15) {
                    this.io.emit('killEvent', { text: `${p.name} wyeliminował ${p2.name}!` }); 
                    p.score += Math.floor(p2.score * 0.5); this.io.emit('deathMarker', { x: p2.x, y: p2.y }); this.killPlayer(p2.id); 
                } else if (dist < r2 && p2.score > p.score * 1.15) {
                    this.io.emit('killEvent', { text: `${p2.name} wyeliminował ${p.name}!` }); 
                    p2.score += Math.floor(p.score * 0.5); this.io.emit('deathMarker', { x: p.x, y: p.y }); this.killPlayer(p.id); 
                }
            });
        });
    }
}

module.exports = FreeMode;