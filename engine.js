// ==========================================
// ENGINE.JS - Silnik graficzny i narzędzia
// ==========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const WORLD_SIZE = 4000;
const camera = { x: 0, y: 0 };
const keys = {};

// ŁADOWANIE TWOJEJ AUTORSKIEJ POSTACI (.svg dla idealnej ostrości)
const characterImg = new Image();
characterImg.src = 'xtreme-destiny-postac.png'; 

// NOWOŚĆ: Ta zmienna będzie trzymała informację o przybliżeniu/oddaleniu
let globalScale = 1;
// Słownik pamiętający stan "przeżuwania" i emocji dla grafiki
const visualStates = {}; 

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

    // Sprawdzamy, czy rysujemy Ciebie (człowieka), czy Bota
    let isHuman = (e === player) || (e.id && e.name && !e.name.toLowerCase().includes('bot') && e.name !== 'Wojownik');

    // Niestandardowe przesunięcia dla Duszka i dla Bota
    let wpnX = isHuman ? 28 : 18;
    let wpnY = isHuman ? 18 : 10;
    let shldX = isHuman ? 28 : 20;
    let shldY = isHuman ? 18 : -6;

    if (!isHuman) {
        // --- KLASYCZNY WYGLĄD BOTA ---
        
        // 1. GRUBE ŁAPKI BOTÓW
        ctx.save();
        ctx.strokeStyle = e.color || '#000'; 
        ctx.lineWidth = 11 * sc; 
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); 
        ctx.moveTo(x - 15 * sc, y + 5 * sc); ctx.lineTo(x - 22 * sc, y + 12 * sc); 
        ctx.moveTo(x + 15 * sc, y + 5 * sc); ctx.lineTo(x + 22 * sc, y + 12 * sc); 
        ctx.moveTo(x - 8 * sc, y + 14 * sc); ctx.lineTo(x - 11 * sc, y + 28 * sc); 
        ctx.moveTo(x + 8 * sc, y + 14 * sc); ctx.lineTo(x + 11 * sc, y + 28 * sc); 
        ctx.stroke();
        ctx.restore();

        // 2. NAKOLANNIKI BOTÓW
        if (score >= 200) { 
            const legTier = getTier(score, [200, 500, 900]); 
            ctx.strokeStyle = legTier === 3 ? '#f1c40f' : (legTier === 2 ? '#3498db' : '#95a5a6'); 
            ctx.lineWidth = 8 * sc; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(x - 5 * sc, y + 16 * sc); ctx.lineTo(x - 11 * sc, y + 27 * sc); 
            ctx.moveTo(x + 5 * sc, y + 16 * sc); ctx.lineTo(x + 11 * sc, y + 27 * sc); 
            ctx.stroke(); 
        }

        // 3. BUTY BOTÓW
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
    } else {
        // --- WYGLĄD TWOJEGO DUSZKA ---
        
        // RĘKAWICE ZAMIAST BUTÓW
        if (score >= 350) {
            ctx.fillStyle = bootTier === 3 ? '#f1c40f' : (bootTier === 2 ? '#e74c3c' : '#34495e'); 
            // Lewa rękawica (pod tarczę)
            ctx.beginPath(); ctx.arc(x - wpnX * sc, y + wpnY * sc, 7 * sc, 0, Math.PI * 2); ctx.fill();
            // Prawa rękawica (pod miecz)
            ctx.beginPath(); ctx.arc(x + wpnX * sc, y + wpnY * sc, 7 * sc, 0, Math.PI * 2); ctx.fill();
        }
    }

    // 4. ZBROJA (Dla wszystkich)
    if (armorTier > 0) drawProArmor(x, y + 4 * sc, sc, armorTier, skills.strength); 

    // 5. CIAŁO / TWARZ
    let eId = e.id || e.name || 'unknown'; 
    if (!visualStates[eId]) visualStates[eId] = { lastScore: score, eatTimer: 0 };
    if (score > visualStates[eId].lastScore) { visualStates[eId].eatTimer = 15; visualStates[eId].lastScore = score; } 
    if (score < visualStates[eId].lastScore) { visualStates[eId].lastScore = score; } 
    if (visualStates[eId].eatTimer > 0) visualStates[eId].eatTimer--;

    ctx.save();
    
    if (isHuman) {
        // --- RYSOWANIE OŻYWIONEGO DUSZKA ---
        const spriteSize = 60 * sc; 
        let timeOffset = Date.now() + e.x; 
        let breatheX = 1 + Math.sin(timeOffset / 150) * 0.03;
        let breatheY = 1 - Math.sin(timeOffset / 150) * 0.04;
        let wobble = Math.cos(timeOffset / 100) * 0.1;

        ctx.translate(x, y); 
        ctx.rotate(wobble);  
        ctx.scale(breatheX, breatheY); 
        ctx.drawImage(characterImg, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
        
        if (visualStates[eId].eatTimer > 0) {
            ctx.rotate(-wobble); ctx.scale(1/breatheX, 1/breatheY);
            ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(25 * sc, -25 * sc, 18 * sc, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.stroke();
            ctx.font = `${22 * sc}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🤤', 25 * sc, -25 * sc);
        }
    } else {
        // --- RYSOWANIE KLASYCZNEGO BOTA (Czyste kółko, jak w oryginale) ---
        ctx.fillStyle = e.color || '#2ecc71';
        ctx.beginPath(); ctx.arc(x, y, 22 * sc, 0, Math.PI * 2); ctx.fill();
        
        // CHMURKA EMOCJI (Rysowana tylko, gdy bot coś zje, obok głowy)
        if (visualStates[eId].eatTimer > 0) {
            ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(x + 25 * sc, y - 25 * sc, 18 * sc, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.stroke();
            ctx.font = `${22 * sc}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🤤', x + 25 * sc, y - 25 * sc);
        }
    }
    
    ctx.restore();

    // 6. HEŁM
    if (helmetTier > 0) drawProHelmet(x, y, sc, helmetTier);

    // 7. TARCZA
    if (e.isShielding) { 
        ctx.save(); ctx.strokeStyle = '#3498db'; ctx.lineWidth = 6 * sc; ctx.shadowBlur = 10; ctx.shadowColor = '#3498db'; ctx.beginPath(); 
        let shieldAngle = (e === player) ? Math.atan2(lastMoveDir.y, lastMoveDir.x) : 0; 
        ctx.arc(x, y, 40 * sc, shieldAngle - 0.9, shieldAngle + 0.9); ctx.stroke(); ctx.restore(); 
    }
    if (score >= 50) { 
        // Tarcza ląduje w odpowiednim miejscu zależnie od tego czy to Duszek czy Bot
        drawProShield(x - shldX * sc, y + shldY * sc, sc, shieldTier); 
    }

    // 8. BRONIE W RĘCE
    if (score >= 15 || actWpn !== 'sword') {
        let weaponAngle = (e === player) ? Math.atan2(lastMoveDir.y, lastMoveDir.x) + 0.5 : 0.5; 
        // Broń ląduje idealnie w rękawicy
        let handX = x + wpnX * sc, handY = y + wpnY * sc; 
        
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

// Skalowanie płótna
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    globalScale = Math.min(1, window.innerHeight / 900);
}
window.onresize = resize;
resize();
