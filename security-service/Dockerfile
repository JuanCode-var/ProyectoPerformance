# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV NODE_ENV=production
ENV PORT=3002
EXPOSE 3002

# Run TS with tsx using Node's import hook
CMD ["node", "--import=tsx", "src/index.ts"]
