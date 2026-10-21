# syntax=docker/dockerfile:1.7

# ---------- Étape 1 : dépendances de production seules (couche réutilisée tant que package-lock.json ne change pas) ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund

# ---------- Étape 2 : build du front (dépendances de développement comprises) ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
# Seuls les fichiers du front : une modification du serveur ne relance pas la construction du front.
COPY index.html vite.config.ts tsconfig.json tsconfig.build.json tailwind.config.js postcss.config.js components.json ./
COPY public ./public
COPY shared ./shared
COPY src ./src
# Les types (tsc) sont contrôlés par la CI avant la publication : l'image ne refait que la construction.
RUN npm run build:prod

# ---------- Étape 3 : image d'exécution (API + site) ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# poppler-utils (pdftoppm, pdfseparate) : rend et sépare les pages des PDF (module Stock)
RUN apk add --no-cache poppler-utils

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY package.json ./
# Le serveur + le code partagé (règles de planification des tâches…) + le front compilé
COPY --chown=node:node server ./server
COPY --chown=node:node shared ./shared
COPY --from=build --chown=node:node /app/dist ./dist

# Le serveur n'écrit que dans le dossier temporaire du système : il n'a pas besoin des droits root.
USER node
EXPOSE 8080

# L'état est celui de /api/health (la base répond). Le port est celui du serveur (API_PORT, 8080 dans les fichiers compose).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3   CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||process.env.API_PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
