// ==========================================
// TEAMS.JS - Tryb Drużynowy (PvP & Trening)
// ==========================================

const socket = io();

// --- ZMIENNE STANU I KONFIGURACJI ---
let player, otherPlayers = {}, foods = [], bots = [], projectiles = [], loots = [];
let castles = []; // <--- NOWOŚĆ: Bazy drużynowe odbierane z serwera
let currentEvent = null, eventTimeLeft = 0;
let controlType = 'WASD', gameState = 'MENU', myId = null;

// Konfiguracja Drużyn
let myTeam = null; 
let gameMode = 'PvP'; // Domyślnie PvP, zmieniane w menu (PvP lub TRAINING)

// Statystyki
let skillPoints = 0, playerSkills = { speed: 0, strength: 0, weapon: 0 }, weaponPath = 'none'; 
let lastMoveDir = { x: 1, y: 0 }, lastCalculatedTier = 0, wasSafe = false, killLogs = [], lastWinterUseClient = 0; 
let draggedBotId = null, dragMouseWorld = { x: 0, y: 0 };

initMap(WORLD_SIZE); // Z map.js

window.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('mousemove', (e) => {
    if (gameState === 'PLAYING' && player) {
        const rect = canvas.getBoundingClientRect();
        const mouseWorldX = (e.clientX - rect.left) + camera.x;
        const mouseWorldY = (e.clientY - rect.top) + camera.y;
        lastMoveDir = { x: Math.cos(Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x)), y: Math.sin(Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x)) };
        if (draggedBotId) dragMouseWorld = { x: mouseWorldX, y: mouseWorldY };
    }
});

window.addEventListener('mousedown', (e) => {
    if (gameState === 'PLAYING' && player) { 
        if (e.button === 2) { 
            const mouseWorldX = e.clientX - canvas.getBoundingClientRect().left + camera.x;
            const mouseWorldY = e.clientY - canvas.getBoundingClientRect().top + camera.y;
            let closestBot = null, minDist = 80; 
            bots.forEach(b => {
                if (b.ownerId === myId) {
                    let d = Math.hypot(b.x - mouseWorldX, b.y - mouseWorldY);
                    if (d < minDist) { minDist = d; closestBot = b; }
                }
            });
            if (closestBot) { draggedBotId = closestBot.id; dragMouseWorld = { x: mouseWorldX, y: mouseWorldY }; }
        }
        else if (e.button === 0) socket.emit('throwSword', { x: player.x, y: player.y, dx: lastMoveDir.x, dy: lastMoveDir.y });
    }
    if (gameState === 'PAUSED' && e.button === 0) {
        // ... (logika przycisków pauzy - bez zmian)
        socket.disconnect(); location.reload();   
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 2 && draggedBotId && player) {
        let dx = dragMouseWorld.x - player.x, dy = dragMouseWorld.y - player.y;
        socket.emit('setBotOffset', { botId: draggedBotId, angleOffset: Math.atan2(dy, dx) - Math.atan2(lastMoveDir.y, lastMoveDir.x), distOffset: Math.hypot(dx, dy) });
        draggedBotId = null; 
    }
});

window.onkeydown = (e) => {
    keys[e.code] = true; 
    if (e.code === 'Space' && (gameState === 'PLAYING' || gameState === 'PAUSED')) gameState = (gameState === 'PLAYING') ? 'PAUSED' : 'PLAYING';
    if (gameState === 'PLAYING') {
        if (e.code === 'Digit1') socket.emit('switchWeapon', 1);
        if (e.code === 'Digit2') socket.emit('switchWeapon', 2);
        if (e.code === 'KeyE') socket.emit('throwSword', { x: player.x, y: player.y, dx: lastMoveDir.x, dy: lastMoveDir.y });
        if (e.code === 'KeyR' && weaponPath === 'winter') { const now = Date.now(); if (now - lastWinterUseClient >= 15000) { lastWinterUseClient = now; socket.emit('throwWinterSword'); } }
        if (e.code === 'KeyQ' && player.score >= 50) player.isShielding = true;
        if (e.code === 'KeyP') socket.emit('toggleRecruit');
        if (e.code === 'KeyC') socket.emit('switchFormation');
    }
};

window.onkeyup = (e) => { keys[e.code] = false; if (e.code === 'KeyQ' && player) player.isShielding = false; };

// --- NOWE MENU STARTOWE ---
window.startGame = (control, mode) => {
    controlType = control;
    gameMode = mode; // 'TRAINING' lub 'PvP'
    document.getElementById('ui-layer').style.display = 'none';
    
    const name = document.getElementById('playerName').value || "Żołnierz";
    // Kolor w trybie drużynowym jest nadawany przez SERWER, więc tu tylko rezerwujemy miejsce
    
    player = {
        x: 2000, y: 2000, score: 5, level: 1, name: name, color: '#fff', 
        isSafe: false, isShielding: false, aura: null, inventory: { bow: 0, knife: 0, shuriken: 0 }, activeWeapon: 'sword',
        team: null 
    };
    
    // Klient wysyła żądanie dołączenia do konkretnego trybu
    socket.emit('joinTeamGame', { name: name, mode: gameMode });
    gameState = 'PLAYING';
    gameLoop();
};

// --- KOMUNIKACJA Z SERWEREM ---
socket.on('initTeam', (data) => { 
    myId = data.id; 
    myTeam = data.team; // N, S, E, W
    if (player) {
        player.id = myId;
        player.team = myTeam;
        player.color = data.color; // Serwer narzuca kolor!
    }
});
socket.on('levelUp', (data) => { skillPoints = data.points; });
socket.on('skillUpdated', (data) => { playerSkills = data.skills; skillPoints = data.points; weaponPath = data.weaponPath || 'none'; });
socket.on('botEaten', (data) => { if (player) player.score = data.newScore; });
socket.on('killEvent', (data) => { killLogs.push({ text: data.text, time: 200 }); });
socket.on('recruitToggled', (state) => { killLogs.push({ text: state ? "TRYB: ZWERBUJ (P)" : "TRYB: ZJADAJ (P)", time: 150 }); });
socket.on('formationSwitched', (formName) => { killLogs.push({ text: "FORMACJA: " + formName, time: 150 }); });

socket.on('gameOver', (data) => {
    gameState = 'GAMEOVER';
    // ... (wyświetlanie ekranu śmierci - bez zmian)
});

socket.on('serverTick', (data) => {
    foods = data.foods; bots = data.bots; projectiles = data.projectiles || []; loots = data.loots || [];
    currentEvent = data.activeEvent; eventTimeLeft = data.eventTimeLeft || 0;
    castles = data.castles || []; // <--- Aktualizacja stanu zamków!
    
    otherPlayers = data.players;
    if (myId && otherPlayers[myId]) {
        player.score = otherPlayers[myId].score; player.inventory = otherPlayers[myId].inventory || { bow: 0, knife: 0, shuriken: 0 }; 
        player.activeWeapon = otherPlayers[myId].activeWeapon || 'sword'; player.isSafe = otherPlayers[myId].isSafe;
    }
    delete otherPlayers[myId];
});

window.upgrade = (name) => { socket.emit('upgradeSkill', name); };

// ... (funkcja checkEquipmentUpgrades - bez zmian)

function update() {
    if (gameState !== 'PLAYING') return;
    if (player.aura && player.aura.time > 0) player.aura.time--;

    let dx = 0, dy = 0;
    if (controlType === 'WASD') { if (keys['KeyW']) dy--; if (keys['KeyS']) dy++; if (keys['KeyA']) dx--; if (keys['KeyD']) dx++; } 
    else { if (keys['ArrowUp']) dy--; if (keys['ArrowDown']) dy++; if (keys['ArrowLeft']) dx--; if (keys['ArrowRight']) dx++; }
    
    if (dx !== 0 || dy !== 0) {
        let moveAngle = Math.atan2(dy, dx); 
        let speed = 5 + (playerSkills.speed * 0.5);
        if (currentEvent === 'BLIZZARD') speed *= 0.4; 
        player.x += Math.cos(moveAngle) * speed; player.y += Math.sin(moveAngle) * speed;
    }
    
    // Bezpieczeństwo i obrażenia w zamkach oblicza SERWER, my tylko wysyłamy pozycję
    camera.x = player.x - canvas.width / 2; camera.y = player.y - canvas.height / 2;
    socket.emit('playerMovementTeam', { x: player.x, y: player.y, score: player.score, isShielding: player.isShielding });
}

function gameLoop() {
    drawForestMap(ctx, camera, canvas.width, canvas.height); 
    
    let allEntities = Object.values(otherPlayers).concat(bots);
    if (player && gameState !== 'GAMEOVER') allEntities.push(player);
    allEntities.sort((a,b) => b.score - a.score);
    
    if (gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'GAMEOVER') {
        if (gameState === 'PLAYING') { update(); /* checkEquipmentUpgrades(); */ }
        
        ctx.save(); ctx.translate(-camera.x, -camera.y);
        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);
        
        // --- RYSOWANIE ZAMKÓW I OBLĘŻENIA ---
        castles.forEach(c => {
            // Rysuj bazę
            ctx.fillStyle = c.color;
            ctx.globalAlpha = 0.3;
            ctx.beginPath(); ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = c.color; ctx.lineWidth = 5; ctx.stroke();

            // Pasek Przejmowania (Oblężenie)
            if (c.captureProgress > 0) {
                ctx.fillStyle = 'black'; ctx.fillRect(c.x - 50, c.y - c.radius - 30, 100, 15);
                ctx.fillStyle = c.captureProgress >= 100 ? '#e74c3c' : '#f1c40f'; // Zmienia kolor przy przejęciu
                ctx.fillRect(c.x - 48, c.y - c.radius - 28, (c.captureProgress / 100) * 96, 11);
                ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center';
                ctx.fillText(c.captureProgress >= 100 ? "PRZEJĘTO!" : "OBLĘŻENIE...", c.x, c.y - c.radius - 20);
            }
        });
        
        foods.forEach(f => { ctx.fillStyle = '#e67e22'; ctx.beginPath(); ctx.arc(f.x, f.y, 8, 0, Math.PI * 2); ctx.fill(); });
        // ... (rysowanie lootu z poprzedniego kodu)
        
        // --- GRAWERUNKI NA MIECZACH ---
        projectiles.forEach(p => {
            let rot = p.isWinter ? Math.PI / 2 : Math.atan2(p.dy, p.dx);
            rot += (Date.now() / 100); 
            
            // Rysowanie miecza
            drawSwordModel(p, p.x, p.y, rot, 0.8, getTier(p.scoreAtThrow || 0, [15, 300, 700]));
            
            // Rysowanie inicjału drużyny na ostrzu!
            if (p.teamInitial) {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(rot);
                ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(p.teamInitial, 15, 0); // Odsunięte na środek ostrza
                ctx.restore();
            }
        });

        // ... (rysowanie botów i graczy bez zmian, dodaj im inicjały na tarczach jeśli p.team jest znany w przyszłości)

        ctx.restore(); 
        
        // ... (Efekty pogody i UI jak w trybie FREE)
    }
    requestAnimationFrame(gameLoop);
}
