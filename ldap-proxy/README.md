# LDAP Proxy Server - INE

Servidor proxy para autenticación LDAP del Instituto Nacional Electoral (INE).

## 🚀 Instalación Rápida

```bash
# 1. Clonar el repositorio
git clone <tu-repo>
cd ldap-test/ldap-proxy

# 2. Ejecutar configuración automática
chmod +x setup.sh
./setup.sh

# 3. Iniciar el servidor
./start-with-proxy.sh
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
LDAP_URL=ldap://ldap-pruebas.ine.mx:389
LDAP_USER_DN_PATTERN=uid={0},ou=People,dc=ife.org.mx
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

### Opción 1: Script con logs (Recomendado)
```bash
./start-with-proxy.sh
```

### Opción 2: NPM Scripts
```bash
npm start          # Inicio normal
npm run dev        # Modo desarrollo con watch
```

### Opción 3: Scripts individuales
```bash
./start-server.sh     # Inicio básico
./start-with-logs.sh  # Con logs detallados
```

## 🌐 Integración con Angular

### 1. Usando Proxy (Recomendado)
```bash
# En tu proyecto Angular
ng serve --proxy-config /path/to/ldap-proxy/proxy.conf.json
```

### 2. Configuración manual en Angular
Copia el archivo `proxy.conf.json` a tu proyecto Angular y configura en `angular.json`:

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
| `LDAP_GROUP_SEARCH_BASE` | Base de búsqueda de grupos | `ou=Groups,dc=ife.org.mx` |
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
├── proxy.conf.json        # Configuración proxy Angular
├── setup.sh               # Script de instalación
├── start-server.sh        # Script de inicio básico
├── start-with-logs.sh     # Script con logs
├── start-with-proxy.sh    # Script completo con proxy
└── README.md             # Esta documentación
```

## 🔒 Seguridad

- Cambiar `JWT_SECRET` en producción
- Usar HTTPS en producción
- Configurar CORS apropiadamente
- Revisar logs periódicamente

## 📞 Soporte

Para problemas o dudas sobre la configuración LDAP del INE, contactar al equipo de infraestructura.
