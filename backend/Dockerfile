# ---------- Étape 1 : build (compilation TypeScript) ----------
FROM node:24-alpine AS build
WORKDIR /app

# Dépendances d'abord : cette couche reste en cache tant que package*.json ne change pas
COPY package.json package-lock.json ./
RUN npm ci

# Puis la configuration TypeScript et le code source
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---------- Étape 2 : image finale (exécution) ----------
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

# Dépendances de production uniquement (express, pg)
# package.json est aussi nécessaire à l'exécution : "type": "module"
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Programme compilé (depuis l'étape build) et migrations SQL (lues au démarrage)
COPY --from=build /app/dist ./dist
COPY migrations ./migrations

# Version et commit : fournis au build avec --build-arg, lus par l'API à l'exécution
ARG APP_VERSION=0.0.0-local
ARG GIT_COMMIT=unknown
ENV APP_VERSION=$APP_VERSION GIT_COMMIT=$GIT_COMMIT

# Exécution sans droits administrateur (utilisateur fourni par l'image node)
USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/health/ready || exit 1


# Forme exec : node est le PID 1 et reçoit SIGTERM pour l'arrêt propre
 CMD ["node", "dist/server.js"]
