// ==========================================
// CAMPAIGN.JS - Logika trybu "Od zera do króla serwera"
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

// Opowieść Midasa
const campaignDialogues = {
    1: "Witaj w ruinach starego świata, Złomku. Twój cel to Tron, ale na razie jesteś nikim. Idź na północ od zamku, w stronę Szepczącego Lasu. Zbierz 15 masy z zielonych kulek i wróć do mnie.",
    2: "No, no... Przeżyłeś. Teraz sprawdźmy, jak walczysz. Kliknij MYSZKĄ, by rzucić mieczem w te zielone, słabe Szlamy, które kręcą się w lesie. Zabij 3 z nich i przynieś mi ich masę (wbij 50 punktów).",
    3: "Dobrze sobie radzisz. Słuchaj, zaraz rozpęta się tu prawdziwe piekło. Zapiszemy ten stan, na dzisiaj wystarczy. (Kolejne questy w produkcji!)"
};

// Inicjalizacja lokalnej mapy (Z POPRAWKĄ NA MAPĘ FABULARNĄ)
initMap(WORLD_SIZE, 'campaign_1');

// Lokalny symulator serwera (Tworzy kropki i wrogów na komputerze gracza)
function spawnLocalFood() {
    return { id: Math.random(), x: Math.random() * WORLD_SIZE, y: Math.random() * WORLD_SIZE };
}

function spawnLocalBot(type) {
    let bx, by, bColor, bName, bScore;

    // Strefa: Szepczący Las (Słabe boty, północ mapy)
    if (type === 'slime') {
        bx = 1000 + Math.random() * 2000;
        by = 500 + Math.random() * 1500;
        bColor = '#2ecc71'; // Zielone szlamy
        bName = 'Dzikie Szlamy';
        bScore = 5 + Math.random() * 10;
    } 

    return {
        id: `bot_${Math.random()}`,
        x: bx, y: by,
        score: bScore, color: bColor, name: bName,
        angle: Math.random() * Math.PI * 2,
        speed: 1.5,
        ownerId: null, team: null,
        activeWeapon: 'sword',
        inventory: { bow: 0, knife: 0, shuriken: 0 },
        paths: { weapon: 'none' },
        skills: { speed: 0, weapon: 0, strength: 0 }
    };
}

// Inicjalizacja świata
for (let i = 0; i < 150; i++) foods.push(spawnLocalFood());
for (let i = 0; i < 15; i++) bots.push(spawnLocalBot('slime'));

// --- OBSŁUGA KLAWIATURY, MYSZKI I EKRANU DOTYKOWEGO ---
window.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('mousemove', (e) => {
    if (gameState === 'PLAYING' && player && controlType !== 'TOUCH') {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const playerScreenX = canvas.width / 2;
        const playerScreenY = canvas.height / 2;
        const angle = Math.atan2(mouseY - playerScreenY, mouseX - playerScreenX);
        lastMoveDir = { x: Math.cos(angle), y: Math.sin(angle) };
    }
});

window.addEventListener('mousedown', (e) => {
    if (e.target.closest('#skill-menu') || e.target.closest('#castle-shop') || e.target.closest('button')) return; 

    if (gameState === 'PLAYING' && player) { 
        if (player.isSafe) return; // W zamku nie strzelamy
        if (e.button === 0 && player.score >= 2) {
            // Lokalny rzut mieczem
            player.score -= 2;
            projectiles.push({
                id: Math.random(), ownerId: player.id,
                x: player.x, y: player.y, dx: lastMoveDir.x, dy: lastMoveDir.y,
                life: 60, speed: 18, damage: 5, isPiercing: false, projType: 'sword'
            });
        }
    }
});

// --- NOWOŚĆ: ODBIÓR STRZAŁU Z PRZYCISKU MOBILNEGO ---
window.addEventListener('mobile-attack', () => {
    if (gameState === 'PLAYING' && player && !player.isSafe && player.score >= 2) {
        player.score -= 2;
        projectiles.push({
            id: Math.random(), ownerId: player.id,
            x: player.x, y: player.y, dx: lastMoveDir.x, dy: lastMoveDir.y,
            life: 60, speed: 18, damage: 5, isPiercing: false, projType: 'sword'
        });
    }
});

window.onkeydown = (e) => {
    keys[e.code] = true; 
    if (e.code === 'KeyH' && player) player.isTutorialActive = !player.isTutorialActive;
};
window.onkeyup = (e) => { keys[e.code] = false; };

// --- START GRY KAMPANI ---
window.startGame = (type) => {
    controlType = type;
    document.getElementById('ui-layer').style.display = 'none';
    const name = document.getElementById('playerName').value || "Bohater";

    // Punkt odrodzenia Kampanii: Zrujnowany Zamek (Południe mapy)
    let spawnX = 2000;
    let spawnY = 3800; 

    player = {
        id: 'local_player',
        x: spawnX, y: spawnY, score: 0, level: 1, 
        name: name, color: '#f1c40f', isSafe: true,
        isShielding: false, aura: null, 
        inventory: { bow: 0, knife: 0, shuriken: 0 }, 
        activeWeapon: 'sword',
        isTutorialActive: true,
        tutorialText: campaignDialogues[currentQuest],
        skin: window.playerSkin || 'standard',
        baseSpeed: window.playerSkin === 'ninja' ? 5.5 : 5.0,
        massMultiplier: window.playerSkin === 'arystokrata' ? 1.15 : (window.playerSkin === 'standard' ? 1.02 : 1.0),
        paths: { speed: 'none', strength: 'none', weapon: 'none' }, // Zabezpieczenie ciała!
        skills: { speed: 0, strength: 0, weapon: 0 } // Zabezpieczenie silnika!
    };
    
    gameState = 'PLAYING';
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
};

// --- LOKALNA LOGIKA FIZYKI (Zastępuje serwer) ---
function updateLocalPhysics() {
    if (!player) return;

    // Ruch Gracza
    let dx = 0, dy = 0;
    
    // --- NOWOŚĆ: OBSŁUGA RUCHU Z JOYSTICKA MOBILNEGO ---
    if (controlType === 'TOUCH') {
        if (window.mobileJoy && window.mobileJoy.active) {
            dx = window.mobileJoy.dx;
            dy = window.mobileJoy.dy;
            
            // Na telefonie postać celuje dokładnie tam, gdzie aktualnie idzie
            lastMoveDir = { x: dx, y: dy }; 
            
            // Wyrównanie prędkości
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
        let speed = player.baseSpeed + (playerSkills.speed * 0.5);
        player.x += Math.cos(moveAngle) * speed; 
        player.y += Math.sin(moveAngle) * speed;
        
        // Granice mapy
        player.x = Math.max(0, Math.min(WORLD_SIZE, player.x));
        player.y = Math.max(0, Math.min(WORLD_SIZE, player.y));
    }

    // Bezpieczna strefa (Zamek)
    player.isSafe = safeZones.some(z => Math.hypot(player.x - z.x, player.y - z.y) < z.radius);
    let playerRadius = 25 * (1 + Math.pow(Math.max(0, player.score - 1), 0.45) * 0.15);

    // Jedzenie Kulek
    foods.forEach((f, fi) => {
        if (Math.hypot(player.x - f.x, player.y - f.y) < playerRadius) {
            player.score += 1 * player.massMultiplier;
            foods[fi] = spawnLocalFood();
            checkQuestProgress();
        }
    });

    // Ruch Botów i Kolizje z graczem
    bots.forEach((b, bi) => {
        // Głupi ruch w lesie
        if (Math.random() < 0.05) b.angle = Math.random() * Math.PI * 2;
        b.x += Math.cos(b.angle) * b.speed;
        b.y += Math.sin(b.angle) * b.speed;
        
        // Zawracanie na granicach strefy lasu (żeby nie uciekły do zamku)
        if (b.x < 500 || b.x > 3500 || b.y > 2500 || b.y < 500) b.angle += Math.PI;

        let dist = Math.hypot(player.x - b.x, player.y - b.y);
        let bRadius = 25 * (1 + Math.pow(Math.max(0, b.score - 1), 0.45) * 0.15);

        // Zjadanie botów lub śmierć gracza
        if (!player.isSafe) {
            if (dist < playerRadius && player.score > b.score * 1.15) {
                player.score += Math.floor(b.score * 0.5);
                killLogs.push({ text: `Zabiłeś ${b.name}!`, time: 150 });
                bots[bi] = spawnLocalBot('slime');
                checkQuestProgress();
            } else if (dist < bRadius && b.score > player.score * 1.15) {
                // KARA ZA ŚMIERĆ W KAMPANII
                player.score = Math.floor(player.score * 0.8); // Traci 20%
                player.x = 2000; player.y = 3800; // Powrót do bazy
                killLogs.push({ text: `Zginąłeś! Tracisz masę i wracasz do bazy.`, time: 200 });
                player.tutorialText = "Bolało? Mówiłem, żebyś uważał. Idź jeszcze raz, tylko tym razem unikaj tych wielkich.";
            }
        }
    });

    // Lot pocisków (Mieczy)
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.dx * p.speed;
        p.y += p.dy * p.speed;
        p.life--;

        // Trafienie w bota
        bots.forEach((b) => {
            if (p.ownerId !== b.id && Math.hypot(p.x - b.x, p.y - b.y) < 30) {
                b.score = Math.max(1, b.score - p.damage);
                damageTexts.push({ x: b.x, y: b.y, val: p.damage, color: '#fff', life: 1, vx: 0, vy: -2 });
                if (!p.isPiercing) p.life = 0; 
            }
        });

        if (p.life <= 0) projectiles.splice(i, 1);
    }
    
    // Kamera podąża za graczem
    camera.x = player.x - canvas.width / 2; camera.y = player.y - canvas.height / 2;
}

// --- LOGIKA QUESTÓW FABULARNYCH ---
function checkQuestProgress() {
    if (currentQuest === 1 && player.score >= 15) {
        currentQuest = 2;
        player.tutorialText = campaignDialogues[currentQuest];
        killLogs.push({ text: "⭐ ZADANIE WYKONANE! Odblokowano rzucanie Myszka (LPM).", time: 200 });
    }
    else if (currentQuest === 2 && player.score >= 50) {
        currentQuest = 3;
        player.tutorialText = campaignDialogues[currentQuest];
        killLogs.push({ text: "⭐ ZADANIE WYKONANE! Akt 1 ukończony pomyślnie.", time: 200 });
    }
}

// --- GŁÓWNA PĘTLA GRY ---
function gameLoop(currentTime) {
    const deltaTime = currentTime - lastFrameTime;
    if (deltaTime < frameDuration) { requestAnimationFrame(gameLoop); return; }
    lastFrameTime = currentTime - (deltaTime % frameDuration);

    if (gameState === 'PLAYING') {
        updateLocalPhysics(); 
    }

    // 1. CZYSZCZENIE EKRANU
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, canvas.width, canvas.height);

    let vWidth = canvas.width / globalScale; let vHeight = canvas.height / globalScale;
    let vCamera = { x: player.x - vWidth / 2, y: player.y - vHeight / 2 };

    // 2. RYSOWANIE MAPY
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(globalScale, globalScale);
    ctx.translate(-vWidth / 2, -vHeight / 2);
    
    ctx.fillStyle = '#27ae60'; ctx.fillRect(-vCamera.x, -vCamera.y, WORLD_SIZE, WORLD_SIZE); 
    drawForestMap(ctx, vCamera, vWidth, vHeight);
    ctx.restore();

    // 3. RYSOWANIE OBIEKTÓW
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(globalScale, globalScale);
    ctx.translate(-player.x, -player.y); 

    ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);
    
    // Zamek Midasa (Południe)
    drawCastle(2000, 3800, 250); 
    
    foods.forEach(f => { ctx.fillStyle = '#e67e22'; ctx.beginPath(); ctx.arc(f.x, f.y, 8, 0, Math.PI * 2); ctx.fill(); });
    
    projectiles.forEach(p => {
        let rot = Math.atan2(p.dy, p.dx) + (Date.now() / 100); 
        drawSwordModel(p, p.x, p.y, rot, 0.8, 1);
    });

    bots.forEach(b => { drawStickman(b, b.x, b.y, getScale(b.score), false, null); });
    
    if (player) {
        player.weaponPath = paths.weapon || 'none';
        drawStickman(player, player.x, player.y, getScale(player.score), player.isSafe, null);
    }

    // Damage texts
    for (let i = damageTexts.length - 1; i >= 0; i--) {
        let dt = damageTexts[i]; dt.x += dt.vx; dt.y += dt.vy; dt.life -= 0.02; 
        ctx.save(); ctx.globalAlpha = Math.max(0, dt.life); ctx.fillStyle = dt.color; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
        ctx.font = `bold ${20 + (1 - dt.life) * 15}px 'Permanent Marker', Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeText(`-${dt.val}`, dt.x, dt.y); ctx.fillText(`-${dt.val}`, dt.x, dt.y); ctx.restore();
        if (dt.life <= 0) damageTexts.splice(i, 1);
    }
    ctx.restore(); 

    // --- UI ---
    if (gameState === 'PLAYING' && player && player.isTutorialActive) {
        ctx.save();
        let tutorialX = 20; let tutorialY = canvas.height - 200; 
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'; ctx.fillRect(tutorialX, tutorialY, 380, 110);
        ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 4; ctx.strokeRect(tutorialX, tutorialY, 380, 110);
        if (typeof skins !== 'undefined' && skins.midas && skins.midas.complete) ctx.drawImage(skins.midas, tutorialX + 10, tutorialY + 15, 80, 80); 
        ctx.fillStyle = '#2c3e50'; ctx.font = "bold 16px 'Permanent Marker', Arial"; ctx.textAlign = 'left';
        ctx.fillText("MIDAS (Przewodnik XD):", tutorialX + 110, tutorialY + 25);
        ctx.fillStyle = '#000'; ctx.font = '13px Arial';
        if (player.tutorialText) { window.wrapText(ctx, player.tutorialText, tutorialX + 110, tutorialY + 50, 250, 18); }
        ctx.fillStyle = '#7f8c8d'; ctx.font = 'bold 10px Arial'; ctx.fillText("[H] - Ukryj podpowiedź", tutorialX + 110, tutorialY + 100);
        ctx.restore();
    }

    // Proste UI Kampanii
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(canvas.width - 280, 10, 270, 80);
    ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 16px Arial'; ctx.fillText("📜 AKT 1: DROGA NA TRON", canvas.width - 265, 30);
    ctx.fillStyle = '#fff'; ctx.fillText(`Masa: ${Math.floor(player.score)}`, canvas.width - 265, 55);
    ctx.fillText(`Zadanie: ${currentQuest}/3`, canvas.width - 265, 75);

    if (killLogs.length > 0) {
        ctx.save(); ctx.font = 'bold 14px Arial'; ctx.textAlign = 'right';
        for (let i = 0; i < killLogs.length; i++) {
            let log = killLogs[i]; ctx.fillStyle = `rgba(241, 196, 15, ${log.time / 50})`; 
            ctx.fillText(log.text, canvas.width - 20, 170 + (i * 22)); log.time--;
        }
        ctx.restore(); killLogs = killLogs.filter(l => l.time > 0);
    }

    requestAnimationFrame(gameLoop);
}
