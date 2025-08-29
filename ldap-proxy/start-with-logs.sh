#!/bin/bash

echo "🚀 Iniciando servidor LDAP proxy con logs en tiempo real..."
echo "========================================="

# Matar cualquier proceso existente
pkill -f "node server.js" 2>/dev/null

# Iniciar el servidor en background
cd /Users/f_orozco/Documents/INE/angular-ldap-login/ldap-proxy
node server.js &
SERVER_PID=$!

echo "✅ Servidor iniciado con PID: $SERVER_PID"
echo "📡 URL: http://localhost:4000"
echo "🔍 Monitoreando logs en tiempo real..."
echo "========================================="

# Seguir los logs del servidor
tail -f server.log 2>/dev/null &

# Esperar un poco para que el servidor arranque
sleep 2

# Hacer una petición de prueba
echo "🧪 Haciendo petición de prueba..."
curl -s -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{"username":"test","password":"test"}' > /dev/null

echo "✅ ¡Servidor funcionando! Los logs de las peticiones aparecerán aquí:"
echo "========================================="

# Mantener el script corriendo
wait
