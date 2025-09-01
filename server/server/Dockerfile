FROM node:20-alpine AS base
WORKDIR /app

# Sólo dependencias del server
COPY server/package*.json ./
RUN npm ci --omit=dev

# Código del server
COPY server/ ./

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Asegúrate que en server/package.json tengas "start": "node index.js"
CMD ["npm", "run", "start"]
