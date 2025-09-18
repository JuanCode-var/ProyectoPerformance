#start-local.sh
#Script para iniciar todos los servicios en modo desarrollo localmente
# chmod +x scripts/start-local.sh - chmod +x scripts/*.sh (darle permisos a un documento para que sea local) 
#ejecutarlo: ./scripts/start-local.sh

echo "🚀 Iniciando microservicio PageSpeed en modo desarrollo..."
cd microPagespeed
npm run dev &
PAGESPEED_PID=$!
cd ..

echo "🚀 Iniciando microservicio de seguridad en modo desarrollo..."
cd security-service
npm run dev &
SECURITY_PID=$!
cd ..

echo "🔧 Iniciando backend en modo desarrollo..."
cd server
npm run dev &
SERVER_PID=$!
cd ..

echo "🚀 Iniciando microservicio Frontend en modo desarrollo..."
npm run dev &
FRONTEND_PID=$!

echo "✅ Todos los servicios iniciados!"
echo "PIDs: PageSpeed=$PAGESPEED_PID Security=$SECURITY_PID Server=$SERVER_PID Frontend=$FRONTEND_PID"
echo "Presiona Ctrl+C para detener todos los servicios"

# Función para limpiar procesos al salir
cleanup() {
    echo "🛑 Deteniendo servicios..."
    kill $PAGESPEED_PID $SECURITY_PID $SERVER_PID $FRONTEND_PID 2>/dev/null
    exit
}

# Capturar señal de interrupción
trap cleanup SIGINT SIGTERM

# Esperar a que terminen los procesos
wait
