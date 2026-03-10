// --- LOGIKA SKLEPU (shop.js) ---

// NOWOŚĆ: Definicja ścieżek ulepszeń i nazw wyświetlanych
const upgradePaths = {
    // Drzewko Łuku
    'bow': { next: 'golden_bow', name: 'Złoty Łuk', price: 250 },
    'golden_bow': { next: 'diamond_bow', name: 'Diamentowy Łuk', price: 500 },
    'diamond_bow': { next: 'crossbow', name: 'Kusza', price: 1000 },
    'crossbow': { next: 'shotgun', name: 'Strzelba', price: 2000 },
    'shotgun': { next: null, name: 'MAX', price: '---' },

    // Drzewko Noża
    'knife': { next: 'golden_knife', name: 'Złoty Nóż', price: 150 },
    'golden_knife': { next: 'diamond_knife', name: 'Diamentowy Nóż', price: 350 },
    'diamond_knife': { next: 'hunting_knife', name: 'Nóż Myśliwski', price: 700 },
    'hunting_knife': { next: 'cleaver', name: 'Tasak', price: 1200 },
    'cleaver': { next: null, name: 'MAX', price: '---' },

    // Drzewko Shurikena
    'shuriken': { next: 'golden_shuriken', name: 'Złoty Shuriken', price: 80 },
    'golden_shuriken': { next: 'diamond_shuriken', name: 'Diamentowy Shuriken', price: 200 },
    'diamond_shuriken': { next: 'chakram', name: 'Czakram', price: 500 },
    'chakram': { next: 'explosive_kunai', name: 'Wybuchowe Kunai', price: 1000 },
    'explosive_kunai': { next: null, name: 'MAX', price: '---' }
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

    // --- NOWOŚĆ: Dynamiczna aktualizacja interfejsu sklepu ---
    const upgradeInfo = upgradePaths[data.item];
    if (upgradeInfo && upgradeInfo.next) {
        // Szukamy przycisku, który właśnie kliknęliśmy
        const btn = document.querySelector(`button[onclick="buyItem('${data.item}')"]`);
        if (btn) {
            // Zmieniamy akcję na następny poziom
            btn.setAttribute('onclick', `buyItem('${upgradeInfo.next}')`);
            // Aktualizujemy tekst przycisku
            btn.innerHTML = `${upgradeInfo.name} ($${upgradeInfo.price})`;
        }
    } else if (upgradeInfo && upgradeInfo.next === null) {
        // Jeśli osiągnięto MAX poziom
        const btn = document.querySelector(`button[onclick="buyItem('${data.item}')"]`);
        if (btn) {
            btn.setAttribute('onclick', `return false;`);
            btn.innerHTML = `MAX POZIOM`;
            btn.disabled = true; 
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
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
