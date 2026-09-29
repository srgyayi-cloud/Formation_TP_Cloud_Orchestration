# syntax=docker/dockerfile:1

# --- Étape 1 : build des fichiers statiques avec Vite ---
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Étape 2 : service des fichiers par nginx ---
FROM nginx:1.28-alpine
ARG APP_VERSION=0.0.0-local
ENV APP_VERSION=${APP_VERSION} \
    API_URL=http://backend:3000

# nginx génère sa configuration à partir du template au démarrage (envsubst)
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1/healthz || exit 1
