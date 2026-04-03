// ==========================================
// ENGINE.JS - Silnik graficzny i narzędzia (Pancerna Wersja AAA)
// ==========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const WORLD_SIZE = 4000;
const camera = { x: 0, y: 0 };
const keys = {};

// --- ŁADOWANIE POSTACI I ASYSTENTA ---
const skins = {
    standard: new Image(),
    ninja: new Image(),
    arystokrata: new Image(),
    midas: new Image()
};
skins.standard.src = 'xtreme-destiny-postac.png'; 
skins.ninja.src = 'ninja-transparent.png';
skins.arystokrata.src = 'postac-bez-tla.png';
skins.midas.src = 'xtreme-destiny-midas.png';

let globalScale = 1;
const visualStates = {}; 

// --- FUNKCJA BEZPIECZNEGO ZAOOKRĄGLANIA (Naprawa crashy na Linux/Firefox) ---
function fillRoundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
}

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

// --- RYSOWANIE GRAFIKI (LIFTING WIZUALNY) ---
function drawBowModel(x, y, angle, sc) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.strokeStyle = '#8e44ad'; ctx.lineWidth = 3 * sc; ctx.lineCap = 'round';
    
    ctx.shadowColor = '#9b59b6'; ctx.shadowBlur = 5 * sc;
    ctx.beginPath(); ctx.arc(0, 0, 15 * sc, -Math.PI/2, Math.PI/2); ctx.stroke();
    
    ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1 * sc; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(0, -15 * sc); ctx.lineTo(0, 15 * sc); ctx.stroke();
    ctx.restore();
}

function drawKnifeModel(x, y, angle, sc) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    
    let grad = ctx.createLinearGradient(0, -2*sc, 15*sc, 2*sc);
    grad.addColorStop(0, '#ecf0f1'); grad.addColorStop(0.5, '#bdc3c7'); grad.addColorStop(1, '#7f8c8d');
    
    ctx.fillStyle = grad; 
    ctx.beginPath(); ctx.moveTo(0, -2*sc); ctx.lineTo(15*sc, 0); ctx.lineTo(0, 2*sc); ctx.fill();
    
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(-5*sc, -2*sc, 5*sc, 4*sc);
    ctx.fillStyle = '#1a252f'; ctx.fillRect(-3*sc, -2*sc, 1*sc, 4*sc);
    ctx.restore();
}

function drawShurikenModel(x, y, angle, sc) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4 * sc;
    ctx.fillStyle = '#34495e';
    for(let i=0; i<4; i++) { 
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(6*sc, -2*sc); ctx.lineTo(12*sc, 0); ctx.lineTo(6*sc, 2*sc); ctx.fill(); 
        ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(12*sc, 0); ctx.lineTo(6*sc, 2*sc); ctx.fill(); 
        ctx.fillStyle = '#34495e'; ctx.rotate(Math.PI/2); 
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ecf0f1'; ctx.beginPath(); ctx.arc(0,0, 2*sc, 0, Math.PI*2); ctx.fill();
    ctx.restore();
}

function drawSwordModel(p, x, y, angle, sc, tier = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    
    if (p && p.isWinter) {
        ctx.shadowBlur = 25 * sc; ctx.shadowColor = '#00ffff';
        let frostGrad = ctx.createLinearGradient(0, 0, 80 * sc, 0);
        frostGrad.addColorStop(0, '#ffffff'); frostGrad.addColorStop(0.5, '#a4ebf3'); frostGrad.addColorStop(1, '#00ffff');
        
        ctx.fillStyle = frostGrad; 
        ctx.beginPath(); ctx.moveTo(0, -6 * sc); ctx.lineTo(60 * sc, -10 * sc); ctx.lineTo(80 * sc, 0); ctx.lineTo(60 * sc, 10 * sc); ctx.lineTo(0, 6 * sc); ctx.fill();
        ctx.fillStyle = '#2c3e50'; ctx.fillRect(4 * sc, -16 * sc, 6 * sc, 32 * sc); ctx.fillRect(-10 * sc, -3 * sc, 10 * sc, 6 * sc);
        ctx.restore(); return;
    }

    let bladeColors = { 1: ['#ecf0f1', '#95a5a6'], 2: ['#ff7675', '#c0392b'], 3: ['#fff200', '#f39c12'] };
    let glow = 'transparent';
    if (p && p.isPiercing) { glow = 'rgba(255, 255, 255, 0.9)'; ctx.shadowBlur = 18 * sc; } 
    else if (tier >= 2) { glow = tier === 3 ? 'rgba(241, 196, 15, 0.6)' : 'rgba(231, 76, 60, 0.5)'; ctx.shadowBlur = 12 * sc; }
    ctx.shadowColor = glow;

    let bladeGrad = ctx.createLinearGradient(0, -5*sc, 0, 5*sc);
    bladeGrad.addColorStop(0, bladeColors[tier][0]); bladeGrad.addColorStop(0.5, '#ffffff'); bladeGrad.addColorStop(1, bladeColors[tier][1]);

    ctx.fillStyle = bladeGrad;
    ctx.beginPath(); ctx.moveTo(0, -2 * sc);
    if (tier <= 1) { ctx.lineTo(35 * sc, -2 * sc); ctx.lineTo(42 * sc, 0); ctx.lineTo(35 * sc, 2 * sc); } 
    else if (tier === 2) { ctx.lineTo(38 * sc, -4 * sc); ctx.lineTo(48 * sc, 0); ctx.lineTo(38 * sc, 4 * sc); } 
    else { ctx.lineTo(48 * sc, -6 * sc); ctx.lineTo(58 * sc, 0); ctx.lineTo(48 * sc, 6 * sc); }
    ctx.lineTo(0, 2 * sc); ctx.fill();

    ctx.shadowBlur = 5 * sc; ctx.shadowColor = 'rgba(0,0,0,0.5)'; 
    ctx.fillStyle = tier === 3 ? '#e67e22' : '#2c3e50';
    let guardWidth = tier >= 2 ? 26 : 20;
    ctx.fillRect(4 * sc, -(guardWidth/2) * sc, 4 * sc, guardWidth * sc);
    if (tier === 3) { ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(6*sc, 0, 3*sc, 0, Math.PI*2); ctx.fill(); }
    
    ctx.fillStyle = '#1a252f'; ctx.fillRect(-10 * sc, -2 * sc, 10 * sc, 4 * sc);
    ctx.restore();
}

function drawProArmor(x, y, sc, tier, strengthLvl) {
    ctx.save();
    let mainColor = tier === 3 ? '#f1c40f' : (tier === 2 ? '#3498db' : '#95a5a6');
    let shadowColor = tier === 3 ? '#d35400' : (tier === 2 ? '#2980b9' : '#7f8c8d');
    let armorGrad = ctx.createLinearGradient(x - 14*sc, y - 10*sc, x + 14*sc, y + 15*sc);
    armorGrad.addColorStop(0, mainColor); armorGrad.addColorStop(1, shadowColor);

    ctx.fillStyle = shadowColor;
    ctx.beginPath(); ctx.moveTo(x - 11 * sc, y - 10 * sc); ctx.lineTo(x + 11 * sc, y - 10 * sc); ctx.lineTo(x + 14 * sc, y + 15 * sc); ctx.lineTo(x - 14 * sc, y + 15 * sc); ctx.fill();
    ctx.fillStyle = armorGrad;
    ctx.beginPath(); ctx.moveTo(x - 9 * sc, y - 10 * sc); ctx.lineTo(x + 9 * sc, y - 10 * sc); ctx.lineTo(x + 11 * sc, y + 13 * sc); ctx.lineTo(x - 11 * sc, y + 13 * sc); ctx.fill();

    if (strengthLvl >= 100) {
        ctx.fillStyle = '#8e44ad'; ctx.fillRect(x - 13 * sc, y - 12 * sc, 26 * sc, 8 * sc);
        ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.moveTo(x, y - 5 * sc); ctx.lineTo(x + 8 * sc, y + 5 * sc); ctx.lineTo(x, y + 15 * sc); ctx.lineTo(x - 8 * sc, y + 5 * sc); ctx.fill();
        ctx.shadowBlur = 10 * sc; ctx.shadowColor = '#9b59b6'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * sc; ctx.stroke();
    } else if (strengthLvl >= 55) {
        ctx.fillStyle = '#00ffff';
        ctx.beginPath(); ctx.moveTo(x - 14 * sc, y - 8 * sc); ctx.lineTo(x - 20 * sc, y - 15 * sc); ctx.lineTo(x - 8 * sc, y - 12 * sc); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 14 * sc, y - 8 * sc); ctx.lineTo(x + 20 * sc, y - 15 * sc); ctx.lineTo(x + 8 * sc, y - 12 * sc); ctx.fill();
        ctx.fillRect(x - 4 * sc, y, 8 * sc, 10 * sc);
    } else if (strengthLvl >= 20) {
        ctx.fillStyle = '#bdc3c7'; ctx.fillRect(x - 10 * sc, y - 5 * sc, 20 * sc, 4 * sc); ctx.fillRect(x - 8 * sc, y + 2 * sc, 16 * sc, 4 * sc);
        ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.arc(x, y + 8 * sc, 4 * sc, 0, Math.PI*2); ctx.fill();
    } else if (strengthLvl >= 5) {
        ctx.fillStyle = '#d35400'; ctx.fillRect(x - 12 * sc, y - 10 * sc, 6 * sc, 6 * sc); ctx.fillRect(x + 6 * sc, y - 10 * sc, 6 * sc, 6 * sc);
        ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 2 * sc; ctx.beginPath(); ctx.moveTo(x - 8 * sc, y - 10 * sc); ctx.lineTo(x + 8 * sc, y + 10 * sc); ctx.stroke();
    }
    ctx.restore();
}

function drawDynamicArmor(e, x, y, sc, tier) {
    if (tier === 0) return; 
    ctx.save(); ctx.translate(x, y);
    
    let skinType = e.skin || 'standard';
    let baseColor = '#bdc3c7'; let trimColor = '#7f8c8d'; let gemColor = null;

    if (skinType === 'ninja') { baseColor = '#2c3e50'; trimColor = '#e74c3c'; } 
    else if (skinType === 'arystokrata') { baseColor = '#f1c40f'; trimColor = '#e67e22'; gemColor = '#8e44ad'; }

    let armorGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 20*sc);
    armorGrad.addColorStop(0, '#ffffff'); armorGrad.addColorStop(0.5, baseColor); armorGrad.addColorStop(1, trimColor);

    if (tier >= 1) {
        ctx.save(); ctx.translate(-25 * sc, 5 * sc); ctx.rotate(-Math.PI / 8);        
        if (skinType === 'ninja') {
            ctx.fillStyle = armorGrad;
            ctx.beginPath(); ctx.moveTo(-6*sc, -12*sc); ctx.lineTo(6*sc, -12*sc); ctx.lineTo(10*sc, 15*sc); ctx.lineTo(0, 22*sc); ctx.lineTo(-10*sc, 15*sc); ctx.fill();
            ctx.strokeStyle = trimColor; ctx.lineWidth = 2*sc; ctx.stroke();
        } else {
            ctx.fillStyle = armorGrad; ctx.beginPath(); ctx.arc(0, 0, 14 * sc, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = trimColor; ctx.lineWidth = 3 * sc; ctx.stroke();
            if (gemColor) { 
                ctx.fillStyle = gemColor; ctx.shadowBlur = 10*sc; ctx.shadowColor = gemColor;
                ctx.beginPath(); ctx.arc(0, 0, 5 * sc, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); ctx.shadowBlur = 0;
            } else { ctx.fillStyle = '#ecf0f1'; ctx.beginPath(); ctx.arc(0, 0, 4 * sc, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.restore();
    }

    if (tier >= 2) {
        ctx.fillStyle = armorGrad; ctx.strokeStyle = trimColor; ctx.lineWidth = 2 * sc;
        ctx.beginPath(); ctx.ellipse(-28 * sc, -15 * sc, 12 * sc, 18 * sc, Math.PI / 4, 0, Math.PI); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(28 * sc, -15 * sc, 12 * sc, 18 * sc, -Math.PI / 4, 0, Math.PI); ctx.fill(); ctx.stroke();
    }

    if (tier >= 3) {
        let auraTime = Date.now() / 200; let floatY = Math.sin(auraTime) * 5 * sc;
        ctx.save(); ctx.translate(0, -45 * sc + floatY); 
        if (skinType === 'ninja') {
            ctx.fillStyle = '#e74c3c'; ctx.shadowColor = '#c0392b'; ctx.shadowBlur = 15;
            ctx.beginPath(); ctx.moveTo(0, -15*sc); ctx.lineTo(10*sc, 5*sc); ctx.lineTo(-10*sc, 5*sc); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0, 10*sc); ctx.lineTo(5*sc, 20*sc); ctx.lineTo(-5*sc, 20*sc); ctx.fill();
        } else {
            let crownColor = skinType === 'arystokrata' ? '#f1c40f' : '#ecf0f1';
            ctx.fillStyle = crownColor; ctx.shadowColor = crownColor; ctx.shadowBlur = 20;
            ctx.beginPath(); ctx.moveTo(-20*sc, 0); ctx.lineTo(-15*sc, -20*sc); ctx.lineTo(-7*sc, -5*sc); ctx.lineTo(0, -25*sc); ctx.lineTo(7*sc, -5*sc); ctx.lineTo(15*sc, -20*sc); ctx.lineTo(20*sc, 0); ctx.fill();
        }
        ctx.restore();
    }
    ctx.restore();
}

function drawStickman(e, x, y, sc, safe, kingId) {
    if (safe) return; 

    ctx.save(); 
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'; 
    ctx.shadowBlur = 10 * sc; ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(x + 2 * sc, y + 26 * sc, 22 * sc, 10 * sc, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    
    if (e.aura && e.aura.time > 0) { 
        ctx.save(); 
        let progress = 1 - (e.aura.time / e.aura.maxTime); 
        let radius = (35 * sc) + (progress * 80 * sc); 
        let alpha = 1 - Math.pow(progress, 2); 
        ctx.globalAlpha = alpha; 
        
        let radGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        radGrad.addColorStop(0, 'transparent'); radGrad.addColorStop(0.8, e.aura.color); radGrad.addColorStop(1, 'transparent');
        
        ctx.fillStyle = radGrad;
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
        ctx.restore(); 
    }

    const isPlayer = (typeof player !== 'undefined' && e === player);
    const score = e.score || 0; 
    const skills = e.skills || (isPlayer && typeof playerSkills !== 'undefined' ? playerSkills : { speed: 0, strength: 0, weapon: 0 }); 
    const inv = e.inventory || { bow: 0, knife: 0, shuriken: 0 }; 
    const actWpn = e.activeWeapon || 'sword';
    const moveDir = (typeof lastMoveDir !== 'undefined') ? lastMoveDir : {x: 1, y: 0};

    const equipmentTier = getTier(score, [100, 300, 600]); 
    const armorTier = getTier(score, [100, 450, 850]); 
    const swordTier = getTier(score, [15, 300, 700]); 
    const bootTier = getTier(skills.speed, [3, 6, 9]);

    let isHuman = isPlayer || (e.id && e.name && !e.name.toLowerCase().includes('bot') && e.name !== 'Wojownik' && e.name !== 'Dron Obrony');

    let timeOffset = Date.now() + e.x; 
    let breatheX = 1 + Math.sin(timeOffset / 150) * 0.02;
    let breatheY = 1 - Math.sin(timeOffset / 150) * 0.03;
    let wobble = Math.cos(timeOffset / 100) * 0.05;

    let floatHandY = Math.sin(timeOffset / 200) * 2 * sc;
    let wpnX = isHuman ? 28 : 18;
    let wpnY = (isHuman ? 18 : 10) + floatHandY;

    if (!isHuman) {
        ctx.save();
        let botBaseColor = e.color || '#7f8c8d';
        let botGrad = ctx.createRadialGradient(x - 5*sc, y - 5*sc, 2*sc, x, y, 25*sc);
        botGrad.addColorStop(0, '#ecf0f1'); botGrad.addColorStop(0.3, botBaseColor); botGrad.addColorStop(1, '#2c3e50'); 
        ctx.fillStyle = botGrad;
        
        ctx.strokeStyle = botBaseColor; 
        ctx.lineWidth = 11 * sc; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); 
        ctx.moveTo(x - 15 * sc, y + 5 * sc); ctx.lineTo(x - 22 * sc, y + 12 * sc); 
        ctx.moveTo(x + 15 * sc, y + 5 * sc); ctx.lineTo(x + 22 * sc, y + 12 * sc); 
        ctx.moveTo(x - 8 * sc, y + 14 * sc); ctx.lineTo(x - 11 * sc, y + 28 * sc); 
        ctx.moveTo(x + 8 * sc, y + 14 * sc); ctx.lineTo(x + 11 * sc, y + 28 * sc); 
        ctx.stroke();

        ctx.beginPath(); ctx.arc(x, y, 22 * sc, 0, Math.PI * 2); ctx.fill();

        if (score >= 200) { 
            const legTier = getTier(score, [200, 500, 900]); 
            ctx.strokeStyle = legTier === 3 ? '#f1c40f' : (legTier === 2 ? '#3498db' : '#95a5a6'); 
            ctx.lineWidth = 8 * sc; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(x - 5 * sc, y + 16 * sc); ctx.lineTo(x - 11 * sc, y + 27 * sc); ctx.moveTo(x + 5 * sc, y + 16 * sc); ctx.lineTo(x + 11 * sc, y + 27 * sc); ctx.stroke(); 
        }

        if (score >= 350) { 
            ctx.fillStyle = bootTier === 3 ? '#f1c40f' : (bootTier === 2 ? '#e74c3c' : '#34495e'); 
            fillRoundRect(ctx, x - 16 * sc, y + 26 * sc, 12 * sc, 8 * sc, 4); 
            fillRoundRect(ctx, x + 4 * sc, y + 26 * sc, 12 * sc, 8 * sc, 4); 
        }

        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.ellipse(x - 7 * sc, y - 5 * sc, 3.5 * sc, 5.5 * sc, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + 7 * sc, y - 5 * sc, 3.5 * sc, 5.5 * sc, 0, 0, Math.PI * 2); ctx.fill();
        
        let eyeColor = (score >= 100) ? '#e74c3c' : '#111'; 
        ctx.fillStyle = eyeColor; ctx.shadowColor = eyeColor; ctx.shadowBlur = (score >= 100) ? 10 * sc : 0;
        ctx.beginPath(); ctx.arc(x - 6.5 * sc, y - 4 * sc, 1.8 * sc, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 6.5 * sc, y - 4 * sc, 1.8 * sc, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; 

        ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5 * sc; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 11 * sc, y - 11 * sc); ctx.lineTo(x - 4 * sc, y - 8 * sc); ctx.moveTo(x + 11 * sc, y - 11 * sc); ctx.lineTo(x + 4 * sc, y - 8 * sc); ctx.stroke();
        ctx.restore();
    } else {
        if (score >= 350) {
            ctx.fillStyle = bootTier === 3 ? '#f1c40f' : (bootTier === 2 ? '#e74c3c' : '#34495e'); 
            ctx.beginPath(); ctx.arc(x - wpnX * sc, y + wpnY * sc, 7 * sc, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + wpnX * sc, y + wpnY * sc, 7 * sc, 0, Math.PI * 2); ctx.fill();
        }
    }
    
    if (armorTier > 0) drawProArmor(x, y + 4 * sc, sc, armorTier, skills.strength); 

    let eId = e.id || e.name || 'unknown'; 
    if (!visualStates[eId]) visualStates[eId] = { lastScore: score, eatTimer: 0 };
    if (score > visualStates[eId].lastScore) { visualStates[eId].eatTimer = 15; visualStates[eId].lastScore = score; } 
    if (score < visualStates[eId].lastScore) { visualStates[eId].lastScore = score; } 
    if (visualStates[eId].eatTimer > 0) visualStates[eId].eatTimer--;

    ctx.save();
    
    if (isHuman) {
        const spriteSize = 60 * sc; 
        ctx.translate(x, y); ctx.rotate(wobble); ctx.scale(breatheX, breatheY); 
        let currentSkinImg = skins.standard;
        if (e.skin === 'ninja') currentSkinImg = skins.ninja;
        else if (e.skin === 'arystokrata') currentSkinImg = skins.arystokrata;
        ctx.drawImage(currentSkinImg, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
        drawDynamicArmor(e, 0, 0, sc, equipmentTier);

        if (visualStates[eId].eatTimer > 0) {
            ctx.rotate(-wobble); ctx.scale(1/breatheX, 1/breatheY);
            ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(25 * sc, -25 * sc, 18 * sc, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.stroke();
            ctx.font = `${22 * sc}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🤤', 25 * sc, -25 * sc);
        }
    } else {
        if (equipmentTier > 0) drawDynamicArmor(e, x, y, sc, equipmentTier);
        if (visualStates[eId].eatTimer > 0) {
            ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(x + 25 * sc, y - 25 * sc, 18 * sc, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.stroke();
            ctx.font = `${22 * sc}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🤤', x + 25 * sc, y - 25 * sc);
        }
    }
    
    ctx.restore();

    if (e.isShielding) { 
        ctx.save(); ctx.strokeStyle = 'rgba(52, 152, 219, 0.9)'; ctx.lineWidth = 6 * sc; ctx.shadowBlur = 15; ctx.shadowColor = '#00ffff'; 
        ctx.beginPath(); let shieldAngle = isPlayer ? Math.atan2(moveDir.y, moveDir.x) : 0; 
        ctx.arc(x, y, 40 * sc, shieldAngle - 1.2, shieldAngle + 1.2); ctx.stroke(); ctx.restore(); 
    }

    if (score >= 15 || actWpn !== 'sword') {
        let weaponAngle = isPlayer ? Math.atan2(moveDir.y, moveDir.x) + 0.5 : 0.5; 
        let handX = x + wpnX * sc, handY = y + wpnY * sc; 
        
        if (actWpn === 'sword' && score >= 15) { e.isPiercing = isPlayer ? (typeof weaponPath !== 'undefined' ? weaponPath === 'piercing' : false) : false; drawSwordModel(e, handX, handY, weaponAngle, sc, swordTier || 1); } 
        else if (actWpn.includes('bow') || actWpn === 'crossbow' || actWpn === 'shotgun') { drawBowModel(handX, handY, weaponAngle, sc); } 
        else if (actWpn.includes('knife') || actWpn === 'cleaver') { drawKnifeModel(handX, handY, weaponAngle, sc); } 
        else if (actWpn.includes('shuriken') || actWpn === 'chakram' || actWpn === 'explosive_kunai') { drawShurikenModel(handX, handY, weaponAngle, sc); }
        
        if (isPlayer && typeof gameState !== 'undefined' && gameState === 'PLAYING') { 
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.4)'; ctx.lineWidth = 2; ctx.beginPath(); 
            ctx.moveTo(x + moveDir.x * 45, y + moveDir.y * 45); ctx.lineTo(x + moveDir.x * 75, y + moveDir.y * 75); ctx.stroke(); 
        }
    }

    if (inv.bow > 0 || inv.golden_bow || inv.diamond_bow || inv.crossbow || inv.shotgun) { ctx.save(); ctx.translate(x - 5 * sc, y + 2 * sc); ctx.rotate(-Math.PI / 6); ctx.fillStyle = '#4a235a'; ctx.fillRect(-5 * sc, -12 * sc, 10 * sc, 24 * sc); ctx.fillStyle = '#bdc3c7'; ctx.fillRect(-3 * sc, -18 * sc, 2 * sc, 6 * sc); ctx.fillRect(1 * sc, -16 * sc, 2 * sc, 4 * sc); ctx.fillStyle = '#e74c3c'; ctx.fillRect(-4 * sc, -20 * sc, 4 * sc, 2 * sc); ctx.fillRect(0 * sc, -18 * sc, 4 * sc, 2 * sc); if (!actWpn.includes('bow') && actWpn !== 'crossbow' && actWpn !== 'shotgun') { ctx.strokeStyle = '#8e44ad'; ctx.lineWidth = 3 * sc; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, 16 * sc, -Math.PI/2, Math.PI/2); ctx.stroke(); ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1 * sc; ctx.beginPath(); ctx.moveTo(0, -16 * sc); ctx.lineTo(0, 16 * sc); ctx.stroke(); } ctx.restore(); }
    if ((inv.knife || inv.golden_knife || inv.diamond_knife || inv.hunting_knife || inv.cleaver) && !actWpn.includes('knife') && actWpn !== 'cleaver') { ctx.save(); ctx.translate(x + 12 * sc, y + 14 * sc); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#bdc3c7'; ctx.beginPath(); ctx.moveTo(0, -2*sc); ctx.lineTo(14*sc, 0); ctx.lineTo(0, 2*sc); ctx.fill(); ctx.fillStyle = '#2c3e50'; ctx.fillRect(-4*sc, -2*sc, 4*sc, 4*sc); ctx.restore(); }
    if ((inv.shuriken || inv.golden_shuriken || inv.diamond_shuriken || inv.chakram || inv.explosive_kunai) && !actWpn.includes('shuriken') && actWpn !== 'chakram' && actWpn !== 'explosive_kunai') { ctx.save(); ctx.translate(x - 10 * sc, y + 18 * sc); ctx.fillStyle = '#34495e'; for(let i=0; i<4; i++) { ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(3.5*sc, -1.5*sc); ctx.lineTo(7*sc, 0); ctx.lineTo(3.5*sc, 1.5*sc); ctx.fill(); ctx.rotate(Math.PI/2); } ctx.fillStyle = '#bdc3c7'; ctx.beginPath(); ctx.arc(0,0, 1.5*sc, 0, Math.PI*2); ctx.fill(); ctx.restore(); }
    
    // --- UI ZNACZNIK IMIENIA I WYNIKU (Elegancka Kapsułka z oznaczeniem drużyny) ---
    let displayScore = Math.floor(score); 
    let prefix = e.team ? `[${e.team}] ` : '';
    let labelText = (e.name !== 'Wojownik' && e.name !== 'Dron Obrony') ? `${prefix}${e.name || "Bot"} [${displayScore}]` : `${prefix}[${displayScore}]`;
    
    ctx.font = `bold ${13 * sc}px Arial`;
    let textWidth = ctx.measureText(labelText).width;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    fillRoundRect(ctx, x - (textWidth/2) - 8*sc, y - 72*sc, textWidth + 16*sc, 18*sc, 8*sc);

    ctx.fillStyle = '#fff';
    if (kingId === eId) ctx.fillStyle = '#f1c40f'; 
    
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(labelText, x, y - 63 * sc); 
    
    ctx.restore();
}

window.wrapText = function(context, text, x, y, maxWidth, lineHeight) {
    if (!text) return;
    let words = text.split(' '); let line = '';
    for(let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' '; let metrics = context.measureText(testLine); let testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) { context.fillText(line, x, y); line = words[n] + ' '; y += lineHeight; } 
        else { line = testLine; }
    }
    context.fillText(line, x, y);
};

function resize() {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    globalScale = Math.min(1, window.innerHeight / 900);
}
window.onresize = resize; resize();
