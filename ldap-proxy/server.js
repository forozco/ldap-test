import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import ldap from "ldapjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();

// Middleware de logging detallado para todas las peticiones
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n🔥🔥🔥 PETICIÓN DETECTADA 🔥🔥🔥`);
  console.log(`\n==================== NUEVA PETICIÓN ====================`);
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  console.log(`[REQUEST] IP: ${req.ip}`);
  console.log(`[REQUEST] User-Agent: ${req.get('User-Agent') || 'N/A'}`);
  console.log(`[REQUEST] Content-Type: ${req.get('Content-Type') || 'N/A'}`);
  console.log(`[REQUEST] Origin: ${req.get('Origin') || 'N/A'}`);
  console.log(`[REQUEST] Headers:`, JSON.stringify(req.headers, null, 2));

  if (req.body && Object.keys(req.body).length > 0) {
    const bodyToLog = { ...req.body };
    if (bodyToLog.password) bodyToLog.password = '***HIDDEN***';
    console.log(`[REQUEST] Body:`, JSON.stringify(bodyToLog, null, 2));
  }

  // Interceptar la respuesta para logear
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`[RESPONSE] Status: ${res.statusCode}`);
    console.log(`[RESPONSE] Body:`, data);
    console.log(`==================== FIN PETICIÓN ====================\n`);
    originalSend.call(this, data);
  };

  next();
});

app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",") || "*",
  credentials: true
}));

const LDAP_URL = process.env.LDAP_URL;
const USER_DN_PATTERN = process.env.LDAP_USER_DN_PATTERN;
const GROUP_BASE = process.env.LDAP_GROUP_SEARCH_BASE;
const GROUP_SEARCH_FILTER = process.env.LDAP_GROUP_SEARCH_FILTER || "(memberUid={1})";
const GROUP_ROLE_ATTRIBUTE = process.env.LDAP_GROUP_ROLE_ATTRIBUTE || "cn";
const DEV_MODE = process.env.DEV_MODE === "true";

function buildUserDN(username) {
  return USER_DN_PATTERN.replace("{0}", username);
}

// Función para probar múltiples formatos de DN basados en configuración INE
async function tryMultipleDNFormats(username, password) {
  const dnFormats = [
    // Patrón principal de INE (nuevo formato con dc=ife.org.mx)
    `uid=${username},ou=People,dc=ife.org.mx`,
    `cn=${username},ou=People,dc=ife.org.mx`,
    // Patrones para usuarios externos (nuevo formato)
    `uid=${username},ou=externo,ou=People,dc=ife.org.mx`,
    `cn=${username},ou=externo,ou=People,dc=ife.org.mx`,
    // Patrón principal de INE (formato antiguo)
    `uid=${username},ou=People,dc=ife,dc=org,dc=mx`,
    `cn=${username},ou=People,dc=ife,dc=org,dc=mx`,
    // Patrones alternativos INE
    `uid=${username},ou=People,dc=ine,dc=mx`,
    `cn=${username},ou=People,dc=ine,dc=mx`,
    // Patrones para usuarios externos (formato antiguo)
    `cn=${username},ou=externo,ou=People,dc=ine,dc=mx`,
    `uid=${username},ou=externo,ou=People,dc=ine,dc=mx`,
    // Patrón simple sin OU (nuevo formato)
    `uid=${username},dc=ife.org.mx`,
    `cn=${username},dc=ife.org.mx`,
    // Patrón simple sin OU (formato antiguo)
    `uid=${username},dc=ife,dc=org,dc=mx`,
    `cn=${username},dc=ife,dc=org,dc=mx`
  ];

  for (const userDN of dnFormats) {
    try {
      console.log(`[LDAP] Probando DN: ${userDN}`);
      const client = await ldapBind(userDN, password);
      console.log(`[LDAP] ¡Éxito con DN: ${userDN}!`);
      return { client, userDN };
    } catch (err) {
      console.log(`[LDAP] Falló DN ${userDN}: ${err.message}`);
    }
  }
  throw new Error("No se encontró un formato DN válido");
}

function ldapBind(userDN, password) {
  return new Promise((resolve, reject) => {
    console.log(`[LDAP] Intentando conectar a: ${LDAP_URL}`);
    console.log(`[LDAP] UserDN: ${userDN}`);
    console.log(`[LDAP] Password length: ${password.length} caracteres`);

    const client = ldap.createClient({ url: LDAP_URL, reconnect: false });

    client.on('connect', () => {
      console.log(`[LDAP] Conexión establecida con ${LDAP_URL}`);
    });

    client.on('connectError', (err) => {
      console.log(`[LDAP] Error de conexión:`, err.message);
    });

    client.bind(userDN, password, (err) => {
      if (err) {
        console.log(`[LDAP] Error en bind:`, err.message);
        console.log(`[LDAP] Código de error:`, err.code);
        console.log(`[LDAP] Tipo de error:`, err.name);
        client.unbind(() => {});
        return reject(err);
      }
      console.log(`[LDAP] Bind exitoso para: ${userDN}`);
      resolve(client);
    });
  });
}

// Función para buscar grupos con múltiples patrones (basada en Spring Security INE)
async function findUserGroups(client, userDN, username) {
  console.log(`[GROUPS] Iniciando búsqueda de grupos para: ${username}`);
  console.log(`[GROUPS] DN del usuario: ${userDN}`);

  const groupSearchPatterns = [
    // Patrón 1: Configuración exacta del INE (Spring Security)
    // {1} se reemplaza con el DN completo del usuario
    {
      base: GROUP_BASE,
      filter: GROUP_SEARCH_FILTER.replace("{1}", userDN),
      description: "Configuración INE principal con DN completo"
    },
    // Patrón 2: {1} se reemplaza con el username
    {
      base: GROUP_BASE,
      filter: GROUP_SEARCH_FILTER.replace("{1}", username),
      description: "Configuración INE con username"
    },
    // Patrón 3: Nuevo formato de dominio con username
    {
      base: "ou=Grupos,dc=ife.org.mx",
      filter: `(memberUid=${username})`,
      description: "Nuevo formato dc=ife.org.mx con username"
    },
    // Patrón 4: Nuevo formato de dominio con DN completo
    {
      base: "ou=Grupos,dc=ife.org.mx",
      filter: `(member=${userDN})`,
      description: "Nuevo formato dc=ife.org.mx con DN completo"
    },
    // Patrón 5: memberUid con username simple (formato antiguo)
    {
      base: "ou=Grupos,dc=ife,dc=org,dc=mx",
      filter: `(memberUid=${username})`,
      description: "memberUid directo con username (formato antiguo)"
    },
    // Patrón 6: member con DN completo (formato antiguo)
    {
      base: "ou=Grupos,dc=ife,dc=org,dc=mx",
      filter: `(member=${userDN})`,
      description: "member con DN completo (formato antiguo)"
    },
    // Patrón 7: uniqueMember con DN completo
    {
      base: "ou=Grupos,dc=ife,dc=org,dc=mx",
      filter: `(uniqueMember=${userDN})`,
      description: "uniqueMember con DN completo"
    },
    // Patrón 8: Búsqueda en base INE
    {
      base: "ou=Grupos,dc=ine,dc=mx",
      filter: `(memberUid=${username})`,
      description: "Base INE con memberUid"
    },
    // Patrón 9: Búsqueda específica de roles SIMETIS/OBSERVADORES (formato nuevo)
    {
      base: "dc=ife.org.mx",
      filter: `(&(|(memberUid=${username})(member=${userDN}))(|(cn=*SIMETIS*)(cn=*OBSERVADORES*)(cn=ROLE_*)))`,
      description: "Búsqueda específica de authorities SIMETIS/OBSERVADORES (formato nuevo)"
    },
    // Patrón 10: Búsqueda específica de roles SIMETIS/OBSERVADORES (formato antiguo)
    {
      base: "dc=ife,dc=org,dc=mx",
      filter: `(&(|(memberUid=${username})(member=${userDN}))(|(cn=*SIMETIS*)(cn=*OBSERVADORES*)(cn=ROLE_*)))`,
      description: "Búsqueda específica de authorities SIMETIS/OBSERVADORES (formato antiguo)"
    }
  ];

  let allGroups = [];

  for (const pattern of groupSearchPatterns) {
    try {
      console.log(`[GROUPS] 🔍 ${pattern.description}`);
      console.log(`[GROUPS] Base: ${pattern.base}`);
      console.log(`[GROUPS] Filtro: ${pattern.filter}`);

      const groups = await ldapSearch(client, pattern.base, {
        scope: "sub",
        filter: pattern.filter,
        attributes: ['cn', 'description', 'member', 'memberUid', 'uniqueMember', 'objectClass']
      });

      if (groups.length > 0) {
        console.log(`[GROUPS] ✅ Encontrados ${groups.length} grupos`);
        groups.forEach(group => {
          const groupName = group[GROUP_ROLE_ATTRIBUTE] || group.cn;
          console.log(`[GROUPS] 📋 Grupo: ${groupName} (DN: ${group.dn})`);
        });
        allGroups = allGroups.concat(groups);
      } else {
        console.log(`[GROUPS] ❌ No se encontraron grupos`);
      }
    } catch (err) {
      console.log(`[GROUPS] ⚠️ Error en patrón ${pattern.base}: ${err.message}`);
    }
  }

  // Eliminar duplicados por nombre de grupo
  const uniqueGroups = allGroups.filter((group, index, self) => {
    const groupName = group[GROUP_ROLE_ATTRIBUTE] || group.cn || group.dn;
    return index === self.findIndex(g =>
      (g[GROUP_ROLE_ATTRIBUTE] || g.cn || g.dn) === groupName
    );
  });

  console.log(`[GROUPS] 📊 Total de grupos únicos encontrados: ${uniqueGroups.length}`);
  return uniqueGroups;
}

// Función auxiliar para realizar búsquedas LDAP
function ldapSearch(client, base, options) {
  return new Promise((resolve, reject) => {
    console.log(`[LDAP] Realizando búsqueda - Base: ${base}, Filtro: ${options.filter}`);

    const entries = [];
    client.search(base, options, (err, res) => {
      if (err) {
        console.log(`[LDAP] Error en búsqueda:`, err.message);
        return reject(err);
      }

      res.on("searchEntry", (entry) => {
        console.log(`[LDAP] Entrada encontrada: ${entry.dn}`);

        // Obtener el objeto con todos los atributos
        const obj = entry.object || {};
        obj.dn = entry.dn;

        // Intentar extraer cn de diferentes formas
        if (!obj.cn && entry.dn) {
          // Si no hay cn, intentar extraerlo del DN
          const dnString = typeof entry.dn === 'string' ? entry.dn : entry.dn.toString();
          const cnMatch = dnString.match(/cn=([^,]+)/i);
          if (cnMatch) {
            obj.cn = cnMatch[1];
            console.log(`[LDAP] CN extraído del DN: ${obj.cn}`);
          }
        }

        // Debug: mostrar todos los atributos disponibles
        console.log(`[LDAP] Atributos disponibles:`, Object.keys(obj));
        if (obj.cn) {
          console.log(`[LDAP] CN encontrado: ${obj.cn}`);
        }

        entries.push(obj);
      });

      res.on("error", (err) => {
        console.log(`[LDAP] Error en resultados de búsqueda:`, err.message);
        reject(err);
      });

      res.on("end", () => {
        console.log(`[LDAP] Búsqueda completada. ${entries.length} entradas encontradas`);
        resolve(entries);
      });
    });
  });
}

// Función para obtener información adicional del usuario (basada en Java config)
function getUserDetails(client, userDN) {
  return new Promise((resolve, reject) => {
    console.log(`[LDAP] Obteniendo detalles del usuario: ${userDN}`);

    const options = {
      scope: 'base',
      attributes: ['cn', 'sn', 'mail', 'idDistrito', 'idEstado', 'uid', 'givenName']
    };

    client.search(userDN, options, (err, res) => {
      if (err) {
        console.log(`[LDAP] Error obteniendo detalles del usuario:`, err.message);
        return reject(err);
      }

      let userDetails = {};
      res.on("searchEntry", (entry) => {
        const attributes = entry.object || {};
        console.log(`[LDAP] Atributos encontrados:`, attributes);
        userDetails = {
          nombreCompleto: attributes.cn || 'N/A',
          nombreCorto: attributes.sn || 'N/A',
          email: attributes.mail || 'N/A',
          idDistrito: attributes.idDistrito || 'N/A',
          idEstado: attributes.idEstado || 'N/A',
          nombreUsuario: attributes.uid || userDN.split(',')[0].split('=')[1],
          givenName: attributes.givenName || 'N/A'
        };
        console.log(`[LDAP] Detalles del usuario obtenidos:`, userDetails);
      });

      res.on("error", (err) => {
        console.log(`[LDAP] Error en resultados de detalles:`, err.message);
        reject(err);
      });

      res.on("end", () => {
        // Si no se encontraron detalles, usar valores por defecto
        if (Object.keys(userDetails).length === 0) {
          console.log(`[LDAP] No se encontraron detalles adicionales, usando valores por defecto`);
          userDetails = {
            nombreCompleto: 'N/A',
            nombreCorto: 'N/A',
            email: 'N/A',
            idDistrito: 'N/A',
            idEstado: 'N/A',
            nombreUsuario: userDN.split(',')[0].split('=')[1],
            givenName: 'N/A'
          };
        }
        resolve(userDetails);
      });
    });
  });
}

app.post("/api/auth/login", async (req, res) => {
  console.log(`\n🔐 ENDPOINT LOGIN ALCANZADO 🔐`);
  console.log(`[LOGIN] Método: ${req.method}`);
  console.log(`[LOGIN] URL: ${req.url}`);
  console.log(`[LOGIN] Ruta exacta: /api/auth/login`);

  const { username, password } = req.body || {};
  console.log(`[LOGIN] Username recibido: ${username || 'UNDEFINED'}`);
  console.log(`[LOGIN] Password recibido: ${password ? '***EXISTE***' : 'UNDEFINED'}`);

  if (!username || !password) {
    console.log(`[LOGIN] ❌ Faltan credenciales`);
    return res.status(400).json({ ok: false, error: "username y password son requeridos" });
  }

  // Modo desarrollo - simular autenticación
  if (DEV_MODE) {
    console.log(`[DEV MODE] Simulando login para usuario: ${username}`);

    // Simular usuarios válidos en modo desarrollo
    const validUsers = ["admin", "test", "demo"];
    const validPassword = "123456";

    if (validUsers.includes(username.toLowerCase()) && password === validPassword) {
      const userDN = buildUserDN(username);
      const mockGroups = username === "admin" ? ["Administradores", "Usuarios"] : ["Usuarios"];

      const token = jwt.sign(
        { sub: username, dn: userDN, groups: mockGroups },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES || "1h" }
      );

      return res.json({
        ok: true,
        token,
        user: { username, dn: userDN, groups: mockGroups }
      });
    } else {
      return res.status(401).json({ ok: false, error: "Credenciales inválidas (dev: admin/test/demo con password 123456)" });
    }
  }

  console.log(`[LOGIN] Intento de login para usuario: ${username}`);

  try {
    console.log(`[LOGIN] Probando múltiples formatos DN...`);
    const { client, userDN } = await tryMultipleDNFormats(username, password);
    console.log(`[LOGIN] Bind exitoso con DN: ${userDN}, obteniendo detalles del usuario...`);

    // Obtener detalles del usuario (como en Java config)
    let userDetails = {};
    try {
      userDetails = await getUserDetails(client, userDN);
      console.log(`[LOGIN] Detalles del usuario obtenidos:`, userDetails);
    } catch (detailErr) {
      console.log(`[LOGIN] Error obteniendo detalles del usuario:`, detailErr.message);
      // Usar valores por defecto si no se pueden obtener los detalles
      userDetails = {
        nombreCompleto: 'N/A',
        nombreCorto: 'N/A',
        email: 'N/A',
        idDistrito: 'N/A',
        idEstado: 'N/A',
        nombreUsuario: username,
        givenName: 'N/A'
      };
    }

    console.log(`[LOGIN] Buscando grupos del usuario...`);
    let groups = [];
    let authorities = []; // Declarar authorities aquí

    try {
      // Buscar grupos usando múltiples patrones (implementación similar a Spring Security)
      const groupEntries = await findUserGroups(client, userDN, username);

      // Procesar grupos y authorities como lo hace Spring Security INE
      const groupNames = [];

      for (const group of groupEntries) {
        let roleName = group[GROUP_ROLE_ATTRIBUTE] || group.cn;

        // Si no hay cn, extraer del DN
        if (!roleName && group.dn && typeof group.dn === 'string') {
          const dnMatch = group.dn.match(/cn=([^,]+)/i);
          if (dnMatch) {
            roleName = dnMatch[1];
          }
        }

        if (roleName) {
          groupNames.push(roleName);

          // Spring Security automáticamente convierte nombres de grupo en authorities
          // Si el nombre ya empieza con ROLE_, lo mantiene, sino lo agrega
          if (roleName.startsWith('ROLE_')) {
            authorities.push(roleName);
          } else {
            authorities.push(`ROLE_${roleName.toUpperCase()}`);
          }
        }
      }

      console.log(`[LOGIN] 📋 Grupos encontrados: ${groupNames.join(', ')}`);
      console.log(`[LOGIN] 🔐 Authorities generadas: ${authorities.join(', ')}`);

      // Mantener grupos y authorities separados
      groups = groupNames;

    } catch (groupErr) {
      console.log(`[LOGIN] Error buscando grupos:`, groupErr.message);
      // authorities ya está declarado arriba, no redeclararla
    }

    client.unbind(() => {});
    console.log(`[LOGIN] Generando token JWT...`);

    // Crear payload del JWT con información completa del usuario
    const jwtPayload = {
      sub: username,
      dn: userDN,
      groups,
      authorities: authorities || [], // Campo authorities separado
      userDetails: userDetails,
      // Campos adicionales basados en configuración INE
      nombreCompleto: userDetails.nombreCompleto,
      email: userDetails.email,
      idDistrito: userDetails.idDistrito,
      idEstado: userDetails.idEstado
    };

    const token = jwt.sign(
      jwtPayload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "1h" }
    );

    console.log(`[LOGIN] Login exitoso para: ${username}`);
    return res.json({
      ok: true,
      token,
      user: {
        username,
        dn: userDN,
        groups,
        authorities: authorities || [], // Campo authorities en la respuesta
        details: userDetails
      }
    });
  } catch (err) {
    console.log(`[ERROR] Error LDAP para usuario ${username}:`, err.message);
    console.log(`[ERROR] LDAP URL: ${LDAP_URL}`);
    console.log(`[ERROR] Detalles completos:`, err);

    // Determinar el tipo de error y código HTTP apropiado
    if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED') || err.message.includes('timeout')) {
      // Error de conectividad/infraestructura
      console.log(`[ERROR] Error de conectividad al servidor LDAP`);
      return res.status(500).json({
        ok: false,
        error: "Error de conectividad al servidor LDAP. Verifique la VPN."
      });
    } else if (err.message.includes('Invalid Credentials') || err.code === 49 || err.message.includes('No se encontró un formato DN válido')) {
      // Error de credenciales (incluye cuando todos los DN fallan)
      console.log(`[ERROR] Credenciales inválidas`);
      return res.status(401).json({
        ok: false,
        error: "Credenciales inválidas"
      });
    } else {
      // Otros errores LDAP
      console.log(`[ERROR] Error general del servidor LDAP`);
      return res.status(500).json({
        ok: false,
        error: "Error interno del servidor LDAP"
      });
    }
  }
});

app.get("/api/auth/profile", (req, res) => {
  console.log(`\n👤 ENDPOINT PROFILE ALCANZADO 👤`);
  console.log(`[PROFILE] Método: ${req.method}`);
  console.log(`[PROFILE] URL: ${req.url}`);
  console.log(`[PROFILE] Ruta exacta: /api/auth/profile`);

  const auth = req.headers.authorization || "";
  console.log(`[PROFILE] Authorization header: ${auth || 'NO PRESENTE'}`);

  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  console.log(`[PROFILE] Token extraído: ${token ? 'PRESENTE' : 'NO PRESENTE'}`);

  if (!token) {
    console.log(`[PROFILE] ❌ Falta token`);
    return res.status(401).json({ ok: false, error: "Falta token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    console.log(`[PROFILE] ✅ Token válido para usuario: ${payload.sub}`);
    res.json({ ok: true, user: payload });
  } catch (err) {
    console.log(`[PROFILE] ❌ Token inválido:`, err.message);
    res.status(401).json({ ok: false, error: "Token inválido o expirado" });
  }
});

// Middleware para manejar rutas no encontradas (404)
app.use('*', (req, res) => {
  console.log(`\n❌ RUTA NO ENCONTRADA (404) ❌`);
  console.log(`[404] Método: ${req.method}`);
  console.log(`[404] URL solicitada: ${req.originalUrl || req.url}`);
  console.log(`[404] Base URL: ${req.baseUrl}`);
  console.log(`[404] Path: ${req.path}`);
  console.log(`[404] Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`[404] Rutas disponibles:`);
  console.log(`   ✅ POST /api/auth/login`);
  console.log(`   ✅ GET  /api/auth/profile`);
  console.log(`❌ FIN ERROR 404 ❌\n`);

  res.status(404).json({
    ok: false,
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    availableRoutes: [
      'POST /api/auth/login',
      'GET /api/auth/profile'
    ]
  });
});

// Middleware global de manejo de errores
app.use((err, req, res, next) => {
  console.log(`\n❌ ERROR GLOBAL ❌`);
  console.log(`[ERROR] Mensaje: ${err.message}`);
  console.log(`[ERROR] Stack:`, err.stack);
  console.log(`[ERROR] URL: ${req.method} ${req.originalUrl}`);
  console.log(`❌ FIN ERROR GLOBAL ❌\n`);

  res.status(500).json({
    ok: false,
    error: 'Error interno del servidor',
    details: err.message
  });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`========================================`);
  console.log(`🚀 LDAP proxy iniciado exitosamente`);
  console.log(`📡 URL: http://localhost:${port}`);
  console.log(`🔗 LDAP Server: ${LDAP_URL}`);
  console.log(`🔧 Modo desarrollo: ${DEV_MODE ? 'ACTIVADO' : 'DESACTIVADO'}`);
  console.log(`📋 Endpoints disponibles:`);
  console.log(`   POST /api/auth/login`);
  console.log(`   GET  /api/auth/profile`);
  console.log(`========================================`);
  console.log(`🔍 ESPERANDO PETICIONES... Logs aparecerán aquí abajo:`);
  console.log(`========================================`);
});

// Logging de errores no capturados
process.on('uncaughtException', (err) => {
  console.error('❌ Error no capturado:', err.message);
  console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
});