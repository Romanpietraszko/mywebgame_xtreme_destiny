// ==========================================
// FREE.JS - Logika trybu "Free"
// ==========================================

const socket = io('https://mywebgame-xtreme-destiny.onrender.com');

// --- ZMIENNE STANU I KONFIGURACJI ---
let player, otherPlayers = {}, foods = [], bots = [], projectiles = [];
let loots = [];            
let currentEvent = null;   
let eventTimeLeft = 0;     
let controlType = 'WASD', gameState = 'MENU', myId = null;

// NOWOŚĆ: Tablica na ptaki wyfruwające na starcie i wiatr
let startBirds = [];
let windLines = [];
let lastWindTrigger = 0;

// Inicjalizacja mapy z pliku map.js (pobiera WORLD_SIZE z engine.js)
initMap(WORLD_SIZE);

// Statystyki RPG, Ekwipunek
let skillPoints = 0;
let playerSkills = { speed: 0, strength: 0, weapon: 0 };
let paths = { speed: 'none', strength: 'none', weapon: 'none' }; 

window.weaponPath = 'none'; 

let lastMoveDir = { x: 1, y: 0 }; 
let lastCalculatedTier = 0; 
let wasSafe = false; 
let killLogs = [];
let lastWinterUseClient = 0; 
let lastDashUseClient = 0; 
let lastSkillMenuState = '';

let damageTexts = [];
let particles = [];

let draggedBotId = null; 
let dragMouseWorld = { x: 0, y: 0 };

let lastFrameTime = performance.now();
const targetFPS = 60;
const frameDuration = 1000 / targetFPS; 

let nextGachaTime = 0;
const GACHA_INTERVAL_MS = 60 * 1000; 

let lastServerTickTime = Date.now();
let isServerLagging = false;

window.addEventListener('contextmenu', e => e.preventDefault());

// --- OBSŁUGA MYSZKI ---
window.addEventListener('mousemove', (e) => {
    if (gameState === 'PLAYING' && player && controlType !== 'TOUCH') {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const mouseWorldX = player.x + (mouseX - canvas.width / 2) / globalScale;
        const mouseWorldY = player.y + (mouseY - canvas.height / 2) / globalScale;
        
        const playerScreenX = canvas.width / 2;
        const playerScreenY = canvas.height / 2;
        
        const angle = Math.atan2(mouseY - playerScreenY, mouseX - playerScreenX);
        
        if (!isNaN(angle)) {
            lastMoveDir = { x: Math.cos(angle), y: Math.sin(angle) };
        }

        if (draggedBotId) { dragMouseWorld = { x: mouseWorldX, y: mouseWorldY }; }
    }
});

window.addEventListener('mousedown', (e) => {
    if (e.target.closest('#skill-menu') || e.target.closest('#castle-shop') || e.target.closest('button')) {
        return; 
    }

    if (gameState === 'PLAYING' && player) { 
        if (player.isSafe) return; 

        if (e.button === 2) { 
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const mouseWorldX = player.x + (mouseX - canvas.width / 2) / globalScale;
            const mouseWorldY = player.y + (mouseY - canvas.height / 2) / globalScale;

            let closestBot = null;
            let minDist = 80; 
            bots.forEach(b => {
                if (b.ownerId === myId) {
                    let d = Math.hypot(b.x - mouseWorldX, b.y - mouseWorldY);
                    if (d < minDist) { minDist = d; closestBot = b; }
                }
            });

            if (closestBot) {
                draggedBotId = closestBot.id;
                dragMouseWorld = { x: mouseWorldX, y: mouseWorldY };
            }
        }
        else if (e.button === 0) {
            socket.emit('throwSword', { x: player.x, y: player.y, dx: lastMoveDir.x, dy: lastMoveDir.y });
        }
    }
    if (gameState === 'PAUSED' && e.button === 0) {
        const gachaModal = document.getElementById('gacha-modal');
        if (gachaModal && gachaModal.style.display.includes('flex')) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const btnX = canvas.width / 2 - 100;
        const btnY = canvas.height / 2 + 10;
        
        if (mouseX >= btnX && mouseX <= btnX + 200 && mouseY >= btnY && mouseY <= btnY + 50) {
            socket.disconnect(); location.reload();   
        }
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 2 && draggedBotId && player) {
        let dx = dragMouseWorld.x - player.x;
        let dy = dragMouseWorld.y - player.y;
        
        if (dx === 0 && dy === 0) { draggedBotId = null; return; }
        
        let dist = Math.hypot(dx, dy);
        let absAngle = Math.atan2(dy, dx);
        let playerFaceAngle = Math.atan2(lastMoveDir.y, lastMoveDir.x);
        let relAngle = absAngle - playerFaceAngle;

        socket.emit('setBotOffset', { botId: draggedBotId, angleOffset: relAngle, distOffset: dist });
        draggedBotId = null; 
    }
});

window.addEventListener('mobile-attack', () => {
    if (gameState === 'PLAYING' && player && !player.isSafe) {
        socket.emit('throwSword', { x: player.x, y: player.y, dx: lastMoveDir.x, dy: lastMoveDir.y });
    }
});

window.onkeydown = (e) => {
    keys[e.code] = true; 
    
    if (e.code === 'KeyH' && player) {
        player.isTutorialActive = !player.isTutorialActive;
    }

    if (e.code === 'Space' && (gameState === 'PLAYING' || gameState === 'PAUSED')) {
        gameState = (gameState === 'PLAYING') ? 'PAUSED' : 'PLAYING';
    }
    if (gameState === 'PLAYING') {
        if (e.code === 'Digit1') socket.emit('switchWeapon', 1);
        if (e.code === 'Digit2') socket.emit('switchWeapon', 2);
        if (e.code === 'KeyE') socket.emit('throwSword', { x: player.x, y: player.y, dx: lastMoveDir.x, dy: lastMoveDir.y });
        
        if (e.code === 'KeyR' && paths.weapon === 'winter') {
            const now = Date.now();
            if (now - lastWinterUseClient >= 15000) {
                lastWinterUseClient = now; socket.emit('throwWinterSword');
            }
        }

        if (e.code === 'ShiftLeft' && paths.speed === 'dash') {
            const now = Date.now();
            if (now - lastDashUseClient >= 3000) { 
                lastDashUseClient = now; 
                socket.emit('dash', lastMoveDir);
            }
        }

        if (e.code === 'KeyQ' && player.score >= 50) player.isShielding = true;
        if (e.code === 'KeyP') socket.emit('toggleRecruit');
        if (e.code === 'KeyC') socket.emit('switchFormation');
    }
};

window.onkeyup = (e) => {
    keys[e.code] = false;
    if (e.code === 'KeyQ' && player) player.isShielding = false;
};

// ==========================================
// FUNKCJE POMOCNICZE DLA PTAKÓW I WIATRU
// ==========================================
function triggerStartBirds(x, y) {
    let birdCount = 50 + Math.floor(Math.random() * 20); // Ogromne stado: 50-70 sztuk!
    for (let i = 0; i < birdCount; i++) {
        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * 5 + 3; // Rozrzut prędkości
        startBirds.push({
            x: x + (Math.random() * 80 - 40),
            y: y + (Math.random() * 80 - 40),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2, // Podbicie w górę
            life: 1.0,
            decay: Math.random() * 0.003 + 0.002, // Dłuższy czas życia
            size: Math.random() * 4 + 3,
            wingPhase: Math.random() * Math.PI * 2,
            wingSpeed: Math.random() * 0.15 + 0.2 
        });
    }
}

function triggerWindLines(playerX, playerY) {
    let lineCount = 8 + Math.floor(Math.random() * 5); // 8-12 kresek wiatru
    for (let i = 0; i < lineCount; i++) {
        windLines.push({
            x: playerX + 1500 + Math.random() * 1000, // Zaczynają daleko z prawej strony
            y: playerY + (Math.random() * 2000 - 1000), // Rozrzut po osi Y w stosunku do gracza
            length: 150 + Math.random() * 300,
            speed: 30 + Math.random() * 20, // Bardzo szybkie (kreskówkowe)
            life: 1.0
        });
    }
}

function drawNotebookBird(ctx, b) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, b.life);
    ctx.translate(b.x, b.y);
    
    let angle = Math.atan2(b.vy, b.vx);
    ctx.rotate(angle + Math.PI / 2); 

    let flap = Math.sin(b.wingPhase) * b.size * 0.8;

    ctx.strokeStyle = '#111111'; 
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(-b.size, flap); 
    ctx.lineTo(0, 0);          
    ctx.lineTo(b.size, flap);  
    ctx.stroke();

    ctx.restore();
}

window.startGame = (type) => {
    controlType = type;
    document.getElementById('ui-layer').style.display = 'none';
    const name = document.getElementById('playerName').value || "Gracz";
    const color = document.getElementById('playerColor').value;
    player = {
        x: 2000, y: 2000, score: 0, level: 1, 
        name: name, color: color, isSafe: false,
        isShielding: false, aura: null, 
        inventory: { bow: 0, knife: 0, shuriken: 0 }, 
        activeWeapon: 'sword',
        isRecruiting: false,
        formation: 0,
        isTutorialActive: true,
        tutorialText: "Ładowanie porady z serwera wiedzy...",
        skin: window.playerSkin || 'standard'
    };
    if (myId) player.id = myId;
    
    triggerStartBirds(player.x, player.y);
    lastWindTrigger = Date.now(); // Inicjalizacja czasu dla wiatru

    socket.emit('joinGame', { name, color, skin: player.skin });
    gameState = 'PLAYING';
    
    lastFrameTime = performance.now();
    lastServerTickTime = Date.now(); 
    nextGachaTime = Date.now() + GACHA_INTERVAL_MS; 
    requestAnimationFrame(gameLoop);
};

// --- KOMUNIKACJA Z SERWEREM ---
socket.on('init', (data) => { myId = data.id; if (player) player.id = myId; });
socket.on('levelUp', (data) => { skillPoints = data.points; });

socket.on('skillUpdated', (data) => {
    if(!data || !data.skills) return; 
    playerSkills = data.skills; 
    skillPoints = data.points; 
    paths = data.paths || paths; 
    window.weaponPath = paths.weapon;
});

socket.on('botEaten', (data) => { if (player && data && !isNaN(data.newScore)) player.score = data.newScore; });
socket.on('killEvent', (data) => { if(data && data.text) killLogs.push({ text: data.text, time: 200 }); });

socket.on('tutorialTick', (data) => {
    if (player && data && data.text) {
        player.tutorialText = data.text;
        player.isTutorialActive = true;
    }
});

socket.on('recruitToggled', (state) => { 
    if (player) player.isRecruiting = state;
    killLogs.push({ text: state ? "TRYB: ZWERBUJ (P)" : "TRYB: ZJADAJ (P)", time: 150 }); 
});
socket.on('formationSwitched', (formName) => { 
    killLogs.push({ text: "FORMACJA: " + formName, time: 150 }); 
});

socket.on('damageText', (data) => {
    if(!data || isNaN(data.x) || isNaN(data.y)) return; 

    if (damageTexts.length > 50) damageTexts.shift();

    damageTexts.push({
        x: data.x + (Math.random() * 20 - 10), 
        y: data.y,
        val: data.val,
        color: data.color || '#ff4757', 
        life: 1.0, 
        vx: (Math.random() - 0.5) * 2, 
        vy: -2 - Math.random() * 2 
    });

    let particleColor = data.color === '#ff4757' ? '#c0392b' : (data.color === '#e67e22' ? '#f39c12' : '#bdc3c7');
    let count = data.val > 20 ? 12 : 6; 
    
    if (particles.length < 250) {
        for (let i = 0; i < count; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 6 + 2;
            particles.push({
                x: data.x, y: data.y,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                life: 1.0, decay: Math.random() * 0.05 + 0.02, 
                color: particleColor, size: Math.random() * 4 + 2 
            });
        }
    }
});

socket.on('gameOver', (data) => {
    gameState = 'GAMEOVER';
    document.getElementById('ui-layer').style.display = 'flex';
    document.getElementById('step-1').style.display = 'none';
    document.getElementById('step-2').style.display = 'none';
    
    let scoreDisplay = (data && !isNaN(data.finalScore)) ? data.finalScore : 0;

    let gameOverDiv = document.getElementById('game-over-screen');
    if (!gameOverDiv) {
        gameOverDiv = document.createElement('div');
        gameOverDiv.id = 'game-over-screen';
        gameOverDiv.style.textAlign = 'center';
        gameOverDiv.style.color = '#111'; 
        document.getElementById('menu').appendChild(gameOverDiv);
    }
    gameOverDiv.style.display = 'block';
    gameOverDiv.innerHTML = `
        <h2 style="color: #e74c3c; font-size: 38px; margin-bottom: 10px; text-transform: uppercase;">Zostałeś pożarty!</h2>
        <p style="font-size: 16px; margin-bottom: 20px;">Twój gang przestał istnieć.</p>
        <p style="font-size: 24px; color: #27ae60; font-weight: bold; margin-bottom: 30px;">Zebrałeś masy: ${scoreDisplay}</p>
        <button class="main-btn" onclick="location.reload()">Zagraj ponownie</button>
    `;
    
    document.getElementById('skill-menu').style.display = 'none';
    const shop = document.getElementById('castle-shop');
    if (shop) shop.style.display = 'none';
});

socket.on('serverTick', (data) => {
    lastServerTickTime = Date.now(); 
    isServerLagging = false;

    if (!data) return; 

    foods = Array.isArray(data.foods) ? data.foods : []; 
    bots = Array.isArray(data.bots) ? data.bots : []; 
    projectiles = Array.isArray(data.projectiles) ? data.projectiles : [];
    loots = Array.isArray(data.loots) ? data.loots : [];              
    currentEvent = data.activeEvent || null;        
    eventTimeLeft = data.eventTimeLeft || 0; 
    
    otherPlayers = typeof data.players === 'object' && data.players !== null ? data.players : {};
    
    if (myId && otherPlayers[myId]) {
        if (typeof otherPlayers[myId].score === 'number' && !isNaN(otherPlayers[myId].score)) {
            player.score = otherPlayers[myId].score;
        }
        player.inventory = otherPlayers[myId].inventory || { bow: 0, knife: 0, shuriken: 0 };
        player.activeWeapon = otherPlayers[myId].activeWeapon || 'sword';
        if (otherPlayers[myId].formation !== undefined) player.formation = otherPlayers[myId].formation;
        if (otherPlayers[myId].isRecruiting !== undefined) player.isRecruiting = otherPlayers[myId].isRecruiting;
        if (otherPlayers[myId].skin) player.skin = otherPlayers[myId].skin; 
    }
    delete otherPlayers[myId];
});

window.upgrade = (name) => { socket.emit('upgradeSkill', name); };
window.choosePath = (category, pathName) => { socket.emit('chooseSkillPath', { category: category, path: pathName }); };

function checkEquipmentUpgrades() {
    if (!player) return;
    let total = 0;
    total += getTier(player.score, [100, 450, 850]); 
    total += getTier(player.score, [500, 800, 1150]); 
    total += getTier(player.score, [15, 300, 700]); 
    total += getTier(playerSkills.speed, [3, 6, 9]); 
    total += getTier(player.score, [50, 150, 300]); 
    
    if (lastCalculatedTier > 0 && total > lastCalculatedTier) {
        let auraColor = '#ffffff'; 
        if (total >= 10) auraColor = '#f1c40f'; 
        else if (total >= 5) auraColor = '#3498db'; 

        player.aura = { time: 45, maxTime: 45, color: auraColor };
        document.body.classList.remove('shield-flash');
        void document.body.offsetWidth; 
        document.body.classList.add('shield-flash');
        setTimeout(() => document.body.classList.remove('shield-flash'), 400);
    }
    lastCalculatedTier = total;
}

function update() {
    if (gameState !== 'PLAYING') return;

    if (player.aura && player.aura.time > 0) player.aura.time--;

    let dx = 0, dy = 0;
    
    if (controlType === 'TOUCH') {
        if (window.mobileJoy && window.mobileJoy.active) {
            dx = window.mobileJoy.dx;
            dy = window.mobileJoy.dy;
            
            if (!isNaN(dx) && !isNaN(dy)) {
                lastMoveDir = { x: dx, y: dy };
                let len = Math.hypot(dx, dy);
                if (len > 0) { dx /= len; dy /= len; }
            }
        }
    } else if (controlType === 'WASD') {
        if (keys['KeyW']) dy--; if (keys['KeyS']) dy++; if (keys['KeyA']) dx--; if (keys['KeyD']) dx++;
    } else {
        if (keys['ArrowUp']) dy--; if (keys['ArrowDown']) dy++; if (keys['ArrowLeft']) dx--; if (keys['ArrowRight']) dx++;
    }
    
    if (dx !== 0 || dy !== 0) {
        let moveAngle = Math.atan2(dy, dx); 
        let speed = 5 + (playerSkills.speed * 0.5);
        
        if (player.skin === 'ninja') { speed *= 1.05; }
        if (currentEvent === 'BLIZZARD') { if (paths.speed !== 'lightweight') { speed *= 0.4; } }

        if (!isNaN(moveAngle) && !isNaN(speed)) {
            player.x += Math.cos(moveAngle) * speed; 
            player.y += Math.sin(moveAngle) * speed;
        }
    }
    
    player.x = Math.max(0, Math.min(WORLD_SIZE, player.x));
    player.y = Math.max(0, Math.min(WORLD_SIZE, player.y));

    if (!isNaN(player.x) && !isNaN(player.y)) {
        player.isSafe = safeZones.some(z => Math.hypot(player.x - z.x, player.y - z.y) < z.radius);
        camera.x = player.x - canvas.width / 2; camera.y = player.y - canvas.height / 2;
        
        if (!isServerLagging) {
            socket.emit('playerMovement', { x: player.x, y: player.y, score: player.score, isSafe: player.isSafe, isShielding: player.isShielding });
        }
    }
}

function gameLoop(currentTime) {
    const deltaTime = currentTime - lastFrameTime;

    if (deltaTime < frameDuration) {
        requestAnimationFrame(gameLoop);
        return;
    }

    lastFrameTime = currentTime - (deltaTime % frameDuration);

    if (Date.now() - lastServerTickTime > 1500) {
        isServerLagging = true;
    }

    let allEntities = Object.values(otherPlayers).concat(bots);
    if (player && gameState !== 'GAMEOVER') allEntities.push(player);
    allEntities.sort((a,b) => (b.score || 0) - (a.score || 0));
    let topEntities = allEntities.slice(0, 5);
    let currentKingId = topEntities.length > 0 ? (topEntities[0].id || topEntities[0].name) : null;
    
    if (gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'GAMEOVER') {
        
        if (gameState === 'PLAYING' && Date.now() > nextGachaTime && window.showGachaAnimation) {
            gameState = 'PAUSED'; 
            window.showGachaAnimation((rewardData) => {
                socket.emit('claimGachaReward', rewardData);
                gameState = 'PLAYING';
                nextGachaTime = Date.now() + GACHA_INTERVAL_MS;
            });
        }

        if (gameState === 'PLAYING') {
            update(); checkEquipmentUpgrades(); 

            // --- AKTUALIZACJA PTAKÓW ---
            for (let i = startBirds.length - 1; i >= 0; i--) {
                let b = startBirds[i];
                b.x += b.vx;
                b.y += b.vy;
                b.life -= b.decay;
                b.wingPhase += b.wingSpeed;

                if (b.life <= 0) {
                    startBirds.splice(i, 1);
                }
            }

            // --- WYZWALACZ WIATRU (Co ok. 30 sekund) ---
            if (Date.now() - lastWindTrigger > 30000) {
                triggerWindLines(player.x, player.y);
                lastWindTrigger = Date.now();
            }

            // --- AKTUALIZACJA LINII WIATRU ---
            for (let i = windLines.length - 1; i >= 0; i--) {
                let w = windLines[i];
                w.x -= w.speed; // Wieje z prawej do lewej
                w.life -= 0.01;
                if (w.life <= 0 || w.x < player.x - 2000) {
                    windLines.splice(i, 1);
                }
            }
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let vWidth = canvas.width / globalScale;
        let vHeight = canvas.height / globalScale;
        let vCamera = { x: player.x - vWidth / 2, y: player.y - vHeight / 2 };

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(globalScale, globalScale);
        ctx.translate(-vWidth / 2, -vHeight / 2);
        
        if(typeof drawForestMap === 'function') {
            drawForestMap(ctx, vCamera, vWidth, vHeight);
        }
        ctx.restore();

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(globalScale, globalScale);
        ctx.translate(-player.x, -player.y); 

        // RYSOWANIE LINII WIATRU (W świecie gry, żeby poprawnie się przesuwały)
        ctx.strokeStyle = 'rgba(17, 17, 17, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        windLines.forEach(w => {
            let waveY = Math.sin(w.x / 100) * 15; // Zwiększone falowanie wiatru
            ctx.moveTo(w.x, w.y + waveY);
            ctx.lineTo(w.x + w.length, w.y + waveY);
        });
        ctx.stroke();

        safeZones.forEach(z => {
            if(typeof drawCastle === 'function') drawCastle(ctx, z);
        }); 
        
        foods.forEach(f => {
            ctx.fillStyle = '#000000'; ctx.beginPath(); ctx.arc(f.x, f.y, 8, 0, Math.PI * 2); ctx.fill();
        });

        loots.forEach(l => {
            ctx.save();
            ctx.translate(l.x, l.y);
            ctx.fillStyle = l.type === 'skill' ? '#8e44ad' : (l.type === 'mass' ? '#f1c40f' : '#e74c3c');
            ctx.fillRect(-12, -10, 24, 20); 
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(-14, -10, 28, 4); 
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText("?", 0, 2); 
            ctx.restore();
        });
        
        projectiles.forEach(p => {
            let rot = p.isWinter ? Math.PI / 2 : Math.atan2(p.dy, p.dx);
            if(isNaN(rot)) rot = 0; 
            
            if (p.projType === 'sword' || p.projType === 'winter' || !p.projType) {
                rot += (Date.now() / 100); 
                drawSwordModel(p, p.x, p.y, rot, 0.8, getTier(p.scoreAtThrow || 0, [15, 300, 700]));
            } else if (p.projType.includes('bow') || p.projType === 'crossbow' || p.projType === 'shotgun') {
                ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(rot); 
                ctx.fillStyle = '#7f8c8d'; ctx.fillRect(-10,-1,20,2); 
                ctx.fillStyle = '#e74c3c'; ctx.fillRect(-10,-3,4,6); 
                ctx.fillStyle = '#bdc3c7'; ctx.beginPath(); ctx.moveTo(10,-3); ctx.lineTo(15,0); ctx.lineTo(10,3); ctx.fill(); 
                ctx.restore();
            } else if (p.projType.includes('knife') || p.projType === 'cleaver') {
                drawKnifeModel(p.x, p.y, rot + Math.PI/2, 0.8);
            } else if (p.projType.includes('shuriken') || p.projType === 'chakram' || p.projType === 'explosive_kunai') {
                drawShurikenModel(p.x, p.y, rot + (Date.now()/20), 1.2);
            }
        });

        if (draggedBotId && player) {
            ctx.save();
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.8)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(dragMouseWorld.x, dragMouseWorld.y); ctx.stroke();
            ctx.beginPath(); ctx.arc(dragMouseWorld.x, dragMouseWorld.y, 25, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(241, 196, 15, 0.2)'; ctx.fill(); ctx.stroke();

            let b = bots.find(bot => bot.id === draggedBotId);
            if (b) {
                ctx.setLineDash([]); ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(b.x, b.y, 40, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();
        }

        allEntities.forEach(e => {
            if (e.isSafe && (!player || !player.isSafe)) return;
            if (isServerLagging && e !== player) { e.isMoving = false; }
            e.weaponPath = e.paths ? e.paths.weapon : 'none';
            drawStickman(e, e.x, e.y, getScale(e.score), false, currentKingId); 
        });

        // --- RYSOWANIE PTAKÓW W ŚWIECIE ---
        startBirds.forEach(b => drawNotebookBird(ctx, b));

        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.x += p.vx; p.y += p.vy; p.vx *= 0.85; p.vy *= 0.85; p.life -= p.decay; 
            ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0, p.size * p.life), 0, Math.PI * 2); ctx.fill(); ctx.restore();
            if (p.life <= 0) particles.splice(i, 1);
        }

        for (let i = damageTexts.length - 1; i >= 0; i--) {
            let dt = damageTexts[i]; dt.x += dt.vx; dt.y += dt.vy; dt.life -= 0.02; 
            ctx.save(); ctx.globalAlpha = Math.max(0, dt.life); ctx.fillStyle = dt.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
            let fontSize = 20 + (1 - dt.life) * 15; ctx.font = `bold ${fontSize}px 'Permanent Marker', Arial`; 
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.strokeText(`-${dt.val}`, dt.x, dt.y); ctx.fillText(`-${dt.val}`, dt.x, dt.y);   
            ctx.restore();
            if (dt.life <= 0) damageTexts.splice(i, 1);
        }

        ctx.restore(); 
        
        ctx.setTransform(1, 0, 0, 1, 0, 0); 

        if (currentEvent === 'TOXIC_RAIN') {
            ctx.save();
            ctx.fillStyle = 'rgba(46, 204, 113, 0.15)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = 'rgba(17, 17, 17, 0.8)'; ctx.lineWidth = 2; ctx.beginPath();
            let timeOffset = Date.now() / 5;
            for(let i = 0; i < 150; i++) {
                let rx = (Math.random() * canvas.width + timeOffset) % canvas.width;
                let ry = (Math.random() * canvas.height + (Date.now() % canvas.height)) % canvas.height;
                ctx.moveTo(rx, ry); ctx.lineTo(rx - 10, ry + 20);
            }
            ctx.stroke();
            ctx.restore();
        } else if (currentEvent === 'BLIZZARD') { 
            ctx.save();
            ctx.fillStyle = 'rgba(52, 152, 219, 0.15)'; 
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#111';
            ctx.beginPath();
            let timeOffset = Date.now() / 15;
            for(let i = 0; i < 200; i++) {
                let rx = (Math.random() * canvas.width + timeOffset * (i%3 + 1)) % canvas.width;
                let ry = (Math.random() * canvas.height + timeOffset * 2) % canvas.height;
                ctx.moveTo(rx, ry);
                ctx.arc(rx, ry, Math.random() * 3 + 1.5, 0, Math.PI * 2);
            }
            ctx.fill();
            ctx.restore();
        }

        if (gameState === 'PLAYING' && player && player.isTutorialActive) {
            ctx.save();
            let tutorialX = 20; let tutorialY = canvas.height - 200; 
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'; 
            ctx.fillRect(tutorialX, tutorialY, 380, 110);
            ctx.strokeStyle = '#111'; ctx.lineWidth = 4; 
            ctx.strokeRect(tutorialX, tutorialY, 380, 110);
            
            if (typeof skins !== 'undefined' && skins.midas && skins.midas.complete) {
                ctx.drawImage(skins.midas, tutorialX + 10, tutorialY + 15, 80, 80); 
            }
            
            ctx.fillStyle = '#111'; ctx.font = "bold 16px 'Permanent Marker', Arial"; ctx.textAlign = 'left';
            ctx.fillText("MIDAS (Przewodnik XD):", tutorialX + 110, tutorialY + 25);
            
            ctx.fillStyle = '#333'; ctx.font = '13px Arial';
            if (player.tutorialText) {
                if (window.wrapText) { window.wrapText(ctx, player.tutorialText, tutorialX + 110, tutorialY + 50, 250, 18); } 
                else { ctx.fillText(player.tutorialText.substring(0, 50) + "...", tutorialX + 110, tutorialY + 50); }
            }
            
            ctx.fillStyle = '#7f8c8d'; ctx.font = 'bold 10px Arial';
            ctx.fillText("[H] - Ukryj podpowiedź", tutorialX + 110, tutorialY + 100);
            ctx.restore();
        }

        if (gameState !== 'GAMEOVER') {
            ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(canvas.width - 280, 10, 270, 140);
            ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(canvas.width - 280, 10, 270, 140);
            
            ctx.fillStyle = '#e74c3c'; ctx.font = "bold 16px 'Permanent Marker', Arial";
            ctx.fillText("🏆 RANKING ARENY", canvas.width - 265, 30);
            
            topEntities.forEach((p, i) => {
                let yPos = 55 + i * 20;
                let displayScore = isNaN(p.score) ? 5 : Math.floor(p.score);
                if (i === 0) { ctx.fillStyle = '#f1c40f'; ctx.fillText(`👑 [KRÓL] ${p.name} - ${displayScore} pkt`, canvas.width - 265, yPos); } 
                else { ctx.fillStyle = (p.id === myId || p === player) ? '#2ecc71' : '#333'; ctx.fillText(`${i+1}. ${p.name} - ${displayScore} pkt`, canvas.width - 265, yPos); }
            });

            ctx.fillStyle = '#111'; ctx.font = "bold 20px 'Permanent Marker', Arial";
            let displayScore = isNaN(player.score) ? 5 : Math.floor(player.score);
            ctx.fillText(`PUNKTY: ${displayScore}`, 20, 40);
            
            if (player.isRecruiting !== undefined) {
                ctx.font = 'bold 14px Arial';
                ctx.fillStyle = player.isRecruiting ? '#3498db' : '#e74c3c';
                ctx.fillText(`TRYB (P): ${player.isRecruiting ? 'WERBUNEK' : 'ZJADANIE'}`, 20, 60);
            }

            ctx.save();
            ctx.textAlign = 'center';
            if (currentEvent === null) {
                ctx.font = 'bold 20px Arial';
                if (eventTimeLeft <= 10) { ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 24px Arial'; } 
                else { ctx.fillStyle = 'rgba(17, 17, 17, 0.8)'; }
                ctx.fillText(`Kolejny event za: ${eventTimeLeft}s`, canvas.width / 2, 40);
            } else {
                ctx.font = 'bold 28px Arial';
                ctx.fillStyle = '#e74c3c';
                let eName = currentEvent === 'KING_HUNT' ? '👑 POLOWANIE NA KRÓLA!' : (currentEvent === 'TOXIC_RAIN' ? '🌧️ KWAŚNY DESZCZ!' : '❄️ ZAMIĘĆ ŚNIEŻNA!');
                ctx.fillText(eName, canvas.width / 2, 50);
                if (currentEvent === 'TOXIC_RAIN') { ctx.font = '16px Arial'; ctx.fillText("Chowaj się w zamku!", canvas.width / 2, 75); }
                if (currentEvent === 'BLIZZARD') { ctx.font = '16px Arial'; ctx.fillText("Poruszasz się znacznie wolniej!", canvas.width / 2, 75); }
            }
            ctx.restore();

            if (killLogs.length > 0) {
                ctx.save(); ctx.font = "bold 14px 'Permanent Marker', Arial"; ctx.textAlign = 'right';
                for (let i = 0; i < killLogs.length; i++) {
                    let log = killLogs[i];
                    ctx.fillStyle = `rgba(231, 76, 60, ${log.time / 50})`; 
                    ctx.fillText("⚔️ " + log.text, canvas.width - 20, 170 + (i * 22));
                    log.time--;
                }
                ctx.restore(); killLogs = killLogs.filter(l => l.time > 0);
            }

            ctx.save();
            let startX = canvas.width / 2 - 60, startY = canvas.height - 80;
            
            ctx.fillStyle = player.activeWeapon === 'sword' ? 'rgba(46, 204, 113, 0.9)' : '#fff';
            ctx.fillRect(startX, startY, 50, 50); ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(startX, startY, 50, 50);
            ctx.fillStyle = '#111'; ctx.font = 'bold 14px Arial'; ctx.fillText('1', startX + 15, startY + 18);
            ctx.font = '10px Arial'; ctx.fillText('Miecz', startX + 25, startY + 40);

            ctx.fillStyle = player.activeWeapon !== 'sword' ? 'rgba(46, 204, 113, 0.9)' : '#fff';
            ctx.fillRect(startX + 60, startY, 50, 50); ctx.strokeRect(startX + 60, startY, 50, 50);
            ctx.fillStyle = '#111'; ctx.font = 'bold 14px Arial'; ctx.fillText('2', startX + 75, startY + 18);
            
            let secText = 'Brak';
            const types = ['shotgun', 'crossbow', 'diamond_bow', 'golden_bow', 'bow', 'cleaver', 'hunting_knife', 'diamond_knife', 'golden_knife', 'knife', 'explosive_kunai', 'chakram', 'diamond_shuriken', 'golden_shuriken', 'shuriken'];
            for(let t of types) { if(player.inventory && player.inventory[t]) { secText = t.replace('_', ' ').toUpperCase(); break; } }
            ctx.font = '9px Arial'; ctx.fillText(secText, startX + 65, startY + 40);

            if (paths.weapon === 'winter') {
                let timePassed = Date.now() - lastWinterUseClient;
                let cooldownTotal = 15000; 
                let winterProgress = Math.min(1, timePassed / cooldownTotal);
                let timeLeft = Math.ceil((cooldownTotal - timePassed) / 1000);

                let btnX = startX + 120;
                ctx.fillStyle = '#fff'; ctx.fillRect(btnX, startY, 50, 50);
                ctx.fillStyle = 'rgba(52, 152, 219, 0.8)'; ctx.fillRect(btnX, startY + 50 * (1 - winterProgress), 50, 50 * winterProgress);
                ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(btnX, startY, 50, 50);
                
                ctx.fillStyle = '#111'; ctx.font = 'bold 14px Arial'; ctx.fillText('R', btnX + 25, startY + 18);
                ctx.font = '10px Arial'; 
                if (winterProgress >= 1) { ctx.fillText('GOTOWE', btnX + 25, startY + 40); } 
                else { ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 14px Arial'; ctx.fillText(`${timeLeft}s`, btnX + 25, startY + 40); }
            }
            
            if (paths.speed === 'dash') {
                let timePassedD = Date.now() - lastDashUseClient;
                let cooldownTotalD = 3000; 
                let dashProgress = Math.min(1, timePassedD / cooldownTotalD);
                let timeLeftD = Math.ceil((cooldownTotalD - timePassedD) / 1000);

                let btnXD = startX + 180;
                ctx.fillStyle = '#fff'; ctx.fillRect(btnXD, startY, 50, 50);
                ctx.fillStyle = 'rgba(46, 204, 113, 0.8)'; ctx.fillRect(btnXD, startY + 50 * (1 - dashProgress), 50, 50 * dashProgress);
                ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(btnXD, startY, 50, 50);
                
                ctx.fillStyle = '#111'; ctx.font = 'bold 12px Arial'; ctx.fillText('SHIFT', btnXD + 25, startY + 18);
                ctx.font = '10px Arial'; 
                if (dashProgress >= 1) { ctx.fillText('GOTOWE', btnXD + 25, startY + 40); } 
                else { ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 14px Arial'; ctx.fillText(`${timeLeftD}s`, btnXD + 25, startY + 40); }
            }
            ctx.restore();

            const skillMenu = document.getElementById('skill-menu');
            let needsWeaponPath = (playerSkills.weapon >= 5 && paths.weapon === 'none');
            let needsSpeedPath = (playerSkills.speed >= 5 && paths.speed === 'none');
            let needsStrengthPath = (playerSkills.strength >= 5 && paths.strength === 'none');
            let hasAnyPath = paths.speed !== 'none' || paths.strength !== 'none' || paths.weapon !== 'none';

            if (skillPoints > 0 || needsWeaponPath || needsSpeedPath || needsStrengthPath || hasAnyPath) {
                skillMenu.style.display = 'flex'; 
                document.getElementById('sp-count').innerText = skillPoints;
                
                const categories = [
                    { id: 'speed', icon: '⚡', name: 'Szybkość', req: 0, path1: 'dash', path1Name: '💨 Zryw', path2: 'lightweight', path2Name: '🪶 Lekkie Stopy' },
                    { id: 'strength', icon: '💪', name: 'Siła', req: 100, path1: 'thorns', path1Name: '🌵 Kolce', path2: 'titan', path2Name: '🛡️ Tytan' },
                    { id: 'weapon', icon: '⚔️', name: 'Broń', req: 15, path1: 'piercing', path1Name: '🏹 Przebicie', path2: 'winter', path2Name: '❄️ Zim. Miecz' }
                ];

                let currentUIState = skillPoints + "|" + JSON.stringify(playerSkills) + "|" + JSON.stringify(paths) + "|" + player.score;
                
                if (lastSkillMenuState !== currentUIState) {
                    lastSkillMenuState = currentUIState;
                    
                    let html = '';
                    categories.forEach(cat => {
                        let lvl = playerSkills[cat.id];
                        let currentPath = paths[cat.id];
                        let canUpgrade = skillPoints > 0 && player.score >= cat.req && lvl < 20; 
                        
                        let levelText = lvl >= 20 ? `(Lv. MAX - PRZEBUDZENIE!)` : `(Lv. ${lvl}/20)`;
                        let titleColor = lvl >= 20 ? '#e67e22' : '#111';
                        
                        html += `<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                    <span style="font-size: 24px;">${cat.icon}</span>
                                    <div style="flex-grow: 1;">
                                        <div style="font-weight: bold; font-size: 14px; display: flex; justify-content: space-between; color: ${titleColor};">
                                            <span>${cat.name} ${levelText}</span>
                                            <button class="skill-btn" ${!canUpgrade ? 'disabled' : ''} onclick="upgrade('${cat.id}')">➕</button>
                                        </div>`;
                        
                        if (currentPath !== 'none') {
                            let pathColor = lvl >= 20 ? '#e74c3c' : '#27ae60';
                            let pathText = lvl >= 20 ? `MISTRZ: ${currentPath.toUpperCase()}` : `ŚCIEŻKA: ${currentPath.toUpperCase()}`;
                            html += `<div style="font-size: 11px; color: ${pathColor}; font-weight: bold; margin-top: 2px;">${pathText}</div>`;
                        } else if (lvl >= 5) {
                            html += `<div style="display: flex; gap: 5px; margin-top: 5px;">
                                        <button class="skill-btn" style="background: #e67e22; flex:1;" onclick="choosePath('${cat.id}', '${cat.path1}')">${cat.path1Name}</button>
                                        <button class="skill-btn" style="background: #3498db; flex:1;" onclick="choosePath('${cat.id}', '${cat.path2}')">${cat.path2Name}</button>
                                     </div>`;
                        } else {
                            html += `<div style="font-size: 10px; color: #7f8c8d; margin-top: 2px;">Odblokowanie Ścieżki na Lv. 5</div>`;
                        }
                        html += `</div></div>`;
                    });
                    
                    let targetDiv = document.getElementById('skills-container');
                    if (targetDiv) targetDiv.innerHTML = html;
                }
            } else { 
                skillMenu.style.display = 'none'; 
            }

            if (player.isSafe && !wasSafe) {
                const shop = document.getElementById('castle-shop'); if (shop) shop.style.display = 'flex';
            } else if (!player.isSafe && wasSafe) {
                const shop = document.getElementById('castle-shop'); if (shop) shop.style.display = 'none';
            }
            wasSafe = player.isSafe; 
        }

        if (isServerLagging && gameState === 'PLAYING') {
            ctx.save();
            ctx.fillStyle = 'rgba(231, 76, 60, 0.9)';
            ctx.fillRect(0, 0, canvas.width, 40);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("⚠️ UTRATA POŁĄCZENIA! Oczekiwanie na odpowiedź serwera...", canvas.width / 2, 20);
            ctx.restore();
        }

        if (gameState === 'PAUSED' && !document.getElementById('gacha-modal').style.display.includes('flex')) {
            ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#111'; ctx.font = "bold 40px 'Permanent Marker', Arial"; ctx.textAlign = 'center';
            ctx.fillText("PAUZA", canvas.width / 2, canvas.height / 2 - 30);
            
            const btnX = canvas.width / 2 - 100; const btnY = canvas.height / 2 + 10;
            ctx.fillStyle = '#e74c3c'; ctx.fillRect(btnX, btnY, 200, 50); ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.strokeRect(btnX, btnY, 200, 50);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 24px Arial'; ctx.fillText("WYJŚCIE", canvas.width / 2, btnY + 33);
            ctx.textAlign = 'left';
        }
    }
    requestAnimationFrame(gameLoop);
}
