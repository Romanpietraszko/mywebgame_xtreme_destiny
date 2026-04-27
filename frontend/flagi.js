// ==========================================
// FLAGI.JS - Centralna Baza Stanów i Ustawień
// ==========================================

window.Flagi = {
    Stan: {
        aktualny: 'LOBBY', // LOBBY, PLAYING, GAMEOVER
        wybranyTryb: 'FREE',
        wybranaKlasa: 'standard'
    },
    Srodowisko: {
        // Automatyczne wykrywanie telefonów, by wyłączyć ciężkie neony
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        worldSize: 4000
    },
    Tryby: {
        FREE: true,
        TEAMS: true,
        CAMPAIGN: false // Zgodnie z ustaleniami na razie wyłączona
    },
    ustawStan: function(nowyStan) {
        this.Stan.aktualny = nowyStan;
        console.log("🚩 [FLAGI] Zmiana stanu na:", nowyStan);
    }
};