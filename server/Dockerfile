# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim

WORKDIR /app

# Instala solo deps del server
COPY package*.json ./
COPY server/package*.json ./server/
RUN cd server && npm ci

# Copia el resto del código necesario (server + src compartido)
COPY server ./server
COPY src ./src

ENV NODE_ENV=production
WORKDIR /app/server
EXPOSE 4000

# Ejecutar usando tsx con el import hook (Node 20+)
CMD ["node", "--import=tsx", "index.ts"]
