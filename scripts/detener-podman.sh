#!/bin/bash

echo '[33m⏹️ Deteniendo y eliminando contenedores...[0m'

for container in web api micro-pagespeed mongo; do
  if podman container exists $container; then
    echo "[34mDeteniendo $container...[0m"
    podman stop $container
    echo "[31mEliminando $container...[0m"
    podman rm $container
  else
    echo "[90mContenedor $container no existe. Saltando...[0m"
  fi
done

read -p '¿Deseas eliminar el volumen mongo_data también? (s/n): ' eliminar_volumen
if [[ $eliminar_volumen == "s" ]]; then
  if podman volume exists mongo_data; then
    echo '[31mEliminando volumen mongo_data...[0m'
    podman volume rm mongo_data
  else
    echo '[90mVolumen mongo_data no existe. Nada que eliminar.[0m'
  fi
else
  echo '[32mVolumen mongo_data conservado.[0m'
fi

echo '[32m✅ Limpieza completada.[0m'