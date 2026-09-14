# ---------- Étape 1 : dépendances ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- Étape 2 : build ----------
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Valeur par défaut ; peut être surchargée au build (--build-arg) depuis la CI.
ARG NEXT_PUBLIC_CLIENT_PORTAL_URL=https://cabinet.camconsult.com.tn/login
ENV NEXT_PUBLIC_CLIENT_PORTAL_URL=$NEXT_PUBLIC_CLIENT_PORTAL_URL

RUN pnpm run build

# ---------- Étape 3 : exécution (sortie "standalone" Next.js — image légère) ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
