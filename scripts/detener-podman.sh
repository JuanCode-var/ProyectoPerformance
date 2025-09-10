#!/usr/bin/env bash
# Detener todo: ./scripts/detener-podman.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE="podman compose"

printf '⏹️  Deteniendo stack...\n'
$COMPOSE down || true

read -r -p '¿Eliminar el volumen de Mongo (mongo_data)? [s/N]: ' RM_VOL
if [[ "${RM_VOL:-N}" =~ ^[sS]$ ]]; then
  if podman volume exists mongo_data; then
    echo '🧹 Eliminando volumen mongo_data...'
    podman volume rm mongo_data || true
  else
    echo 'ℹ️  Volumen mongo_data no existe.'
  fi
else
  echo '✅ Volumen mongo_data conservado.'
fi

read -r -p '¿Eliminar imágenes construidas (web, api, micro-pagespeed, security-service)? [s/N]: ' RM_IMG
if [[ "${RM_IMG:-N}" =~ ^[sS]$ ]]; then
  echo '🧹 Eliminando imágenes...'
  podman images | awk '/pulsechoukairperformancert-|pulsechoukair\/|micro-pagespeed|security-service/ {print $3}' | xargs -r podman rmi -f || true
fi

printf '✅ Limpieza completada.\n'