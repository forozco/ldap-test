# Angular LDAP Login

Este es un proyecto de autenticación Angular con integración LDAP que incluye:

## Componentes principales

- **Frontend Angular**: Aplicación de login con autenticación
- **Proxy LDAP**: Servidor Node.js que actúa como proxy para las consultas LDAP

## Estructura del proyecto

```
angular-ldap-login/
├── angular-ldap-login/     # Aplicación Angular
│   ├── src/
│   │   └── app/
│   │       ├── auth/       # Servicios de autenticación
│   │       └── login/      # Componente de login
│   └── ...
└── ldap-proxy/            # Servidor proxy LDAP
    ├── server.js
    └── package.json
```

## Instalación

### Frontend Angular
```bash
cd angular-ldap-login
npm install
ng serve
```

### Servidor LDAP Proxy
```bash
cd ldap-proxy
npm install
npm start
```

## Configuración

1. Configura los parámetros de tu servidor LDAP en el proxy
2. Ajusta las URLs de la API en la aplicación Angular
3. Ejecuta ambos servicios para el funcionamiento completo

## Tecnologías utilizadas

- Angular 18+
- Node.js
- LDAP
- TypeScript
- Bootstrap/CSS

## Desarrollo

Para desarrollo local, asegúrate de tener ambos servicios ejecutándose:
- Frontend Angular en puerto 4200
- Proxy LDAP en puerto 3000
