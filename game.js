const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const socket = io();

// --- ZMIENNE STANU I KONFIGURACJI ---
let player, otherPlayers = {}, foods = [], bots = [], projectiles = [];
let controlType = 'WASD', gameState = 'MENU', myId = null;
const WORLD_SIZE = 4000, camera = { x: 0, y: 0 }, keys = {};

// Inicjalizacja mapy z pliku maps.js
initMap(WORLD_SIZE);

// Statystyki RPG, Ekwipunek i Pamięć Animacji
let skillPoints = 0;
let playerSkills = { speed: 0, strength: 0, weapon: 0 };
let weaponPath = 'none'; 
let lastMoveDir = { x: 1, y: 0 }; 
let lastCalculatedTier = 0; 
let wasSafe = false; 
let killLogs = [];
const visualStates = {}; 
let lastWinterUseClient = 0; // NOWOŚĆ: Zmienna do paska ładowania R

// NOWOŚCI: Zmienne do precyzyjnego przeciągania botów (RTS)
let draggedBotId = null; 
let dragMouseWorld = { x: 0, y: 0 };

// Blokada menu pod prawym przyciskiem, żeby dało się przeciągać
window.addEventListener('contextmenu', e => e.preventDefault());

// --- OBSŁUGA MYSZKI ---
window.addEventListener('mousemove', (e) => {
    if (gameState === 'PLAYING' && player) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const mouseWorldX = mouseX + camera.x;
        const mouseWorldY = mouseY + camera.y;
        
        const playerScreenX = player.x - camera.x;
        const playerScreenY = player.y - camera.y;
        
        const angle = Math.atan2(mouseY - playerScreenY, mouseX - playerScreenX);
        lastMoveDir = { x: Math.cos(angle), y: Math.sin(angle) };

        // Aktualizujemy pozycję myszy u klienta do rysowania smyczy (zero spamu do serwera!)
        if (draggedBotId) {
            dragMouseWorld = { x: mouseWorldX, y: mouseWorldY };
        }
    }
});

window.addEventListener('mousedown', (e) => {
    if (gameState === 'PLAYING' && player) { 
        // --- Chwytanie bota do układania formacji (PPM) ---
        if (e.button === 2) { 
            const rect = canvas.getBoundingClientRect();
            const mouseWorldX = e.clientX - rect.left + camera.x;
            const mouseWorldY = e.clientY - rect.top + camera.y;

            let closestBot = null;
            let minDist = 80; // Zasięg "łapania" myszką
            bots.forEach(b => {
                if (b.ownerId === myId) {
                    let d = Math.hypot(b.x - mouseWorldX, b.y - mouseWorldY);
                    if (d < minDist) {
                        minDist = d;
                        closestBot = b;
                    }
                }
            });

            if (closestBot) {
                draggedBotId = closestBot.id;
                dragMouseWorld = { x: mouseWorldX, y: mouseWorldY };
            }
        }
        // Strzał z Miecza (LPM)
        else if (e.button === 0) {
            socket.emit('throwSword', { 
                x: player.x, 
                y: player.y, 
                dx: lastMoveDir.x, 
                dy: lastMoveDir.y 
            });
        }
    }
    
    if (gameState === 'PAUSED' && e.button === 0) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const btnX = canvas.width / 2 - 100;
        const btnY = canvas.height / 2 + 10;
        
        if (mouseX >= btnX && mouseX <= btnX + 200 && mouseY >= btnY && mouseY <= btnY + 50) {
            socket.disconnect();
            location.reload();   
        }
    }
});

window.addEventListener('mouseup', (e) => {
    // Puszczasz bota z myszki (PPM) - wysyłamy JEDNĄ komendę do serwera
    if (e.button === 2 && draggedBotId && player) {
        let dx = dragMouseWorld.x - player.x;
        let dy = dragMouseWorld.y - player.y;
        let dist = Math.hypot(dx, dy);
        let absAngle = Math.atan2(dy, dx);
        let playerFaceAngle = Math.atan2(lastMoveDir.y, lastMoveDir.x);
        let relAngle = absAngle - playerFaceAngle;

        socket.emit('setBotOffset', {
            botId: draggedBotId,
            angleOffset: relAngle,
            distOffset: dist
        });

        draggedBotId = null; 
    }
});

// --- OBSŁUGA KLAWIATURY ---
window.onkeydown = (e) => {
    keys[e.code] = true;
    if (e.code === 'Space' && (gameState === 'PLAYING' || gameState === 'PAUSED')) {
        gameState = (gameState === 'PLAYING') ? 'PAUSED' : 'PLAYING';
    }
    if (gameState === 'PLAYING') {
        if (e.code === 'Digit1') socket.emit('switchWeapon', 1);
        if (e.code === 'Digit2') socket.emit('switchWeapon', 2);

        if (e.code === 'KeyE') {
            socket.emit('throwSword', { 
                x: player.x, 
                y: player.y, 
                dx: lastMoveDir.x, 
                dy: lastMoveDir.y 
            });
        }
        // NOWOŚĆ: Synchronizacja paska ładowania z rzucaniem zimowego miecza
        if (e.code === 'KeyR' && weaponPath === 'winter') {
            const now = Date.now();
            if (now - lastWinterUseClient >= 15000) {
                lastWinterUseClient = now;
                socket.emit('throwWinterSword');
            }
        }
        if (e.code === 'KeyQ' && player.score >= 50) {
            player.isShielding = true;
        }
        // Klawisze RTS
        if (e.code === 'KeyP') socket.emit('toggleRecruit');
        if (e.code === 'KeyC') socket.emit('switchFormation');
    }
};

window.onkeyup = (e) => {
    keys[e.code] = false;
    if (e.code === 'KeyQ' && player) {
        player.isShielding = false;
    }
};

// --- LOGIKA MENU I STARTU ---
window.startGame = (type) => {
    controlType = type;
    document.getElementById('ui-layer').style.display = 'none';
    const name = document.getElementById('playerName').value || "Gracz";
    const color = document.getElementById('playerColor').value;
    player = {
        x: 2000, y: 2000, score: 5, level: 1,
        name: name, color: color, isSafe: false,
        isShielding: false,
        aura: null, 
        inventory: { bow: 0, knife: 0, shuriken: 0 }, 
        activeWeapon: 'sword' 
    };
    if (myId) player.id = myId;
    socket.emit('joinGame', { name, color });
    gameState = 'PLAYING';
    gameLoop();
};

// --- KOMUNIKACJA Z SERWEREM ---
socket.on('init', (data) => { 
    myId = data.id; 
    if (player) player.id = myId;
});
socket.on('levelUp', (data) => { skillPoints = data.points; });
socket.on('skillUpdated', (data) => {
    playerSkills = data.skills;
    skillPoints = data.points;
    weaponPath = data.weaponPath || 'none';
});
socket.on('botEaten', (data) => { if (player) player.score = data.newScore; });

socket.on('killEvent', (data) => {
    killLogs.push({ text: data.text, time: 200 }); 
});

socket.on('recruitToggled', (state) => {
    killLogs.push({ text: state ? "TRYB: ZWERBUJ (P)" : "TRYB: ZJADAJ (P)", time: 150 }); 
});
socket.on('formationSwitched', (formName) => {
    killLogs.push({ text: "FORMACJA: " + formName, time: 150 }); 
});

socket.on('gameOver', (data) => {
    gameState = 'GAMEOVER';
    
    document.getElementById('ui-layer').style.display = 'flex';
    document.getElementById('step-1').style.display = 'none';
    document.getElementById('step-2').style.display = 'none';
    
    let gameOverDiv = document.getElementById('game-over-screen');
    if (!gameOverDiv) {
        gameOverDiv = document.createElement('div');
        gameOverDiv.id = 'game-over-screen';
        gameOverDiv.style.textAlign = 'center';
        gameOverDiv.style.color = 'white';
        document.getElementById('menu').appendChild(gameOverDiv);
    }
    gameOverDiv.style.display = 'block';
    gameOverDiv.innerHTML = `
        <h2 style="color: #e74c3c; font-size: 38px; margin-bottom: 10px; text-transform: uppercase;">Zostałeś pożarty!</h2>
        <p style="font-size: 16px; margin-bottom: 20px;">Twój gang przestał istnieć.</p>
        <p style="font-size: 24px; color: #f1c40f; font-weight: bold; margin-bottom: 30px;">Zebrałeś masy: ${data.finalScore}</p>
        <button class="main-btn" onclick="location.reload()">Zagraj ponownie</button>
    `;
    
    document.getElementById('skill-menu').style.display = 'none';
    const shop = document.getElementById('castle-shop');
    if (shop) shop.style.display = 'none';
});

socket.on('serverTick', (data) => {
    foods = data.foods;
    bots = data.bots;
    projectiles = data.projectiles || [];
    otherPlayers = data.players;
    if (myId && otherPlayers[myId]) {
        player.score = otherPlayers[myId].score;
        player.inventory = otherPlayers[myId].inventory || { bow: 0, knife: 0, shuriken: 0 };
        player.activeWeapon = otherPlayers[myId].activeWeapon || 'sword';
    }
    delete otherPlayers[myId];
});

window.upgrade = (name) => { socket.emit('upgradeSkill', name); };

// --- POMOCNICZE FUNKCJE TIEROWANIA ---
function getTier(value, thresholds = [100, 300, 600]) {
    if (value >= thresholds[2]) return 3; 
    if (value >= thresholds[1]) return 2; 
    if (value >= thresholds[0]) return 1; 
    return 0;
}

function getScale(s) {
    return 1 + Math.pow(Math.max(0, s - 1), 0.45) * 0.15;
}

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

// --- RYSOWANIE GRAFIKI ---

function drawBowModel(x, y, angle, sc) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.strokeStyle = '#8e44ad'; ctx.lineWidth = 3 * sc; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 15 * sc, -Math.PI/2, Math.PI/2); ctx.stroke();
    ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1 * sc;
    ctx.beginPath(); ctx.moveTo(0, -15 * sc); ctx.lineTo(0, 15 * sc); ctx.stroke();
    ctx.restore();
}

function drawKnifeModel(x, y, angle, sc) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = '#bdc3c7'; ctx.beginPath(); ctx.moveTo(0, -2*sc); ctx.lineTo(15*sc, 0); ctx.lineTo(0, 2*sc); ctx.fill();
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(-5*sc, -2*sc, 5*sc, 4*sc);
    ctx.restore();
}

function drawShurikenModel(x, y, angle, sc) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = '#34495e';
    for(let i=0; i<4; i++) { ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(6*sc, -2*sc); ctx.lineTo(12*sc, 0); ctx.lineTo(6*sc, 2*sc); ctx.fill(); ctx.rotate(Math.PI/2); }
    ctx.fillStyle = '#bdc3c7'; ctx.beginPath(); ctx.arc(0,0, 2*sc, 0, Math.PI*2); ctx.fill();
    ctx.restore();
}

function drawSwordModel(p, x, y, angle, sc, tier = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    if (p && p.isWinter) {
        ctx.shadowBlur = 20 * sc;
        ctx.shadowColor = 'rgba(135, 206, 235, 0.8)';
        ctx.fillStyle = '#a4ebf3'; 
        ctx.beginPath(); ctx.moveTo(0, -6 * sc);
        ctx.lineTo(60 * sc, -10 * sc); ctx.lineTo(80 * sc, 0); ctx.lineTo(60 * sc, 10 * sc);
        ctx.lineTo(0, 6 * sc); ctx.fill();
        
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(4 * sc, -16 * sc, 6 * sc, 32 * sc);
        ctx.fillRect(-10 * sc, -3 * sc, 10 * sc, 6 * sc);
        ctx.restore();
        return;
    }

    let bladeColor = tier === 3 ? '#f1c40f' : (tier === 2 ? '#e74c3c' : '#bdc3c7');
    let glow = 'transparent';
    
    if (p && p.isPiercing) {
        glow = 'rgba(255, 255, 255, 0.8)'; 
        ctx.shadowBlur = 15 * sc;
    } else if (tier >= 2) {
        glow = tier === 3 ? 'rgba(241, 196, 15, 0.5)' : 'rgba(231, 76, 60, 0.3)';
        ctx.shadowBlur = 10 * sc;
    }
    ctx.shadowColor = glow;

    ctx.fillStyle = bladeColor;
    ctx.beginPath(); ctx.moveTo(0, -2 * sc);
    if (tier <= 1) { 
        ctx.lineTo(35 * sc, -2 * sc); ctx.lineTo(42 * sc, 0); ctx.lineTo(35 * sc, 2 * sc);
    } else if (tier === 2) { 
        ctx.lineTo(38 * sc, -4 * sc); ctx.lineTo(48 * sc, 0); ctx.lineTo(38 * sc, 4 * sc);
    } else { 
        ctx.lineTo(48 * sc, -6 * sc); ctx.lineTo(58 * sc, 0); ctx.lineTo(48 * sc, 6 * sc);
    }
    ctx.lineTo(0, 2 * sc); ctx.fill();

    ctx.fillStyle = tier === 3 ? '#e67e22' : '#2c3e50';
    let guardWidth = tier >= 2 ? 26 : 20;
    ctx.fillRect(4 * sc, -(guardWidth/2) * sc, 4 * sc, guardWidth * sc);
    if (tier === 3) {
        ctx.fillStyle = '#f39c12';
        ctx.beginPath(); ctx.arc(6*sc, 0, 3*sc, 0, Math.PI*2); ctx.fill();
    }
    
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(-10 * sc, -2 * sc, 10 * sc, 4 * sc);
    ctx.restore();
}

function drawProArmor(x, y, sc, tier, strengthLvl) {
    ctx.save();
    let mainColor = tier === 3 ? '#f1c40f' : (tier === 2 ? '#3498db' : '#95a5a6');
    let shadowColor = tier === 3 ? '#d35400' : (tier === 2 ? '#2980b9' : '#7f8c8d');

    ctx.fillStyle = shadowColor;
    ctx.beginPath(); ctx.moveTo(x - 11 * sc, y - 10 * sc); ctx.lineTo(x + 11 * sc, y - 10 * sc);
    ctx.lineTo(x + 14 * sc, y + 15 * sc); ctx.lineTo(x - 14 * sc, y + 15 * sc); ctx.fill();

    ctx.fillStyle = mainColor;
    ctx.beginPath(); ctx.moveTo(x - 9 * sc, y - 10 * sc); ctx.lineTo(x + 9 * sc, y - 10 * sc);
    ctx.lineTo(x + 11 * sc, y + 13 * sc); ctx.lineTo(x - 11 * sc, y + 13 * sc); ctx.fill();

    if (strengthLvl >= 100) {
        ctx.fillStyle = '#8e44ad'; 
        ctx.fillRect(x - 13 * sc, y - 12 * sc, 26 * sc, 8 * sc);
        ctx.fillStyle = '#f1c40f'; 
        ctx.beginPath(); ctx.moveTo(x, y - 5 * sc); ctx.lineTo(x + 8 * sc, y + 5 * sc); ctx.lineTo(x, y + 15 * sc); ctx.lineTo(x - 8 * sc, y + 5 * sc); ctx.fill();
        ctx.shadowBlur = 10 * sc; ctx.shadowColor = '#9b59b6';
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * sc; ctx.stroke();
    } else if (strengthLvl >= 55) {
        ctx.fillStyle = '#00ffff';
        ctx.beginPath(); ctx.moveTo(x - 14 * sc, y - 8 * sc); ctx.lineTo(x - 20 * sc, y - 15 * sc); ctx.lineTo(x - 8 * sc, y - 12 * sc); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 14 * sc, y - 8 * sc); ctx.lineTo(x + 20 * sc, y - 15 * sc); ctx.lineTo(x + 8 * sc, y - 12 * sc); ctx.fill();
        ctx.fillRect(x - 4 * sc, y, 8 * sc, 10 * sc);
    } else if (strengthLvl >= 20) {
        ctx.fillStyle = '#bdc3c7';
        ctx.fillRect(x - 10 * sc, y - 5 * sc, 20 * sc, 4 * sc);
        ctx.fillRect(x - 8 * sc, y + 2 * sc, 16 * sc, 4 * sc);
        ctx.fillStyle = '#7f8c8d';
        ctx.beginPath(); ctx.arc(x, y + 8 * sc, 4 * sc, 0, Math.PI*2); ctx.fill();
    } else if (strengthLvl >= 5) {
        ctx.fillStyle = '#d35400';
        ctx.fillRect(x - 12 * sc, y - 10 * sc, 6 * sc, 6 * sc);
        ctx.fillRect(x + 6 * sc, y - 10 * sc, 6 * sc, 6 * sc);
        ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 2 * sc;
        ctx.beginPath(); ctx.moveTo(x - 8 * sc, y - 10 * sc); ctx.lineTo(x + 8 * sc, y + 10 * sc); ctx.stroke();
    }
    ctx.restore();
}

function drawProHelmet(x, y, sc, tier) {
    ctx.save();
    let col = tier === 3 ? '#f1c40f' : (tier === 2 ? '#3498db' : '#7f8c8d');
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y - 22 * sc, 12 * sc, Math.PI, 0); ctx.fill();

    ctx.fillStyle = '#2c3e50';
    if (tier === 1) {
        ctx.fillRect(x - 11 * sc, y - 22 * sc, 22 * sc, 4 * sc);
    } else {
        ctx.beginPath(); ctx.moveTo(x - 12 * sc, y - 22 * sc); ctx.lineTo(x + 12 * sc, y - 22 * sc);
        ctx.lineTo(x + 8 * sc, y - 15 * sc); ctx.lineTo(x - 8 * sc, y - 15 * sc); ctx.fill();
    }

    if (tier >= 2) {
        ctx.fillStyle = tier === 3 ? '#e74c3c' : '#bdc3c7';
        ctx.beginPath(); ctx.moveTo(x, y - 34 * sc);
        ctx.quadraticCurveTo(x - 15 * sc, y - 40 * sc, x - 22 * sc, y - 25 * sc);
        ctx.lineTo(x - 5 * sc, y - 28 * sc); ctx.fill();
    }
    ctx.restore();
}

function drawProShield(x, y, sc, tier) {
    ctx.save();
    ctx.translate(x, y);

    if (tier === 1) { 
        ctx.fillStyle = '#95a5a6';
        ctx.beginPath(); ctx.arc(0, 0, 14 * sc, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = 2 * sc; ctx.stroke();
        ctx.fillStyle = '#34495e'; 
        ctx.beginPath(); ctx.arc(0, 0, 4 * sc, 0, Math.PI * 2); ctx.fill();
    } 
    else if (tier === 2) { 
        ctx.fillStyle = '#2980b9';
        ctx.beginPath();
        ctx.moveTo(-12 * sc, -14 * sc); ctx.lineTo(12 * sc, -14 * sc);
        ctx.lineTo(12 * sc, 4 * sc); ctx.lineTo(0, 18 * sc); ctx.lineTo(-12 * sc, 4 * sc);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ecf0f1'; ctx.lineWidth = 2 * sc; ctx.stroke();
        ctx.fillStyle = '#ecf0f1';
        ctx.fillRect(-2 * sc, -10 * sc, 4 * sc, 18 * sc);
        ctx.fillRect(-8 * sc, -2 * sc, 16 * sc, 4 * sc);
    } 
    else { 
        ctx.shadowBlur = 10 * sc; ctx.shadowColor = 'rgba(241, 196, 15, 0.6)';
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath(); ctx.arc(0, 0, 15 * sc, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 3 * sc; ctx.stroke();
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath(); ctx.arc(0, 0, 5 * sc, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
}

// --- NOWA WERSJA: GRUBE ŁAPKI + Z-INDEX (Zbroja z tyłu, twarz z przodu) ---
function drawStickman(e, x, y, sc, safe, kingId) {
    ctx.save(); 
    if (safe) ctx.globalAlpha = 0.35;
    
    // --- AURA ---
    if (e.aura && e.aura.time > 0) { 
        ctx.save(); 
        let progress = 1 - (e.aura.time / e.aura.maxTime); 
        let radius = (30 * sc) + (progress * 70 * sc); 
        let alpha = 1 - Math.pow(progress, 2); 
        ctx.globalAlpha = alpha; 
        let gradient = ctx.createLinearGradient(x, y + 20 * sc, x, y - 120 * sc); 
        gradient.addColorStop(0, e.aura.color); 
        gradient.addColorStop(1, 'transparent'); 
        ctx.fillStyle = gradient; 
        ctx.fillRect(x - 25 * sc, y - 120 * sc, 50 * sc, 140 * sc); 
        ctx.beginPath(); 
        ctx.arc(x, y, radius, 0, Math.PI * 2); 
        ctx.strokeStyle = e.aura.color; 
        ctx.lineWidth = 15 * (1 - progress); 
        ctx.shadowBlur = 20; 
        ctx.shadowColor = e.aura.color; 
        ctx.stroke(); 
        ctx.restore(); 
    }

    const score = e.score || 0; 
    const skills = e.skills || (e === player ? playerSkills : { speed: 0, strength: 0, weapon: 0 }); 
    const inv = e.inventory || { bow: 0, knife: 0, shuriken: 0 }; 
    const actWpn = e.activeWeapon || 'sword';

    const armorTier = getTier(score, [100, 450, 850]); 
    const helmetTier = getTier(score, [500, 800, 1150]); 
    const swordTier = getTier(score, [15, 300, 700]); 
    const shieldTier = getTier(score, [50, 150, 300]); 
    const bootTier = getTier(skills.speed, [3, 6, 9]);

    // 1. GRUBE, UROCZE ŁAPKI (Rysowane na samym dole)
    ctx.save();
    ctx.strokeStyle = e.color || '#000'; 
    ctx.lineWidth = 11 * sc; 
    ctx.lineCap = 'round'; 
    ctx.lineJoin = 'round';
    
    ctx.beginPath(); 
    ctx.moveTo(x - 15 * sc, y + 5 * sc); ctx.lineTo(x - 22 * sc, y + 12 * sc); // L ręka
    ctx.moveTo(x + 15 * sc, y + 5 * sc); ctx.lineTo(x + 22 * sc, y + 12 * sc); // P ręka
    ctx.moveTo(x - 8 * sc, y + 14 * sc); ctx.lineTo(x - 11 * sc, y + 28 * sc); // L noga
    ctx.moveTo(x + 8 * sc, y + 14 * sc); ctx.lineTo(x + 11 * sc, y + 28 * sc); // P noga
    ctx.stroke();
    ctx.restore();

    // 2. NAKOLANNIKI (też pod spodem)
    if (score >= 200) { 
        const legTier = getTier(score, [200, 500, 900]); 
        ctx.strokeStyle = legTier === 3 ? '#f1c40f' : (legTier === 2 ? '#3498db' : '#95a5a6'); 
        ctx.lineWidth = 8 * sc; 
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 5 * sc, y + 16 * sc); ctx.lineTo(x - 11 * sc, y + 27 * sc); 
        ctx.moveTo(x + 5 * sc, y + 16 * sc); ctx.lineTo(x + 11 * sc, y + 27 * sc); 
        ctx.stroke(); 
    }

    // 3. BUTY (pod spodem)
    if (score >= 350) { 
        ctx.fillStyle = bootTier === 3 ? '#f1c40f' : (bootTier === 2 ? '#e74c3c' : '#34495e'); 
        ctx.beginPath(); ctx.roundRect(x - 16 * sc, y + 26 * sc, 12 * sc, 8 * sc, 4); ctx.fill(); 
        ctx.beginPath(); ctx.roundRect(x + 4 * sc, y + 26 * sc, 12 * sc, 8 * sc, 4); ctx.fill(); 
        if (bootTier >= 2) { 
            ctx.fillStyle = 'white'; 
            ctx.beginPath(); ctx.moveTo(x-14*sc, y+31*sc); ctx.lineTo(x-20*sc, y+25*sc); ctx.lineTo(x-12*sc, y+27*sc); ctx.fill(); 
            ctx.beginPath(); ctx.moveTo(x+14*sc, y+31*sc); ctx.lineTo(x+20*sc, y+25*sc); ctx.lineTo(x+12*sc, y+27*sc); ctx.fill(); 
        } 
    }

    // 4. ZBROJA (Rysowana PRZED twarzą, udaje brzuszek pod głową)
    if (armorTier > 0) drawProArmor(x, y + 4 * sc, sc, armorTier, skills.strength); 

    // 5. TWARZ / EMOTKA (Rysowana NA WIERZCHU, żeby zbroja jej nie zasłaniała!)
    let eId = e.id || e.name || 'unknown'; 
    if (!visualStates[eId]) visualStates[eId] = { lastScore: score, eatTimer: 0 };
    if (score > visualStates[eId].lastScore) { visualStates[eId].eatTimer = 15; visualStates[eId].lastScore = score; } 
    if (score < visualStates[eId].lastScore) { visualStates[eId].lastScore = score; } 
    if (visualStates[eId].eatTimer > 0) visualStates[eId].eatTimer--;

    ctx.save(); 
    ctx.font = `${42 * sc}px Arial`; 
    ctx.textAlign = 'center'; 
    ctx.textBaseline = 'middle';
    
    // Lekki cień pod buzią, żeby odcinała się od zbroi
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 6 * sc;
    ctx.shadowOffsetY = 2 * sc;

    let emojiChar = '🙂'; 
    if (visualStates[eId].eatTimer > 0) emojiChar = '🤤'; 
    else if (e.name === 'Wojownik') emojiChar = '😠'; 
    else if (e.name && e.name.includes('Bot')) emojiChar = score >= 50 ? '💀' : '🧟‍♂️'; 
    else if (e !== player) emojiChar = '👿';
    ctx.fillText(emojiChar, x, y); 
    ctx.restore();

    // 6. HEŁM (Na samej górze głowy)
    if (helmetTier > 0) drawProHelmet(x, y, sc, helmetTier);

    // 7. TARCZA
    if (e.isShielding) { 
        ctx.save(); ctx.strokeStyle = '#3498db'; ctx.lineWidth = 6 * sc; ctx.shadowBlur = 10; ctx.shadowColor = '#3498db'; ctx.beginPath(); 
        let shieldAngle = (e === player) ? Math.atan2(lastMoveDir.y, lastMoveDir.x) : 0; 
        ctx.arc(x, y, 40 * sc, shieldAngle - 0.9, shieldAngle + 0.9); ctx.stroke(); ctx.restore(); 
    }
    if (score >= 50) { drawProShield(x - 20 * sc, y + 6 * sc, sc, shieldTier); }

    // 8. BRONIE W RĘCE
    if (score >= 15 || actWpn !== 'sword') {
        let weaponAngle = (e === player) ? Math.atan2(lastMoveDir.y, lastMoveDir.x) + 0.5 : 0.5; 
        let handX = x + 18 * sc, handY = y + 10 * sc; // Broń przesunięta do nowej, grubej łapki
        if (actWpn === 'sword' && score >= 15) { e.isPiercing = (e === player) ? (weaponPath === 'piercing') : false; drawSwordModel(e, handX, handY, weaponAngle, sc, swordTier || 1); } 
        else if (actWpn.includes('bow') || actWpn === 'crossbow' || actWpn === 'shotgun') { drawBowModel(handX, handY, weaponAngle, sc); } 
        else if (actWpn.includes('knife') || actWpn === 'cleaver') { drawKnifeModel(handX, handY, weaponAngle, sc); } 
        else if (actWpn.includes('shuriken') || actWpn === 'chakram' || actWpn === 'explosive_kunai') { drawShurikenModel(handX, handY, weaponAngle, sc); }
        
        if (e === player && gameState === 'PLAYING') { ctx.strokeStyle = 'rgba(231, 76, 60, 0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + lastMoveDir.x * 45, y + lastMoveDir.y * 45); ctx.lineTo(x + lastMoveDir.x * 75, y + lastMoveDir.y * 75); ctx.stroke(); }
    }

    // 9. BRONIE NA PLECACH
    if (inv.bow > 0 || inv.golden_bow || inv.diamond_bow || inv.crossbow || inv.shotgun) { ctx.save(); ctx.translate(x - 5 * sc, y + 2 * sc); ctx.rotate(-Math.PI / 6); ctx.fillStyle = '#4a235a'; ctx.fillRect(-5 * sc, -12 * sc, 10 * sc, 24 * sc); ctx.fillStyle = '#bdc3c7'; ctx.fillRect(-3 * sc, -18 * sc, 2 * sc, 6 * sc); ctx.fillRect(1 * sc, -16 * sc, 2 * sc, 4 * sc); ctx.fillStyle = '#e74c3c'; ctx.fillRect(-4 * sc, -20 * sc, 4 * sc, 2 * sc); ctx.fillRect(0 * sc, -18 * sc, 4 * sc, 2 * sc); if (!actWpn.includes('bow') && actWpn !== 'crossbow' && actWpn !== 'shotgun') { ctx.strokeStyle = '#8e44ad'; ctx.lineWidth = 3 * sc; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, 16 * sc, -Math.PI/2, Math.PI/2); ctx.stroke(); ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1 * sc; ctx.beginPath(); ctx.moveTo(0, -16 * sc); ctx.lineTo(0, 16 * sc); ctx.stroke(); } ctx.restore(); }
    if ((inv.knife || inv.golden_knife || inv.diamond_knife || inv.hunting_knife || inv.cleaver) && !actWpn.includes('knife') && actWpn !== 'cleaver') { ctx.save(); ctx.translate(x + 12 * sc, y + 14 * sc); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#bdc3c7'; ctx.beginPath(); ctx.moveTo(0, -2*sc); ctx.lineTo(14*sc, 0); ctx.lineTo(0, 2*sc); ctx.fill(); ctx.fillStyle = '#2c3e50'; ctx.fillRect(-4*sc, -2*sc, 4*sc, 4*sc); ctx.restore(); }
    if ((inv.shuriken || inv.golden_shuriken || inv.diamond_shuriken || inv.chakram || inv.explosive_kunai) && !actWpn.includes('shuriken') && actWpn !== 'chakram' && actWpn !== 'explosive_kunai') { ctx.save(); ctx.translate(x - 10 * sc, y + 18 * sc); ctx.fillStyle = '#34495e'; for(let i=0; i<4; i++) { ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(3.5*sc, -1.5*sc); ctx.lineTo(7*sc, 0); ctx.lineTo(3.5*sc, 1.5*sc); ctx.fill(); ctx.rotate(Math.PI/2); } ctx.fillStyle = '#bdc3c7'; ctx.beginPath(); ctx.arc(0,0, 1.5*sc, 0, Math.PI*2); ctx.fill(); ctx.restore(); }
    
    // 10. KORONA I NICK
    if (kingId === eId && score >= 1) { ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.moveTo(x - 12 * sc, y - 35 * sc); ctx.lineTo(x - 12 * sc, y - 55 * sc); ctx.lineTo(x - 6 * sc, y - 45 * sc); ctx.lineTo(x, y - 55 * sc); ctx.lineTo(x + 6 * sc, y - 45 * sc); ctx.lineTo(x + 12 * sc, y - 55 * sc); ctx.lineTo(x + 12 * sc, y - 35 * sc); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(x, y - 45 * sc, 2 * sc, 0, Math.PI * 2); ctx.fill(); }

    ctx.fillStyle = '#fff'; ctx.font = `bold ${13 * sc}px Arial`; ctx.textAlign = 'center';
    if (e.name !== 'Wojownik') { ctx.fillText(`${e.name || "Bot"} [${score}]`, x, y - 65 * sc); } else { ctx.fillText(`[${score}]`, x, y - 65 * sc); } 
    
    ctx.restore();
}

// --- LOGIKA UPDATE I PĘTLA ---
function update() {
    if (gameState !== 'PLAYING') return;

    if (player.aura && player.aura.time > 0) {
        player.aura.time--;
    }

    let dx = 0, dy = 0;
    if (controlType === 'WASD') {
        if (keys['KeyW']) dy--; if (keys['KeyS']) dy++; if (keys['KeyA']) dx--; if (keys['KeyD']) dx++;
    } else {
        if (keys['ArrowUp']) dy--; if (keys['ArrowDown']) dy++; if (keys['ArrowLeft']) dx--; if (keys['ArrowRight']) dx++;
    }
    
    if (dx !== 0 || dy !== 0) {
        let moveAngle = Math.atan2(dy, dx); 
        let speed = 5 + (playerSkills.speed * 0.5);
        player.x += Math.cos(moveAngle) * speed; 
        player.y += Math.sin(moveAngle) * speed;
    }
    
    // NOWOŚĆ: Śmierć po wyjściu poza krawędź mapy! (zastępuje dawne Math.max/Math.min)
    if (player.x <= 0 || player.x >= WORLD_SIZE || player.y <= 0 || player.y >= WORLD_SIZE) {
        socket.emit('playerMovement', { x: -100, y: -100, score: player.score, isSafe: false, isShielding: false });
    } else {
        player.isSafe = safeZones.some(z => Math.hypot(player.x - z.x, player.y - z.y) < z.radius);
        camera.x = player.x - canvas.width / 2; camera.y = player.y - canvas.height / 2;
        socket.emit('playerMovement', { x: player.x, y: player.y, score: player.score, isSafe: player.isSafe, isShielding: player.isShielding });
    }
}

function gameLoop() {
    drawForestMap(ctx, camera, canvas.width, canvas.height); 
    
    let allEntities = Object.values(otherPlayers).concat(bots);
    if (player && gameState !== 'GAMEOVER') allEntities.push(player);
    allEntities.sort((a,b) => b.score - a.score);
    let topEntities = allEntities.slice(0, 5);
    let currentKingId = topEntities.length > 0 ? (topEntities[0].id || topEntities[0].name) : null;
    
    if (gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'GAMEOVER') {
        if (gameState === 'PLAYING') {
            update();
            checkEquipmentUpgrades(); 
        }
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 10;
        ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);
        
        safeZones.forEach(z => drawCastle(ctx, z));
        
        foods.forEach(f => {
            ctx.fillStyle = '#e67e22'; ctx.beginPath(); ctx.arc(f.x, f.y, 8, 0, Math.PI * 2); ctx.fill();
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

        // --- CZYSTE RYSOWANIE "PODPOWIADACZKI" (Tylko w trakcie aktywnego przeciągania na kliencie) ---
        if (draggedBotId && player) {
            ctx.save();
            
            // 1. Smycz (Linia od gracza do myszki)
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(player.x, player.y);
            ctx.lineTo(dragMouseWorld.x, dragMouseWorld.y);
            ctx.stroke();

            // 2. Cel (Duch gdzie bot stanie)
            ctx.beginPath();
            ctx.arc(dragMouseWorld.x, dragMouseWorld.y, 25, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(241, 196, 15, 0.2)';
            ctx.fill();
            ctx.stroke();

            // 3. Wyraźne podświetlenie bota, którego właśnie złapałeś!
            let b = bots.find(bot => bot.id === draggedBotId);
            if (b) {
                ctx.setLineDash([]); // Pełna linia dla obwódki
                ctx.strokeStyle = '#f1c40f';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(b.x, b.y, 40, 0, Math.PI * 2);
                ctx.stroke();
            }
            
            ctx.restore();
        }

        bots.forEach(b => {
            if (b.isSafe && (!player || !player.isSafe)) return;
            drawStickman(b, b.x, b.y, getScale(b.score), false, currentKingId);
        });

        Object.values(otherPlayers).forEach(p => {
            if (p.isSafe && (!player || !player.isSafe)) return;
            drawStickman(p, p.x, p.y, getScale(p.score), p.isSafe, currentKingId);
        });
        
        if (player && gameState !== 'GAMEOVER') {
            drawStickman(player, player.x, player.y, getScale(player.score), player.isSafe, currentKingId);
        }
        ctx.restore();
        
        if (gameState !== 'GAMEOVER') {
            ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(canvas.width - 280, 10, 270, 140);
            ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 16px Arial';
            ctx.fillText("🏆 RANKING SERWERA", canvas.width - 265, 30);
            
            topEntities.forEach((p, i) => {
                let yPos = 55 + i * 20;
                if (i === 0) {
                    ctx.fillStyle = '#f1c40f';
                    ctx.fillText(`👑 [KRÓL] ${p.name} - ${p.score} pkt`, canvas.width - 265, yPos);
                } else {
                    ctx.fillStyle = (p.id === myId || p === player) ? '#2ecc71' : '#fff'; 
                    ctx.fillText(`${i+1}. ${p.name} - ${p.score} pkt`, canvas.width - 265, yPos);
                }
            });

            ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Arial';
            ctx.fillText(`PUNKTY: ${player.score}`, 20, 40);

            if (killLogs.length > 0) {
                ctx.save();
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'right';
                for (let i = 0; i < killLogs.length; i++) {
                    let log = killLogs[i];
                    ctx.fillStyle = `rgba(231, 76, 60, ${log.time / 50})`; 
                    ctx.fillText("☠️ " + log.text, canvas.width - 20, 170 + (i * 22));
                    log.time--;
                }
                ctx.restore();
                killLogs = killLogs.filter(l => l.time > 0);
            }

            ctx.save();
            let startX = canvas.width / 2 - 60, startY = canvas.height - 80;
            
            ctx.fillStyle = player.activeWeapon === 'sword' ? 'rgba(46, 204, 113, 0.9)' : 'rgba(44, 62, 80, 0.8)';
            ctx.fillRect(startX, startY, 50, 50); 
            ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2; ctx.strokeRect(startX, startY, 50, 50);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.fillText('1', startX + 15, startY + 18);
            ctx.font = '10px Arial'; ctx.fillText('Miecz', startX + 25, startY + 40);

            ctx.fillStyle = player.activeWeapon !== 'sword' ? 'rgba(46, 204, 113, 0.9)' : 'rgba(44, 62, 80, 0.8)';
            ctx.fillRect(startX + 60, startY, 50, 50); ctx.strokeRect(startX + 60, startY, 50, 50);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.fillText('2', startX + 75, startY + 18);
            
            let secText = 'Brak';
            const types = ['shotgun', 'crossbow', 'diamond_bow', 'golden_bow', 'bow', 'cleaver', 'hunting_knife', 'diamond_knife', 'golden_knife', 'knife', 'explosive_kunai', 'chakram', 'diamond_shuriken', 'golden_shuriken', 'shuriken'];
            for(let t of types) {
                if(player.inventory && player.inventory[t]) {
                    secText = t.replace('_', ' ').toUpperCase();
                    break;
                }
            }
            ctx.font = '9px Arial'; ctx.fillText(secText, startX + 65, startY + 40);

            // --- NOWOŚĆ: UI COOLDOWNU DLA ZIMOWEGO MIECZA (Pasek R) ---
            if (weaponPath === 'winter') {
                let winterProgress = Math.min(1, (Date.now() - lastWinterUseClient) / 15000);
                let btnX = startX + 120;
                
                // Ciemne tło
                ctx.fillStyle = 'rgba(44, 62, 80, 0.8)';
                ctx.fillRect(btnX, startY, 50, 50);
                
                // Ładujący się niebieski pasek
                ctx.fillStyle = 'rgba(52, 152, 219, 0.8)';
                ctx.fillRect(btnX, startY + 50 * (1 - winterProgress), 50, 50 * winterProgress);
                
                // Obramowanie
                ctx.strokeStyle = winterProgress >= 1 ? '#3498db' : '#7f8c8d'; 
                ctx.lineWidth = 2; ctx.strokeRect(btnX, startY, 50, 50);
                
                ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.fillText('R', btnX + 25, startY + 18);
                ctx.font = '10px Arial'; ctx.fillText(winterProgress >= 1 ? 'GOTOWE' : 'ŁADUJE', btnX + 25, startY + 40);
            }

            ctx.restore();
            
            const skillMenu = document.getElementById('skill-menu');
            if (skillPoints > 0) {
                skillMenu.style.display = 'flex';
                document.getElementById('sp-count').innerText = skillPoints;

                const btnStrength = document.getElementById('btn-strength');
                const btnWeapon = document.getElementById('btn-weapon');
                if (btnStrength) btnStrength.disabled = player.score < 100;
                if (btnWeapon) btnWeapon.disabled = player.score < 15;

                const weaponPathsDiv = document.getElementById('weapon-paths');
                if (weaponPathsDiv) {
                    if (playerSkills.weapon >= 5 && weaponPath === 'none') {
                        weaponPathsDiv.style.display = 'flex';
                    } else {
                        weaponPathsDiv.style.display = 'none';
                    }
                }
            } else {
                skillMenu.style.display = 'none';
            }

            if (player.isSafe && !wasSafe) {
                const shop = document.getElementById('castle-shop');
                if (shop) shop.style.display = 'flex';
            } else if (!player.isSafe && wasSafe) {
                const shop = document.getElementById('castle-shop');
                if (shop) shop.style.display = 'none';
            }
            wasSafe = player.isSafe; 
        }

        if (gameState === 'PAUSED') {
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 40px Arial'; ctx.textAlign = 'center';
            ctx.fillText("PAUZA", canvas.width / 2, canvas.height / 2 - 30);
            
            const btnX = canvas.width / 2 - 100;
            const btnY = canvas.height / 2 + 10;
            ctx.fillStyle = '#e74c3c'; 
            ctx.fillRect(btnX, btnY, 200, 50);
            
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 24px Arial';
            ctx.fillText("WYJŚCIE", canvas.width / 2, btnY + 33);
            
            ctx.textAlign = 'left';
        }
    }
    requestAnimationFrame(gameLoop);
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.onresize = resize;
resize();
