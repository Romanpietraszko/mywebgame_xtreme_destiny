// --- LOGIKA SKLEPU (shop.js) ---

// NOWOŚĆ: Definicja ścieżek ulepszeń, nazw wyświetlanych oraz ikonek dla UI
const upgradePaths = {
    // Drzewko Łuku
    'bow': { next: 'golden_bow', name: 'Złoty Łuk', price: 250, icon: '🏹' },
    'golden_bow': { next: 'diamond_bow', name: 'Diamentowy Łuk', price: 500, icon: '🏹' },
    'diamond_bow': { next: 'crossbow', name: 'Kusza', price: 1000, icon: '🏹' },
    'crossbow': { next: 'shotgun', name: 'Strzelba', price: 2000, icon: '🔫' },
    'shotgun': { next: null, name: 'MAX', price: '---', icon: '🔫' },

    // Drzewko Noża
    'knife': { next: 'golden_knife', name: 'Złoty Nóż', price: 150, icon: '🗡️' },
    'golden_knife': { next: 'diamond_knife', name: 'Diamentowy Nóż', price: 350, icon: '🗡️' },
    'diamond_knife': { next: 'hunting_knife', name: 'Nóż Myśliwski', price: 700, icon: '🗡️' },
    'hunting_knife': { next: 'cleaver', name: 'Tasak', price: 1200, icon: '🪓' },
    'cleaver': { next: null, name: 'MAX', price: '---', icon: '🪓' },

    // Drzewko Shurikena
    'shuriken': { next: 'golden_shuriken', name: 'Złoty Shuriken', price: 80, icon: '🥷' },
    'golden_shuriken': { next: 'diamond_shuriken', name: 'Diamentowy Shuriken', price: 200, icon: '🥷' },
    'diamond_shuriken': { next: 'chakram', name: 'Czakram', price: 500, icon: '🌀' },
    'chakram': { next: 'explosive_kunai', name: 'Wyb. Kunai', price: 1000, icon: '🧨' },
    'explosive_kunai': { next: null, name: 'MAX', price: '---', icon: '🧨' }
};

window.buyItem = (item) => {
    if (typeof socket !== 'undefined') {
        socket.emit('buyShopItem', item);
    }
};

// Obsługa udanego zakupu
socket.on('shopSuccess', (data) => {
    console.log(`Pomyślnie kupiono: ${data.item}`);
    
    // Wizualny efekt na przycisku (np. podświetlenie na zielono przez chwilę)
    const shopDiv = document.getElementById('castle-shop');
    if(shopDiv) {
        let originalBg = shopDiv.style.background || 'rgba(44, 62, 80, 0.95)';
        shopDiv.style.background = 'rgba(39, 174, 96, 0.95)'; // Zielony błysk
        setTimeout(() => {
            shopDiv.style.background = originalBg; // Powrót do oryginału
        }, 300);
    }

    // --- NOWOŚĆ: Dynamiczna aktualizacja interfejsu sklepu z zachowaniem stylów HTML ---
    const upgradeInfo = upgradePaths[data.item];
    if (upgradeInfo) {
        // Szukamy przycisku, który właśnie kliknęliśmy
        const btn = document.querySelector(`button[onclick="buyItem('${data.item}')"]`);
        if (btn) {
            if (upgradeInfo.next) {
                // Zmieniamy akcję na następny poziom
                btn.setAttribute('onclick', `buyItem('${upgradeInfo.next}')`);
                // Aktualizujemy tekst przycisku, zachowując dwa <span> dla ładnego formatowania
                btn.innerHTML = `<span>${upgradeInfo.icon} ${upgradeInfo.name}</span> <span>$${upgradeInfo.price}</span>`;
            } else {
                // Jeśli osiągnięto MAX poziom
                btn.setAttribute('onclick', `return false;`);
                btn.innerHTML = `<span>${upgradeInfo.icon} MAX POZIOM</span> <span>---</span>`;
                btn.disabled = true; 
                btn.style.opacity = "0.5";
                btn.style.cursor = "not-allowed";
            }
        }
    }
});

// Obsługa błędu zakupu (np. brak punktów lub oszustwo)
socket.on('shopError', (data) => {
    // Wizualny efekt błędu (podświetlenie na czerwono)
    const shopDiv = document.getElementById('castle-shop');
    if(shopDiv) {
        let originalBg = shopDiv.style.background || 'rgba(44, 62, 80, 0.95)';
        shopDiv.style.background = 'rgba(192, 57, 43, 0.95)'; // Czerwony błysk
        setTimeout(() => {
            shopDiv.style.background = originalBg;
        }, 300);
    }
    console.warn("Sklep:", data.message);
});
