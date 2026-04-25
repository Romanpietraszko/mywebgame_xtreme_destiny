// ==========================================
// SERVER.JS - Wzorzec Strategii (Czysty Serwer Sieciowy)
// ==========================================

const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- ROUTING (Z Wirtualnym Prefiksem dla Assetów) ---
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/assety', express.static(path.join(__dirname, '../assety')));
app.use('/automatyzacja', express.static(path.join(__dirname, '../automatyzacja')));

// Gdy ktoś wchodzi na stronę główną, odsyłamy szkielet gry
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// --- ŁADOWANIE TRYBÓW GRY ---
const FreeMode = require('./modes/FreeMode');
// W przyszłości dodasz tu: const TeamMode = require('./modes/TeamMode');
// W przyszłości dodasz tu: const CampaignMode = require('./modes/CampaignMode');

// Inicjalizacja domyślnego trybu (Przekazujemy mu obiekt 'io', żeby mógł wysyłać pakiety)
let currentGame = new FreeMode(io);

// --- OBSŁUGA POŁĄCZEŃ (Gniazda przekazują rozkazy do Klasy Trybu) ---
io.on('connection', (socket) => {
    console.log(`[SOCKET] Nowy gracz: ${socket.id}`);
    
    // Delegujemy całą obsługę wejścia/ruchu/ataków do aktywnego trybu
    currentGame.handleConnection(socket);
});

// --- GŁÓWNA PĘTLA SERWERA (30 FPS) ---
// Co 33 milisekundy serwer wywołuje funkcję update() z aktywnego trybu
setInterval(() => {
    currentGame.update();
}, 33);

// --- START SERWERA ---
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` SERWER XD DZIAŁA W ARCHITEKTURZE KLASOWEJ `);
    console.log(` Port: ${PORT} | Aktywny Tryb: ${currentGame.modeName} `);
    console.log(`=========================================`);
});