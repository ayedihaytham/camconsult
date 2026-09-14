# ---------- Étape 1 : build du front + install des deps ----------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build          # tsc + vite -> dist/

# ---------- Étape 2 : image d'exécution (API + site) ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# poppler-utils (pdftoppm) : rasterise les PDF scannés avant OCR (module Stock)
RUN apk add --no-cache poppler-utils

# Uniquement les dépendances de production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Le serveur + le front compilé
COPY server ./server
COPY --from=build /app/dist ./dist

EXPOSE 8080
CMD ["node", "server/index.js"]
