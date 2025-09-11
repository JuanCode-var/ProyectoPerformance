#!/usr/bin/env bash
# Despliega usando únicamente imágenes de Docker Hub (ya publicadas)
# Uso:
#   1) podman login docker.io
#   2) export PSI_API_KEY=TU_KEY
#   3) ./scripts/deploy-from-hub.sh            # usa latest
#      TAG=v1 ./scripts/deploy-from-hub.sh     # usa tag diferente
# Flags:
#   --pull-only   Solo hace pull de las imágenes y sale.
#   --down        Detiene stack previo antes de subirlo.
#   --recreate    Fuerza recreate (down + up -d limpio)
#   -h|--help     Ayuda.

set -euo pipefail

HELP=false
PULL_ONLY=false
DO_DOWN=false
RECREATE=false

for arg in "$@"; do
  case "$arg" in
    --pull-only) PULL_ONLY=true ;;
    --down) DO_DOWN=true ;;
    --recreate) RECREATE=true ;;
    -h|--help) HELP=true ;;
    *) echo "Opción desconocida: $arg"; HELP=true ;;
  esac
done

if [[ "$HELP" == true ]]; then
  sed -n '2,30p' "$0"
  exit 0
fi

if ! command -v podman >/dev/null 2>&1; then
  echo "❌ Necesitas 'podman' instalado" >&2
  exit 1
fi

if ! podman info >/dev/null 2>&1; then
  echo "❌ 'podman info' falló; revisa tu instalación" >&2
  exit 1
fi

if [[ -z "${PSI_API_KEY:-}" ]]; then
  echo "⚠️  Variable PSI_API_KEY vacía (continuando, pero micro-pagespeed fallará si la requiere)" >&2
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="compose.deploy.yml"
if [[ ! -f $COMPOSE_FILE ]]; then
  echo "❌ No existe $COMPOSE_FILE" >&2
  exit 1
fi

if podman compose version >/dev/null 2>&1; then
  COMPOSE="podman compose -f $COMPOSE_FILE"
else
  echo "❌ Se requiere 'podman compose'" >&2
  exit 1
fi

TAG_VAL="${TAG:-latest}"
export TAG="$TAG_VAL"

echo "📦 Usando tag: $TAG_VAL"

echo "⬇️  Pull de imágenes..."
$COMPOSE pull || true

echo "🖼  Imágenes locales filtradas:" && podman images | grep pulsechoukairperformancert || true

if [[ "$PULL_ONLY" == true ]]; then
  echo "✅ Pull completo. (Modo --pull-only)"; exit 0; fi

if [[ "$DO_DOWN" == true ]]; then
  echo "⏹  Deteniendo stack previo (sin borrar volumenes)..."
  $COMPOSE down || true
fi

if [[ "$RECREATE" == true ]]; then
  echo "♻️  Recreando stack (down + up limpio)..."; $COMPOSE down || true; fi

echo "🚀 Levantando (sin build)..."
$COMPOSE up -d

echo "📋 Estado:"; $COMPOSE ps || true

echo "⌛ Esperando servicios (intentos cortos)..."
wait_for() {
  local url="$1"; local name="$2"; local tries=30; local sleep_s=2
  for i in $(seq 1 $tries); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "✅ $name OK ($url)"; return 0
    fi
    sleep $sleep_s
  done
  echo "⚠️  $name no respondió a tiempo ($url)"; return 1
}

wait_for "http://localhost:4000/health" "API" || true
wait_for "http://localhost:8080" "Frontend" || true
wait_for "http://localhost:3001/api/health" "micro-pagespeed" || true

cat <<EOF

✅ Despliegue listo (tag=$TAG_VAL).
- Frontend:         http://localhost:8080
- API health:       http://localhost:4000/health
- micro-pagespeed:  http://localhost:3001/api/health
- security-service: http://localhost:3002/api/analyze (POST)
- Mongo:            localhost:27017 (volumen mongo_data)

Flags útiles:
  --pull-only   Solo descargar imágenes
  --down        Parar stack previo antes
  --recreate    Forzar recreate completo
  TAG=v1 ./scripts/deploy-from-hub.sh   (usar otra versión)

Para actualizar:
  TAG=latest ./scripts/deploy-from-hub.sh --pull-only
  TAG=latest ./scripts/deploy-from-hub.sh --recreate
EOF
