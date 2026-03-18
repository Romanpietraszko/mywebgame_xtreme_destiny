// ==========================================
// TEAMS.JS - Tryb Drużynowy (PvP & Trening)
// ==========================================

const socket = io('https://mywebgame-xtreme-destiny.onrender.com');

// --- ZMIENNE STANU I KONFIGURACJI ---
let player, otherPlayers = {}, foods = [], bots = [], projectiles = [], loots = [];
let castles = []; // Bazy drużynowe odbierane z serwera
let currentEvent = null, eventTimeLeft = 0;
let controlType = 'WASD', gameState = 'MENU', myId = null;

// Konfiguracja Drużyn
let myTeam = null; 
let gameMode = 'PvP'; 

// Statystyki
let skillPoints = 0, playerSkills = { speed: 0, strength: 0, weapon: 0 }, weaponPath = 'none'; 
let lastMoveDir = { x: 1, y: 0 }, lastCalculatedTier = 0, wasSafe = false, killLogs = [], lastWinterUseClient = 0; 
let draggedBotId = null, dragMouseWorld = { x: 0, y: 0 };

initMap(WORLD_SIZE); 

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
    gameMode = mode; 
    document.getElementById('ui-layer').style.display = 'none';
    
    const name = document.getElementById('playerName').value || "Żołnierz";
    
    player = {
        x: 2000, y: 2000, score: 5, level: 1, name: name, color: '#fff', 
        isSafe: false, isShielding: false, aura: null, inventory: { bow: 0, knife: 0, shuriken: 0 }, activeWeapon: 'sword',
        team: null, isRecruiting: false, formation: 0
    };
    
    socket.emit('joinTeamGame', { name: name, mode: gameMode });
    gameState = 'PLAYING';
    gameLoop();
};

// --- KOMUNIKACJA Z SERWEREM ---
socket.on('initTeam', (data) => { 
    myId = data.id; 
    myTeam = data.team; 
    if (player) {
        player.id = myId;
        player.team = myTeam;
        player.color = data.color; 
    }
});
socket.on('levelUp', (data) => { skillPoints = data.points; });
socket.on('skillUpdated', (data) => { playerSkills = data.skills; skillPoints = data.points; weaponPath = data.weaponPath || 'none'; });
socket.on('botEaten', (data) => { if (player) player.score = data.newScore; });
socket.on('killEvent', (data) => { killLogs.push({ text: data.text, time: 200 }); });
socket.on('recruitToggled', (state) => { if (player) player.isRecruiting = state; killLogs.push({ text: state ? "TRYB: ZWERBUJ (P)" : "TRYB: ZJADAJ (P)", time: 150 }); });
socket.on('formationSwitched', (formName) => { killLogs.push({ text: "FORMACJA: " + formName, time: 150 }); });

// --- OBSŁUGA SKLEPU (Dodano komunikaty z serwera) ---
socket.on('shopSuccess', (data) => { killLogs.push({ text: `🛒 Zakupiono: ${data.item}!`, time: 200 }); });
socket.on('shopError', (data) => { killLogs.push({ text: `❌ ${data.message}`, time: 200 }); });

socket.on('gameOver', (data) => {
    gameState = 'GAMEOVER';
});

socket.on('serverTick', (data) => {
    foods = data.foods; bots = data.bots; projectiles = data.projectiles || []; loots = data.loots || [];
    currentEvent = data.activeEvent; eventTimeLeft = data.eventTimeLeft || 0;
    castles = data.castles || []; 
    
    otherPlayers = data.players;
    if (myId && otherPlayers[myId]) {
        player.score = otherPlayers[myId].score; player.inventory = otherPlayers[myId].inventory || { bow: 0, knife: 0, shuriken: 0 }; 
        player.activeWeapon = otherPlayers[myId].activeWeapon || 'sword'; player.isSafe = otherPlayers[myId].isSafe;
        if (otherPlayers[myId].formation !== undefined) player.formation = otherPlayers[myId].formation;
        if (otherPlayers[myId].isRecruiting !== undefined) player.isRecruiting = otherPlayers[myId].isRecruiting;
        
        // --- LOGIKA WYŚWIETLANIA SKLEPU ---
        // PAMIĘTAJ: Zmień 'shop' na takie ID, jakie masz wpisane w pliku HTML! (np. 'sklep', 'shopUI')
        const shopUI = document.getElementById('castle-shop'); 
        if (shopUI) {
            shopUI.style.display = player.isSafe ? 'block' : 'none';
        }
    }
    delete otherPlayers[myId];
});

// --- FUNKCJE DLA PRZYCISKÓW W HTML ---
window.upgrade = (name) => { socket.emit('upgradeSkill', name); };
window.buyItem = (itemName) => { socket.emit('buyShopItem', itemName); }; // Umożliwia kupowanie

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
        player.x += Math.cos(moveAngle) * speed; 
        player.y += Math.sin(moveAngle) * speed;

        // --- TWARDE GRANICE MAPY ---
        player.x = Math.max(0, Math.min(WORLD_SIZE, player.x));
        player.y = Math.max(0, Math.min(WORLD_SIZE, player.y));
    }
    
    camera.x = player.x - canvas.width / 2; camera.y = player.y - canvas.height / 2;
    socket.emit('playerMovementTeam', { x: player.x, y: player.y, score: player.score, isShielding: player.isShielding });
}

function gameLoop() {
    // 1. Ciemna Taktyczna Arena
    ctx.fillStyle = '#1e272e'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(-camera.x % 100, -camera.y % 100);
    ctx.strokeStyle = 'rgba(46, 204, 113, 0.15)';
    ctx.lineWidth = 2;
    for (let i = -100; i <= canvas.width + 100; i += 100) {
        ctx.beginPath(); ctx.moveTo(i, -100); ctx.lineTo(i, canvas.height + 100); ctx.stroke();
    }
    for (let i = -100; i <= canvas.height + 100; i += 100) {
        ctx.beginPath(); ctx.moveTo(-100, i); ctx.lineTo(canvas.width + 100, i); ctx.stroke();
    }
    ctx.restore();
    
    let allEntities = Object.values(otherPlayers).concat(bots);
    if (player && gameState !== 'GAMEOVER') allEntities.push(player);
    allEntities.sort((a,b) => b.score - a.score);
    let topEntities = allEntities.slice(0, 5);
    let currentKingId = topEntities.length > 0 ? (topEntities[0].id || topEntities[0].name) : null;
    
    if (gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'GAMEOVER') {
        if (gameState === 'PLAYING') { update(); }
        
        ctx.save(); ctx.translate(-camera.x, -camera.y);
        ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);
        
        // --- RYSOWANIE ZAMKÓW I OBLĘŻENIA ---
        castles.forEach(c => {
            ctx.fillStyle = c.color;
            ctx.globalAlpha = 0.3;
            ctx.beginPath(); ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = c.color; ctx.lineWidth = 5; ctx.stroke();

            if (c.captureProgress > 0) {
                ctx.fillStyle = 'black'; ctx.fillRect(c.x - 50, c.y - c.radius - 30, 100, 15);
                ctx.fillStyle = c.captureProgress >= 100 ? '#e74c3c' : '#f1c40f'; 
                ctx.fillRect(c.x - 48, c.y - c.radius - 28, (c.captureProgress / 100) * 96, 11);
                ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center';
                ctx.fillText(c.captureProgress >= 100 ? "PRZEJĘTO!" : "OBLĘŻENIE...", c.x, c.y - c.radius - 20);
            }
        });
        
        // --- RYSOWANIE LOOTU (JEDZENIE I SKRZYNKI) ---
        foods.forEach(f => { ctx.fillStyle = '#e67e22'; ctx.beginPath(); ctx.arc(f.x, f.y, 8, 0, Math.PI * 2); ctx.fill(); });
        
        loots.forEach(l => { 
            ctx.font = "30px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            if (l.type === 'mass') ctx.fillText("🎁", l.x, l.y);
            else if (l.type === 'skill') ctx.fillText("📘", l.x, l.y);
            else if (l.type === 'weapon') ctx.fillText("🗡️", l.x, l.y);
        });
        
        // --- GRAWERUNKI NA MIECZACH ---
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
            
            if (p.teamInitial) {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(rot);
                ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(p.teamInitial, 15, 0); 
                ctx.restore();
            }
        });

        // Linii przeciągania RTS
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

        // --- RYSOWANIE GRACZY I BOTÓW ---
        allEntities.forEach(e => {
            if (e.isSafe && (!player || !player.isSafe)) return;
            
            let radius = 25 * (1 + Math.pow(Math.max(0, e.score - 1), 0.45) * 0.15);
            let scale = radius / 25; 
            
            drawStickman(e, e.x, e.y, scale, e.isSafe, currentKingId);

            // Dodatki drużynowe
            if (e.team) {
                ctx.save();
                ctx.translate(e.x, e.y); 

                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.font = `bold ${Math.floor(radius * 1.2)}px Arial`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(e.team, 0, 0);

                const teamEmojis = { 'N': '🥶', 'S': '😈', 'E': '👺', 'W': '👹' };
                ctx.font = `${Math.floor(radius)}px Arial`;
                ctx.fillText(teamEmojis[e.team] || '👿', 0, -radius - 20);
                
                ctx.restore();
            }
        });
        
        ctx.restore(); 
        
        // --- EFEKTY POGODY I UI ---
        if (currentEvent === 'TOXIC_RAIN') {
            ctx.fillStyle = 'rgba(46, 204, 113, 0.2)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center';
            ctx.fillText(`KWAŚNY DESZCZ: ${eventTimeLeft}s`, canvas.width / 2, 80);
        } else if (currentEvent === 'BLIZZARD') {
            ctx.fillStyle = 'rgba(236, 240, 241, 0.3)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ecf0f1'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center';
            ctx.fillText(`ZAMIĘĆ ŚNIEŻNA: ${eventTimeLeft}s`, canvas.width / 2, 80);
        } else if (currentEvent === 'KING_HUNT') {
            ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center';
            ctx.fillText(`POLOWANIE NA KRÓLA: ${eventTimeLeft}s`, canvas.width / 2, 80);
        }

        // --- RYSOWANIE LOGÓW ZABÓJSTW I SKLEPU ---
        let logY = canvas.height - 30;
        killLogs.forEach((log, index) => {
            if (log.time > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${log.time / 200})`;
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'left';
                ctx.fillText(log.text, 20, logY - (index * 25));
                log.time--;
            }
        });
        killLogs = killLogs.filter(log => log.time > 0);

        // --- RYSOWANIE UI GRACZA ---
        if (gameState !== 'GAMEOVER' && player) {
            ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(canvas.width - 280, 10, 270, 140);
            ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 16px Arial';
            ctx.fillText("🏆 RANKING SERWERA", canvas.width - 265, 30);
            
            topEntities.forEach((p, i) => {
                let yPos = 55 + i * 20;
                if (i === 0) { ctx.fillStyle = '#f1c40f'; ctx.fillText(`👑 [KRÓL] ${p.name} - ${p.score} pkt`, canvas.width - 265, yPos); } 
                else { ctx.fillStyle = (p.id === myId || p === player) ? '#2ecc71' : '#fff'; ctx.fillText(`${i+1}. ${p.name} - ${p.score} pkt`, canvas.width - 265, yPos); }
            });

            ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Arial';
            ctx.fillText(`PUNKTY: ${player.score}`, 20, 40);
            
            if (player.isRecruiting !== undefined) {
                ctx.font = 'bold 14px Arial';
                ctx.fillStyle = player.isRecruiting ? '#3498db' : '#e74c3c';
                ctx.fillText(`TRYB (P): ${player.isRecruiting ? 'WERBUNEK' : 'ZJADANIE'}`, 20, 60);
            }
        }

        // EKRAN ŚMIERCI
        if (gameState === 'GAMEOVER') {
            ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 48px Arial'; ctx.textAlign = 'center';
            ctx.fillText("ZGŁADZONO CIĘ", canvas.width/2, canvas.height/2);
            ctx.fillStyle = '#fff'; ctx.font = '24px Arial';
            ctx.fillText(`Końcowa masa: ${Math.floor(player.score)}`, canvas.width/2, canvas.height/2 + 40);
            ctx.fillText("Odśwież stronę, aby zagrać ponownie.", canvas.width/2, canvas.height/2 + 80);
        }
    }
    requestAnimationFrame(gameLoop);
}
