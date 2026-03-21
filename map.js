// --- KONFIGURACJA ŚRODOWISKA ---
const safeZones = [
    { x: 1000, y: 1000, radius: 250 },
    { x: 3000, y: 3000, radius: 250 }
];

const mapData = { trees: [], roads: [] };

function initMap(worldSize) {
    // Generujemy przecinające się drogi
    mapData.roads.push({ x: worldSize / 2 - 120, y: 0, width: 240, height: worldSize });
    mapData.roads.push({ x: 0, y: worldSize / 2 - 120, width: worldSize, height: 240 });

    // Proceduralne generowanie drzew
    const NUM_TREES = 350; 
    for (let i = 0; i < NUM_TREES; i++) {
        const r = 35 + Math.random() * 40; 
        let tx, ty, onRoad;
        do {
            onRoad = false;
            tx = Math.random() * worldSize;
            ty = Math.random() * worldSize;
            for(let road of mapData.roads) {
                if (tx > road.x - r && tx < road.x + road.width + r &&
                    ty > road.y - r && ty < road.y + road.height + r) {
                    onRoad = true; break;
                }
            }
        } while(onRoad);
        
        // --- NOWOŚĆ: Generowanie "puszystej" korony (clusters) ---
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
    ctx.fillStyle = '#264a18';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Subtelna siatka z tła
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
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

    // Drogi
    ctx.fillStyle = '#6d4c41'; 
    ctx.strokeStyle = '#3e2723';
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
        // 1. RYSOWANIE PNIA (bez cienia, za to z połówkowym światłocieniem)
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#3e2723'; // Ciemny brąz
        ctx.fillRect(tree.x - 8, tree.y + tree.radius - 20, 16, 35);
        ctx.fillStyle = '#4e342e'; // Jasny brąz od strony słońca
        ctx.fillRect(tree.x - 8, tree.y + tree.radius - 20, 6, 35);

        // 2. RYSOWANIE KORONY Z POTĘŻNYM CIENIEM
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'; // Grubszy cień
        ctx.shadowBlur = 18;
        ctx.shadowOffsetX = 12; // Cień rzucany w prawo
        ctx.shadowOffsetY = 12; // Cień rzucany w dół

        // Gradient promienisty tworzący efekt wypukłej, oświetlonej korony
        let grad = ctx.createRadialGradient(
            tree.x - tree.radius * 0.35, tree.y - tree.radius * 0.35, tree.radius * 0.1, // Źródło światła
            tree.x, tree.y, tree.radius * 1.2
        );
        grad.addColorStop(0, tree.brightColor || '#4caf50'); 
        grad.addColorStop(0.5, tree.color);
        grad.addColorStop(1, '#0d210f'); // Głęboka zieleń na krawędziach

        ctx.fillStyle = grad;
        
        ctx.beginPath();
        // Środek drzewa
        ctx.arc(tree.x, tree.y, tree.radius, 0, Math.PI * 2);
        
        // Puszyste "bąble" dookoła korony
        if (tree.clusters) {
            for (let c of tree.clusters) {
                ctx.moveTo(tree.x + c.x + c.r, tree.y + c.y); // Wyzerowanie ścieżki (zapobiega paskom)
                ctx.arc(tree.x + c.x, tree.y + c.y, c.r, 0, Math.PI * 2);
            }
        }
        ctx.fill(); // Rysuje i zlewa kółka w JEDEN kształt rzucający JEDEN wspólny cień!
        ctx.closePath();

        // 3. RYSOWANIE POŁYSKU (dodaje głębi)
        ctx.shadowColor = 'transparent'; 
        ctx.beginPath();
        ctx.arc(tree.x - tree.radius * 0.25, tree.y - tree.radius * 0.25, tree.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'; // Delikatny blask
        ctx.fill();
        ctx.closePath();
    }
    ctx.restore();
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
