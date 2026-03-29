// ==========================================
// ENGINE.JS - Silnik graficzny i narzędzia
// ==========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const WORLD_SIZE = 4000;
const camera = { x: 0, y: 0 };
const keys = {};

// --- NOWOŚĆ: ŁADOWANIE TWOICH AUTORSKICH POSTACI I ASYSTENTA ---
const skins = {
    standard: new Image(),
    ninja: new Image(),
    arystokrata: new Image(),
    midas: new Image()
};
// Dokładne nazwy plików z Figmy:
skins.standard.src = 'xtreme-destiny-postac.png'; 
skins.ninja.src = 'ninja-transparent.png';
skins.arystokrata.src = 'postac-bez-tla.png';
skins.midas.src = 'xtreme-destiny-midas.png';

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

// ==========================================
// NOWOŚĆ: DYNAMICZNY PANCERZ (PUKLERZ I NARAMIENNIKI)
// ==========================================
function drawDynamicArmor(e, x, y, sc, tier) {
    if (tier === 0) return; // Zwykły patyczak, brak masy
    
    ctx.save();
    ctx.translate(x, y);
    
    // Bazowe kolory zależne od wybranego skina
    let skinType = e.skin || 'standard';
    let baseColor = '#bdc3c7'; // Srebrny (Standard)
    let trimColor = '#7f8c8d'; // Ciemnosrebrny
    let gemColor = null;

    if (skinType === 'ninja') {
        baseColor = '#2c3e50'; // Czarny/Granat
        trimColor = '#e74c3c'; // Czerwony pasek
    } else if (skinType === 'arystokrata') {
        baseColor = '#f1c40f'; // Złoty
        trimColor = '#e67e22'; // Pomarańczowy/Miedziany
        gemColor = '#8e44ad';  // Fioletowy rubin
    }

    // TIER 1 (Masa 100+): PUKLERZ NA LEWYM RAMIENIU
    if (tier >= 1) {
        ctx.save();
        ctx.translate(-25 * sc, 5 * sc); // Ustawienie na lewym ramieniu
        ctx.rotate(-Math.PI / 8);        // Lekkie przechylenie

        if (skinType === 'ninja') {
            // Karwasz Ninji
            ctx.fillStyle = baseColor;
            ctx.beginPath(); ctx.moveTo(-6*sc, -12*sc); ctx.lineTo(6*sc, -12*sc); ctx.lineTo(10*sc, 15*sc); ctx.lineTo(0, 22*sc); ctx.lineTo(-10*sc, 15*sc); ctx.fill();
            ctx.strokeStyle = trimColor; ctx.lineWidth = 2*sc; ctx.stroke();
        } else {
            // Klasyczny lub Złoty Puklerz
            ctx.fillStyle = baseColor;
            ctx.beginPath(); ctx.arc(0, 0, 14 * sc, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = trimColor; ctx.lineWidth = 3 * sc; ctx.stroke();
            
            if (gemColor) { // Szmaragd/Rubin dla Arystokraty
                ctx.fillStyle = gemColor;
                ctx.beginPath(); ctx.arc(0, 0, 5 * sc, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
            } else { // Metalowy nit dla Standardu
                ctx.fillStyle = '#ecf0f1';
                ctx.beginPath(); ctx.arc(0, 0, 4 * sc, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.restore();
    }

    // TIER 2 (Masa 300+): POTĘŻNE NARAMIENNIKI
    if (tier >= 2) {
        ctx.fillStyle = baseColor;
        ctx.strokeStyle = trimColor;
        ctx.lineWidth = 2 * sc;

        // Lewy Naramiennik
        ctx.beginPath(); ctx.ellipse(-28 * sc, -15 * sc, 12 * sc, 18 * sc, Math.PI / 4, 0, Math.PI); ctx.fill(); ctx.stroke();
        // Prawy Naramiennik
        ctx.beginPath(); ctx.ellipse(28 * sc, -15 * sc, 12 * sc, 18 * sc, -Math.PI / 4, 0, Math.PI); ctx.fill(); ctx.stroke();
    }

    // TIER 3 (Masa 600+): KORONA ENERGII / AURA WETERANA
    if (tier >= 3) {
        let auraTime = Date.now() / 200;
        let floatY = Math.sin(auraTime) * 5 * sc;
        
        ctx.save();
        ctx.translate(0, -45 * sc + floatY); // Unosi się nad głową
        
        if (skinType === 'ninja') {
            // Mroczna Aura Ninji
            ctx.fillStyle = '#e74c3c';
            ctx.shadowColor = '#c0392b'; ctx.shadowBlur = 15;
            ctx.beginPath(); ctx.moveTo(0, -15*sc); ctx.lineTo(10*sc, 5*sc); ctx.lineTo(-10*sc, 5*sc); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0, 10*sc); ctx.lineTo(5*sc, 20*sc); ctx.lineTo(-5*sc, 20*sc); ctx.fill();
        } else {
            // Diadem Wojownika / Złota Korona
            let crownColor = skinType === 'arystokrata' ? '#f1c40f' : '#ecf0f1';
            ctx.fillStyle = crownColor;
            ctx.shadowColor = crownColor; ctx.shadowBlur = 20;
            ctx.beginPath(); 
            ctx.moveTo(-20*sc, 0); ctx.lineTo(-15*sc, -20*sc); ctx.lineTo(-7*sc, -5*sc); 
            ctx.lineTo(0, -25*sc); ctx.lineTo(7*sc, -5*sc); ctx.lineTo(15*sc, -20*sc); 
            ctx.lineTo(20*sc, 0); ctx.fill();
        }
        ctx.restore();
    }

    ctx.restore();
}

function drawStickman(e, x, y, sc, safe, kingId) {
    if (safe) return; 

    ctx.save(); 

    // BLOB SHADOW
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; 
    ctx.beginPath();
    ctx.ellipse(x + 5 * sc, y + 25 * sc, 20 * sc, 8 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // AURA
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

    // BEZPIECZNA INICJALIZACJA (Tarcza Anty-Crashowa)
    const isPlayer = (typeof player !== 'undefined' && e === player);
    const score = e.score || 0; 
    const skills = e.skills || (isPlayer && typeof playerSkills !== 'undefined' ? playerSkills : { speed: 0, strength: 0, weapon: 0 }); 
    const inv = e.inventory || { bow: 0, knife: 0, shuriken: 0 }; 
    const actWpn = e.activeWeapon || 'sword';
    const moveDir = (typeof lastMoveDir !== 'undefined') ? lastMoveDir : {x: 1, y: 0};

    // Obliczamy Tier Ekwipunku na podstawie MASY (100, 300, 600)
    const equipmentTier = getTier(score, [100, 300, 600]); 
    const swordTier = getTier(score, [15, 300, 700]); 
    const shieldTier = getTier(score, [50, 150, 300]); 
    const bootTier = getTier(skills.speed, [3, 6, 9]);

    let isHuman = isPlayer || (e.id && e.name && !e.name.toLowerCase().includes('bot') && e.name !== 'Wojownik');

    let wpnX = isHuman ? 28 : 18;
    let wpnY = isHuman ? 18 : 10;
    let shldX = isHuman ? 28 : 20;
    let shldY = isHuman ? 18 : -6;

    if (!isHuman) {
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

        if (score >= 200) { 
            const legTier = getTier(score, [200, 500, 900]); 
            ctx.strokeStyle = legTier === 3 ? '#f1c40f' : (legTier === 2 ? '#3498db' : '#95a5a6'); 
            ctx.lineWidth = 8 * sc; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(x - 5 * sc, y + 16 * sc); ctx.lineTo(x - 11 * sc, y + 27 * sc); 
            ctx.moveTo(x + 5 * sc, y + 16 * sc); ctx.lineTo(x + 11 * sc, y + 27 * sc); 
            ctx.stroke(); 
        }

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
        if (score >= 350) {
            ctx.fillStyle = bootTier === 3 ? '#f1c40f' : (bootTier === 2 ? '#e74c3c' : '#34495e'); 
            ctx.beginPath(); ctx.arc(x - wpnX * sc, y + wpnY * sc, 7 * sc, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + wpnX * sc, y + wpnY * sc, 7 * sc, 0, Math.PI * 2); ctx.fill();
        }
    }

    let eId = e.id || e.name || 'unknown'; 
    if (!visualStates[eId]) visualStates[eId] = { lastScore: score, eatTimer: 0 };
    if (score > visualStates[eId].lastScore) { visualStates[eId].eatTimer = 15; visualStates[eId].lastScore = score; } 
    if (score < visualStates[eId].lastScore) { visualStates[eId].lastScore = score; } 
    if (visualStates[eId].eatTimer > 0) visualStates[eId].eatTimer--;

    ctx.save();
    
    if (isHuman) {
        const spriteSize = 60 * sc; 
        let timeOffset = Date.now() + e.x; 
        let breatheX = 1 + Math.sin(timeOffset / 150) * 0.03;
        let breatheY = 1 - Math.sin(timeOffset / 150) * 0.04;
        let wobble = Math.cos(timeOffset / 100) * 0.1;

        ctx.translate(x, y); 
        ctx.rotate(wobble);  
        ctx.scale(breatheX, breatheY); 
        
        let currentSkinImg = skins.standard;
        if (e.skin === 'ninja') currentSkinImg = skins.ninja;
        else if (e.skin === 'arystokrata') currentSkinImg = skins.arystokrata;
        
        ctx.drawImage(currentSkinImg, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
        
        // RYSOWANIE EPICKIEGO PANCERZA BEZPOŚREDNIO NA POSTACI HUMANA!
        drawDynamicArmor(e, 0, 0, sc, equipmentTier);

        if (visualStates[eId].eatTimer > 0) {
            ctx.rotate(-wobble); ctx.scale(1/breatheX, 1/breatheY);
            ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(25 * sc, -25 * sc, 18 * sc, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.stroke();
            ctx.font = `${22 * sc}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🤤', 25 * sc, -25 * sc);
        }
    } else {
        ctx.fillStyle = e.color || '#2ecc71';
        ctx.beginPath(); ctx.arc(x, y, 22 * sc, 0, Math.PI * 2); ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.ellipse(x - 7 * sc, y - 5 * sc, 3.5 * sc, 5.5 * sc, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + 7 * sc, y - 5 * sc, 3.5 * sc, 5.5 * sc, 0, 0, Math.PI * 2); ctx.fill();
        
        ctx.fillStyle = 'black';
        ctx.beginPath(); ctx.arc(x - 6.5 * sc, y - 4 * sc, 1.8 * sc, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 6.5 * sc, y - 4 * sc, 1.8 * sc, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1.5 * sc;
        ctx.lineCap = 'round';
        ctx.beginPath(); 
        ctx.moveTo(x - 11 * sc, y - 11 * sc); ctx.lineTo(x - 4 * sc, y - 8 * sc); 
        ctx.moveTo(x + 11 * sc, y - 11 * sc); ctx.lineTo(x + 4 * sc, y - 8 * sc); 
        ctx.stroke();

        // RYSOWANIE EPICKIEGO PANCERZA DLA BOTA (Jeśli ma dużo masy)
        if (equipmentTier > 0) {
            drawDynamicArmor(e, x, y, sc, equipmentTier);
        }

        if (visualStates[eId].eatTimer > 0) {
            ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(x + 25 * sc, y - 25 * sc, 18 * sc, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.stroke();
            ctx.font = `${22 * sc}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🤤', x + 25 * sc, y - 25 * sc);
        }
    }
    
    ctx.restore();

    if (e.isShielding) { 
        ctx.save(); ctx.strokeStyle = '#3498db'; ctx.lineWidth = 6 * sc; ctx.shadowBlur = 10; ctx.shadowColor = '#3498db'; ctx.beginPath(); 
        let shieldAngle = isPlayer ? Math.atan2(moveDir.y, moveDir.x) : 0; 
        ctx.arc(x, y, 40 * sc, shieldAngle - 0.9, shieldAngle + 0.9); ctx.stroke(); ctx.restore(); 
    }
    if (score >= 50) { 
        drawProShield(x - shldX * sc, y + shldY * sc, sc, shieldTier); 
    }

    if (score >= 15 || actWpn !== 'sword') {
        let weaponAngle = isPlayer ? Math.atan2(moveDir.y, moveDir.x) + 0.5 : 0.5; 
        let handX = x + wpnX * sc, handY = y + wpnY * sc; 
        
        if (actWpn === 'sword' && score >= 15) { 
            e.isPiercing = isPlayer ? (typeof weaponPath !== 'undefined' ? weaponPath === 'piercing' : false) : false; 
            drawSwordModel(e, handX, handY, weaponAngle, sc, swordTier || 1); 
        } 
        else if (actWpn.includes('bow') || actWpn === 'crossbow' || actWpn === 'shotgun') { drawBowModel(handX, handY, weaponAngle, sc); } 
        else if (actWpn.includes('knife') || actWpn === 'cleaver') { drawKnifeModel(handX, handY, weaponAngle, sc); } 
        else if (actWpn.includes('shuriken') || actWpn === 'chakram' || actWpn === 'explosive_kunai') { drawShurikenModel(handX, handY, weaponAngle, sc); }
        
        if (isPlayer && typeof gameState !== 'undefined' && gameState === 'PLAYING') { 
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.6)'; ctx.lineWidth = 2; ctx.beginPath(); 
            ctx.moveTo(x + moveDir.x * 45, y + moveDir.y * 45); 
            ctx.lineTo(x + moveDir.x * 75, y + moveDir.y * 75); ctx.stroke(); 
        }
    }

    if (inv.bow > 0 || inv.golden_bow || inv.diamond_bow || inv.crossbow || inv.shotgun) { ctx.save(); ctx.translate(x - 5 * sc, y + 2 * sc); ctx.rotate(-Math.PI / 6); ctx.fillStyle = '#4a235a'; ctx.fillRect(-5 * sc, -12 * sc, 10 * sc, 24 * sc); ctx.fillStyle = '#bdc3c7'; ctx.fillRect(-3 * sc, -18 * sc, 2 * sc, 6 * sc); ctx.fillRect(1 * sc, -16 * sc, 2 * sc, 4 * sc); ctx.fillStyle = '#e74c3c'; ctx.fillRect(-4 * sc, -20 * sc, 4 * sc, 2 * sc); ctx.fillRect(0 * sc, -18 * sc, 4 * sc, 2 * sc); if (!actWpn.includes('bow') && actWpn !== 'crossbow' && actWpn !== 'shotgun') { ctx.strokeStyle = '#8e44ad'; ctx.lineWidth = 3 * sc; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, 16 * sc, -Math.PI/2, Math.PI/2); ctx.stroke(); ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 1 * sc; ctx.beginPath(); ctx.moveTo(0, -16 * sc); ctx.lineTo(0, 16 * sc); ctx.stroke(); } ctx.restore(); }
    if ((inv.knife || inv.golden_knife || inv.diamond_knife || inv.hunting_knife || inv.cleaver) && !actWpn.includes('knife') && actWpn !== 'cleaver') { ctx.save(); ctx.translate(x + 12 * sc, y + 14 * sc); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#bdc3c7'; ctx.beginPath(); ctx.moveTo(0, -2*sc); ctx.lineTo(14*sc, 0); ctx.lineTo(0, 2*sc); ctx.fill(); ctx.fillStyle = '#2c3e50'; ctx.fillRect(-4*sc, -2*sc, 4*sc, 4*sc); ctx.restore(); }
    if ((inv.shuriken || inv.golden_shuriken || inv.diamond_shuriken || inv.chakram || inv.explosive_kunai) && !actWpn.includes('shuriken') && actWpn !== 'chakram' && actWpn !== 'explosive_kunai') { ctx.save(); ctx.translate(x - 10 * sc, y + 18 * sc); ctx.fillStyle = '#34495e'; for(let i=0; i<4; i++) { ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(3.5*sc, -1.5*sc); ctx.lineTo(7*sc, 0); ctx.lineTo(3.5*sc, 1.5*sc); ctx.fill(); ctx.rotate(Math.PI/2); } ctx.fillStyle = '#bdc3c7'; ctx.beginPath(); ctx.arc(0,0, 1.5*sc, 0, Math.PI*2); ctx.fill(); ctx.restore(); }
    
    // --- NOWOŚĆ: UCINANIE BRZYDKICH UŁAMKÓW PO PRZECINKU ---
    ctx.fillStyle = '#fff'; ctx.font = `bold ${13 * sc}px Arial`; ctx.textAlign = 'center';
    let displayScore = Math.floor(score); // Ta jedna linijka załatwia cały problem!
    if (e.name !== 'Wojownik') { ctx.fillText(`${e.name || "Bot"} [${displayScore}]`, x, y - 65 * sc); } else { ctx.fillText(`[${displayScore}]`, x, y - 65 * sc); } 
    
    ctx.restore();
}

// --- RYSOWANIE PRAWDZIWEGO ZAMKU (Zabezpieczone pod Map.js i Engine.js) ---
function drawCastle(x, y, radius) {
    // Tarcza przed konfliktem z plikiem map.js (który podaje ctx jako x)
    if (typeof x === 'object' && y && y.radius !== undefined) {
        radius = y.radius;
        let tempX = y.x;
        y = y.y;
        x = tempX;
    }

    ctx.save();
    ctx.translate(x, y);

    // 1. FOSA (Woda)
    ctx.beginPath();
    ctx.arc(0, 0, radius + 40, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(41, 128, 185, 0.4)'; // półprzezroczysta woda na trawie
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(52, 152, 219, 0.6)';
    ctx.stroke();

    // 2. DREWNIANY MOST (Od dołu wejście)
    ctx.fillStyle = '#5c4033'; 
    ctx.fillRect(-25, radius - 10, 50, 60);
    ctx.fillStyle = '#8b5a2b'; // deski
    for(let i=0; i<5; i++) {
        ctx.fillRect(-23, radius + i*10, 46, 6);
    }

    // 3. MURY (Zewnętrzny obwód)
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#7f8c8d';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#2c3e50';
    ctx.stroke();

    // 4. BLANKI (Zębatki na murach)
    ctx.fillStyle = '#95a5a6';
    for(let i = 0; i < 12; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 / 12) * i);
        ctx.fillRect(-15, -radius - 12, 30, 20);
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 3;
        ctx.strokeRect(-15, -radius - 12, 30, 20);
        ctx.restore();
    }

    // 5. WNĘTRZE ZAMKU (Ciemny środek imitujący dach / mrok wewnątrz)
    ctx.beginPath();
    ctx.arc(0, 0, radius - 15, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a'; // Bardzo ciemne wnętrze, bo jesteś pod dachem!
    ctx.fill();

    // 6. IKONA SKLEPU NA ŚRODKU (Wyśrodkowana bez napisu)
    ctx.fillStyle = '#f1c40f';
    ctx.font = `bold ${radius * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏰', 0, 0);

    ctx.restore();
}

// --- POMOCNICZA FUNKCJA DO ZAWIJANIA TEKSTU (TUTORIAL MIDASA) ---
window.wrapText = function(context, text, x, y, maxWidth, lineHeight) {
    if (!text) return;
    let words = text.split(' ');
    let line = '';
    for(let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        let metrics = context.measureText(testLine);
        let testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            context.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    context.fillText(line, x, y);
};

// Skalowanie płótna
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    globalScale = Math.min(1, window.innerHeight / 900);
}
window.onresize = resize;
resize();
