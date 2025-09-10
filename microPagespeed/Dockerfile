# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Instala dependencias para compilar TypeScript
COPY package*.json ./
RUN npm ci

# Copia código y compila
COPY tsconfig.json ./
COPY src ./src
# Evita copiar .env por seguridad
# .dockerignore debería excluir .env
RUN npm run build && npm prune --omit=dev

# Imagen final con Chromium para Lighthouse local
FROM node:20-bookworm-slim

# Instala Chromium y fuentes
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       chromium \
       ca-certificates \
       fonts-liberation \
       fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV PS_PORT=3001

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/dist ./dist
COPY package*.json ./

EXPOSE 3001
CMD ["node", "dist/index.js"]
