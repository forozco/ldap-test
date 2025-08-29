import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import ldap from "ldapjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();

// Middleware de logging para todas las peticiones
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url} - IP: ${req.ip}`);
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
const GROUP_SEARCH_FILTER = process.env.LDAP_GROUP_SEARCH_FILTER || "(memberUid={0})";
const DEV_MODE = process.env.DEV_MODE === "true";

function buildUserDN(username) {
  return USER_DN_PATTERN.replace("{0}", username);
}

// Función para probar múltiples formatos de DN
async function tryMultipleDNFormats(username, password) {
  const dnFormats = [
    `uid=${username},ou=People,dc=ife,dc=org,dc=mx`,
    `cn=${username},ou=externo,ou=People,dc=ine,dc=mx`,
    `uid=${username},ou=People,dc=ine,dc=mx`,
    `cn=${username},ou=People,dc=ife,dc=org,dc=mx`
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

function ldapSearch(client, base, options) {
  return new Promise((resolve, reject) => {
    console.log(`[LDAP] Buscando grupos en base: ${base}`);
    console.log(`[LDAP] Filtro de búsqueda: ${options.filter}`);

    const entries = [];
    client.search(base, options, (err, res) => {
      if (err) {
        console.log(`[LDAP] Error en búsqueda:`, err.message);
        return reject(err);
      }

      res.on("searchEntry", (entry) => {
        console.log(`[LDAP] Grupo encontrado:`, entry.object.cn);
        entries.push(entry.object);
      });

      res.on("error", (err) => {
        console.log(`[LDAP] Error en resultados de búsqueda:`, err.message);
        reject(err);
      });

      res.on("end", () => {
        console.log(`[LDAP] Búsqueda completada. ${entries.length} grupos encontrados`);
        resolve(entries);
      });
    });
  });
}

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
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
    console.log(`[LOGIN] Bind exitoso con DN: ${userDN}, buscando grupos...`);

    let groups = [];
    try {
      const groupFilter = GROUP_SEARCH_FILTER.replace("{0}", username);
      console.log(`[LOGIN] Filtro de grupos: ${groupFilter}`);
      const groupEntries = await ldapSearch(client, GROUP_BASE, {
        scope: "sub",
        filter: groupFilter
      });
      groups = groupEntries.map(g => g.cn).filter(Boolean);
      console.log(`[LOGIN] Grupos del usuario: ${groups.join(', ')}`);
    } catch (groupErr) {
      console.log(`[LOGIN] Error buscando grupos:`, groupErr.message);
    }

    client.unbind(() => {});
    console.log(`[LOGIN] Generando token JWT...`);

    const token = jwt.sign(
      { sub: username, dn: userDN, groups },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "1h" }
    );

    console.log(`[LOGIN] Login exitoso para: ${username}`);
    return res.json({ ok: true, token, user: { username, dn: userDN, groups } });
  } catch (err) {
    console.log(`[ERROR] Error LDAP para usuario ${username}:`, err.message);
    console.log(`[ERROR] LDAP URL: ${LDAP_URL}`);
    console.log(`[ERROR] Detalles completos:`, err);
    return res.status(401).json({ ok: false, error: "Credenciales inválidas o error de conexión LDAP" });
  }
});

app.get("/api/auth/profile", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "Falta token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ ok: true, user: payload });
  } catch {
    res.status(401).json({ ok: false, error: "Token inválido o expirado" });
  }
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
});

// Logging de errores no capturados
process.on('uncaughtException', (err) => {
  console.error('❌ Error no capturado:', err.message);
  console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
});