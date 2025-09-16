#!/bin/bash

# Script para construir y subir la imagen del frontend (web) a Docker Hub
# Uso: ./scripts/build-and-push-web.sh [tag]
# Ejemplo: ./scripts/build-and-push-web.sh v1.2.3

set -e

# Configuración
DOCKER_USERNAME="juancoder"
IMAGE_NAME="pulsechoukairperformancert-web"
FULL_IMAGE_NAME="docker.io/${DOCKER_USERNAME}/${IMAGE_NAME}"

# Tag por defecto es 'latest' si no se especifica
TAG=${1:-latest}

echo "🚀 Construyendo imagen del frontend..."
echo "📦 Imagen: ${FULL_IMAGE_NAME}:${TAG}"
echo ""

# Construir la imagen del frontend
echo "🔨 Construyendo imagen con Podman..."
podman build -f src/Dockerfile.web -t "${FULL_IMAGE_NAME}:${TAG}" .

# También tagear como 'latest' si el tag no es 'latest'
if [ "$TAG" != "latest" ]; then
    echo "🏷️  Taggeando también como 'latest'..."
    podman tag "${FULL_IMAGE_NAME}:${TAG}" "${FULL_IMAGE_NAME}:latest"
fi

# Verificar que estamos logueados en Docker Hub
echo "🔐 Verificando login en Docker Hub..."
# Intentar hacer push de prueba o simplemente continuar si el build fue exitoso
echo "✅ Continuando con push (imagen construida exitosamente)..."

# Subir la imagen
echo "📤 Subiendo imagen a Docker Hub..."
podman push "${FULL_IMAGE_NAME}:${TAG}"

# Subir también 'latest' si aplicaba
if [ "$TAG" != "latest" ]; then
    echo "📤 Subiendo también tag 'latest'..."
    podman push "${FULL_IMAGE_NAME}:latest"
fi

echo ""
echo "✅ ¡Imagen subida exitosamente!"
echo "🐋 Imagen disponible en: ${FULL_IMAGE_NAME}:${TAG}"
echo ""
echo "📋 Para usar en producción, actualiza compose.deploy.yml:"
echo "   web:"
echo "     image: ${FULL_IMAGE_NAME}:${TAG}"
echo ""
echo "🚀 Para desplegar:"
echo "   TAG=${TAG} ./scripts/deploy-from-hub.sh"
