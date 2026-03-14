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
        
        mapData.trees.push({
            x: tx, y: ty, radius: r,
            color: Math.random() > 0.5 ? '#1e4620' : '#2d6a31' 
        });
    }
}

// --- RYSOWANIE GRAFIKI MAPY ---
function drawForestMap(ctx, camera, canvasWidth, canvasHeight) {
    ctx.fillStyle = '#264a18';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

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

    ctx.fillStyle = '#6d4c41'; 
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 10;
    for(let road of mapData.roads) {
        ctx.fillRect(road.x, road.y, road.width, road.height);
        ctx.strokeRect(road.x, road.y, road.width, road.height);
    }

    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 8;
    ctx.shadowOffsetY = 8;

    for(let tree of mapData.trees) {
        if (tree.x + tree.radius < camera.x || tree.x - tree.radius > camera.x + canvasWidth ||
            tree.y + tree.radius < camera.y || tree.y - tree.radius > camera.y + canvasHeight) {
            continue;
        }

        ctx.fillStyle = '#3e2723';
        ctx.fillRect(tree.x - 8, tree.y + tree.radius - 20, 16, 35);

        ctx.beginPath();
        ctx.arc(tree.x, tree.y, tree.radius, 0, Math.PI * 2);
        ctx.fillStyle = tree.color;
        ctx.fill();
        ctx.closePath();

        ctx.save();
        ctx.shadowColor = 'transparent'; 
        ctx.beginPath();
        ctx.arc(tree.x - tree.radius * 0.2, tree.y - tree.radius * 0.2, tree.radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fill();
        ctx.closePath();
        ctx.restore();
    }
    ctx.restore();
}

function drawCastle(ctx, z) {
    ctx.save();
    ctx.translate(z.x, z.y);
    
    ctx.fillStyle = 'rgba(189, 195, 199, 0.4)';
    ctx.beginPath(); ctx.arc(0, 0, z.radius, 0, Math.PI * 2); ctx.fill();

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
