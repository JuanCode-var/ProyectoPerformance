#start-local.sh
#Script para iniciar todos los servicios en modo desarrollo localmente
# chmod +x scripts/start-local.sh (darle permisos a un documento para que sea local) 
#ejecutarlo: ./scripts/start-local.sh

echo "🚀 Iniciando microservicio PageSpeed en modo desarrollo..."
cd microPagespeed
npm run dev &
cd ..

echo "🚀 Iniciando microservicio de seguridad en modo desarrollo..."
cd security-service
npm run dev &
cd ..

echo "🔧 Iniciando backend en modo desarrollo..."
cd server
npm run dev &
cd ..

echo "🚀 Iniciando microservicio Frontend en modo desarrollo..."
cd PulseChoukairPerformanceRT
npm run dev &
cd ..
