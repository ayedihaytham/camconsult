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

# SEO : les pages, robots.txt et sitemap.xml sont générés au build.
ARG SITE_URL=https://camconsult.com.tn
ARG SITE_INDEXABLE=true
ARG GOOGLE_SITE_VERIFICATION=
ARG BING_SITE_VERIFICATION=
ENV SITE_URL=$SITE_URL
ENV SITE_INDEXABLE=$SITE_INDEXABLE
ENV GOOGLE_SITE_VERIFICATION=$GOOGLE_SITE_VERIFICATION
ENV BING_SITE_VERIFICATION=$BING_SITE_VERIFICATION

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
