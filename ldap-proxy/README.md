# LDAP Proxy Server - INE

Servidor proxy para autenticación LDAP del Instituto Nacional Electoral (INE) con soporte completo para Spring Security authorities.

## 🚀 Instalación Rápida

```bash
# 1. Clonar el repositorio
git clone https://github.com/forozco/ldap-test.git
cd ldap-test/ldap-proxy

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno (opcional)
cp .env.example .env

# 4. Iniciar el servidor
npm start
```

## ⚙️ Configuración Manual

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
# Editar .env con tu configuración
```

### 3. Configuración LDAP
El archivo `.env` contiene la configuración del servidor LDAP del INE:

```env
# Servidor LDAP
LDAP_URL=ldap://ldap-pruebas.ine.mx:389
LDAP_USER_DN_PATTERN=uid={0},ou=People,dc=ife.org.mx
LDAP_GROUP_SEARCH_BASE=ou=Grupos,dc=ife.org.mx
LDAP_GROUP_ROLE_ATTRIBUTE=cn

# JWT Configuration
JWT_SECRET=tu_jwt_secret_aqui
JWT_EXPIRES=1h

# Server Configuration
PORT=4000
CORS_ORIGIN=http://localhost:4200,http://localhost:3000
DEV_MODE=false
```

## 🔧 Modos de Funcionamiento

### Modo Desarrollo (DEV_MODE=true)
- Usa usuarios simulados para pruebas
- Credenciales válidas:
  - Usuario: `admin`, `test`, o `demo`
  - Password: `123456`

### Modo Producción (DEV_MODE=false)
- Conecta al servidor LDAP real del INE
- Usa credenciales reales de usuarios del INE

## 🚀 Iniciar el Servidor

### Opción 1: NPM Scripts (Recomendado)
```bash
npm start          # Inicio normal
npm run dev        # Modo desarrollo con watch
```

### Opción 2: Scripts disponibles
```bash
./start-server.sh     # Inicio básico
./start-with-logs.sh  # Con logs detallados
```

### Opción 3: Node directo
```bash
node server.js
```

## 🌐 Integración con Angular

### Configuración de Proxy
Crea un archivo `proxy.conf.json` en tu proyecto Angular:

```json
{
  "/api/*": {
    "target": "http://localhost:4000",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug"
  }
}
```

### Usar en Angular
```bash
# Ejecutar Angular con proxy
ng serve --proxy-config proxy.conf.json
```

### Configuración en angular.json
```json
"serve": {
  "builder": "@angular-devkit/build-angular:dev-server",
  "options": {
    "proxyConfig": "proxy.conf.json"
  }
}
```

## 📡 API Endpoints

### POST /api/auth/login
Autenticación de usuario
```json
{
  "username": "usuario.ine",
  "password": "password123"
}
```

**Respuesta exitosa:**
```json
{
  "ok": true,
  "token": "jwt_token_here",
  "user": {
    "username": "usuario.ine",
    "dn": "uid=usuario.ine,ou=People,dc=ife.org.mx",
    "groups": ["GRUPO1", "GRUPO2"],
    "authorities": ["ROLE_GRUPO1", "ROLE_GRUPO2"]
  }
}
```

### GET /api/auth/profile
Obtener perfil del usuario autenticado (requiere token JWT)

## 🔧 Configuración de Variables

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `PORT` | Puerto del servidor | `4000` |
| `LDAP_URL` | URL del servidor LDAP | `ldap://ldap-pruebas.ine.mx:389` |
| `LDAP_USER_DN_PATTERN` | Patrón DN de usuarios | `uid={0},ou=People,dc=ife.org.mx` |
| `LDAP_GROUP_SEARCH_BASE` | Base de búsqueda de grupos | `ou=Grupos,dc=ife.org.mx` |
| `LDAP_GROUP_ROLE_ATTRIBUTE` | Atributo de rol en grupos | `cn` |
| `JWT_SECRET` | Clave secreta para JWT | `cambiar_en_produccion` |
| `JWT_EXPIRES` | Tiempo de expiración JWT | `1h` |
| `CORS_ORIGIN` | Orígenes permitidos para CORS | `http://localhost:4200,http://localhost:3000` |
| `DEV_MODE` | Modo desarrollo | `false` |

## 🐛 Solución de Problemas

### Error 401 - Credenciales inválidas
- Verificar que `LDAP_URL` sea correcta
- Comprobar conectividad al servidor LDAP
- Revisar formato de username/password

### Error 504 - Gateway Timeout
- Configurar proxy en Angular
- Verificar que el servidor esté corriendo en puerto 4000

### Error ECONNREFUSED
- El servidor LDAP no está disponible
- Verificar conectividad de red
- Comprobar URL y puerto del LDAP

## 📁 Estructura de Archivos

```
ldap-proxy/
├── server.js              # Servidor principal
├── package.json           # Dependencias
├── .env                   # Configuración (no en git)
├── .env.example           # Plantilla de configuración
├── start-server.sh        # Script de inicio básico
├── start-with-logs.sh     # Script con logs detallados
└── README.md             # Esta documentación
```

## ✨ Características

- ✅ Autenticación LDAP con servidor INE
- ✅ Generación automática de authorities con prefijo `ROLE_`
- ✅ Compatible con Spring Security
- ✅ Búsqueda automática de grupos LDAP
- ✅ JWT tokens con información completa del usuario
- ✅ Logs detallados para debugging
- ✅ Soporte para múltiples patrones de DN
- ✅ CORS configurado para Angular

## 🔒 Seguridad

- Cambiar `JWT_SECRET` en producción
- Usar HTTPS en producción
- Configurar CORS apropiadamente
- Revisar logs periódicamente
- El servidor LDAP utiliza la estructura de dominio `dc=ife.org.mx`

## 🧪 Pruebas

### Ejemplo de petición con cURL
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "tu_usuario", "password": "tu_password"}'
```

### Respuesta esperada
```json
{
  "ok": true,
  "token": "eyJ...",
  "user": {
    "username": "tu_usuario",
    "dn": "uid=tu_usuario,ou=People,dc=ife.org.mx",
    "groups": ["GRUPO1", "GRUPO2"],
    "authorities": ["ROLE_GRUPO1", "ROLE_GRUPO2"]
  }
}
```

## 📞 Soporte

Para problemas o dudas sobre la configuración LDAP del INE, contactar al equipo de infraestructura.
