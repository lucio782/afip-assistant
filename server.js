require('dotenv').config();
const express = require('express');
const path = require('path');
const compression = require('compression');
const cors = require('cors');
const database = require('./services/database');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
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

app.use((err, req, res, next) => {
  console.error('Error no controlado:', err.message);
  res.status(500).json({ error: 'Error interno del servidor', detail: err.message });
});

app.get('/api/status', (req, res) => {
  res.json({
    ok: true, name: 'AFIP Assistant', version: '2.0.0',
    mode: process.env.DATABASE_URL ? 'produccion' : 'desarrollo',
    uptime: process.uptime(),
    endpoints: {
      auth: '/api/auth', monotributo: '/api/monotributo',
      cotizaciones: '/api/cotizaciones', gastos: '/api/gastos',
      sueldos: '/api/sueldos', pagos: '/api/payments',
      export: '/api/export', alerts: '/api/alerts', tools: '/api/tools',
    },
  });
});

let autoSaveInterval;
function startAutoSave() {
  autoSaveInterval = setInterval(() => {
    try { database.save(); } catch (e) { console.error('Auto-save error:', e.message); }
  }, 5 * 60 * 1000);
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
  console.error('Error no capturado:', err.message);
  database.save();
});

database.init().then(() => {
  startAutoSave();
  app.listen(PORT, HOST, () => {
    console.log(`AFIP Assistant v2 corriendo en http://localhost:${PORT}`);
    console.log(`Modo: ${process.env.DATABASE_URL ? 'produccion (PostgreSQL)' : 'desarrollo (SQLite)'}`);
    console.log(`MP: ${process.env.MP_ACCESS_TOKEN ? 'real' : 'simulado'}`);
  });
}).catch(err => {
  console.error('Error al iniciar:', err);
  process.exit(1);
});