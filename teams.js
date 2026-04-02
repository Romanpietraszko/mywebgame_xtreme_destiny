// ==========================================
// TEAMS.JS - Tryb Drużynowy (ZBUDOWANY NA BAZIE FREE.JS)
// ==========================================

const socket = io('https://mywebgame-xtreme-destiny.onrender.com');

// --- ZMIENNE STANU I KONFIGURACJI ---
let player, otherPlayers = {}, foods = [], bots = [], projectiles = [];
let loots = [];            
let castles = [];      // ZAMKI DRUŻYNOWE
let bushes = [];       // KRZAKI
let meteorZones = [];  // METEORYTY
let currentEvent = null;   
let eventTimeLeft = 0;     
let controlType = 'WASD', gameState = 'MENU', myId = null;

let myTeam = null; 
let gameMode = 'PvP'; 

initMap(WORLD_SIZE);

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

let finalDeathMessage = "Gra to nie życie. Odpocznij chwilę i wróć silniejszy.";
let blizzardParticles = [];
let rainParticles = [];
for (let i = 0; i < 150; i++) blizzardParticles.push({ x: Math.random() * 5000, y: Math.random() * 5000, vx: (Math.random() - 0.5) * 5, vy: Math.random() * 5 + 3 });
for (let i = 0; i < 200; i++) rainParticles.push({ x: Math.random() * 5000, y: Math.random() * 5000, vy: 15 + Math.random() * 10, length: 10 + Math.random() * 20 });


window.addEventListener('contextmenu', e => e.preventDefault());

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
        lastMoveDir = { x: Math.cos(angle), y: Math.sin(angle) };
        player.moveAngle = angle; // Ważne dla rysowania!

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

// SZYBKA ZMIANA FORMACJI
window.setFormation = (idx) => {
    if (!player) return;
    player.formation = idx; 
    socket.emit('setFormation', idx); 
    const buttons = document.querySelectorAll('.form-btn');
    buttons.forEach((btn, i) => {
        btn.style.borderColor = (i === idx) ? '#f1c40f' : '#2c3e50';
        btn.style.background = (i === idx) ? '#2c3e50' : '#34495e';
    });
};

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
        if (e.code === 'Digit3') window.setFormation(0); 
        if (e.code === 'Digit4') window.setFormation(1); 
        if (e.code === 'Digit5') window.setFormation(2); 
        if (e.code === 'Digit6') window.setFormation(3); 

        if (e.code === 'KeyE' && !player.isSafe) socket.emit('throwSword', { x: player.x, y: player.y, dx: lastMoveDir.x, dy: lastMoveDir.y });
        
        if (e.code === 'KeyR' && paths.weapon === 'winter' && !player.isSafe) {
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

// --- LOGIKA MENU I STARTU ---
window.startGame = (control, mode) => {
    controlType = control;
    gameMode = mode;
    document.getElementById('ui-layer').style.display = 'none';

    if (gameMode === 'TRAINING') {
        let diffBtn = document.getElementById('difficulty-btn');
        if (!diffBtn) {
            diffBtn = document.createElement('button');
            diffBtn.id = 'difficulty-btn';
            diffBtn.style.cssText = "position: absolute; top: 20px; left: 50%; transform: translateX(-50%); z-index: 100; padding: 10px 20px; background: #e67e22; border: 2px solid #d35400; border-radius: 8px; color: white; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.3); font-family: Arial, sans-serif;";
            diffBtn.innerText = "Trudność Botów: NORMALNY";
            document.body.appendChild(diffBtn);
            
            let diffLevels = ['ŁATWY', 'NORMALNY', 'TRUDNY'];
            let currentDiffIndex = 1;
            diffBtn.onclick = () => {
                currentDiffIndex = (currentDiffIndex + 1) % 3;
                diffBtn.innerText = `Trudność Botów: ${diffLevels[currentDiffIndex]}`;
                socket.emit('setBotDifficulty', currentDiffIndex); 
            };
        }
        diffBtn.style.display = 'block';
    }

    let formMenu = document.getElementById('formation-menu');
    if (!formMenu) {
        formMenu = document.createElement('div');
        formMenu.id = 'formation-menu';
        formMenu.style.cssText = "position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; z-index: 100;";
        formMenu.innerHTML = `
            <button class="form-btn" onclick="setFormation(0)" style="background: #2c3e50; color: white; padding: 8px 15px; border-radius: 8px; border: 2px solid #f1c40f; cursor: pointer; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: 0.2s;">[3] Okrąg</button>
            <button class="form-btn" onclick="setFormation(1)" style="background: #34495e; color: white; padding: 8px 15px; border-radius: 8px; border: 2px solid #2c3e50; cursor: pointer; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: 0.2s;">[4] Klin</button>
            <button class="form-btn" onclick="setFormation(2)" style="background: #34495e; color: white; padding: 8px 15px; border-radius: 8px; border: 2px solid #2c3e50; cursor: pointer; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: 0.2s;">[5] Linia</button>
            <button class="form-btn" onclick="setFormation(3)" style="background: #34495e; color: white; padding: 8px 15px; border-radius: 8px; border: 2px solid #2c3e50; cursor: pointer; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: 0.2s;">[6] Własna</button>
        `;
        document.body.appendChild(formMenu);
    }
    formMenu.style.display = 'flex';

    const name = document.getElementById('playerName').value || "Gracz";
    
    // TWORZYMY OBIEKT GRACZA
    player = {
        x: 2000, y: 2000, score: 0, level: 1, 
        name: name, color: '#fff', isSafe: false,
        isShielding: false, aura: null, 
        inventory: { bow: 0, knife: 0, shuriken: 0 }, 
        activeWeapon: 'sword',
        isRecruiting: false,
        formation: 0,
        isTutorialActive: true,
        tutorialText: "Oczekiwanie na rozkazy Midasa...",
        skin: window.playerSkin || 'standard',
        moveAngle: 0, isMoving: false
    };
    
    socket.emit('joinTeamGame', { name: name, mode: gameMode, skin: player.skin });
    gameState = 'PLAYING';
    
    lastFrameTime = performance.now();
    nextGachaTime = Date.now() + GACHA_INTERVAL_MS; 
    requestAnimationFrame(gameLoop);
};

// --- KOMUNIKACJA Z SERWEREM ---
socket.on('initTeam', (data) => { 
    myId = data.id; myTeam = data.team; 
    if (player) { player.id = myId; player.team = myTeam; player.color = data.color; }
});

socket.on('init', (data) => { 
    if(!myId) myId = data.id; 
    if (player && !player.id) player.id = myId; 
});

socket.on('levelUp', (data) => { skillPoints = data.points; });

socket.on('skillUpdated', (data) => {
    playerSkills = data.skills; 
    skillPoints = data.points; 
    paths = data.paths || paths; 
    window.weaponPath = paths.weapon;
});

socket.on('botEaten', (data) => { if (player) player.score = data.newScore; });
socket.on('killEvent', (data) => { killLogs.push({ text: data.text, time: 200 }); });

socket.on('tutorialTick', (data) => {
    if (player) {
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
    if(player) {
        const buttons = document.querySelectorAll('.form-btn');
        buttons.forEach((btn, i) => {
            btn.style.borderColor = (i === player.formation) ? '#f1c40f' : '#2c3e50';
            btn.style.background = (i === player.formation) ? '#2c3e50' : '#34495e';
        });
    }
});

// EFEKTY CZĄSTECZKOWE
socket.on('damageText', (data) => {
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
    
    for (let i = 0; i < count; i++) {
        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * 6 + 2;
        particles.push({
            x: data.x,
            y: data.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            decay: Math.random() * 0.05 + 0.02, 
            color: particleColor,
            size: Math.random() * 4 + 2 
        });
    }
});

socket.on('gameOver', (data) => {
    gameState = 'GAMEOVER';
    if (data && data.message) finalDeathMessage = data.message;
    document.getElementById('skill-menu').style.display = 'none';
    const shop = document.getElementById('castle-shop'); if (shop) shop.style.display = 'none';
    let diffBtn = document.getElementById('difficulty-btn'); if (diffBtn) diffBtn.style.display = 'none';
    let formMenu = document.getElementById('formation-menu'); if (formMenu) formMenu.style.display = 'none';
});

socket.on('serverTick', (data) => {
    foods = data.foods; 
    bots = data.bots; 
    projectiles = data.projectiles || [];
    loots = data.loots || [];             
    currentEvent = data.activeEvent;       
    eventTimeLeft = data.eventTimeLeft || 0; 
    castles = data.castles || []; 
    bushes = data.bushes || []; 
    meteorZones = data.meteorZones || [];
    
    otherPlayers = data.players;
    if (myId && otherPlayers[myId]) {
        player.score = otherPlayers[myId].score;
        player.inventory = otherPlayers[myId].inventory || { bow: 0, knife: 0, shuriken: 0 };
        player.activeWeapon = otherPlayers[myId].activeWeapon || 'sword';
        if (otherPlayers[myId].formation !== undefined) player.formation = otherPlayers[myId].formation;
        if (otherPlayers[myId].isRecruiting !== undefined) player.isRecruiting = otherPlayers[myId].isRecruiting;
        if (otherPlayers[myId].skin) player.skin = otherPlayers[myId].skin; 
        
        // --- SYNCHRONIZACJA BAZY I SKLEPU ---
        player.isSafe = otherPlayers[myId].isSafe;
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

// --- LOGIKA UPDATE ---
function update() {
    if (gameState !== 'PLAYING') return;

    if (player.aura && player.aura.time > 0) player.aura.time--;

    let dx = 0, dy = 0;
    
    if (controlType === 'TOUCH') {
        if (window.mobileJoy && window.mobileJoy.active) {
            dx = window.mobileJoy.dx;
            dy = window.mobileJoy.dy;
            
            lastMoveDir = { x: dx, y: dy };
            let len = Math.hypot(dx, dy);
            if (len > 0) { dx /= len; dy /= len; }
        }
    } else if (controlType === 'WASD') {
        if (keys['KeyW']) dy--; if (keys['KeyS']) dy++; if (keys['KeyA']) dx--; if (keys['KeyD']) dx++;
    } else {
        if (keys['ArrowUp']) dy--; if (keys['ArrowDown']) dy++; if (keys['ArrowLeft']) dx--; if (keys['ArrowRight']) dx++;
    }
    
    if (dx !== 0 || dy !== 0) {
        let moveAngle = Math.atan2(dy, dx); 
        let speed = 5 + (playerSkills.speed * 0.5);
        
        if (player.skin === 'ninja') {
            speed *= 1.05; 
        }

        if (currentEvent === 'BLIZZARD') {
            if (paths.speed !== 'lightweight') {
                speed *= 0.4; 
            }
        }
        
        let inBush = bushes.some(b => Math.hypot(player.x - b.x, player.y - b.y) < b.radius);
        if (inBush) speed *= 0.5;

        player.x += Math.cos(moveAngle) * speed; 
        player.y += Math.sin(moveAngle) * speed;
    }
    
    if (player.x <= 0 || player.x >= WORLD_SIZE || player.y <= 0 || player.y >= WORLD_SIZE) {
        socket.emit('playerMovementTeam', { x: -100, y: -100, score: player.score, isShielding: false });
    } else {
        camera.x = player.x - canvas.width / 2; camera.y = player.y - canvas.height / 2;
        socket.emit('playerMovementTeam', { x: player.x, y: player.y, score: player.score, isShielding: player.isShielding });
    }
}

// --- DREWNIANY FORT (Zamiast kółek zamków) ---
function drawWoodenFort(ctx, castle) {
    ctx.save();
    ctx.translate(castle.x, castle.y);
    
    // Palisada
    ctx.fillStyle = '#8b5a2b';
    ctx.beginPath(); ctx.arc(0, 0, castle.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5c4033'; ctx.lineWidth = 15; ctx.stroke();

    // Podłoga
    ctx.fillStyle = '#cd853f'; 
    ctx.beginPath(); ctx.arc(0, 0, castle.radius * 0.8, 0, Math.PI * 2); ctx.fill();

    // Centralna Wieża
    ctx.fillStyle = '#6b4423'; ctx.fillRect(-40, -40, 80, 80);
    ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 5; ctx.strokeRect(-40, -40, 80, 80);

    // Flaga drużyny
    ctx.fillStyle = castle.color;
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(40, -20); ctx.lineTo(-40, -20); ctx.closePath(); ctx.fill();
    
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#fff'; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(castle.team, 0, 10);

    ctx.restore();
}

function gameLoop(currentTime) {
    const deltaTime = currentTime - lastFrameTime;

    if (deltaTime < frameDuration) {
        requestAnimationFrame(gameLoop);
        return;
    }

    lastFrameTime = currentTime - (deltaTime % frameDuration);

    let allEntities = Object.values(otherPlayers).concat(bots);
    if (player && gameState !== 'GAMEOVER') allEntities.push(player);
    allEntities.sort((a,b) => b.score - a.score);
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
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#111111'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let vWidth = canvas.width / globalScale;
        let vHeight = canvas.height / globalScale;
        let vCamera = { x: player.x - vWidth / 2, y: player.y - vHeight / 2 };

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(globalScale, globalScale);
        ctx.translate(-vWidth / 2, -vHeight / 2);
        
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(-vCamera.x, -vCamera.y, WORLD_SIZE, WORLD_SIZE); 
        drawForestMap(ctx, vCamera, vWidth, vHeight);
        ctx.restore();

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(globalScale, globalScale);
        ctx.translate(-player.x, -player.y); 

        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 10;
        ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);
        
        castles.forEach(c => {
            drawWoodenFort(ctx, c);
            if (c.captureProgress > 0) {
                ctx.fillStyle = 'black'; ctx.fillRect(c.x - 50, c.y - c.radius - 30, 100, 15);
                ctx.fillStyle = c.captureProgress >= 100 ? '#e74c3c' : '#f1c40f'; 
                ctx.fillRect(c.x - 48, c.y - c.radius - 28, (c.captureProgress / 100) * 96, 11);
                ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center';
                ctx.fillText(c.captureProgress >= 100 ? "PRZEJĘTO!" : "OBLĘŻENIE...", c.x, c.y - c.radius - 20);
            }
        });
        
        foods.forEach(f => {
            ctx.fillStyle = '#e67e22'; ctx.beginPath(); ctx.arc(f.x, f.y, 8, 0, Math.PI * 2); ctx.fill();
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

        // --- RYSOWANIE GRACZY I BOTÓW WEDŁUG WZORU Z FREE.JS ---
        bots.forEach(b => {
            b.weaponPath = b.paths ? b.paths.weapon : 'none';
            // Nadpisywanie koloru na podstawie teamu
            const TEAM_COLORS = { 'N': '#3498db', 'S': '#e74c3c', 'E': '#f1c40f', 'W': '#2ecc71' };
            if (b.team) {
                b.color = TEAM_COLORS[b.team] || '#fff';
            } else if (!b.team && b.name && b.name.includes("Bot")) {
                b.color = '#7f8c8d'; 
            }
            drawStickman(b, b.x, b.y, getScale(b.score), false, currentKingId); 
            // Flaga nad głową bota, jeśli kogoś zwerbował
            if (b.team) {
                ctx.save(); ctx.translate(b.x, b.y); ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                let r = 25 * (1 + Math.pow(Math.max(0, b.score - 1), 0.45) * 0.15);
                ctx.font = `bold ${Math.floor(r * 1.2)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.team, 0, 0);
                ctx.restore();
            }
        });

        Object.values(otherPlayers).forEach(p => {
            if (p.isSafe && (!player || !player.isSafe)) return;
            p.weaponPath = p.paths ? p.paths.weapon : 'none';
            drawStickman(p, p.x, p.y, getScale(p.score), p.isSafe, currentKingId);
            
            if (p.team) {
                ctx.save(); ctx.translate(p.x, p.y); ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                let r = 25 * (1 + Math.pow(Math.max(0, p.score - 1), 0.45) * 0.15);
                ctx.font = `bold ${Math.floor(r * 1.2)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.team, 0, 0);
                const teamEmojis = { 'N': '🥶', 'S': '😈', 'E': '👺', 'W': '👹' }; ctx.font = `${Math.floor(r)}px Arial`; ctx.fillText(teamEmojis[p.team] || '👿', 0, -r - 45); 
                ctx.restore();
            }
        });
        
        if (player && gameState !== 'GAMEOVER') {
            player.weaponPath = paths.weapon || 'none';
            drawStickman(player, player.x, player.y, getScale(player.score), player.isSafe, currentKingId);
            if (player.team) {
                ctx.save(); ctx.translate(player.x, player.y); ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                let r = 25 * (1 + Math.pow(Math.max(0, player.score - 1), 0.45) * 0.15);
                ctx.font = `bold ${Math.floor(r * 1.2)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(player.team, 0, 0);
                const teamEmojis = { 'N': '🥶', 'S': '😈', 'E': '👺', 'W': '👹' }; ctx.font = `${Math.floor(r)}px Arial`; ctx.fillText(teamEmojis[player.team] || '👿', 0, -r - 45); 
                ctx.restore();
            }
        }

        // Rysowanie fizyki cząsteczek (Krew / Iskry)
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.x += p.vx; p.y += p.vy; p.vx *= 0.85; p.vy *= 0.85; p.life -= p.decay; 

            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            let currentRadius = Math.max(0, p.size * p.life);
            ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (p.life <= 0) particles.splice(i, 1);
        }

        // Rysowanie wyskakujących obrażeń
        for (let i = damageTexts.length - 1; i >= 0; i--) {
            let dt = damageTexts[i];
            dt.x += dt.vx; dt.y += dt.vy; dt.life -= 0.02; 

            ctx.save();
            ctx.globalAlpha = Math.max(0, dt.life);
            ctx.fillStyle = dt.color;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            let fontSize = 20 + (1 - dt.life) * 15;
            ctx.font = `bold ${fontSize}px 'Permanent Marker', Arial`; 
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            ctx.strokeText(`-${dt.val}`, dt.x, dt.y); 
            ctx.fillText(`-${dt.val}`, dt.x, dt.y);   
            ctx.restore();

            if (dt.life <= 0) {
                damageTexts.splice(i, 1);
            }
        }

        // Krzaki i Meteoryty
        bushes.forEach(b => {
            ctx.globalAlpha = 0.85; ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(b.x - b.radius/3, b.y - b.radius/3, b.radius/2, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1.0;
        });

        meteorZones.forEach(m => {
            ctx.fillStyle = 'rgba(231, 76, 60, 0.2)'; ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = '#ff4757'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'; ctx.fillText("⚠️ ZAGROŻENIE", m.x, m.y);
            if (m.timer !== undefined) {
                let meteorY = m.y - (m.timer * 20); let meteorX = m.x + (m.timer * 5); 
                ctx.save(); ctx.translate(meteorX, meteorY); ctx.fillStyle = '#e67e22'; ctx.beginPath(); ctx.arc(0, -20, m.radius * 0.4, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.arc(0, 0, m.radius * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            }
        });

        ctx.restore(); 
        
        // --- EFEKTY WIZUALNE POGODY ---
        ctx.setTransform(1, 0, 0, 1, 0, 0); 

        if (currentEvent === 'TOXIC_RAIN') {
            ctx.save();
            ctx.fillStyle = 'rgba(46, 204, 113, 0.15)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = 'rgba(46, 204, 113, 0.6)'; ctx.lineWidth = 2; ctx.beginPath();
            
            rainParticles.forEach(p => {
                let drawX = p.x - camera.x; let drawY = p.y - camera.y;
                if (drawX < 0) p.x += canvas.width; if (drawX > canvas.width) p.x -= canvas.width; if (drawY > canvas.height) p.y -= canvas.height;
                ctx.moveTo(p.x - camera.x, p.y - camera.y); ctx.lineTo(p.x - camera.x, p.y - camera.y + p.length); p.y += p.vy;
            });
            
            ctx.stroke();
            ctx.restore();
            ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center'; ctx.fillText(`KWAŚNY DESZCZ: ${eventTimeLeft}s`, canvas.width / 2, 80);
        } else if (currentEvent === 'BLIZZARD') { 
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'; 
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            blizzardParticles.forEach(p => {
                let drawX = p.x - camera.x; let drawY = p.y - camera.y;
                if (drawX < 0) p.x += canvas.width; if (drawX > canvas.width) p.x -= canvas.width;
                if (drawY < 0) p.y += canvas.height; if (drawY > canvas.height) p.y -= canvas.height;
                ctx.arc(p.x - camera.x, p.y - camera.y, Math.random() * 3 + 1.5, 0, Math.PI * 2);
                p.x += p.vx; p.y += p.vy;
            });
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = '#ecf0f1'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center'; ctx.fillText(`ZAMIĘĆ ŚNIEŻNA: ${eventTimeLeft}s`, canvas.width / 2, 80);
        } else if (currentEvent === 'KING_HUNT') {
            ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center'; ctx.fillText(`POLOWANIE NA KRÓLA: ${eventTimeLeft}s`, canvas.width / 2, 80);
        }

        // --- RYSOWANIE UI ---
        if (gameState === 'PLAYING' && player && player.isTutorialActive) {
            ctx.save();
            let tutorialX = 20; let tutorialY = canvas.height - 200; 
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'; ctx.fillRect(tutorialX, tutorialY, 380, 110);
            ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 4; ctx.strokeRect(tutorialX, tutorialY, 380, 110);
            
            if (typeof skins !== 'undefined' && skins.midas && skins.midas.complete) {
                ctx.drawImage(skins.midas, tutorialX + 10, tutorialY + 15, 80, 80); 
            }
            
            ctx.fillStyle = '#2c3e50'; ctx.font = "bold 16px 'Permanent Marker', Arial"; ctx.textAlign = 'left';
            ctx.fillText("MIDAS (Przewodnik XD):", tutorialX + 110, tutorialY + 25);
            
            ctx.fillStyle = '#000'; ctx.font = '13px Arial';
            if (player.tutorialText) {
                if (window.wrapText) { window.wrapText(ctx, player.tutorialText, tutorialX + 110, tutorialY + 50, 250, 18); } 
                else { ctx.fillText(player.tutorialText.substring(0, 50) + "...", tutorialX + 110, tutorialY + 50); }
            }
            
            ctx.fillStyle = '#7f8c8d'; ctx.font = 'bold 10px Arial';
            ctx.fillText("[H] - Ukryj podpowiedź", tutorialX + 110, tutorialY + 100);
            
            ctx.restore();
        }

        if (gameState !== 'GAMEOVER') {
            ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(canvas.width - 280, 10, 270, 140);
            ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 16px Arial';
            ctx.fillText("🏆 RANKING SERWERA", canvas.width - 265, 30);
            
            topEntities.forEach((p, i) => {
                let yPos = 55 + i * 20;
                if (i === 0) { ctx.fillStyle = '#f1c40f'; ctx.fillText(`👑 [KRÓL] ${p.name} - ${Math.floor(p.score)} pkt`, canvas.width - 265, yPos); } 
                else { ctx.fillStyle = (p.id === myId || p === player) ? '#2ecc71' : '#fff'; ctx.fillText(`${i+1}. ${p.name} - ${Math.floor(p.score)} pkt`, canvas.width - 265, yPos); }
            });

            ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Arial';
            ctx.fillText(`PUNKTY: ${Math.floor(player.score)}`, 20, 40);
            
            if (player.isRecruiting !== undefined) {
                ctx.font = 'bold 14px Arial';
                ctx.fillStyle = player.isRecruiting ? '#3498db' : '#e74c3c';
                ctx.fillText(`TRYB (P): ${player.isRecruiting ? 'WERBUNEK' : 'ZJADANIE'}`, 20, 60);
            }

            if (killLogs.length > 0) {
                ctx.save(); ctx.font = 'bold 14px Arial'; ctx.textAlign = 'right';
                for (let i = 0; i < killLogs.length; i++) {
                    let log = killLogs[i];
                    ctx.fillStyle = `rgba(231, 76, 60, ${log.time / 50})`; 
                    ctx.fillText("☠️ " + log.text, canvas.width - 20, 170 + (i * 22));
                    log.time--;
                }
                ctx.restore(); killLogs = killLogs.filter(l => l.time > 0);
            }

            ctx.save();
            let startX = canvas.width / 2 - 60, startY = canvas.height - 80;
            
            ctx.fillStyle = player.activeWeapon === 'sword' ? 'rgba(46, 204, 113, 0.9)' : 'rgba(44, 62, 80, 0.8)';
            ctx.fillRect(startX, startY, 50, 50); ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2; ctx.strokeRect(startX, startY, 50, 50);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.fillText('1', startX + 15, startY + 18);
            ctx.font = '10px Arial'; ctx.fillText('Miecz', startX + 25, startY + 40);

            ctx.fillStyle = player.activeWeapon !== 'sword' ? 'rgba(46, 204, 113, 0.9)' : 'rgba(44, 62, 80, 0.8)';
            ctx.fillRect(startX + 60, startY, 50, 50); ctx.strokeRect(startX + 60, startY, 50, 50);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.fillText('2', startX + 75, startY + 18);
            
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
                ctx.fillStyle = 'rgba(44, 62, 80, 0.8)'; ctx.fillRect(btnX, startY, 50, 50);
                ctx.fillStyle = 'rgba(52, 152, 219, 0.8)'; ctx.fillRect(btnX, startY + 50 * (1 - winterProgress), 50, 50 * winterProgress);
                ctx.strokeStyle = winterProgress >= 1 ? '#3498db' : '#7f8c8d'; ctx.lineWidth = 2; ctx.strokeRect(btnX, startY, 50, 50);
                
                ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.fillText('R', btnX + 25, startY + 18);
                
                ctx.font = '10px Arial'; 
                if (winterProgress >= 1) {
                    ctx.fillText('GOTOWE', btnX + 25, startY + 40);
                } else {
                    ctx.fillStyle = '#e74c3c'; 
                    ctx.font = 'bold 14px Arial';
                    ctx.fillText(`${timeLeft}s`, btnX + 25, startY + 40);
                }
            }
            
            if (paths.speed === 'dash') {
                let timePassedD = Date.now() - lastDashUseClient;
                let cooldownTotalD = 3000; 
                let dashProgress = Math.min(1, timePassedD / cooldownTotalD);
                let timeLeftD = Math.ceil((cooldownTotalD - timePassedD) / 1000);

                let btnXD = startX + 180;
                ctx.fillStyle = 'rgba(44, 62, 80, 0.8)'; ctx.fillRect(btnXD, startY, 50, 50);
                ctx.fillStyle = 'rgba(46, 204, 113, 0.8)'; ctx.fillRect(btnXD, startY + 50 * (1 - dashProgress), 50, 50 * dashProgress);
                ctx.strokeStyle = dashProgress >= 1 ? '#2ecc71' : '#7f8c8d'; ctx.lineWidth = 2; ctx.strokeRect(btnXD, startY, 50, 50);
                
                ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.fillText('SHIFT', btnXD + 25, startY + 18);
                
                ctx.font = '10px Arial'; 
                if (dashProgress >= 1) {
                    ctx.fillText('GOTOWE', btnXD + 25, startY + 40);
                } else {
                    ctx.fillStyle = '#e74c3c'; 
                    ctx.font = 'bold 14px Arial';
                    ctx.fillText(`${timeLeftD}s`, btnXD + 25, startY + 40);
                }
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
                        let titleColor = lvl >= 20 ? '#e67e22' : '#000';
                        
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

        if (gameState === 'PAUSED' && !document.getElementById('gacha-modal').style.display.includes('flex')) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 40px Arial'; ctx.textAlign = 'center';
            ctx.fillText("PAUZA", canvas.width / 2, canvas.height / 2 - 30);
            
            const btnX = canvas.width / 2 - 100; const btnY = canvas.height / 2 + 10;
            ctx.fillStyle = '#e74c3c'; ctx.fillRect(btnX, btnY, 200, 50);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 24px Arial'; ctx.fillText("WYJŚCIE", canvas.width / 2, btnY + 33);
            ctx.textAlign = 'left';
        }
    }
    requestAnimationFrame(gameLoop);
}
