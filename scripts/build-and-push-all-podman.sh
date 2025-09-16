#!/bin/bash

# Script para construir y subir AMBAS imágenes (web + security-service) a Docker Hub usando Podman
# Uso: ./scripts/build-and-push-all-podman.sh [tag]
# Ejemplo: ./scripts/build-and-push-all-podman.sh v1.3.0

set -e

# Configuración
DOCKER_USERNAME="juancoder"
TAG=${1:-latest}

echo "🚀 Construyendo y subiendo todas las imágenes con Podman..."
echo "🏷️  Tag: ${TAG}"
echo ""

# Verificar login una sola vez
echo "🔐 Verificando login en Docker Hub..."
# Simplificamos la verificación - si el push falla, se mostrará el error
echo "✅ Continuando (verificaremos durante el push)..."
echo ""

# 1. Construir y subir security-service
echo "════════════════════════════════════════════════════════════════"
echo "1️⃣  CONSTRUYENDO SECURITY-SERVICE"
echo "════════════════════════════════════════════════════════════════"

./scripts/build-and-push-security.sh ${TAG}

if [ $? -ne 0 ]; then
    echo "❌ Error al construir/subir security-service"
    exit 1
fi

echo ""
echo "✅ Security-service completado!"
echo ""

# 2. Construir y subir web (frontend)
echo "════════════════════════════════════════════════════════════════"
echo "2️⃣  CONSTRUYENDO WEB (FRONTEND)"
echo "════════════════════════════════════════════════════════════════"

./scripts/build-and-push-web.sh ${TAG}

if [ $? -ne 0 ]; then
    echo "❌ Error al construir/subir web (frontend)"
    exit 1
fi

echo ""
echo "✅ Frontend completado!"
echo ""

# Resumen final
echo "════════════════════════════════════════════════════════════════"
echo "🎉 ¡TODAS LAS IMÁGENES SUBIDAS EXITOSAMENTE!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📦 Imágenes disponibles en Docker Hub:"
echo "   🛡️  docker.io/${DOCKER_USERNAME}/pulsechoukairperformancert-security-service:${TAG}"
echo "   🌐 docker.io/${DOCKER_USERNAME}/pulsechoukairperformancert-web:${TAG}"
echo ""
echo "🚀 Para desplegar en producción:"
echo "   TAG=${TAG} ./scripts/deploy-from-hub.sh"
echo ""
echo "🔄 O si quieres usar 'latest':"
echo "   ./scripts/deploy-from-hub.sh"
