require('dotenv').config();
const express = require('express');
const path = require('path');
const compression = require('compression');
const cors = require('cors');
const database = require('./services/database');
const config = require('./config');
const mailer = require('./services/mailer');
const vencimientosService = require('./services/vencimientos');

const app = express();
const PORT = config.app.port;
const HOST = config.app.host;

app.set('trust proxy', 1);
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    const allowed = origin === config.app.url
      || origin.includes('.duckdns.org')
      || origin.includes('.onrender.com')
      || /^http:\/\/localhost(:\d+)?$/.test(origin);
    cb(null, allowed);
  },
}));
app.use(compression());
app.use(express.json({ limit: config.app.bodyLimit }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'");
  next();
});
const crypto = require('crypto');
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html') {
    const cookie = req.headers.cookie || '';
    const m = cookie.match(new RegExp('(?:^|;\\s*)' + config.security.visitorCookie + '=([^;]+)'));
    const vv = m ? m[1] : crypto.randomBytes(8).toString('hex');
    if (!m) {
      const secure = (req.secure || req.headers['x-forwarded-proto'] === 'https') ? '; Secure' : '';
      res.setHeader('Set-Cookie', config.security.visitorCookie + '=' + vv + '; Path=/; Max-Age=' + config.security.visitorCookieMaxAge + '; HttpOnly; SameSite=Lax' + secure);
    }
    database.incrementVisits(vv).catch(() => {});
    const src = req.query.utm_source || req.query.ref || 'directo';
    database.incrementSource(src).catch(() => {});
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
    if (filePath.endsWith('manifest.webmanifest') || filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
  },
}));

app.get('/manifest.webmanifest', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.sendFile(path.join(__dirname, 'public', 'manifest.webmanifest'));
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/monotributo', require('./routes/monotributo'));
app.use('/api/cotizaciones', require('./routes/exchange'));
app.use('/api/gastos', require('./routes/expenses'));
app.use('/api/sueldos', require('./routes/salary'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/export', require('./routes/export'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/tools', require('./routes/tools'));
app.use('/api/metrics', require('./routes/metrics'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/news', require('./routes/news'));

app.use((err, req, res, next) => {
  console.error('Error no controlado:', err && err.message);
  res.status(err && err.statusCode ? err.statusCode : 500).json({ error: 'Error interno del servidor' });
});

app.get('/api/status', (req, res) => {
  res.json({
    ok: true, name: config.app.name, version: config.app.version,
    mode: process.env.DATABASE_URL ? 'produccion' : 'desarrollo',
    uptime: process.uptime(),
    endpoints: {
      auth: '/api/auth', monotributo: '/api/monotributo',
      cotizaciones: '/api/cotizaciones', gastos: '/api/gastos',
      sueldos: '/api/sueldos', pagos: '/api/payments',
      export: '/api/export', alerts: '/api/alerts', tools: '/api/tools',
      news: '/api/news', reviews: '/api/reviews',
    },
  });
});

let autoSaveInterval;
function startAutoSave() {
  autoSaveInterval = setInterval(() => {
    try { database.save(); } catch (e) { console.error('Auto-save error:', e.message); }
  }, config.app.autoSaveMs);
}

// ===== Recordatorios de vencimientos por email (1 vez por usuario por día) =====
const lastReminderSent = {};
async function sendVencimientoReminders() {
  try {
    if (!mailer.isConfigured()) return;
    const upcoming = vencimientosService.getUpcoming(7);
    if (!upcoming.length) return;
    const users = await database.getUsersForEmailAlerts();
    if (!users.length) return;
    const today = new Date().toISOString().split('T')[0];
    const lista = upcoming.map(v => '• <strong>' + v.concepto + '</strong>: ' + v.fecha).join('<br>');
    let enviados = 0;
    for (const u of users) {
      const key = u.id + ':' + today;
      if (lastReminderSent[key]) continue;
      const html = '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto">' +
        '<h2 style="color:#3b82f6">' + config.app.name + '</h2>' +
        '<p>Hola' + (u.name ? ' ' + u.name : '') + ', estos son los próximos vencimientos:</p>' +
        '<p>' + lista + '</p>' +
        '<p style="font-size:.85rem;color:#64748b">Podés desactivar estos recordatorios desde la pestaña Alertas de la app.</p>' +
        '<p style="font-size:.75rem;color:#94a3b8">' + config.app.name + ' no es un sitio oficial de ARCA (ex AFIP).</p></div>';
      await mailer.send({ to: u.email, subject: 'Recordatorio: vencimientos próximos', html });
      lastReminderSent[key] = 1;
      enviados++;
    }
    if (enviados) console.log('Recordatorios por email enviados: ' + enviados);
  } catch (e) {
    console.error('Error en recordatorio de vencimientos:', e && e.message);
  }
}

async function shutdown(signal) {
  console.log(`\n${signal} recibido. Cerrando...`);
  clearInterval(autoSaveInterval);
  database.save();
  database.close();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
  try { database.save(); } catch {}
  process.exit(1);
});

database.init().then(() => {
  startAutoSave();
  setInterval(sendVencimientoReminders, 12 * 60 * 60 * 1000);
  setTimeout(sendVencimientoReminders, 15000);
  app.listen(PORT, HOST, () => {
    console.log(`${config.app.name} v${config.app.version} corriendo en http://localhost:${PORT}`);
    console.log(`Modo: ${process.env.DATABASE_URL ? 'produccion (PostgreSQL)' : 'desarrollo (SQLite)'}`);
    console.log(`MP: ${process.env.MP_ACCESS_TOKEN ? 'real' : 'simulado'}`);
    console.log(`Email: ${mailer.isConfigured() ? 'configurado' : 'desactivado (sin SMTP)'}`);
  });
}).catch(err => {
  console.error('Error al iniciar:', err);
  process.exit(1);
});