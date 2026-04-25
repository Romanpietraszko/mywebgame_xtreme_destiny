// ==========================================
// CAMPAIGN.JS - MEGA UPDATE: "Od Zera do Króla Serwera"
// Tryb: RPG Akcji / Vibe Noir / Zen & Survive
// ==========================================

// UWAGA: Nie łączymy się z serwerem Socket.IO! Wszystko działa lokalnie.

// --- ZMIENNE STANU I KONFIGURACJI LOKALNEJ ---
let player;
let foods = [];
let bots = [];
let projectiles = [];
let loots = [];
let controlType = 'WASD';
let gameState = 'MENU';
let lastMoveDir = { x: 1, y: 0 }; 
let screenShake = 0;

let skillPoints = 0;
let playerSkills = { speed: 0, strength: 0, weapon: 0 };
let paths = { speed: 'none', strength: 'none', weapon: 'none' }; 
window.weaponPath = 'none'; 

let damageTexts = [];
let particles = []; 
let killLogs = [];

let lastFrameTime = performance.now();
const frameDuration = 1000 / 60; // 60 FPS

// --- ZMIENNE KAMPANII (RPG) ---
let currentQuest = 1;
let questProgress = 0;
let currentMapType = 'campaign_1'; 

// System Anti-Tilt (Zdrowie Psychiczne)
let playerDeathCount = 0;
let respawnLockTimer = 0;

// System Bossa
let bossActive = false;
let bossEntity = null;

// Grafiki NPC
const imgZwiadowca = new Image();
imgZwiadowca.src = 'zwiadowca.png';

const imgKowal = new Image();
imgKowal.src = 'xtreme-destiny-kowal.png';

// Współrzędne Kluczowych Miejsc
const NPC_ZWIADOWCA = { x: 1600, y: 3800 }; 
const NPC_KOWAL = { x: 2400, y: 3800 };
const DOOR_POS = { x: 2000, y: 200 }; 

// Opowieść Midasa (Zen & Survive)
const campaignDialogues = {
    1: "MIDAS: Witaj w Cyfrowych Ruinach, {NAME}. Zbieraj Masy (kropki) w lesie na północ. Wróć, gdy zdobędziesz 10 pkt.",
    2: "MIDAS: Masz siłę. Przetestuj miecz (LPM) na Dzikich Szlamach. Nabij 25 masy.",
    3: "MIDAS: Dobrze. Mruganie to podstawa – bez nawilżonych oczu stracisz refleks. Mrugnij mocno i idź do Kowala (po prawej).",
    4: "KOWAL: Twoja broń to śmieć. Zdobądź 40 masy z lasu, a pomyślę nad jej wykuciem.",
    5: "MIDAS: Rośniesz. Zwiadowca po lewej ma dla ciebie ważne wieści.",
    6: "ZWIADOWCA: UWAŻAJ! Wyprostuj plecy... Odetchnij głęboko... ZASADZKA! Przetrwaj to piekło i wbij 60 masy!",
    7: "MIDAS: Żyjesz... Świetnie. Zdejmij na chwilę ręce z klawiatury. Rozluźnij dłonie. Odpocząłeś? Zdobądź 80 masy.",
    8: "KOWAL: Niezły pokaz siły. Podejdź, dam ci Ognisty Klucz.",
    9: "KOWAL: Masz klucz! Wbij 100 masy (5 Level), odblokuj klasę w lewym dolnym rogu ekranu i zamelduj się przy Jaskini na dalekiej północy (Radar!).",
    10: "MIDAS: Pamiętaj, {NAME}. Jaskinia to brak odwrotu. Wchodzimy!",

    11: "MIDAS: Dolina Cieni... Ciemno tu. Szlamy rzucają nożami! Zdobądź 130 masy, uważaj na ostrza.",
    12: "ZWIADOWCA: Trujące kratery zabijają na miejscu! Uważaj pod nogi. Wbij 160 masy.",
    13: "KOWAL: Wymagam więcej materiałów z tych zjaw. (Osiągnij 190 masy)",
    14: "MIDAS: KOLEJNA ZASADZKA! Skup wzrok i walcz o życie! Wbij 220 masy, nie daj się!",
    15: "ZWIADOWCA: Jeśli serce bije ci za szybko, weź wdech na 4 sekundy i wydech na 4 sekundy. Droga do Tronu jest na północy. Wbij 250 masy i przejdź przez bramę!",

    16: "MIDAS: Pustkowia Królów. Tu kolce rozerwią cię na strzępy. Bądź ostrożny. Zdobądź 280 masy.",
    17: "KOWAL: To już końcówka. Wykuję ci ostatni pancerz. Zbierz 310 masy!",
    18: "MIDAS: Zanim zrobimy finałowy krok... oderwij wzrok od ekranu na 5 sekund. Odpocznij. Gotowy? Zdobądź 350 masy.",
    19: "MIDAS: Tron już blisko, {NAME}! Wbij 380 masy i idź na północ!",
    20: "MIDAS: Co to za trzęsienie ziemi?! UWAŻAJ, KRÓL PUSTKOWI NADCIĄGA! Zniszcz go, albo on zniszczy ciebie!",
    21: "MIDAS: 👑 KAMPANIA UKOŃCZONA! 👑 Wygrałeś, {NAME}! Zabiłeś Króla! Teraz, z czystym sumieniem, zamknij grę i odpocznij w realnym świecie."
};

// Inicjalizacja lokalnej mapy
initMap(WORLD_SIZE, currentMapType);

// --- SYSTEM CZĄSTECZEK (Vibe Noir) ---
function spawnParticle(x, y, color, type = 'blood') {
    let count = 1;
    if (type === 'blood') count = 8;
    if (type === 'spark') count = 3;
    
    for (let i = 0; i < count; i++) {
        let vx = (Math.random() - 0.5) * 2;
        let vy = (Math.random() - 0.5) * 2;
        let size = 2 + Math.random() * 3;
        
        if (type === 'blood') {
            vx = (Math.random() - 0.5) * 6;
            vy = (Math.random() - 0.5) * 6;
            size = 2 + Math.random() * 4;
        } else if (type === 'spark') {
            vx = (Math.random() - 0.5) * 10;
            vy = (Math.random() - 0.5) * 10;
        } else if (type === 'dust') {
            size = 4 + Math.random() * 6;
        }

        particles.push({
            x: x, 
            y: y,
            vx: vx,
            vy: vy,
            life: 1.0,
            size: size,
            color: color,
            type: type
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; 
        p.y += p.vy;
        
        if (p.type === 'blood') {
            p.life -= 0.02;
        } else if (p.type === 'spark') {
            p.life -= 0.05;
        } else {
            p.life -= 0.04;
        }

        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// --- SYSTEM ZASADZEK I BOSSÓW ---
function triggerAmbush(count) {
    screenShake = 15;
    killLogs.push({ text: "⚠️ UWAGA! ZASADZKA CIENI! ⚠️", time: 300 });
    
    for (let i = 0; i < count; i++) {
        let angle = Math.random() * Math.PI * 2;
        let bx = player.x + Math.cos(angle) * 500;
        let by = player.y + Math.sin(angle) * 500;
        let bScore = Math.max(15, player.score * 0.8); 
        
        bots.push({
            id: `ambush_${Math.random()}`, 
            x: bx, 
            y: by,
            score: bScore, 
            color: '#e74c3c', 
            name: 'Zabójczy Cień',
            angle: Math.atan2(player.y - by, player.x - bx), 
            speed: 4.0 + (currentQuest * 0.1),
            ownerId: null, 
            team: null, 
            activeWeapon: 'knife', 
            inventory: { knife: 1 }, 
            paths: { weapon: 'piercing' }, 
            skills: { weapon: 10 },
            isAmbushTarget: true, 
            lastShootTime: 0
        });
    }
}

function spawnBoss() {
    screenShake = 30;
    bossActive = true;
    killLogs.push({ text: "☠️ KRÓL PUSTKOWI SIĘ PRZEBUDZIŁ! ☠️", time: 400 });
    
    bossEntity = {
        id: 'BOSS_KING', 
        x: player.x, 
        y: player.y - 600,
        score: player.score * 3.5, 
        maxScore: player.score * 3.5, 
        color: '#8e44ad', 
        name: 'Król Pustkowi',
        angle: Math.PI / 2, 
        speed: 2.8,
        ownerId: null, 
        team: null, 
        activeWeapon: 'crossbow', 
        inventory: { crossbow: 1 }, 
        paths: { weapon: 'piercing' }, 
        skills: { weapon: 20 },
        isBoss: true, 
        lastShootTime: 0, 
        phase: 1
    };
    bots.push(bossEntity);
}

// --- LOKALNY SYMULATOR ŚWIATA ---
function spawnLocalFood() { 
    return { 
        id: Math.random(), 
        x: Math.random() * WORLD_SIZE, 
        y: Math.random() * WORLD_SIZE 
    }; 
}

function spawnLocalBot(type) {
    let bx, by;
    do { 
        bx = 200 + Math.random() * 3600; 
        by = 200 + Math.random() * 3600; 
    } 
    while (Math.hypot(bx - 2000, by - 3800) < 600); 

    let bScore = 5 + Math.random() * 10;
    if (currentMapType === 'campaign_2') {
        bScore = 15 + Math.random() * 20;
    } else if (currentMapType === 'campaign_3') {
        bScore = 30 + Math.random() * 40;
    }
    
    return {
        id: `bot_${Math.random()}`, 
        x: bx, 
        y: by,
        score: bScore, 
        color: '#2ecc71', 
        name: 'Zmutowany Szlam',
        angle: Math.random() * Math.PI * 2, 
        speed: 1.5,
        ownerId: null, 
        team: null, 
        activeWeapon: 'sword', 
        inventory: { bow: 0 }, 
        paths: { weapon: 'none' }, 
        skills: { weapon: 0 },
        lastShootTime: 0
    };
}

for (let i = 0; i < 200; i++) {
    foods.push(spawnLocalFood());
}
for (let i = 0; i < 20; i++) {
    bots.push(spawnLocalBot('slime'));
}

// --- OBSŁUGA WEJŚCIA GRACZA ---
window.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('mousemove', (e) => {
    if (gameState === 'PLAYING' && player && controlType !== 'TOUCH') {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - canvas.width / 2;
        const mouseY = e.clientY - rect.top - canvas.height / 2;
        const angle = Math.atan2(mouseY, mouseX);
        
        lastMoveDir = { 
            x: Math.cos(angle), 
            y: Math.sin(angle) 
        };
    }
});

window.addEventListener('mousedown', (e) => {
    if (e.target.closest('#skill-menu') || e.target.closest('#castle-shop') || e.target.closest('button')) {
        return; 
    }
    
    if (gameState === 'PLAYING' && player && !player.isSafe && respawnLockTimer <= 0) { 
        let cost = 2; 
        let dmg = 5; 
        let wSpeed = 18; 
        let projType = 'sword'; 
        let pierce = (window.weaponPath === 'piercing');
        
        if (player.activeWeapon === 'knife') { 
            projType = 'knife'; 
            wSpeed = 22; 
            dmg = 12; 
        } else if (player.activeWeapon === 'bow') { 
            projType = 'bow'; 
            wSpeed = 26; 
            dmg = 8; 
        }

        if (player.score >= cost) {
            player.score -= cost;
            screenShake = Math.max(screenShake, 3);
            
            projectiles.push({
                id: Math.random(), 
                ownerId: player.id,
                x: player.x, 
                y: player.y, 
                dx: lastMoveDir.x, 
                dy: lastMoveDir.y,
                life: 60, 
                speed: wSpeed, 
                damage: dmg + playerSkills.weapon, 
                isPiercing: pierce, 
                projType: projType
            });
        }
    }
});

window.addEventListener('mobile-attack', () => { 
    window.dispatchEvent(new MouseEvent('mousedown', {button: 0})); 
});

window.onkeydown = (e) => { 
    keys[e.code] = true; 
    if (e.code === 'KeyH' && player) {
        player.isTutorialActive = !player.isTutorialActive; 
    }
};

window.onkeyup = (e) => { 
    keys[e.code] = false; 
};

// --- START KAMPANII ---
window.startGame = (type) => {
    controlType = type;
    document.getElementById('ui-layer').style.display = 'none';
    const name = document.getElementById('playerName').value || "Bohater";

    player = {
        id: 'local_player', 
        x: 2000, 
        y: 3800, 
        score: 0, 
        level: 1, 
        name: name, 
        color: '#f1c40f', 
        isSafe: true, 
        isShielding: false, 
        aura: null, 
        inventory: { bow: 0, knife: 0, shuriken: 0 }, 
        activeWeapon: 'sword',
        isTutorialActive: true, 
        tutorialText: campaignDialogues[currentQuest].replace('{NAME}', name),
        skin: window.playerSkin || 'standard',
        baseSpeed: window.playerSkin === 'ninja' ? 5.5 : 5.0, 
        massMultiplier: window.playerSkin === 'arystokrata' ? 1.15 : (window.playerSkin === 'standard' ? 1.02 : 1.0),
        paths: { speed: 'none', strength: 'none', weapon: 'none' }, 
        skills: { speed: 0, strength: 0, weapon: 0 } 
    };
    
    gameState = 'PLAYING'; 
    lastFrameTime = performance.now(); 
    requestAnimationFrame(gameLoop);
};

// --- LOGIKA QUESTÓW I ZMIANY AKTÓW ---
function advanceQuest(newQuestNum) {
    currentQuest = newQuestNum;
    player.tutorialText = campaignDialogues[currentQuest].replace('{NAME}', player.name);
    killLogs.push({ text: "⭐ MISJA ZAKTUALIZOWANA!", time: 200 });
    screenShake = 10;
    
    if (newQuestNum === 6) {
        triggerAmbush(4);
    }
    if (newQuestNum === 14) {
        triggerAmbush(7);
    }
    if (newQuestNum === 20) {
        spawnBoss();
    }
}

function transitionToNextAct(newMapType) {
    currentMapType = newMapType; 
    initMap(WORLD_SIZE, currentMapType);
    
    player.x = 2000; 
    player.y = 3800; 
    player.isSafe = true;
    
    foods.length = 0; 
    bots.length = 0; 
    projectiles.length = 0; 
    particles.length = 0;
    
    for (let i = 0; i < 150; i++) {
        foods.push(spawnLocalFood());
    }
    for (let i = 0; i < 15; i++) {
        bots.push(spawnLocalBot('slime'));
    }
    
    killLogs.push({ text: "Wkraczasz do nowego regionu...", time: 300 });
}

// --- SILNIK LOKALNY KAMPANII ---
function updateLocalPhysics() {
    if (!player) return;

    if (respawnLockTimer > 0) {
        respawnLockTimer -= frameDuration;
        return; 
    }

    // --- RUCH GRACZA ---
    let dx = 0, dy = 0;
    
    if (controlType === 'TOUCH') { 
        if (window.mobileJoy && window.mobileJoy.active) { 
            dx = window.mobileJoy.dx; 
            dy = window.mobileJoy.dy; 
            lastMoveDir = { x: dx, y: dy }; 
            
            let len = Math.hypot(dx, dy); 
            if (len > 0) { 
                dx /= len; 
                dy /= len; 
            } 
        } 
    } else if (controlType === 'WASD') { 
        if (keys['KeyW']) dy--; 
        if (keys['KeyS']) dy++; 
        if (keys['KeyA']) dx--; 
        if (keys['KeyD']) dx++; 
    } else { 
        if (keys['ArrowUp']) dy--; 
        if (keys['ArrowDown']) dy++; 
        if (keys['ArrowLeft']) dx--; 
        if (keys['ArrowRight']) dx++; 
    }
    
    if (dx !== 0 || dy !== 0) {
        let moveAngle = Math.atan2(dy, dx); 
        let speed = player.baseSpeed + (playerSkills.speed * 0.5);
        
        player.x += Math.cos(moveAngle) * speed; 
        player.y += Math.sin(moveAngle) * speed;
        
        if (Math.random() > 0.6) {
            spawnParticle(player.x, player.y + 20, 'rgba(50,50,50,0.8)', 'dust');
        }
    }
    
    player.x = Math.max(0, Math.min(WORLD_SIZE, player.x)); 
    player.y = Math.max(0, Math.min(WORLD_SIZE, player.y));

    // --- MECHANIKA QUESTÓW (Kolizje z NPC i Drzwiami) ---
    let distSmith = Math.hypot(player.x - NPC_KOWAL.x, player.y - NPC_KOWAL.y);
    let distScout = Math.hypot(player.x - NPC_ZWIADOWCA.x, player.y - NPC_ZWIADOWCA.y);
    let distGate = Math.hypot(player.x - DOOR_POS.x, player.y - DOOR_POS.y);

    if (distSmith < 100) { 
        if (currentQuest === 3) {
            advanceQuest(4); 
        }
        if (currentQuest === 8) { 
            advanceQuest(9); 
            player.inventory.knife = 1; 
        } 
    }
    
    if (distScout < 100) { 
        if (currentQuest === 5) {
            advanceQuest(6); 
        }
    }
    
    if (distGate < 150) {
        if (currentQuest === 10) { 
            advanceQuest(11); 
            transitionToNextAct('campaign_2'); 
        }
        if (currentQuest === 15) { 
            advanceQuest(16); 
            transitionToNextAct('campaign_3'); 
        }
        if (currentQuest === 19 && currentMapType === 'campaign_3') { 
            player.x = 2000; 
            player.y = 2000; 
            advanceQuest(20); 
        } 
    }

    // --- LOGIKA MASY ---
    player.isSafe = safeZones.some(z => Math.hypot(player.x - z.x, player.y - z.y) < z.radius) || currentQuest === 21;
    let playerRadius = 25 * (1 + Math.pow(Math.max(0, player.score - 1), 0.45) * 0.15);

    foods.forEach((f, fi) => {
        if (Math.hypot(player.x - f.x, player.y - f.y) < playerRadius) {
            player.score += 1 * player.massMultiplier; 
            foods[fi] = spawnLocalFood();
            
            // AUTOMATYCZNY SPRAWDZACZ ZADAŃ
            if (currentQuest === 1 && player.score >= 10) advanceQuest(2);
            else if (currentQuest === 2 && player.score >= 25) advanceQuest(3);
            else if (currentQuest === 4 && player.score >= 40) advanceQuest(5);
            else if (currentQuest === 6 && player.score >= 60) advanceQuest(7);
            else if (currentQuest === 7 && player.score >= 80) advanceQuest(8);
            else if (currentQuest === 9 && player.score >= 100) advanceQuest(10);
            else if (currentQuest === 11 && player.score >= 130) advanceQuest(12);
            else if (currentQuest === 12 && player.score >= 160) advanceQuest(13);
            else if (currentQuest === 13 && player.score >= 190) advanceQuest(14);
            else if (currentQuest === 14 && player.score >= 220) advanceQuest(15);
            else if (currentQuest === 16 && player.score >= 280) advanceQuest(17);
            else if (currentQuest === 17 && player.score >= 310) advanceQuest(18);
            else if (currentQuest === 18 && player.score >= 350) advanceQuest(19);
        }
    });

    // --- AI BOTÓW I BOSSA ---
    const now = Date.now();
    
    bots.forEach((b, bi) => {
        let isAmbushOrBoss = b.isAmbushTarget || b.isBoss;
        
        if (isAmbushOrBoss && !player.isSafe) {
            b.angle = Math.atan2(player.y - b.y, player.x - b.x); 
            
            let shootCooldown = b.isBoss ? 1000 : 2500;
            
            if (b.score >= 15 && now - b.lastShootTime > shootCooldown && Math.hypot(player.x - b.x, player.y - b.y) < 600) {
                b.lastShootTime = now;
                b.score -= 2;
                
                projectiles.push({
                    id: Math.random(), 
                    ownerId: b.id, 
                    x: b.x, 
                    y: b.y, 
                    dx: Math.cos(b.angle), 
                    dy: Math.sin(b.angle),
                    life: 90, 
                    speed: b.isBoss ? 35 : 22, 
                    damage: b.isBoss ? 40 : 12, 
                    isPiercing: b.isBoss, 
                    projType: b.activeWeapon
                });
            }
        } else if (Math.random() < 0.05) { 
            b.angle = Math.random() * Math.PI * 2; 
        } 

        b.x += Math.cos(b.angle) * b.speed; 
        b.y += Math.sin(b.angle) * b.speed;
        
        if (!isAmbushOrBoss) { 
            if (b.x < 100 || b.x > WORLD_SIZE-100 || b.y > WORLD_SIZE-100 || b.y < 100) {
                b.angle += Math.PI; 
            }
        } 

        let dist = Math.hypot(player.x - b.x, player.y - b.y);
        let bRadius = 25 * (1 + Math.pow(Math.max(0, b.score - 1), 0.45) * 0.15);

        // KOLIZJE FIZYCZNE (Zjadanie)
        if (!player.isSafe) {
            if (dist < playerRadius && player.score > b.score * 1.15) {
                player.score += Math.floor(b.score * 0.5);
                spawnParticle(b.x, b.y, '#ff0000', 'blood'); 
                killLogs.push({ text: `Zabiłeś ${b.name}!`, time: 150 });
                screenShake = 10;
                
                if (b.isBoss) {
                    advanceQuest(21); 
                    bots.splice(bi, 1);
                    bossActive = false;
                } else if (b.isAmbushTarget) {
                    bots.splice(bi, 1);
                } else {
                    bots[bi] = spawnLocalBot('slime');
                }
            } else if (dist < bRadius && b.score > player.score * 1.15) {
                // ŚMIERĆ GRACZA (ANTI-TILT SYSTEM)
                spawnParticle(player.x, player.y, '#ff0000', 'blood'); 
                player.score = Math.floor(player.score * 0.8); 
                player.x = 2000; 
                player.y = 3800; 
                playerDeathCount++;
                screenShake = 20;
                
                if (playerDeathCount >= 3) {
                    respawnLockTimer = 10000; 
                    killLogs.push({ text: `☠️ TILT! Odpocznij przez 10 sekund.`, time: 600 });
                    player.tutorialText = "MIDAS: Twoje dłonie drżą. Pamięć mięśniowa zawodzi. Zdejmij ręce z klawiatury. Zamknij oczy na 10 sekund. Wrócisz silniejszy.";
                    playerDeathCount = 0;
                } else {
                    killLogs.push({ text: `☠️ Zginąłeś! Tracisz masę i wracasz do bazy.`, time: 200 });
                    player.tutorialText = "MIDAS: Bolało? Odetchnij głęboko, wypuść powietrze i spróbuj ponownie. Bądź uważniejszy.";
                }
                
                bots = bots.filter(bot => !bot.isAmbushTarget && !bot.isBoss); 
                if (bossActive) { 
                    currentQuest = 19; 
                    bossActive = false; 
                } 
            }
        }
    });

    // --- KOLIZJE POCISKÓW ---
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.dx * p.speed; 
        p.y += p.dy * p.speed; 
        p.life--;

        // Trafienie w gracza 
        if (p.ownerId !== player.id && !player.isSafe && Math.hypot(p.x - player.x, p.y - player.y) < 30) {
            player.score = Math.max(1, player.score - p.damage);
            spawnParticle(player.x, player.y, '#ff0000', 'blood'); 
            screenShake = Math.max(screenShake, p.damage > 20 ? 15 : 5);
            damageTexts.push({ x: player.x, y: player.y, val: p.damage, color: '#ff4757', life: 1, vx: 0, vy: -2 });
            if (!p.isPiercing) {
                p.life = 0;
            }
        }

        // Trafienie w bota
        bots.forEach((b) => {
            if (p.ownerId !== b.id && Math.hypot(p.x - b.x, p.y - b.y) < 30) {
                b.score = Math.max(1, b.score - p.damage);
                spawnParticle(b.x, b.y, '#f1c40f', 'spark'); 
                damageTexts.push({ x: b.x, y: b.y, val: p.damage, color: '#fff', life: 1, vx: 0, vy: -2 });
                if (!p.isPiercing) {
                    p.life = 0; 
                }
            }
        });

        if (p.life <= 0) {
            projectiles.splice(i, 1);
        }
    }
    
    updateParticles();
    camera.x = player.x - canvas.width / 2; 
    camera.y = player.y - canvas.height / 2;
}

// --- RYSOWANIE EKRANU ---
function gameLoop(currentTime) {
    const deltaTime = currentTime - lastFrameTime;
    if (deltaTime < frameDuration) { 
        requestAnimationFrame(gameLoop); 
        return; 
    }
    lastFrameTime = currentTime - (deltaTime % frameDuration);

    if (gameState === 'PLAYING') {
        updateLocalPhysics(); 
    }

    // 1. CZYSZCZENIE EKRANU 
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#050505'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (screenShake > 0) { 
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake); 
        screenShake *= 0.9; 
        if (screenShake < 0.5) {
            screenShake = 0; 
        }
    }

    let vWidth = canvas.width / globalScale; 
    let vHeight = canvas.height / globalScale;
    let vCamera = { x: player.x - vWidth / 2, y: player.y - vHeight / 2 };

    // 2. RYSOWANIE MAPY 
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(globalScale, globalScale);
    ctx.translate(-vWidth / 2, -vHeight / 2);
    
    if (typeof drawForestMap === 'function') {
        drawForestMap(ctx, vCamera, vWidth, vHeight);
    }
    ctx.restore();

    // 3. RYSOWANIE OBIEKTÓW
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(globalScale, globalScale);
    ctx.translate(-player.x, -player.y); 

    let isGateGlowing = (currentQuest === 10 || currentQuest === 15);
    drawCaveEntrance(DOOR_POS.x, DOOR_POS.y, isGateGlowing);

    if (currentMapType === 'campaign_1') {
        drawHut(2000, 3800, 150); 
        drawDeadTree(NPC_ZWIADOWCA.x, NPC_ZWIADOWCA.y);
        if (imgZwiadowca.complete) {
            ctx.drawImage(imgZwiadowca, NPC_ZWIADOWCA.x - 40, NPC_ZWIADOWCA.y - 40, 80, 80);
            ctx.fillStyle = '#ffffff'; 
            ctx.font = 'bold 14px Rajdhani'; 
            ctx.textAlign = 'center'; 
            ctx.fillText("Zwiadowca", NPC_ZWIADOWCA.x, NPC_ZWIADOWCA.y - 50);
        }
        
        drawBlacksmithArea(NPC_KOWAL.x, NPC_KOWAL.y);
        if (imgKowal.complete) {
            ctx.drawImage(imgKowal, NPC_KOWAL.x - 40, NPC_KOWAL.y - 40, 80, 80);
            ctx.fillStyle = '#e67e22'; 
            ctx.font = 'bold 14px Rajdhani'; 
            ctx.textAlign = 'center'; 
            ctx.fillText("Kowal", NPC_KOWAL.x, NPC_KOWAL.y - 50);
        }
    }

    particles.forEach(p => { 
        ctx.globalAlpha = Math.max(0, p.life); 
        ctx.fillStyle = p.color; 
        ctx.beginPath(); 
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); 
        ctx.fill(); 
    });
    ctx.globalAlpha = 1.0;

    ctx.fillStyle = '#ffffff';
    foods.forEach(f => { 
        ctx.beginPath(); 
        ctx.arc(f.x, f.y, 6, 0, Math.PI * 2); 
        ctx.fill(); 
    });
    
    projectiles.forEach(p => {
        let rot = Math.atan2(p.dy, p.dx); 
        if (p.projType === 'sword') {
            drawSwordModel(p, p.x, p.y, rot + (Date.now()/100), 0.8, 1);
        } else if (p.projType.includes('knife')) {
            drawKnifeModel(p.x, p.y, rot + Math.PI/2, 0.8, p.projType);
        } else if (p.projType === 'crossbow') {
            drawBowModel(p.x, p.y, rot, 0.8, p.projType);
        }
    });

    bots.forEach(b => {
        drawStickman(b, b.x, b.y, getScale(b.score), false, null);
    });
    
    if (player) {
        player.weaponPath = paths.weapon || 'none';
        if (respawnLockTimer > 0) { 
            ctx.globalAlpha = 0.3; 
        } 
        drawStickman(player, player.x, player.y, getScale(player.score), player.isSafe, null);
        ctx.globalAlpha = 1.0;
    }

    for (let i = damageTexts.length - 1; i >= 0; i--) {
        let dt = damageTexts[i]; 
        dt.x += dt.vx; 
        dt.y += dt.vy; 
        dt.life -= 0.02; 
        
        ctx.save(); 
        ctx.globalAlpha = Math.max(0, dt.life); 
        ctx.fillStyle = dt.color; 
        ctx.strokeStyle = '#000'; 
        ctx.lineWidth = 3;
        ctx.font = `bold ${20 + (1 - dt.life) * 15}px 'Permanent Marker', Arial`; 
        ctx.textAlign = 'center'; 
        ctx.textBaseline = 'middle';
        ctx.strokeText(`-${dt.val}`, dt.x, dt.y); 
        ctx.fillText(`-${dt.val}`, dt.x, dt.y); 
        ctx.restore();
        
        if (dt.life <= 0) {
            damageTexts.splice(i, 1);
        }
    }
    ctx.restore(); 

    // --- 4. RYSOWANIE HUD ---
    ctx.restore(); 
    
    if (respawnLockTimer > 0) {
        ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff'; 
        ctx.font = "bold 40px 'Rajdhani', sans-serif"; 
        ctx.textAlign = 'center';
        ctx.fillText(`ZAMKNIJ OCZY: ${Math.ceil(respawnLockTimer/1000)}s`, canvas.width / 2, canvas.height / 2);
    }

    if (gameState === 'PLAYING' && player && player.isTutorialActive) {
        ctx.save();
        let tutorialX = 20; 
        let tutorialY = canvas.height - 200; 
        
        ctx.fillStyle = currentQuest === 21 ? 'rgba(46, 204, 113, 0.95)' : 'rgba(10, 10, 15, 0.95)';
        ctx.fillRect(tutorialX, tutorialY, 400, 120);
        ctx.strokeStyle = '#3498db'; 
        ctx.lineWidth = 2; 
        ctx.strokeRect(tutorialX, tutorialY, 400, 120);
        
        let speakerName = "MIDAS"; 
        let rawText = player.tutorialText || ""; 
        let displayText = rawText;
        
        if (rawText.startsWith("KOWAL:")) { 
            speakerName = "KOWAL"; 
            displayText = rawText.replace("KOWAL: ", "").trim(); 
        } else if (rawText.startsWith("ZWIADOWCA:")) { 
            speakerName = "ZWIADOWCA"; 
            displayText = rawText.replace("ZWIADOWCA: ", "").trim(); 
        } else if (rawText.startsWith("MIDAS:")) { 
            speakerName = "MIDAS"; 
            displayText = rawText.replace("MIDAS: ", "").trim(); 
        }

        if (speakerName === "MIDAS" && typeof skins !== 'undefined' && skins.midas && skins.midas.complete) {
            ctx.drawImage(skins.midas, tutorialX + 10, tutorialY + 15, 90, 90); 
        } else if (speakerName === "KOWAL" && imgKowal.complete) {
            ctx.drawImage(imgKowal, tutorialX + 10, tutorialY + 15, 90, 90);
        } else if (speakerName === "ZWIADOWCA" && imgZwiadowca.complete) {
            ctx.drawImage(imgZwiadowca, tutorialX + 10, tutorialY + 15, 90, 90);
        }

        ctx.fillStyle = '#3498db'; 
        ctx.font = "bold 18px 'Permanent Marker', cursive"; 
        ctx.textAlign = 'left';
        ctx.fillText(speakerName + ":", tutorialX + 120, tutorialY + 25);
        
        ctx.fillStyle = '#dddddd'; 
        ctx.font = "bold 14px 'Rajdhani', sans-serif";
        if (displayText) {
            window.wrapText(ctx, displayText, tutorialX + 120, tutorialY + 50, 260, 18);
        }
        
        ctx.fillStyle = '#888888'; 
        ctx.font = 'bold 10px Arial'; 
        ctx.fillText("[H] - Ukryj podpowiedź", tutorialX + 120, tutorialY + 110);
        ctx.restore();
    }

    ctx.fillStyle = 'rgba(10, 10, 15, 0.9)'; 
    ctx.fillRect(canvas.width - 300, 20, 280, 100);
    ctx.strokeStyle = '#3498db'; 
    ctx.lineWidth = 2; 
    ctx.strokeRect(canvas.width - 300, 20, 280, 100);
    
    ctx.fillStyle = '#f1c40f'; 
    ctx.font = "bold 20px 'Rajdhani', sans-serif"; 
    
    let actName = "📜 AKT 1: CYFROWE RUINY";
    if (currentMapType === 'campaign_2') {
        actName = "📜 AKT 2: DOLINA CIENI";
    } else if (currentMapType === 'campaign_3') {
        actName = "📜 AKT 3: PUSTKOWIA KRÓLÓW";
    }
    
    ctx.fillText(actName, canvas.width - 285, 45);
    ctx.fillStyle = '#ffffff'; 
    ctx.font = "bold 16px 'Rajdhani', sans-serif";
    ctx.fillText(`TWOJA MASA: ${Math.floor(player.score)}`, canvas.width - 285, 75);
    ctx.fillText(`ETAP FABUŁY: ${currentQuest}/21`, canvas.width - 285, 95);

    if (killLogs.length > 0) {
        ctx.save(); 
        ctx.font = "bold 16px 'Rajdhani', sans-serif"; 
        ctx.textAlign = 'right';
        
        for (let i = 0; i < killLogs.length; i++) {
            let log = killLogs[i];
            ctx.fillStyle = `rgba(241, 196, 15, ${log.time / 50})`; 
            ctx.fillText(log.text, canvas.width - 20, 160 + (i * 25));
            log.time--;
        }
        ctx.restore(); 
        killLogs = killLogs.filter(l => l.time > 0);
    }

    if (bossActive && bossEntity) {
        let bossHPPercent = Math.max(0, bossEntity.score / bossEntity.maxScore);
        let barWidth = 600; 
        let barHeight = 25;
        let barX = canvas.width / 2 - barWidth / 2; 
        let barY = 40;
        
        ctx.save();
        ctx.fillStyle = '#111'; 
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.strokeStyle = '#fff'; 
        ctx.lineWidth = 3; 
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        ctx.fillStyle = '#8e44ad'; 
        ctx.fillRect(barX, barY, barWidth * bossHPPercent, barHeight);
        
        ctx.fillStyle = '#fff'; 
        ctx.font = "bold 24px 'Permanent Marker', cursive"; 
        ctx.textAlign = 'center'; 
        ctx.textBaseline = 'bottom';
        
        if (!window.isMobile) { 
            ctx.shadowBlur = 10; 
            ctx.shadowColor = '#8e44ad'; 
        }
        ctx.fillText(bossEntity.name.toUpperCase(), canvas.width / 2, barY - 10);
        ctx.restore();
    }

    requestAnimationFrame(gameLoop);
}

// --- FUNKCJE RYSOWANIA STRUKTUR LOKALNYCH ---
function drawHut(x, y, size) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; 
    ctx.beginPath(); 
    ctx.ellipse(x, y + size/2, size * 0.8, size * 0.25, 0, 0, Math.PI * 2); 
    ctx.fill();
    
    ctx.fillStyle = '#050505'; 
    ctx.fillRect(x - size/2, y - size/2, size, size);
    
    ctx.strokeStyle = '#ffffff'; 
    ctx.lineWidth = 2; 
    ctx.strokeRect(x - size/2, y - size/2, size, size);
    
    ctx.beginPath(); 
    ctx.moveTo(x - size/2, y); 
    ctx.lineTo(x + size/2, y); 
    ctx.stroke();
    
    ctx.fillStyle = '#111111'; 
    ctx.beginPath(); 
    ctx.moveTo(x - size/2 - 20, y - size/2); 
    ctx.lineTo(x, y - size/2 - size * 0.6); 
    ctx.lineTo(x + size/2 + 20, y - size/2); 
    ctx.closePath(); 
    ctx.fill(); 
    ctx.stroke();
    
    ctx.fillStyle = '#050505'; 
    let doorWidth = size * 0.35; 
    let doorHeight = size * 0.55;
    ctx.fillRect(x - doorWidth/2, y + size/2 - doorHeight, doorWidth, doorHeight); 
    ctx.strokeRect(x - doorWidth/2, y + size/2 - doorHeight, doorWidth, doorHeight);
    
    ctx.fillStyle = '#3498db'; 
    if (!window.isMobile) { 
        ctx.shadowBlur = 15; 
        ctx.shadowColor = '#3498db'; 
    }
    ctx.beginPath(); 
    ctx.arc(x, y - size/2 + 15, 6, 0, Math.PI*2); 
    ctx.fill(); 
    ctx.shadowBlur = 0;
    
    ctx.restore();
}

function drawDeadTree(x, y) {
    ctx.save(); 
    ctx.strokeStyle = '#ffffff'; 
    ctx.lineWidth = 4; 
    ctx.lineCap = 'round';
    
    ctx.beginPath(); 
    ctx.moveTo(x, y); 
    ctx.lineTo(x, y - 80); 
    ctx.lineTo(x - 30, y - 120); 
    ctx.moveTo(x, y - 50); 
    ctx.lineTo(x + 40, y - 100); 
    ctx.stroke();
    
    ctx.restore();
}

function drawBlacksmithArea(x, y) {
    ctx.save(); 
    ctx.fillStyle = '#050505'; 
    ctx.strokeStyle = '#ffffff'; 
    ctx.lineWidth = 2;
    
    ctx.beginPath(); 
    ctx.arc(x + 40, y - 10, 30, 0, Math.PI*2); 
    ctx.fill(); 
    ctx.stroke();
    
    ctx.beginPath(); 
    ctx.arc(x + 35, y - 5, 20, 0, Math.PI*2); 
    ctx.fill(); 
    ctx.stroke();
    
    ctx.beginPath(); 
    ctx.ellipse(x - 45, y + 25, 25, 12, 0, 0, Math.PI*2); 
    ctx.fill(); 
    ctx.stroke();
    
    if (Math.random() > 0.5) {
        spawnParticle(x - 45 + (Math.random()*10-5), y + 15, 'rgba(255, 100, 0, 0.8)', 'fire');
    }
    
    ctx.restore();
}

function drawCaveEntrance(x, y, isGlowing) {
    ctx.save();
    ctx.fillStyle = '#050505'; 
    ctx.strokeStyle = '#ffffff'; 
    ctx.lineWidth = 2;
    
    ctx.beginPath(); 
    ctx.arc(x, y + 50, 140, Math.PI, 0); 
    ctx.lineTo(x + 140, y + 100); 
    ctx.lineTo(x - 140, y + 100); 
    ctx.fill(); 
    ctx.stroke();

    if (isGlowing) { 
        if (!window.isMobile) { 
            ctx.shadowBlur = 20; 
            ctx.shadowColor = '#3498db'; 
        } 
        ctx.fillStyle = '#3498db'; 
    } else { 
        ctx.fillStyle = '#111111'; 
    }
    
    ctx.beginPath(); 
    ctx.arc(x, y + 50, 90, Math.PI, 0); 
    ctx.lineTo(x + 90, y + 100); 
    ctx.lineTo(x - 90, y + 100); 
    ctx.fill(); 
    ctx.shadowBlur = 0;

    if (isGlowing && Math.random() > 0.5) {
        spawnParticle(x + (Math.random() * 120 - 60), y + 50, 'rgba(52, 152, 219, 0.8)', 'fire');
    }

    drawDeadTree(x - 160, y + 90); 
    drawDeadTree(x + 160, y + 90);
    
    ctx.restore();
}