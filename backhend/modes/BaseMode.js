// ==========================================
// BaseMode.js - Główny silnik fizyki i mechaniki (KOMPLETNY)
// ==========================================

class BaseMode {
    constructor(io) {
        this.io = io;
        this.modeName = 'BASE';
        
        // --- KONFIGURACJA ŚWIATA ---
        this.WORLD_SIZE = 4000;
        this.MAX_FOODS = 200;
        this.MAX_LOOTS = 15; 
        
        this.players = {};
        this.foods = {};
        this.bots = {};
        this.loots = {}; 
        this.projectiles = {}; 
        
        this.entityIdCounter = 0;
        this.botNameCounter = 0;
        this.tickCounter = 0;
        this.dirtyFoods = true;
        
        this.bushes = [];
        this.meteorZones = [];
        this.botDifficultyMultiplier = 1.0;
        
        // Zmienne Eventowe
        this.activeEvent = null; 
        this.eventTimer = 0;      
        this.eventTickCounter = 0; 
        this.currentKingId = null;

        // Statystyki Broni
        this.weaponStats = {
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

        this.generateEnvironment();
        this.spawnInitialEntities();
    }

    generateEnvironment() {
        for (let i = 0; i < 35; i++) {
            this.bushes.push({ x: Math.random() * this.WORLD_SIZE, y: Math.random() * this.WORLD_SIZE, radius: 60 + Math.random() * 60 });
        }
    }

    spawnInitialEntities() {
        for (let i = 0; i < this.MAX_FOODS; i++) this.spawnFood();
        for (let i = 0; i < this.MAX_LOOTS; i++) this.spawnLoot();
    }

    spawnFood() {
        let id = ++this.entityIdCounter;
        this.foods[id] = { id: id, x: Math.random() * this.WORLD_SIZE, y: Math.random() * this.WORLD_SIZE };
        this.dirtyFoods = true; 
    }

    spawnLoot() {
        let id = ++this.entityIdCounter;
        const types = ['mass', 'skill', 'weapon'];
        this.loots[id] = {
            id: id,
            x: Math.random() * this.WORLD_SIZE,
            y: Math.random() * this.WORLD_SIZE,
            type: types[Math.floor(Math.random() * types.length)]
        };
    }

    // --- INTEGRACJA AI (QWEN) ---
    async getAIWellbeingMessage(mass) {
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

    async killPlayer(pId) {
        const p = this.players[pId];
        if (p) {
            if (pId === this.currentKingId) {
                this.io.emit('killEvent', { text: `☠️ Król ${p.name} obalony!`, time: 200 });
                this.currentKingId = null; this.activeEvent = null;   
            }
            this.onPlayerDeath(pId); // Dla specyficznych trybów
            
            console.log(`[ŚMIERĆ] Gracz ${p.name} zginął! Odpytuję AI...`);
            const finalMass = Math.floor(p.score || 0);
            p.isSafe = true; 
            const deathMessage = await this.getAIWellbeingMessage(finalMass);
            this.io.to(p.id).emit('gameOver', { finalScore: finalMass, message: deathMessage });
            delete this.players[pId];
        }
    }

    onPlayerDeath(pId) {} // Do nadpisania

    // ==========================================
    // OBSŁUGA POŁĄCZEŃ I ZDARZEŃ Z KLIENTA
    // ==========================================
    handleConnection(socket) {
        socket.on('joinGame', (data) => this.playerJoin(socket, data));
        socket.on('playerMovement', (data) => this.playerMove(socket, data));
        socket.on('disconnect', () => this.playerDisconnect(socket));
        
        socket.on('setBotDifficulty', (levelIndex) => {
            if (levelIndex === 0) this.botDifficultyMultiplier = 0.6;
            else if (levelIndex === 1) this.botDifficultyMultiplier = 1.0; 
            else if (levelIndex === 2) this.botDifficultyMultiplier = 1.5; 
            this.io.emit('killEvent', { text: `⚙️ Zmiana trudności AI: ${levelIndex === 0 ? 'ŁATWY' : levelIndex === 1 ? 'NORMALNY' : 'TRUDNY'}`, time: 150 });
        });

        socket.on('setFormation', (formationIndex) => {
            const p = this.players[socket.id];
            if (p) {
                p.formation = formationIndex;
                let formName = p.formation === 0 ? "OKRĄG" : (p.formation === 1 ? "KLIN (V)" : (p.formation === 2 ? "LINIA" : "WŁASNA (PPM)"));
                for (let bId in this.bots) { if (this.bots[bId].ownerId === p.id) this.bots[bId].isCustomPosition = false; }
                socket.emit('formationSwitched', formName);
            }
        });

        socket.on('switchFormation', () => {
            const p = this.players[socket.id];
            if (p) {
                p.formation = (p.formation + 1) % 4; 
                let formName = p.formation === 0 ? "OKRĄG" : (p.formation === 1 ? "KLIN (V)" : (p.formation === 2 ? "LINIA" : "WŁASNA (PPM)"));
                for (let bId in this.bots) { if (this.bots[bId].ownerId === p.id) this.bots[bId].isCustomPosition = false; }
                socket.emit('formationSwitched', formName);
            }
        });

        socket.on('setBotOffset', (data) => {
            if (!data || !data.botId) return;
            const p = this.players[socket.id];
            let b = this.bots[data.botId];
            if (p && b && b.ownerId === p.id) {
                b.angleOffset = data.angleOffset || 0; 
                b.distOffset = data.distOffset || 0;
                b.isCustomPosition = true;
            }
        });

        socket.on('dash', (dir) => {
            if (!dir) return; 
            const p = this.players[socket.id];
            const now = Date.now();
            if (p && p.paths.speed === 'dash' && now - p.lastDashUse > 3000) {
                p.lastDashUse = now; 
                let dashDist = 150;
                let dx = parseFloat(dir.x) || 0; let dy = parseFloat(dir.y) || 0;
                let len = Math.hypot(dx, dy);
                if (len > 0) { dx /= len; dy /= len; } else { dx = Math.cos(p.moveAngle || 0); dy = Math.sin(p.moveAngle || 0); }
                let nextX = p.x + dx * dashDist; let nextY = p.y + dy * dashDist;
                
                if (this.canCrossCastleWall(p.x, p.y, nextX, nextY)) {
                    p.x = Math.max(0, Math.min(this.WORLD_SIZE, nextX)); 
                    p.y = Math.max(0, Math.min(this.WORLD_SIZE, nextY));
                    this.io.emit('killEvent', { text: `💨 Zryw!`, time: 100 });
                }
            }
        });

        socket.on('toggleRecruit', () => {
            const p = this.players[socket.id];
            if (p) { p.isRecruiting = !p.isRecruiting; socket.emit('recruitToggled', p.isRecruiting); }
        });

        socket.on('upgradeSkill', (skillName) => {
            const p = this.players[socket.id];
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
            if (!data || !data.category || !data.path) return;
            const p = this.players[socket.id];
            if (p && p.skills[data.category] >= 5 && p.paths[data.category] === 'none') {
                p.paths[data.category] = data.path;
                socket.emit('skillUpdated', { skills: p.skills, points: p.skillPoints, paths: p.paths });
            }
        });

        socket.on('claimGachaReward', (data) => {
            if (!data) return;
            const p = this.players[socket.id];
            if (!p) return;
            if (data.type === 'weapon') {
                p.inventory[data.item] = 1; p.activeWeapon = data.item;
                this.io.emit('killEvent', { text: `🔥 ${p.name} wylosował potężną broń: ${data.itemName}!` });
            } else if (data.type === 'skin_fragment') {
                this.io.emit('killEvent', { text: `🌟 ${p.name} zdobył fragment: ${data.itemName}!` });
            }
        });

        socket.on('buyShopItem', (item) => {
            const p = this.players[socket.id];
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
                for (let bId in this.bots) {
                    if (this.bots[bId].ownerId === p.id) { this.bots[bId].inventory[item] = 1; this.bots[bId].activeWeapon = item; }
                }
            } else {
                socket.emit('shopError', { message: "Za mało punktów masy!" });
            }
        });

        socket.on('switchWeapon', (slot) => {
            const p = this.players[socket.id];
            if(!p) return;
            if (slot === 1) p.activeWeapon = 'sword';
            else if (slot === 2) {
                const types = ['shotgun', 'crossbow', 'diamond_bow', 'golden_bow', 'bow', 'cleaver', 'hunting_knife', 'diamond_knife', 'golden_knife', 'knife', 'explosive_kunai', 'chakram', 'diamond_shuriken', 'golden_shuriken', 'shuriken'];
                for(let t of types) if(p.inventory[t]) { p.activeWeapon = t; break; }
            }
            for (let bId in this.bots) { if (this.bots[bId].ownerId === p.id) this.bots[bId].activeWeapon = p.activeWeapon; }
        });

        socket.on('equipFromInventory', (data) => {
            if (!data || !data.weaponId) return;
            const p = this.players[socket.id];
            if (!p) return;
            if (p.inventory[data.weaponId] > 0) {
                p.activeWeapon = data.weaponId;
                for (let bId in this.bots) { if (this.bots[bId].ownerId === p.id) this.bots[bId].activeWeapon = p.activeWeapon; }
            }
        });

        socket.on('throwSword', (data) => {
            if (!data || typeof data.x !== 'number' || typeof data.y !== 'number') return;
            const p = this.players[socket.id];
            if (!p) return;
            let type = p.activeWeapon;
            let stats = this.weaponStats[type];
            
            if (stats && p.score >= stats.cost) {
                let canShoot = false;
                if (type === 'sword' && p.score >= 15) canShoot = true;
                else if (type !== 'sword' && p.inventory[type] > 0) canShoot = true;

                if (canShoot) {
                    p.score -= stats.cost;
                    let finalDmg = type === 'sword' ? stats.dmg + (p.skills.weapon * 1) : stats.dmg;
                    let isPierce = type === 'sword' ? (p.paths.weapon === 'piercing') : stats.piercing;
                    
                    let pid = ++this.entityIdCounter;
                    this.projectiles[pid] = {
                        id: pid, ownerId: socket.id, ownerTeam: p.team || null, teamInitial: p.team || null,
                        x: data.x, y: data.y, dx: data.dx, dy: data.dy,
                        life: stats.life, speed: stats.speed, isBotSword: false,
                        scoreAtThrow: p.score, isPiercing: isPierce, damage: finalDmg, isWinter: false, projType: type 
                    };
                }
            }
        });
    }

    playerJoin(socket, data) {
        const skinType = data.skin || 'standard';
        let baseSpeed = skinType === 'ninja' ? 5.5 : (skinType === 'arystokrata' ? 4.8 : 5);
        let massGainMult = skinType === 'arystokrata' ? 1.15 : 1.0; 
        
        this.players[socket.id] = {
            id: socket.id, x: typeof data.spawnX === 'number' ? data.spawnX : 2000, y: typeof data.spawnY === 'number' ? data.spawnY : 2000, 
            score: 0, baseSpeed: baseSpeed, massMultiplier: massGainMult, level: 1, skillPoints: 0, skills: { speed: 0, strength: 0, weapon: 0 },
            paths: { speed: 'none', strength: 'none', weapon: 'none' }, lastWinterUse: 0, lastDashUse: 0, isMoving: false, idleTime: 0,     
            color: data.color || '#000', name: data.name || 'Gracz', skin: skinType, isSafe: false, isShielding: false, armorHits: 0,
            inventory: { bow: 0, knife: 0, shuriken: 0 }, activeWeapon: 'sword', isRecruiting: false, formation: 0, moveAngle: 0, team: null,
            isTutorialActive: true, tutorialFlags: { m15: false, m50: false, m100: false }
        };
        
        socket.emit('init', { id: socket.id, bushes: this.bushes });
        this.io.to(socket.id).emit('tutorialTick', { text: this.getTutorialMessage(data.name, `join_${skinType}`) });
    }

    playerMove(socket, data) {
        const p = this.players[socket.id];
        if (p && this.canCrossCastleWall(p.x, p.y, data.x, data.y)) {
            p.isMoving = (data.x !== p.x || data.y !== p.y);
            if (p.isMoving) p.idleTime = 0; 
            if (p.isMoving) p.moveAngle = Math.atan2(data.y - p.y, data.x - p.x);
            p.x = data.x; p.y = data.y; p.isSafe = data.isSafe; p.isShielding = data.isShielding; 
            
            let newLevel = Math.floor(p.score / 20) + 1;
            if (newLevel > p.level) {
                p.level = newLevel; p.skillPoints++;
                socket.emit('levelUp', { level: p.level, points: p.skillPoints });
            }
        } else if (p) { p.isSafe = false; }
    }

    playerDisconnect(socket) {
        if (this.players[socket.id]) {
            this.onPlayerDeath(socket.id); 
            delete this.players[socket.id];
        }
    }

    canCrossCastleWall(oldX, oldY, newX, newY) { return true; } // Nadpisywane

    getTutorialMessage(playerName, eventType) {
        const messages = {
            'join_standard': `Witaj na arenie, ${playerName}! Jako Zwykły Wojownik rośniesz odrobinę szybciej. Zbieraj pomarańczowe kropki i skrzynki!`,
            'join_ninja': `Witaj w cieniach, ${playerName}. Jesteś zwinny jak Ninja, ale uważaj, jesteś bardzo delikatny na starcie! Zbieraj kropki, by przetrwać!`,
            'join_arystokrata': `Ah, Wasza Wysokość ${playerName}! Jako Arystokrata masz zniżki w Zamkowym Sklepie i zbijasz fortunę na kropkach!`,
            'mass15': `Masz 15 masy! Odblokowałeś Miecz. Kliknij LPM (Myszka) lub przycisk na ekranie, by rzucić. Koszt: 2 pkt masy.`,
            'mass50': `Pół drogi do potęgi (50 masy)! Możesz używać Tarczy. Przytrzymaj [Q] lub ikonę tarczy, by odbijać ataki.`,
            'mass100': `Niesamowite, 100 masy (5 poziom)! Użyj menu po lewej i wybierz klasę (np. Zryw pod [SHIFT]).`,
            'toxic_rain': `Uwaga! Kwaśny Deszcz! 🌧️ Szybko chowaj się pod dachem Zamku, inaczej deszcz wypali Twoją masę!`,
            'blizzard': `Brrr... Śnieżyca! ❄️ Wszyscy zwalniają. To idealny moment, by rzucać mieczami w powolne cele!`
        };
        return messages[eventType] || `Walcz dzielnie, ${playerName}!`;
    }

    // ==========================================
    // GŁÓWNA PĘTLA BACKENDU (Odpalana przez serwer.js)
    // ==========================================
    update() {
        this.tickCounter++;
        this.eventTickCounter++;

        // 1. Sprawdzanie śmierci graczy
        for (let pId in this.players) {
            let p = this.players[pId];
            if (!p.isSafe && (p.x < -10 || p.x > this.WORLD_SIZE + 10 || p.y < -10 || p.y > this.WORLD_SIZE + 10)) {
                this.io.emit('killEvent', { text: `${p.name} zginął poza mapą!` }); 
                this.killPlayer(pId);
            }
        }

        // 2. SYSTEM EVENTÓW
        this.eventTimer++;
        if (this.eventTimer > 2700 && this.activeEvent === null) {
            let playersArray = Object.values(this.players);
            let rand = Math.random();
            
            if (rand < 0.25 && playersArray.length > 0) {
                playersArray.sort((a, b) => b.score - a.score);
                let topPlayer = playersArray[0];
                if (topPlayer && topPlayer.score >= 50) { 
                    this.currentKingId = topPlayer.id; this.activeEvent = 'KING_HUNT';
                    this.io.emit('killEvent', { text: `👑 EVENT! ${topPlayer.name} ZDOBYŁ KORONĘ! WSZYSCY NA NIEGO!`, time: 300 });
                    setTimeout(() => {
                        if (this.activeEvent === 'KING_HUNT' && this.players[this.currentKingId]) {
                            this.players[this.currentKingId].score += 500; 
                            this.io.emit('killEvent', { text: `🛡️ Król przetrwał rzeź! +500 pkt!`, time: 200 });
                        }
                        this.activeEvent = null; this.currentKingId = null; this.eventTimer = 0;
                    }, 30000);
                } else this.eventTimer = 0; 
            } else if (rand < 0.5) {
                this.activeEvent = 'TOXIC_RAIN';
                this.io.emit('killEvent', { text: `🌧️ KWAŚNY DESZCZ! Uciekaj do bezpiecznej strefy (Zamku)!`, time: 300 });
                Object.values(this.players).forEach(p => { if (p.isTutorialActive) this.io.to(p.id).emit('tutorialTick', { text: this.getTutorialMessage(p.name, 'toxic_rain') }); });
                setTimeout(() => { this.activeEvent = null; this.eventTimer = 0; this.io.emit('killEvent', { text: `⛅ Przejaśnia się. Deszcz ustąpił.`, time: 200 }); }, 25000);
            } else if (rand < 0.75) {
                this.activeEvent = 'BLIZZARD';
                this.io.emit('killEvent', { text: `❄️ ZAMIĘĆ ŚNIEŻNA! Temperatura spada, wszyscy zwalniają!`, time: 300 });
                Object.values(this.players).forEach(p => { if (p.isTutorialActive) this.io.to(p.id).emit('tutorialTick', { text: this.getTutorialMessage(p.name, 'blizzard') }); });
                setTimeout(() => { this.activeEvent = null; this.eventTimer = 0; this.io.emit('killEvent', { text: `☀️ Śnieżyca ustała. Wracamy do normy.`, time: 200 }); }, 20000);
            } else {
                this.activeEvent = 'METEOR_SHOWER';
                this.io.emit('killEvent', { text: `☄️ UWAGA! Zbliża się deszcz meteorytów! Omijajcie czerwone strefy!`, time: 300 });
                for(let m = 0; m < 10; m++) this.meteorZones.push({ x: Math.random() * this.WORLD_SIZE, y: Math.random() * this.WORLD_SIZE, radius: 150 + Math.random() * 100, timer: 90 });
                setTimeout(() => { this.activeEvent = null; this.eventTimer = 0; this.io.emit('killEvent', { text: `💨 Zagrożenie minęło. Meteoryty spadły.`, time: 200 }); }, 15000); 
            }
        }

        // --- Logika Meteorytów ---
        for (let i = this.meteorZones.length - 1; i >= 0; i--) {
            let m = this.meteorZones[i];
            m.timer--;
            if (m.timer <= 0) {
                Object.values(this.players).forEach(p => {
                    if (!p.isSafe && Math.hypot(p.x - m.x, p.y - m.y) < m.radius) {
                        p.score = Math.max(1, p.score - 100); 
                        this.io.emit('damageText', { x: p.x, y: p.y - 30, val: 100, color: '#e74c3c' });
                        this.io.emit('deathMarker', { x: p.x, y: p.y });
                        if(p.score <= 1) this.killPlayer(p.id);
                    }
                });
                for (let bId in this.bots) {
                    if (Math.hypot(this.bots[bId].x - m.x, this.bots[bId].y - m.y) < m.radius) {
                        this.bots[bId].score = Math.max(1, this.bots[bId].score - 100);
                        this.io.emit('damageText', { x: this.bots[bId].x, y: this.bots[bId].y - 30, val: 100, color: '#e74c3c' });
                    }
                }
                this.meteorZones.splice(i, 1);
            }
        }

        // --- Kwaśny Deszcz i Klasa Tytana ---
        if (this.activeEvent === 'TOXIC_RAIN' && this.eventTickCounter % 30 === 0) {
            Object.values(this.players).forEach(p => { if (!p.isSafe && p.score > 5) { p.score -= (p.paths.strength === 'titan' ? 1 : 2); } });
            for (let bId in this.bots) { if (!this.bots[bId].isSafe && this.bots[bId].score > 5) this.bots[bId].score -= 1; }
        }

        if (this.eventTickCounter % 30 === 0) { 
            Object.values(this.players).forEach(p => {
                if (p.paths.strength === 'titan') {
                    if (!p.isMoving) p.idleTime++;
                    if (p.idleTime >= 3) p.score += 2; 
                }
            });
            for (let bId in this.bots) {
                if (!this.bots[bId].ownerId) { 
                    let growthChance = (this.bots[bId].score < 30 ? 0.4 : 0.1) * this.botDifficultyMultiplier;
                    if (Math.random() < growthChance) this.bots[bId].score += 1;
                }
            }
        }

        // --- Flagi Samouczka ---
        Object.values(this.players).forEach(p => {
            if (!p.isTutorialActive || !p.tutorialFlags) return;
            if (p.score >= 15 && !p.tutorialFlags.m15) { p.tutorialFlags.m15 = true; this.io.to(p.id).emit('tutorialTick', { text: this.getTutorialMessage(p.name, 'mass15') }); }
            else if (p.score >= 50 && !p.tutorialFlags.m50) { p.tutorialFlags.m50 = true; this.io.to(p.id).emit('tutorialTick', { text: this.getTutorialMessage(p.name, 'mass50') }); }
            else if (p.score >= 100 && !p.tutorialFlags.m100) { p.tutorialFlags.m100 = true; this.io.to(p.id).emit('tutorialTick', { text: this.getTutorialMessage(p.name, 'mass100') }); }
        });

        // ==========================================
        // 3. RUCH BOTÓW
        // ==========================================
        let armies = {};
        for (let bId in this.bots) {
            let b = this.bots[bId];
            if (b.ownerId) {
                if (!armies[b.ownerId]) armies[b.ownerId] = [];
                armies[b.ownerId].push(b);
            }
        }

        for (let bId in this.bots) {
            let b = this.bots[bId];
            
            if (b.isHyperboss) {
                if (b.score > 800) b.score = 800; 
                let timeAliveSec = (Date.now() - b.spawnTick) / 1000;
                if (timeAliveSec > 35) { delete this.bots[bId]; this.spawnBot(); continue; }
            }
            
            let owner = b.ownerId ? this.players[b.ownerId] : null;
            let botSpeedFromOwner = owner ? owner.baseSpeed : (2.5 * this.botDifficultyMultiplier); 
            let baseBotSpeed = botSpeedFromOwner + ((owner ? owner.skills.speed : 0) * 0.4);
            let isLightweight = owner && owner.paths.speed === 'lightweight';
            let currentBotSpeed = (this.activeEvent === 'BLIZZARD' && !isLightweight) ? baseBotSpeed * 0.4 : baseBotSpeed;
            
            let nextX = b.x; let nextY = b.y;

            if (b.ownerId) {
                if (owner && armies[b.ownerId]) {
                    let myIndex = armies[b.ownerId].indexOf(b);
                    let total = armies[b.ownerId].length;
                    let targetX = owner.x; let targetY = owner.y;

                    if (b.isCustomPosition) {
                        targetX = owner.x + Math.cos(owner.moveAngle + b.angleOffset) * b.distOffset;
                        targetY = owner.y + Math.sin(owner.moveAngle + b.angleOffset) * b.distOffset;
                    } else {
                        if (owner.formation === 0) { 
                            let angleStep = (Math.PI * 2) / total; let currentAngle = (Date.now() / 1500) + (myIndex * angleStep); let radius = 70 + (total * 2); 
                            targetX = owner.x + Math.cos(currentAngle) * radius; targetY = owner.y + Math.sin(currentAngle) * radius;
                        } else if (owner.formation === 1) { 
                            let row = Math.floor(myIndex / 2) + 1; let side = myIndex % 2 === 0 ? 1 : -1; if (myIndex === 0) { row = 1; side = 0; } 
                            targetX = owner.x - Math.cos(owner.moveAngle) * (row * 45) + Math.cos(owner.moveAngle + Math.PI/2) * (side * row * 35);
                            targetY = owner.y - Math.sin(owner.moveAngle) * (row * 45) + Math.sin(owner.moveAngle + Math.PI/2) * (side * row * 35);
                        } else if (owner.formation === 2) { 
                            let offset = (myIndex - (total - 1) / 2) * 45;
                            targetX = owner.x - Math.cos(owner.moveAngle) * 60 + Math.cos(owner.moveAngle + Math.PI/2) * offset;
                            targetY = owner.y - Math.sin(owner.moveAngle) * 60 + Math.sin(owner.moveAngle + Math.PI/2) * offset;
                        } else if (owner.formation === 3) {
                            targetX = owner.x + Math.cos(owner.moveAngle + (myIndex * 0.5)) * 80;
                            targetY = owner.y + Math.sin(owner.moveAngle + (myIndex * 0.5)) * 80;
                        }
                    }

                    b.targetX = targetX; b.targetY = targetY;
                    let distToTarget = Math.hypot(targetX - b.x, targetY - b.y);
                    if (distToTarget > 10) { 
                        b.angle = Math.atan2(targetY - b.y, targetX - b.x);
                        let speedMult = distToTarget > 120 ? 1.8 : (distToTarget > 40 ? 1.3 : 0.8);
                        nextX += Math.cos(b.angle) * (currentBotSpeed * speedMult); nextY += Math.sin(b.angle) * (currentBotSpeed * speedMult);
                    }
                } else if (!owner) {
                    b.ownerId = null; b.team = null; b.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
                    this.botNameCounter++; b.name = `Bot AI #${this.botNameCounter}`; b.inventory = { bow: 0, knife: 0, shuriken: 0 }; b.activeWeapon = 'sword';
                }
            } else {
                let isHuntingKing = false;
                if (this.activeEvent === 'KING_HUNT' && this.currentKingId && this.players[this.currentKingId]) {
                    let king = this.players[this.currentKingId];
                    if (!king.isSafe) {
                        isHuntingKing = true; b.angle = Math.atan2(king.y - b.y, king.x - b.x);
                        nextX += Math.cos(b.angle) * (currentBotSpeed * 1.5); nextY += Math.sin(b.angle) * (currentBotSpeed * 1.5);
                        b.color = '#c0392b'; 
                    }
                }
                if (!isHuntingKing) {
                    if (Math.random() < 0.02) b.angle = Math.random() * Math.PI * 2;
                    nextX += Math.cos(b.angle) * currentBotSpeed; nextY += Math.sin(b.angle) * currentBotSpeed;
                    if (b.color === '#c0392b' && !b.isHyperboss) b.color = `hsl(${Math.random() * 360}, 70%, 50%)`;
                }
                if (nextX < 0 || nextX > this.WORLD_SIZE) b.angle = Math.PI - b.angle;
                if (nextY < 0 || nextY > this.WORLD_SIZE) b.angle = -b.angle;
            }

            if (this.canCrossCastleWall(b.x, b.y, nextX, nextY)) {
                b.x = nextX; b.y = nextY;
            } else {
                b.angle += Math.PI / 2; b.x += Math.cos(b.angle) * 3; b.y += Math.sin(b.angle) * 3;
            }
        }

        // ==========================================
        // 4. SIATKA DLA POCISKÓW (Grid)
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

        const getNearbyEntities = (x, y) => {
            let cx = Math.floor(x / CELL_SIZE); let cy = Math.floor(y / CELL_SIZE);
            let nearby = { players: [], bots: [], foods: [], loots: [] };
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    let cell = grid[`${cx + dx},${cy + dy}`];
                    if (cell) { nearby.players.push(...cell.players); nearby.bots.push(...cell.bots); }
                }
            }
            return nearby;
        };

        // ==========================================
        // 5. POCISKI (Miecze, Shurikeny)
        // ==========================================
        for (let pId in this.projectiles) {
            let proj = this.projectiles[pId];
            proj.x += proj.dx * proj.speed; proj.y += proj.dy * proj.speed; proj.life--;

            let nearby = getNearbyEntities(proj.x, proj.y);

            nearby.bots.forEach(b => {
                if (!this.bots[b.id] || !this.projectiles[pId]) return;
                let hitRange = proj.isWinter ? 60 : 30; 
                if (proj.ownerId !== b.id && proj.ownerId !== b.ownerId && Math.hypot(proj.x - b.x, proj.y - b.y) < hitRange) {
                    if (b.ownerId && this.players[b.ownerId] && proj.ownerTeam === this.players[b.ownerId].team) return;
                    if (proj.ownerTeam && !b.team) return;

                    b.score = Math.max(1, b.score - proj.damage);
                    this.io.emit('damageText', { x: b.x, y: b.y - 20, val: proj.damage, color: '#fff' });
                    if (!proj.isPiercing) proj.life = 0; 
                }
            });

            nearby.players.forEach(pl => {
                if (!this.players[pl.id] || !this.projectiles[pId]) return;
                let hitRange = proj.isWinter ? 60 : 30;
                if (proj.ownerId !== pl.id && Math.hypot(proj.x - pl.x, proj.y - pl.y) < hitRange) {
                    if (proj.ownerTeam && proj.ownerTeam === pl.team) return;

                    if (pl.isShielding && !proj.isWinter) {
                        if (!proj.isPiercing) proj.life = 0; 
                    } else {
                        let damage = proj.damage;
                        if (pl.score >= 800) { damage -= 4; if (pl.armorHits < 3 && !proj.isWinter) { damage = 0; pl.armorHits++; } } 
                        else if (pl.score >= 400) { damage -= 3; } else if (pl.score >= 100) { damage -= 2; }

                        let strengthReduction = Math.floor((pl.skills.strength || 0) / 10);
                        damage -= strengthReduction; damage = Math.max(1, damage); 
                        if (proj.isWinter) damage = proj.damage;

                        pl.score = Math.max(1, pl.score - Math.floor(damage));
                        this.io.emit('damageText', { x: pl.x, y: pl.y - 30, val: Math.floor(damage), color: '#ff4757' });
                        
                        if (pl.paths.strength === 'thorns') {
                            let attacker = this.players[proj.ownerId];
                            if (attacker) {
                                let reflectDmg = Math.max(1, Math.floor(damage * 0.25));
                                attacker.score = Math.max(1, attacker.score - reflectDmg);
                                this.io.emit('damageText', { x: attacker.x, y: attacker.y - 30, val: reflectDmg, color: '#e67e22' });
                            }
                        }
                        if (!proj.isPiercing) proj.life = 0;
                    }
                }
            });

            if (proj.life <= 0) delete this.projectiles[pId];
        }

        // 6. Resetowanie Skilli
        Object.values(this.players).forEach(p => {
            let skillsChanged = false;
            if (p.score < 100 && p.skills.strength > 0) { p.skills.strength = 0; skillsChanged = true; }
            if (p.score < 15 && (p.skills.weapon > 0 || p.paths.weapon !== 'none' || p.activeWeapon !== 'sword')) {
                p.skills.weapon = 0; p.paths.weapon = 'none'; p.activeWeapon = 'sword'; skillsChanged = true;
            }
            if (skillsChanged) this.io.to(p.id).emit('skillUpdated', { skills: p.skills, points: p.skillPoints, paths: p.paths });
        });

        // 7. Odpalenie Logiki Trybu
        this.processModeRules();

        // 8. WYŚLIJ TICK DO GRACZY
        let payload = {
            players: this.players, bots: this.bots, projectiles: this.projectiles, loots: this.loots, 
            activeEvent: this.activeEvent, eventTimeLeft: Math.max(0, Math.floor((2700 - this.eventTimer) / 30)), meteorZones: this.meteorZones
        };
        
        if (this.dirtyFoods || this.tickCounter % 60 === 0) {
            payload.foods = this.foods;
            this.dirtyFoods = false;
        }

        this.io.emit('serverTick', payload);
    }

    processModeRules() {} // Zastępowane przez FreeMode.js
}

module.exports = BaseMode;