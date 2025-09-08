#!/bin/bash

echo '🚀 Iniciando despliegue con Podman...'

# Crear volumen de MongoDB si no existe
if ! podman volume exists mongo_data; then
  echo '📦 Creando volumen mongo_data...'
  podman volume create mongo_data
fi

# Construir imágenes
echo '🔨 Construyendo imágenes...'
podman build -t pulsechoukair/web -f ./src/Dockerfile.web ./src
podman build -t pulsechoukair/api -f ./server/Dockerfile ./server
podman build -t pulsechoukair/micro-pagespeed -f ./microPagespeed/Dockerfile ./microPagespeed

# Levantar MongoDB
echo '🗄️ Levantando MongoDB...'
podman run -d --name mongo -p 27017:27017 -v mongo_data:/data/db --restart=unless-stopped mongo:6

# Levantar micro-pagespeed
echo '⚡ Levantando micro-pagespeed...'
podman run -d --name micro-pagespeed -p 3001:3001 \
  -e NODE_ENV=production \
  -e PSI_API_KEY=AIzaSyCX_fQrS880HJ_rNsush2O54b6Ilcynbhc \
  --restart=unless-stopped pulsechoukair/micro-pagespeed

# Levantar API
echo '🧠 Levantando API...'
podman run -d --name api -p 4000:4000 \
  -e NODE_ENV=production \
  -e MONGO_URL=mongodb://mongo:27017/pulse \
  --restart=unless-stopped --link mongo --link micro-pagespeed pulsechoukair/api

# Levantar frontend web
echo '🌐 Levantando frontend web...'
podman run -d --name web -p 8080:80 \
  --restart=unless-stopped --link api pulsechoukair/web

echo '✅ Todos los servicios están levantados con Podman.'