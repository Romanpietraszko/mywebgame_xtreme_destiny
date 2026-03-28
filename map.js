// --- KONFIGURACJA ŚRODOWISKA ---
const safeZones = []; // Usunięto sztywne pozycje, tablica jest wypełniana dynamicznie przez initMap!
const mapData = { trees: [], roads: [] };

function initMap(worldSize, mapType = 'default') {
    // Czyścimy mapę przed startem (ważne przy zmianie trybów gry z Menu)
    mapData.roads.length = 0;
    mapData.trees.length = 0;
    safeZones.length = 0;

    if (mapType === 'campaign_1') {
        // ==========================================
        // MAPA FABULARNA: "Szepczący Las" (Akt 1)
        // ==========================================
        safeZones.push({ x: 2000, y: 3800, radius: 250 }); // Baza Midasa (Respawn) na południu

        // Jedna główna droga przecinająca mapę z dołu na północ (Trakt Fabularny)
        mapData.roads.push({ x: worldSize / 2 - 120, y: 200, width: 240, height: worldSize - 200 });
    } else {
        // ==========================================
        // MAPA MULTIPLAYER (Free / PvP)
        // ==========================================
        safeZones.push({ x: 1000, y: 1000, radius: 250 });
        safeZones.push({ x: 3000, y: 3000, radius: 250 });

        // Generujemy przecinające się drogi
        mapData.roads.push({ x: worldSize / 2 - 120, y: 0, width: 240, height: worldSize });
        mapData.roads.push({ x: 0, y: worldSize / 2 - 120, width: worldSize, height: 240 });
    }

    // Proceduralne generowanie drzew
    // W kampanii sadzimy więcej drzew (450), bo chcemy zrobić ciasny las
    const NUM_TREES = mapType === 'campaign_1' ? 450 : 350; 
    
    for (let i = 0; i < NUM_TREES; i++) {
        const r = 35 + Math.random() * 40; 
        let tx, ty, invalidPos;
        do {
            invalidPos = false;
            tx = Math.random() * worldSize;
            ty = Math.random() * worldSize;

            // --- REŻYSERIA MAPY KAMPANII ---
            if (mapType === 'campaign_1') {
                // 1. Robimy wielką "Polanę Bossa" w centrum (brak drzew)
                if (tx > 1300 && tx < 2700 && ty > 1300 && ty < 2700) invalidPos = true;
                // 2. Czysty teren wokół bazy startowej (żeby gracz nie zaciął się w drzewach)
                if (Math.hypot(tx - 2000, ty - 3800) < 500) invalidPos = true; 
            }

            // Drzewa nie mogą rosnąć na drogach
            if (!invalidPos) {
                for(let road of mapData.roads) {
                    if (tx > road.x - r && tx < road.x + road.width + r &&
                        ty > road.y - r && ty < road.y + road.height + r) {
                        invalidPos = true; break;
                    }
                }
            }
        } while(invalidPos);
        
        // --- Generowanie "puszystej" korony (clusters) ---
        let clusters = [];
        let numClusters = 4 + Math.floor(Math.random() * 4); // 4 do 7 dodatkowych "bąbli" liści
        for (let j = 0; j < numClusters; j++) {
            let angle = (Math.PI * 2 / numClusters) * j + (Math.random() * 0.5);
            let dist = r * (0.3 + Math.random() * 0.3); // Odsunięcie od centrum
            clusters.push({
                x: Math.cos(angle) * dist,
                y: Math.sin(angle) * dist,
                r: r * (0.5 + Math.random() * 0.3) // Promień bąbla
            });
        }

        mapData.trees.push({
            x: tx, y: ty, radius: r,
            color: Math.random() > 0.5 ? '#1e4620' : '#2d6a31',         // Ciemniejsza zieleń bazy
            brightColor: Math.random() > 0.5 ? '#3ed05b' : '#2ecc71',   // Jaśniejsza zieleń (oświetlona)
            clusters: clusters
        });
    }
}

// --- RYSOWANIE GRAFIKI MAPY ---
function drawForestMap(ctx, camera, canvasWidth, canvasHeight) {
    // ==========================================
    // NOWOŚĆ: SYSTEM BIOMÓW I CZASU (DZIEŃ/NOC)
    // ==========================================
    
    // Bezpieczne pobranie eventu (żeby nie wywaliło błędu w Kampanii)
    let eventName = typeof currentEvent !== 'undefined' ? currentEvent : null;
    let isWinter = eventName === 'BLIZZARD';
    let isToxic = eventName === 'TOXIC_RAIN';

    // Obliczanie czasu lokalnego (Pora dnia)
    let currentHour = new Date().getHours();
    let timeOverlay = 'transparent';
    if (currentHour >= 18 && currentHour < 20) {
        timeOverlay = 'rgba(211, 84, 0, 0.15)'; // Ciepły, pomarańczowy wieczór
    } else if (currentHour >= 20 || currentHour < 7) {
        timeOverlay = 'rgba(10, 17, 40, 0.45)'; // Głęboka, chłodna noc
    }

    // Dynamiczna trawa zależna od pogody
    let grassColor = '#264a18'; // Domyślna trawa
    if (isWinter) grassColor = '#dbe4e9'; // Śnieg
    else if (isToxic) grassColor = '#2d2720'; // Uschnięta ziemia bagienna

    ctx.fillStyle = grassColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Subtelna siatka z tła
    ctx.strokeStyle = isWinter ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 2;
    const TILE_SIZE = 100;
    const offsetX = -camera.x % TILE_SIZE;
    const offsetY = -camera.y % TILE_SIZE;

    ctx.beginPath();
    for(let x = offsetX - TILE_SIZE; x < canvasWidth; x += TILE_SIZE) {
        ctx.moveTo(x, 0); ctx.lineTo(x, canvasHeight);
    }
    for(let y = offsetY - TILE_SIZE; y < canvasHeight; y += TILE_SIZE) {
        ctx.moveTo(0, y); ctx.lineTo(canvasWidth, y);
    }
    ctx.stroke();

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Dynamiczne Drogi
    let roadColor = '#6d4c41';
    let roadBorder = '#3e2723';
    if (isWinter) { roadColor = '#bdc3c7'; roadBorder = '#7f8c8d'; }
    else if (isToxic) { roadColor = '#3e2723'; roadBorder = '#1a1110'; }

    ctx.fillStyle = roadColor; 
    ctx.strokeStyle = roadBorder;
    ctx.lineWidth = 10;
    for(let road of mapData.roads) {
        ctx.fillRect(road.x, road.y, road.width, road.height);
        ctx.strokeRect(road.x, road.y, road.width, road.height);
    }

    // Sortujemy drzewa po osi Y, żeby te niżej przysłaniały te wyżej (efekt 3D)
    let visibleTrees = mapData.trees.filter(tree => {
        return !(tree.x + tree.radius * 1.5 < camera.x || tree.x - tree.radius * 1.5 > camera.x + canvasWidth ||
                 tree.y + tree.radius * 1.5 < camera.y || tree.y - tree.radius * 1.5 > camera.y + canvasHeight);
    });
    visibleTrees.sort((a, b) => a.y - b.y);

    for(let tree of visibleTrees) {
        // --- DYNAMICZNE KOLORY DRZEW ---
        let tTrunk1 = '#3e2723'; let tTrunk2 = '#4e342e';
        let tMainColor = tree.color;
        let tBrightColor = tree.brightColor;
        let tShadowEdge = '#0d210f';

        if (isWinter) {
            tTrunk1 = '#7f8c8d'; tTrunk2 = '#95a5a6'; // Oszroniony pień
            tMainColor = '#bdc3c7'; tBrightColor = '#ffffff'; tShadowEdge = '#7f8c8d'; // Zamarznięte liście
        } else if (isToxic) {
            tTrunk1 = '#2c1f1c'; tTrunk2 = '#3e2c28'; // Gnijący pień
            tMainColor = '#5c5316'; tBrightColor = '#8c8021'; tShadowEdge = '#1a1804'; // Uschnięte, toksyczne liście
        }

        // 1. RYSOWANIE PNIA
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = tTrunk1;
        ctx.fillRect(tree.x - 8, tree.y + tree.radius - 20, 16, 35);
        ctx.fillStyle = tTrunk2; 
        ctx.fillRect(tree.x - 8, tree.y + tree.radius - 20, 6, 35);

        // 2. RYSOWANIE KORONY Z POTĘŻNYM CIENIEM
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'; 
        ctx.shadowBlur = 18;
        ctx.shadowOffsetX = 12; 
        ctx.shadowOffsetY = 12; 

        // Gradient promienisty tworzący efekt wypukłej korony
        let grad = ctx.createRadialGradient(
            tree.x - tree.radius * 0.35, tree.y - tree.radius * 0.35, tree.radius * 0.1, 
            tree.x, tree.y, tree.radius * 1.2
        );
        grad.addColorStop(0, tBrightColor); 
        grad.addColorStop(0.5, tMainColor);
        grad.addColorStop(1, tShadowEdge); 

        ctx.fillStyle = grad;
        
        ctx.beginPath();
        // Środek drzewa
        ctx.arc(tree.x, tree.y, tree.radius, 0, Math.PI * 2);
        
        // Puszyste "bąble" dookoła korony
        if (tree.clusters) {
            for (let c of tree.clusters) {
                ctx.moveTo(tree.x + c.x + c.r, tree.y + c.y); 
                ctx.arc(tree.x + c.x, tree.y + c.y, c.r, 0, Math.PI * 2);
            }
        }
        ctx.fill(); 
        ctx.closePath();

        // 3. RYSOWANIE POŁYSKU (dodaje głębi)
        ctx.shadowColor = 'transparent'; 
        ctx.beginPath();
        ctx.arc(tree.x - tree.radius * 0.25, tree.y - tree.radius * 0.25, tree.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'; 
        ctx.fill();
        ctx.closePath();
    }
    ctx.restore();

    // 4. NAKŁADANIE FILTRU PORY DNIA (TYLKO NA MAPĘ)
    if (timeOverlay !== 'transparent') {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Resetujemy transformację do ekranu kamery
        ctx.fillStyle = timeOverlay;
        ctx.fillRect(0, 0, canvasWidth * globalScale, canvasHeight * globalScale); // Malujemy cały ekran cieniem
        ctx.restore();
    }
}

function drawCastle(ctx, z) {
    ctx.save();
    ctx.translate(z.x, z.y);
    
    // Dodajemy głęboki cień pod całą bazą zamku!
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 25;
    ctx.shadowOffsetX = 8;
    ctx.shadowOffsetY = 8;

    ctx.fillStyle = 'rgba(189, 195, 199, 0.4)';
    ctx.beginPath(); ctx.arc(0, 0, z.radius, 0, Math.PI * 2); ctx.fill();

    // Wyłączamy cieniowanie, żeby detale i zarys się nie rozmyły
    ctx.shadowColor = 'transparent'; 

    ctx.strokeStyle = '#7f8c8d';
    ctx.lineWidth = 15;
    ctx.beginPath(); ctx.arc(0, 0, z.radius, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = '#95a5a6';
    const blenkiCount = 16;
    for(let i = 0; i < blenkiCount; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 / blenkiCount) * i);
        ctx.fillRect(z.radius - 12, -15, 24, 30);
        ctx.restore();
    }

    ctx.fillStyle = '#2c3e50';
    ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c0392b'; 
    ctx.beginPath(); ctx.arc(0, 0, 45, 0, Math.PI * 2); ctx.fill();
    
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 0);

    ctx.restore();
}
