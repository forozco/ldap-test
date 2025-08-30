#!/bin/bash

echo "🚀 Configurando proyecto LDAP Proxy..."
echo "========================================="

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Ejecuta este script desde la carpeta ldap-proxy"
    exit 1
fi

# 1. Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

# 2. Crear archivo .env si no existe
if [ ! -f ".env" ]; then
    echo "⚙️  Creando archivo de configuración (.env)..."
    cp .env.example .env
    echo "✅ Archivo .env creado. ¡IMPORTANTE! Revisa y ajusta la configuración según tu entorno."
else
    echo "ℹ️  El archivo .env ya existe. No se sobrescribió."
fi

# 3. Hacer ejecutables los scripts
echo "🔧 Configurando permisos de scripts..."
chmod +x start-server.sh start-with-logs.sh start-with-proxy.sh

# 4. Verificar configuración
echo ""
echo "========================================="
echo "✅ Configuración completada!"
echo ""
echo "📋 Archivos creados/configurados:"
echo "   - .env (configuración del servidor)"
echo "   - proxy.conf.json (configuración de proxy para Angular)"
echo "   - Scripts ejecutables"
echo ""
echo "🚀 Para iniciar el servidor:"
echo "   ./start-with-proxy.sh    # Recomendado (con logs detallados)"
echo "   npm start                # Inicio básico"
echo "   npm run dev              # Modo desarrollo con watch"
echo ""
echo "🔧 Configuración LDAP actual:"
grep "LDAP_URL" .env
grep "DEV_MODE" .env
echo ""
echo "⚠️  IMPORTANTE:"
echo "   - Revisa el archivo .env y ajusta las configuraciones"
echo "   - Cambia JWT_SECRET en producción"
echo "   - Para Angular: usa 'ng serve --proxy-config proxy.conf.json'"
echo "========================================="
