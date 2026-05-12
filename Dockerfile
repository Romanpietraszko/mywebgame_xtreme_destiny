# Używamy lekkiego i wydajnego obrazu Node.js (wersja 18, żeby Qwen i nowe funkcje działały)
FROM node:18-alpine

# Ustawiamy katalog roboczy wewnątrz kontenera
WORKDIR /app

# Kopiujemy pliki z listą pakietów (package.json)
COPY package*.json ./

# Instalujemy wymagane pakiety (Express, Socket.io)
RUN npm install

# Kopiujemy całą resztę Twojego kodu i grafik
COPY . .

# Informujemy system, że gra nasłuchuje na porcie 3000
EXPOSE 3000

# Komenda uruchamiająca serwer
CMD ["node", "backhend/server.js"]
