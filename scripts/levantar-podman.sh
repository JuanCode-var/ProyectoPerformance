#!/usr/bin/env bash
# Levantar todo: ./scripts/levantar-podman.sh [--no-build] [--no-cache] [--full] [--no-wait]

set -euo pipefail

usage() {
  cat <<'USAGE'
Uso: scripts/levantar-podman.sh [opciones]

Opciones:
  --no-build    No forza rebuild (no pasa --build a 'up').
  --no-cache    Fuerza rebuild sin cache (equivale a 'compose build --no-cache' antes de 'up').
  --full        Limpia stack previo (down -v --rmi local) y luego levanta con build.
  --no-wait     Omite checks de salud (no espera a que los servicios respondan).
  -h, --help    Muestra esta ayuda y sale.

Ejemplos:
  scripts/levantar-podman.sh --no-build
  scripts/levantar-podman.sh --no-cache
  scripts/levantar-podman.sh --full
USAGE
}

# Parseo de flags
BUILD=true
WAIT=true
FULL=false
NO_CACHE=false

for arg in "$@"; do
  case "$arg" in
    --no-build) BUILD=false ;;
    --no-cache) NO_CACHE=true ;;
    --full)     FULL=true ;;
    --no-wait)  WAIT=false ;;
    -h|--help)  usage; exit 0 ;;
    *) echo "Opción desconocida: $arg"; usage; exit 1 ;;
  esac
done

# Verificaciones de herramientas disponibles
if ! command -v podman >/dev/null 2>&1; then
  echo "❌ 'podman' no está instalado o no está en PATH" >&2
  exit 1
fi

# Elegir backend de compose (preferir 'podman compose')
if podman compose version >/dev/null 2>&1; then
  COMPOSE="podman compose"
elif command -v podman-compose >/dev/null 2>&1; then
  COMPOSE="podman-compose"
else
  echo "❌ No se encontró 'podman compose' ni 'podman-compose'" >&2
  exit 1
fi

# Ir a la raíz del repo
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Limpieza completa si se solicita
if [[ "$FULL" == true ]]; then
  printf '\n🧹 Limpiando stack previo (down -v --rmi local)...\n'
  $COMPOSE down -v --rmi local || true
fi

# Rebuild sin cache si se solicita
if [[ "$NO_CACHE" == true ]]; then
  printf '\n🔧 Ejecutando build sin cache...\n'
  $COMPOSE build --no-cache
  # Evitar doble build en el 'up'
  BUILD=false
fi

# Levantar servicios
printf '\n🚀 Levantando stack con %s...\n' "$COMPOSE"
UP_CMD=(up -d)
if [[ "$BUILD" == true ]]; then
  UP_CMD+=(--build)
fi
$COMPOSE "${UP_CMD[@]}"

printf '\n📋 Estado de los servicios:\n'
$COMPOSE ps || true

# Función para esperar endpoints HTTP
wait_for() {
  local url="$1"; local name="$2"; local retries="${3:-60}"; local sleep_s="${4:-2}"
  for i in $(seq 1 "$retries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      printf "✅ %s OK (%s)\n" "$name" "$url"; return 0
    fi
    sleep "$sleep_s"
  done
  printf "⚠️  %s no respondió a tiempo (%s)\n" "$name" "$url"; return 1
}

# Esperar API y Web (salud básica), a menos que se pida no esperar
if [[ "$WAIT" == true ]]; then
  # Estos checks no fallan el script si algo no responde a tiempo
  wait_for "http://localhost:4000/health" "API" || true
  wait_for "http://localhost:8080" "Frontend" || true
  wait_for "http://localhost:3001/api/health" "micro-pagespeed" || true
fi

cat <<EOF

✅ Stack listo.
- Frontend:           http://localhost:8080
- API (health):       http://localhost:4000/health
- micro-pagespeed:    http://localhost:3001/api/health
- security-service:   http://localhost:3002/api/analyze (POST)
- MongoDB:            localhost:27017 (volumen: mongo_data)

Comandos útiles:
- Ver estado:         $COMPOSE ps
- Ver logs API:       podman logs pulsechoukairperformancert-api-1 --tail 100
- Detener todo:       ./scripts/detener-podman.sh

Sugerencia:
- Puedes usar flags: --no-build | --no-cache | --full | --no-wait
EOF