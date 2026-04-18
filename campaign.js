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
let particles = []; // NOWE: System cząsteczek
let killLogs = [];

let lastFrameTime = performance.now();
const frameDuration = 1000 / 60; // 60 FPS

// --- ZMIENNE KAMPANII (RPG) ---
let currentQuest = 1;
let questProgress = 0;

// Grafiki NPC
const imgZwiadowca = new Image();
imgZwiadowca.src = 'zwiadowca.png';

const imgKowal = new Image();
imgKowal.src = 'xtreme-destiny-kowal.png';

// Współrzędne Kluczowych Miejsc
const NPC_ZWIADOWCA = { x: 400, y: 3880 };
const NPC_KOWAL = { x: 3600, y: 3880 };
const DOOR_POS = { x: 2000, y: 0 };

// Opowieść Midasa (Pełne 3 Akty, 21 misji)
const campaignDialogues = {
    // AKT 1: Ruiny
    1: "MIDAS: Witaj, {NAME}. Twój cel to Tron. Idź na północ i zbierz 10 masy z zielonych kulek.",
    2: "MIDAS: Dobrze, {NAME}. Teraz przetestuj rzut mieczem (LPM) na Szlamach. Wbij 25 masy.",
    3: "MIDAS: Dobrze sobie radzisz. Podejdź do Kowala po prawej stronie.",
    4: "KOWAL: Potrzebuję surowców! Wbij 40 masy w lesie, by udowodnić swoją siłę.",
    5: "MIDAS: Zuch z ciebie. Podejdź do Zwiadowcy po lewej.",
    6: "ZWIADOWCA: Na północy jest Jaskinia. Wbij 60 masy, by przetrwać drogę.",
    7: "MIDAS: Musisz być potężny. Zanurz się w las i zdobądź 80 masy.",
    8: "KOWAL: Zróbmy interes! Podejdź do mnie po Ognisty Klucz.",
    9: "KOWAL: Klucz gotowy! Osiągnij 100 masy, by mieć siłę go unieść.",
    10: "MIDAS: Jesteś gotów, {NAME}. Wejdź w świecącą Jaskinię na północy!",

    // AKT 2: Dolina Cieni
    11: "MIDAS: Przetrwałeś Jaskinię! Witaj w nowym etapie. Zdobądź 130 masy.",
    12: "ZWIADOWCA: Szlamy tutaj są potężniejsze. Wbij 160 masy, by zyskać szacunek.",
    13: "KOWAL: Twoja broń tępieje. Przynieś mi surowce! (Osiągnij 190 masy)",
    14: "MIDAS: Czuję, że rośniesz w siłę, {NAME}. Pokaż na co cię stać i wbij 220 masy.",
    15: "ZWIADOWCA: Droga do Tronu jest zamknięta. Wbij 250 masy i znów wejdź do Jaskini!",

    // AKT 3: Pustkowia Królów
    16: "MIDAS: To już Pustkowia Królów. Tutaj nikt nie wybacza błędów. Zdobądź 280 masy.",
    17: "KOWAL: Wykuję ci pancerz godny władcy. Zbierz 310 masy!",
    18: "ZWIADOWCA: Uważaj, czuję niebezpieczeństwo. Osiągnij 350 masy, by przeżyć.",
    19: "MIDAS: To ostatnia prosta do Tronu, {NAME}! Wbij 380 masy!",
    20: "MIDAS: Ostateczna próba! Osiągnij 400 masy i udowodnij, że jesteś Królem Serwera!",
    21: "MIDAS: 👑 KAMPANIA UKOŃCZONA! 👑 Jesteś prawdziwym Królem, {NAME}!"
};

// Inicjalizacja lokalnej mapy (Z POPRAWKĄ NA MAPĘ FABULARNĄ)
initMap(WORLD_SIZE, 'campaign_1');

// --- SYSTEM CZĄSTECZEK (Krew, Kurz, Ogień) ---
function spawnParticle(x, y, color, type = 'blood') {
    const count = type === 'blood' ? 8 : 1;
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * (type === 'blood' ? 6 : (type === 'fire' ? 1 : 2)),
            vy: (Math.random() - 0.5) * (type === 'blood' ? 6 : (type === 'fire' ? -3 : 2)),
            life: 1.0,
            size: type === 'blood' ? 2 + Math.random() * 4 : (type === 'dust' ? 4 + Math.random() * 6 : 2 + Math.random() * 3),
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
        p.life -= (p.type === 'blood' ? 0.02 : (p.type === 'fire' ? 0.04 : 0.05));
        if (p.life <= 0) particles.splice(i, 1);
    }
}

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

    // Punkt odrodzenia Kampanii: Baza wypadowa (Południe mapy)
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
        tutorialText: campaignDialogues[currentQuest].replace('{NAME}', name),
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

// --- LOGIKA QUESTÓW FABULARNYCH ---
function advanceQuest(newQuestNum) {
    currentQuest = newQuestNum;
    player.tutorialText = campaignDialogues[currentQuest].replace('{NAME}', player.name);
    killLogs.push({ text: "⭐ MISJA ZAKTUALIZOWANA!", time: 200 });
}

function checkQuestProgress() {
    // AKT 1
    if (currentQuest === 1 && player.score >= 10) advanceQuest(2);
    else if (currentQuest === 2 && player.score >= 25) advanceQuest(3);
    else if (currentQuest === 4 && player.score >= 40) advanceQuest(5);
    else if (currentQuest === 6 && player.score >= 60) advanceQuest(7);
    else if (currentQuest === 7 && player.score >= 80) advanceQuest(8);
    else if (currentQuest === 9 && player.score >= 100) advanceQuest(10);
    // AKT 2
    else if (currentQuest === 11 && player.score >= 130) advanceQuest(12);
    else if (currentQuest === 12 && player.score >= 160) advanceQuest(13);
    else if (currentQuest === 13 && player.score >= 190) advanceQuest(14);
    else if (currentQuest === 14 && player.score >= 220) advanceQuest(15);
    // AKT 3
    else if (currentQuest === 16 && player.score >= 280) advanceQuest(17);
    else if (currentQuest === 17 && player.score >= 310) advanceQuest(18);
    else if (currentQuest === 18 && player.score >= 350) advanceQuest(19);
    else if (currentQuest === 19 && player.score >= 380) advanceQuest(20);
    else if (currentQuest === 20 && player.score >= 400) advanceQuest(21);
}

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
        
        // EFEKT KURZU POD STOPAMI GRACZA (Ciemniejszy, grubszy)
        if (Math.random() > 0.6) spawnParticle(player.x, player.y + 20, 'rgba(50,50,50,0.8)', 'dust');

        // Granice mapy
        player.x = Math.max(0, Math.min(WORLD_SIZE, player.x));
        player.y = Math.max(0, Math.min(WORLD_SIZE, player.y));
    }

    // SPRAWDZANIE INTERAKCJI Z NPC I OBIEKTAMI
    let distSmith = Math.hypot(player.x - NPC_KOWAL.x, player.y - NPC_KOWAL.y);
    let distScout = Math.hypot(player.x - NPC_ZWIADOWCA.x, player.y - NPC_ZWIADOWCA.y);
    let distGate = Math.hypot(player.x - DOOR_POS.x, player.y - DOOR_POS.y);

    if (distSmith < 80) {
        if (currentQuest === 3) advanceQuest(4);
        if (currentQuest === 8) advanceQuest(9);
    }
    if (distScout < 80) {
        if (currentQuest === 5) advanceQuest(6);
    }
    if (distGate < 120) {
        if (currentQuest === 10) advanceQuest(11);
        if (currentQuest === 15) advanceQuest(16);
    }

    // Bezpieczna strefa (Baza i koniec gry)
    player.isSafe = safeZones.some(z => Math.hypot(player.x - z.x, player.y - z.y) < z.radius) || currentQuest === 21;
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
        
        // EFEKT KURZU POD STOPAMI BOTA
        if (Math.random() > 0.9) spawnParticle(b.x, b.y + 20, 'rgba(100,100,100,0.5)', 'dust');

        // Zawracanie na granicach strefy lasu (żeby nie uciekły do bazy)
        if (b.x < 500 || b.x > 3500 || b.y > 2500 || b.y < 500) b.angle += Math.PI;

        let dist = Math.hypot(player.x - b.x, player.y - b.y);
        let bRadius = 25 * (1 + Math.pow(Math.max(0, b.score - 1), 0.45) * 0.15);

        // Zjadanie botów lub śmierć gracza
        if (!player.isSafe) {
            if (dist < playerRadius && player.score > b.score * 1.15) {
                player.score += Math.floor(b.score * 0.5);
                spawnParticle(b.x, b.y, '#ff0000', 'blood'); // KREW PRZY ZJEDZENIU
                killLogs.push({ text: `Zabiłeś ${b.name}!`, time: 150 });
                bots[bi] = spawnLocalBot('slime');
                checkQuestProgress();
            } else if (dist < bRadius && b.score > player.score * 1.15) {
                // KARA ZA ŚMIERĆ W KAMPANII
                spawnParticle(player.x, player.y, '#ff0000', 'blood'); // KREW PRZY ŚMIERCI
                player.score = Math.floor(player.score * 0.8); // Traci 20%
                player.x = 2000; player.y = 3800; // Powrót do bazy
                killLogs.push({ text: `Zginąłeś! Tracisz masę i wracasz do bazy.`, time: 200 });
                player.tutorialText = "MIDAS: Bolało? Mówiłem, żebyś uważał. Idź jeszcze raz, tylko tym razem unikaj tych wielkich.";
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
                spawnParticle(b.x, b.y, '#ff0000', 'blood'); // KREW PRZY TRAFIENIU
                damageTexts.push({ x: b.x, y: b.y, val: p.damage, color: '#fff', life: 1, vx: 0, vy: -2 });
                if (!p.isPiercing) p.life = 0; 
            }
        });

        if (p.life <= 0) projectiles.splice(i, 1);
    }
    
    // Aktualizacja systemu cząsteczek
    updateParticles();

    // Kamera podąża za graczem
    camera.x = player.x - canvas.width / 2; camera.y = player.y - canvas.height / 2;
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
    
    // --- WROTA (Północ) - NOWA JASKINIA ---
    let isGateGlowing = (currentQuest === 10 || currentQuest === 15);
    drawCaveEntrance(DOOR_POS.x, DOOR_POS.y, isGateGlowing);

    // --- BAZA WYPADOWA KAMPANII ---
    
    // Chata Midasa 
    drawHut(2000, 3800, 150); 
    
    // Zwiadowca w obozie (Po lewej stronie) z drzewem
    drawDeadTree(NPC_ZWIADOWCA.x, NPC_ZWIADOWCA.y);
    if (imgZwiadowca.complete) {
        ctx.drawImage(imgZwiadowca, NPC_ZWIADOWCA.x - 40, NPC_ZWIADOWCA.y - 40, 80, 80);
        
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.ellipse(NPC_ZWIADOWCA.x, NPC_ZWIADOWCA.y + 35, 30, 10, 0, 0, Math.PI * 2); ctx.fill();
        
        ctx.fillStyle = '#7f8c8d'; 
        ctx.font = 'bold 14px Arial'; 
        ctx.textAlign = 'center';
        ctx.fillText("Zwiadowca", NPC_ZWIADOWCA.x, NPC_ZWIADOWCA.y - 50);
    }

    // Kowal w obozie (Po prawej stronie) z otoczeniem
    drawBlacksmithArea(NPC_KOWAL.x, NPC_KOWAL.y);
    if (imgKowal.complete) {
        ctx.drawImage(imgKowal, NPC_KOWAL.x - 40, NPC_KOWAL.y - 40, 80, 80);
        
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.ellipse(NPC_KOWAL.x, NPC_KOWAL.y + 35, 30, 10, 0, 0, Math.PI * 2); ctx.fill();
        
        ctx.fillStyle = '#e67e22'; 
        ctx.font = 'bold 14px Arial'; 
        ctx.textAlign = 'center';
        ctx.fillText("Kowal", NPC_KOWAL.x, NPC_KOWAL.y - 50);
    }
    
    // CZĄSTECZKI (Kurz pod postaciami)
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;

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

    // --- UI Z DYNAMICZNYM MÓWCĄ ---
    if (gameState === 'PLAYING' && player && player.isTutorialActive) {
        ctx.save();
        let tutorialX = 20; let tutorialY = canvas.height - 200; 
        ctx.fillStyle = currentQuest === 21 ? 'rgba(46, 204, 113, 0.95)' : 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(tutorialX, tutorialY, 380, 110);
        ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 4; ctx.strokeRect(tutorialX, tutorialY, 380, 110);
        
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
            ctx.drawImage(skins.midas, tutorialX + 10, tutorialY + 15, 80, 80); 
        } else if (speakerName === "KOWAL" && imgKowal.complete) {
            ctx.drawImage(imgKowal, tutorialX + 10, tutorialY + 15, 80, 80);
        } else if (speakerName === "ZWIADOWCA" && imgZwiadowca.complete) {
            ctx.drawImage(imgZwiadowca, tutorialX + 10, tutorialY + 15, 80, 80);
        }

        ctx.fillStyle = '#2c3e50'; ctx.font = "bold 16px 'Permanent Marker', Arial"; ctx.textAlign = 'left';
        ctx.fillText(speakerName + ":", tutorialX + 110, tutorialY + 25);
        ctx.fillStyle = '#000'; ctx.font = '13px Arial';
        
        if (displayText) { window.wrapText(ctx, displayText, tutorialX + 110, tutorialY + 50, 250, 18); }
        
        ctx.fillStyle = '#7f8c8d'; ctx.font = 'bold 10px Arial'; ctx.fillText("[H] - Ukryj podpowiedź", tutorialX + 110, tutorialY + 100);
        ctx.restore();
    }

    // --- DYNAMICZNY TYTUŁ AKTU W PRAWYM ROGU ---
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(canvas.width - 280, 10, 270, 80);
    ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 16px Arial'; 
    
    let actName = "📜 AKT 1: RUINY";
    if (currentQuest > 10 && currentQuest <= 15) actName = "📜 AKT 2: DOLINA CIENI";
    if (currentQuest > 15) actName = "📜 AKT 3: PUSTKOWIA KRÓLÓW";
    
    ctx.fillText(actName, canvas.width - 265, 30);
    ctx.fillStyle = '#fff'; ctx.fillText(`Masa: ${Math.floor(player.score)}`, canvas.width - 265, 55);
    ctx.fillText(`Etap Fabuły: ${currentQuest}/21`, canvas.width - 265, 75);

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

// --- FUNKCJA RYSOWANIA CHATY (Baza Midasa) - MROCZNA ---
function drawHut(x, y, size) {
    ctx.save();
    
    // 1. Cień pod chatą
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + size/2, size * 0.8, size * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Główne ściany (Szaro-Czarne)
    ctx.fillStyle = '#333333'; 
    ctx.fillRect(x - size/2, y - size/2, size, size);
    
    // 3. Zarys desek (Mroczny)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - size/2, y - size/2, size, size);
    ctx.beginPath();
    ctx.moveTo(x - size/2, y); 
    ctx.lineTo(x + size/2, y);
    ctx.stroke();

    // 4. Dach
    ctx.fillStyle = '#222222'; 
    ctx.beginPath();
    ctx.moveTo(x - size/2 - 20, y - size/2); 
    ctx.lineTo(x, y - size/2 - size * 0.6);  
    ctx.lineTo(x + size/2 + 20, y - size/2); 
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 5. Drzwi
    ctx.fillStyle = '#0a0a0a'; 
    let doorWidth = size * 0.35;
    let doorHeight = size * 0.55;
    ctx.fillRect(x - doorWidth/2, y + size/2 - doorHeight, doorWidth, doorHeight);
    
    // 6. Złoty detal Midasa
    ctx.fillStyle = '#F1C40F';
    ctx.beginPath();
    ctx.arc(x, y - size/2 + 15, 6, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
}

// --- DODATKOWE ELEMENTY OTOCZENIA ---
function drawDeadTree(x, y) {
    ctx.save();
    ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); 
    ctx.moveTo(x, y); ctx.lineTo(x, y - 80); 
    ctx.lineTo(x - 30, y - 120); 
    ctx.moveTo(x, y - 50); ctx.lineTo(x + 40, y - 100); 
    ctx.stroke();
    ctx.restore();
}

function drawBlacksmithArea(x, y) {
    ctx.save();
    ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(x + 40, y - 10, 30, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#444'; ctx.beginPath(); ctx.arc(x + 35, y - 5, 20, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(x - 45, y + 25, 25, 12, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#e74c3c'; 
    ctx.beginPath(); ctx.moveTo(x - 45, y + 25); ctx.lineTo(x - 55, y + 5); ctx.lineTo(x - 40, y + 15); ctx.lineTo(x - 35, y); ctx.lineTo(x - 45, y + 25); ctx.fill();
    if (Math.random() > 0.5) spawnParticle(x - 45 + (Math.random()*10-5), y + 15, 'rgba(255, 100, 0, 0.8)', 'fire');
    ctx.restore();
}

function drawCaveEntrance(x, y, isGlowing) {
    ctx.save();
    
    // Zarys skał (jaskinia)
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(x, y + 50, 140, Math.PI, 0); 
    ctx.lineTo(x + 140, y + 100);
    ctx.lineTo(x - 140, y + 100);
    ctx.fill();

    // Wnętrze mroku (lub świecący portal)
    ctx.fillStyle = isGlowing ? '#3498db' : '#050505';
    ctx.beginPath();
    ctx.arc(x, y + 50, 90, Math.PI, 0);
    ctx.lineTo(x + 90, y + 100);
    ctx.lineTo(x - 90, y + 100);
    ctx.fill();

    // Cząsteczki dla aktywnej jaskini
    if(isGlowing && Math.random() > 0.5) {
        spawnParticle(x + (Math.random() * 120 - 60), y + 50, 'rgba(52, 152, 219, 0.8)', 'fire');
    }

    // Drzewa strażnicze przy wejściu
    drawDeadTree(x - 160, y + 90);
    drawDeadTree(x + 160, y + 90);
    
    ctx.restore();
}