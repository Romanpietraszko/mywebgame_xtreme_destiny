// ==========================================
// SHOP.JS - Logika Zbrojowni (Drzewka Ulepszeń Vibe Noir)
// ==========================================

console.log("🛒 [SHOP] Drzewka Ulepszeń Załadowane.");

// --- CSS DLA EFEKTÓW WIZUALNYCH PRZYCISKÓW ---
const style = document.createElement('style');
style.innerHTML = `
    @keyframes shakeError {
        0%, 100% { transform: translateX(0); border-color: #e74c3c; background: rgba(231, 76, 60, 0.2); }
        20%, 60% { transform: translateX(-5px); border-color: #e74c3c; }
        40%, 80% { transform: translateX(5px); border-color: #e74c3c; }
    }
    .shake-error { animation: shakeError 0.4s ease forwards; }
    
    @keyframes flashSuccess {
        0% { background: rgba(46, 204, 113, 0.8); transform: scale(1.05); box-shadow: 0 0 20px #2ecc71; }
        100% { background: #050505; transform: scale(1); box-shadow: none; }
    }
    .flash-success { animation: flashSuccess 0.5s ease forwards; border-color: #2ecc71 !important; }
    
    .shop-feedback-toast {
        position: absolute; top: -20px; left: 50%; transform: translateX(-50%);
        font-size: 14px; font-weight: bold; opacity: 0; transition: 0.3s; pointer-events: none;
        text-shadow: 0 0 5px #000;
    }
`;
document.head.appendChild(style);

// --- DEFINICJA ŚCIEŻEK ULEPSZEŃ (Z kolorami rzadkości) ---
const upgradePaths = {
    // Drzewko Łuku
    'bow': { next: 'golden_bow', name: 'Złoty Łuk', price: 250, icon: '🏹', color: '#f1c40f' },
    'golden_bow': { next: 'diamond_bow', name: 'Diamentowy Łuk', price: 500, icon: '🏹', color: '#00cec9' },
    'diamond_bow': { next: 'crossbow', name: 'Kusza', price: 1000, icon: '🎯', color: '#e74c3c' },
    'crossbow': { next: 'shotgun', name: 'Strzelba', price: 2000, icon: '💥', color: '#ff0000' },
    'shotgun': { next: null, name: 'MAX', price: '---', icon: '👑', color: '#ffffff' },

    // Drzewko Noża
    'knife': { next: 'golden_knife', name: 'Złoty Nóż', price: 150, icon: '🗡️', color: '#f1c40f' },
    'golden_knife': { next: 'diamond_knife', name: 'Diamentowy Nóż', price: 350, icon: '🗡️', color: '#00cec9' },
    'diamond_knife': { next: 'hunting_knife', name: 'Nóż Myśliwski', price: 700, icon: '🗡️', color: '#e74c3c' },
    'hunting_knife': { next: 'cleaver', name: 'Tasak', price: 1200, icon: '🪓', color: '#ff0000' },
    'cleaver': { next: null, name: 'MAX', price: '---', icon: '👑', color: '#ffffff' },

    // Drzewko Shurikena
    'shuriken': { next: 'golden_shuriken', name: 'Złoty Shuriken', price: 80, icon: '🥷', color: '#f1c40f' },
    'golden_shuriken': { next: 'diamond_shuriken', name: 'Diamentowy Shuriken', price: 200, icon: '🥷', color: '#00cec9' },
    'diamond_shuriken': { next: 'chakram', name: 'Czakram', price: 500, icon: '🌀', color: '#9b59b6' },
    'chakram': { next: 'explosive_kunai', name: 'Wyb. Kunai', price: 1000, icon: '🧨', color: '#e74c3c' },
    'explosive_kunai': { next: null, name: 'MAX', price: '---', icon: '👑', color: '#ffffff' }
};

let lastClickedItem = null;

window.buyItem = (item) => {
    lastClickedItem = item; // Zapamiętujemy co gracz kliknął, by trząść tym przyciskiem przy błędzie
    if (typeof socket !== 'undefined') {
        socket.emit('buyShopItem', item);
    }
};

// --- OBSŁUGA UDANEGO ZAKUPU ---
socket.on('shopSuccess', (data) => {
    console.log(`[SHOP] Pomyślnie kupiono: ${data.item}`);
    
    // Szukamy przycisku, który właśnie kliknęliśmy
    const btn = document.querySelector(`button[onclick="buyItem('${data.item}')"]`);
    
    if (btn) {
        // Zamiast błyskać tłem, błyska sam przycisk
        btn.classList.remove('shake-error');
        btn.classList.add('flash-success');
        setTimeout(() => btn.classList.remove('flash-success'), 500);

        // --- Dynamiczna aktualizacja interfejsu ---
        const upgradeInfo = upgradePaths[data.item];
        
        if (upgradeInfo) {
            if (upgradeInfo.next) {
                // Sprawdzamy czy gracz to Arystokrata (zniżka 5%)
                let isArystokrata = (typeof player !== 'undefined' && player && player.skin === 'arystokrata');
                let displayPrice = isArystokrata ? Math.floor(upgradeInfo.price * 0.95) : upgradeInfo.price;
                let priceHtml = isArystokrata 
                    ? `<span style="color: #888; text-decoration: line-through; font-size: 12px; margin-right: 5px;">${upgradeInfo.price}</span><span style="color: ${upgradeInfo.color};">$${displayPrice}</span>` 
                    : `<span style="color: ${upgradeInfo.color}; font-weight: bold;">$${displayPrice}</span>`;

                // Aktualizujemy przycisk na wyższy poziom
                btn.setAttribute('onclick', `buyItem('${upgradeInfo.next}')`);
                btn.style.borderColor = upgradeInfo.color;
                btn.style.position = 'relative'; // Potrzebne do toastów
                
                btn.innerHTML = `<span style="color: ${upgradeInfo.color}; text-shadow: 0 0 8px ${upgradeInfo.color}; font-weight: bold;">${upgradeInfo.icon} ${upgradeInfo.name}</span> <span>${priceHtml}</span>`;
            } else {
                // Jeśli osiągnięto MAX poziom
                btn.setAttribute('onclick', `return false;`);
                btn.innerHTML = `<span style="color: #f1c40f; text-shadow: 0 0 8px #f1c40f; font-weight: bold;">${upgradeInfo.icon} MAX POZIOM</span> <span style="color: #888;">---</span>`;
                btn.style.borderColor = "#f1c40f";
                btn.disabled = true; 
                btn.style.opacity = "0.6";
                btn.style.cursor = "not-allowed";
            }
        }
    }
});

// --- OBSŁUGA BŁĘDU ZAKUPU ---
socket.on('shopError', (data) => {
    console.warn("[SHOP] Błąd:", data.message);
    
    if (lastClickedItem) {
        const btn = document.querySelector(`button[onclick="buyItem('${lastClickedItem}')"]`);
        if (btn) {
            btn.style.position = 'relative'; // Upewniamy się, że powiadomienie pozycjonuje się wzg. przycisku
            
            // Resetujemy i odpalamy animację trzęsienia (Shake)
            btn.classList.remove('shake-error');
            void btn.offsetWidth; // Wymuszenie odświeżenia przeglądarki, by animacja odpaliła ponownie
            btn.classList.add('shake-error');
            
            // Tworzymy mały, pływający tekst błędu nad przyciskiem
            let toast = btn.querySelector('.shop-feedback-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.className = 'shop-feedback-toast';
                btn.appendChild(toast);
            }
            toast.innerText = "Brak Masy!";
            toast.style.color = "#e74c3c";
            toast.style.opacity = "1";
            toast.style.transform = "translate(-50%, -25px)";
            
            // Ukrywamy po 1 sekundzie
            setTimeout(() => {
                toast.style.opacity = "0";
                toast.style.transform = "translate(-50%, -10px)";
                btn.classList.remove('shake-error');
            }, 1000);
        }
    }
});