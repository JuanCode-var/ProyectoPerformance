#!/usr/bin/env bash
# Script de bootstrap: inicia sesión en Docker Hub / Podman Registry, pull de imágenes y levanta el stack.
# Uso rápido (interactivo):
#   ./scripts/bootstrap-servidor.sh
# Flags opcionales:
#   --pull-only   Solo descarga/actualiza imágenes (no levanta compose)
#   --no-login    Omite login (asume sesión ya existente)
#   --help        Muestra ayuda
# Variables que puedes ajustar antes de ejecutar:
#   REGISTRY (default docker.io)
#   NAMESPACE (tu usuario/organización en Docker Hub)
#   TAG (tag de las imágenes, default latest)
#   COMPOSE_FILE (default compose.deploy.yml)
# Requiere: podman (preferido) o docker.

set -euo pipefail

REGISTRY="docker.io"
# Ajusta esto si tu namespace es distinto a tu usuario (ej: empresa)
NAMESPACE="${NAMESPACE:-}"  # Si se deja vacío se usará el usuario introducido en login
TAG="${TAG:-latest}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.deploy.yml}"
PULL_ONLY=false
DO_LOGIN=true

IMAGES=(
  "web"              # Frontend
  "api"              # API principal
  "micro-pagespeed"  # Servicio de PageSpeed
  "security-service" # Servicio de seguridad
  "mongo"            # MongoDB (si lo publicaste; si usas oficial puedes quitarlo)
)

usage() {
  grep '^#' "$0" | sed 's/^# //;s/^#//' | head -n 30
  cat <<EOF
Variables actuales:
  REGISTRY=$REGISTRY
  NAMESPACE=${NAMESPACE:-<pendiente>}
  TAG=$TAG
  COMPOSE_FILE=$COMPOSE_FILE
EOF
}

for arg in "$@"; do
  case "$arg" in
    --pull-only) PULL_ONLY=true ;;
    --no-login)  DO_LOGIN=false ;;
    --help|-h)   usage; exit 0 ;;
    *) echo "Flag desconocida: $arg"; usage; exit 1 ;;
  esac
done

# Detectar motor (podman preferido)
ENGINE=""
if command -v podman >/dev/null 2>&1; then
  ENGINE="podman"
elif command -v docker >/dev/null 2>&1; then
  ENGINE="docker"
else
  echo "❌ Ni podman ni docker encontrados en PATH" >&2; exit 1
fi

# Función compose unificada
compose_cmd() {
  if [[ "$ENGINE" == podman ]]; then
    if podman compose version >/dev/null 2>&1; then
      podman compose -f "$COMPOSE_FILE" "$@"
    elif command -v podman-compose >/dev/null 2>&1; then
      podman-compose -f "$COMPOSE_FILE" "$@"
    else
      echo "❌ 'podman compose' no disponible" >&2; return 1
    fi
  else
    $ENGINE compose -f "$COMPOSE_FILE" "$@"
  fi
}

login_registry() {
  if [[ "$DO_LOGIN" == false ]]; then
    echo "➡️  Omitiendo login (flag --no-login)."; return 0
  fi
  read -rp "Usuario Docker Hub: " HUB_USER
  if [[ -z "$NAMESPACE" ]]; then
    NAMESPACE="$HUB_USER"
  fi
  echo -n "Password / PAT: "
  # Desactivar echo para password
  stty -echo; read -r HUB_PASS; stty echo; echo
  echo "$HUB_PASS" | $ENGINE login "$REGISTRY" -u "$HUB_USER" --password-stdin
  echo "✅ Login exitoso en $REGISTRY como $HUB_USER"
}

pull_images() {
  echo "\n⬇️  Descargando imágenes (namespace: $NAMESPACE tag: $TAG)";
  for img in "${IMAGES[@]}"; do
    # Si es mongo y quieres usar la imagen oficial, puedes detectar y usar 'mongo:6'
    if [[ "$img" == mongo && "$NAMESPACE" == mongo ]]; then
      # Caso improbable; se deja genérico
      :
    fi
    FULL_REF="$REGISTRY/$NAMESPACE/$img:$TAG"
    echo "--> Pull $FULL_REF"
    if ! $ENGINE pull "$FULL_REF"; then
      echo "⚠️  Falló pull de $FULL_REF" >&2
    fi
  done
  echo "\n📦 Imágenes locales relacionadas:";
  $ENGINE images | grep -E "$NAMESPACE" || true
}

bring_up() {
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "❌ No se encuentra $COMPOSE_FILE en $(pwd)" >&2; exit 1
  fi
  echo "\n🚀 Levantando stack con $COMPOSE_FILE"
  compose_cmd up -d
  echo "\n📋 Servicios:"; compose_cmd ps || true
}

main() {
  echo "== Bootstrap de despliegue desde Docker Hub =="
  login_registry
  pull_images
  if [[ "$PULL_ONLY" == true ]]; then
    echo "✅ Pull completado (modo --pull-only)."; exit 0
  fi
  bring_up
  cat <<EOF
\n✅ Despliegue listo.
Endpoints típicos (ajusta puertos según tu compose):
  Frontend:        http://<host>:8080
  API (health):    http://<host>:4000/health
  PageSpeed:       http://<host>:3001/api/health
  Security:        http://<host>:3002/api/health (si existe)
Mongo expuesto interno según compose.

Actualización futura:
  1) ./scripts/bootstrap-servidor.sh --pull-only (descarga nuevas imágenes)
  2) compose down && compose up -d (o repetir script sin --pull-only)
EOF
}

main "$@"
