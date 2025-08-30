#!/bin/bash

echo "🚀 Iniciando servidor LDAP proxy con configuración de proxy..."
echo "========================================="

# Verificar que el directorio sea correcto
CURRENT_DIR=$(pwd)
echo "📁 Directorio actual: $CURRENT_DIR"

# Ir al directorio del proyecto
cd /Users/fernandoorozco/Downloads/INE/ldap-test/ldap-proxy

# Matar cualquier proceso existente del servidor
echo "🔄 Deteniendo procesos existentes..."
pkill -f "node server.js" 2>/dev/null || true

# Verificar que las dependencias estén instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

# Verificar que el archivo .env existe
if [ ! -f ".env" ]; then
    echo "⚠️  Archivo .env no encontrado. Creando uno de ejemplo..."
    cat > .env << 'EOF'
# Configuración del servidor LDAP Proxy
PORT=4000
LDAP_URL=ldap://localhost:389
LDAP_USER_DN_PATTERN=uid={0},ou=People,dc=ife.org.mx
LDAP_GROUP_SEARCH_BASE=ou=Groups,dc=ife.org.mx
LDAP_GROUP_SEARCH_FILTER=(memberUid={1})
LDAP_GROUP_ROLE_ATTRIBUTE=cn
JWT_SECRET=tu_clave_secreta_jwt_aqui
CORS_ORIGIN=http://localhost:4200,http://localhost:3000
DEV_MODE=true
EOF
fi

# Verificar que el archivo proxy.conf.json existe
if [ ! -f "proxy.conf.json" ]; then
    echo "🔧 Creando archivo de configuración de proxy..."
    cat > proxy.conf.json << 'EOF'
{
  "/api/*": {
    "target": "http://localhost:4000",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug"
  }
}
EOF
fi

echo "========================================="
echo "🔧 Configuración del proxy:"
echo "   - Servidor LDAP: http://localhost:4000"
echo "   - Proxy Angular: http://localhost:4200"
echo "   - Archivo proxy: proxy.conf.json"
echo "========================================="

# Iniciar el servidor en background
echo "🚀 Iniciando servidor LDAP..."
node server.js &
SERVER_PID=$!

echo "✅ Servidor iniciado con PID: $SERVER_PID"
echo "📡 URL del servidor: http://localhost:4000"
echo "🔍 Monitoreando logs en tiempo real..."
echo ""
echo "📋 Para usar con Angular, ejecuta en tu proyecto Angular:"
echo "   ng serve --proxy-config proxy.conf.json"
echo ""
echo "🧪 Credenciales de prueba (modo desarrollo):"
echo "   - Usuario: admin, test, o demo"
echo "   - Password: 123456"
echo ""
echo "========================================="
echo "📊 LOGS DEL SERVIDOR:"
echo "========================================="

# Esperar para que el servidor arranque completamente
sleep 3

# Hacer una petición de prueba para verificar que funciona
echo "🧪 Haciendo petición de prueba..."
RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"123456"}')
HTTP_CODE="${RESPONSE: -3}"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    echo "✅ Servidor funcionando correctamente (HTTP $HTTP_CODE)"
else
    echo "⚠️  Servidor respondió con código: $HTTP_CODE"
fi

echo ""
echo "🔥 Logs en tiempo real (Ctrl+C para salir):"
echo "========================================="

# Seguir los logs del proceso
wait $SERVER_PID
