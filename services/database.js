const { v4: uuidv4 } = require('uuid');
const path = require('path');

let db = null;
let isPostgres = false;

async function init() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (DATABASE_URL) {
    return initPostgres(DATABASE_URL);
  }
  return initSQLite();
}

async function initPostgres(connectionString) {
  isPostgres = true;
  const { Pool } = require('pg');
  db = new Pool({ connectionString, max: 20, idleTimeoutMillis: 30000 });

  const client = await db.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, tier TEXT DEFAULT 'free', name TEXT DEFAULT '',
      email TEXT UNIQUE, password_hash TEXT DEFAULT '',
      mercadopago_id TEXT DEFAULT '', subscription_id TEXT DEFAULT '',
      subscription_status TEXT DEFAULT 'inactive',
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, amount REAL NOT NULL,
      currency TEXT DEFAULT 'ARS', category TEXT DEFAULT 'otros',
      description TEXT DEFAULT '', date TEXT DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS exchange_history (
      id TEXT PRIMARY KEY, date TEXT NOT NULL, source TEXT NOT NULL,
      buy REAL, sell REAL, created_at TIMESTAMP DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY, user_id TEXT DEFAULT 'guest', type TEXT NOT NULL,
      title TEXT NOT NULL, message TEXT, enabled INTEGER DEFAULT 1,
      triggered INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS rate_limits (
      user_id TEXT, expense_count INTEGER DEFAULT 0,
      month TEXT DEFAULT to_char(NOW(), 'YYYY-MM'),
      last_reset DATE DEFAULT CURRENT_DATE,
      PRIMARY KEY (user_id, month)
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS visits (
      date TEXT PRIMARY KEY, count INTEGER DEFAULT 0
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS visitors (
      date TEXT NOT NULL, vv TEXT NOT NULL,
      PRIMARY KEY (date, vv)
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT DEFAULT '',
      rating INTEGER DEFAULT 5, comment TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS sources (
      date TEXT NOT NULL, source TEXT NOT NULL, count INTEGER DEFAULT 0,
      PRIMARY KEY (date, source)
    )`);
    // Migrations: add missing columns on existing tables
    const { rows } = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`);
    const cols = rows.map(r => r.column_name);
    if (!cols.includes('password_hash')) await client.query(`ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT ''`);
    if (!cols.includes('email')) await client.query(`ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''`);
    if (!cols.includes('tier')) await client.query(`ALTER TABLE users ADD COLUMN tier TEXT DEFAULT 'free'`);
    if (!cols.includes('name')) await client.query(`ALTER TABLE users ADD COLUMN name TEXT DEFAULT ''`);
    if (!cols.includes('email_alerts')) await client.query(`ALTER TABLE users ADD COLUMN email_alerts INTEGER DEFAULT 1`);
  } finally {
    client.release();
  }
  console.log('PostgreSQL conectado');
  return db;
}

async function initSQLite() {
  isPostgres = false;
  const initSqlJs = require('sql.js');
  const fs = require('fs');
  const DB_FILE = path.join(__dirname, '..', 'data', 'afip.db');
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    db = new SQL.Database(fs.readFileSync(DB_FILE));
  } else {
    db = new SQL.Database();
  }
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, tier TEXT DEFAULT 'free', name TEXT DEFAULT '',
    email TEXT UNIQUE, password_hash TEXT DEFAULT '',
    mercadopago_id TEXT DEFAULT '', subscription_id TEXT DEFAULT '',
    subscription_status TEXT DEFAULT 'inactive',
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, amount REAL NOT NULL,
    currency TEXT DEFAULT 'ARS', category TEXT DEFAULT 'otros',
    description TEXT DEFAULT '', date TEXT DEFAULT (date('now')),
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS exchange_history (
    id TEXT PRIMARY KEY, date TEXT NOT NULL, source TEXT NOT NULL,
    buy REAL, sell REAL, created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY, user_id TEXT DEFAULT 'guest', type TEXT NOT NULL,
    title TEXT NOT NULL, message TEXT, enabled INTEGER DEFAULT 1,
    triggered INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS rate_limits (
    user_id TEXT, expense_count INTEGER DEFAULT 0,
    month TEXT DEFAULT (strftime('%Y-%m', 'now')),
    last_reset TEXT DEFAULT (date('now')),
    PRIMARY KEY (user_id, month)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS visits (
    date TEXT PRIMARY KEY, count INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS visitors (
    date TEXT NOT NULL, vv TEXT NOT NULL,
    PRIMARY KEY (date, vv)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT DEFAULT '',
    rating INTEGER DEFAULT 5, comment TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS sources (
    date TEXT NOT NULL, source TEXT NOT NULL, count INTEGER DEFAULT 0,
    PRIMARY KEY (date, source)
  )`);
  // Migrations: add missing columns on existing tables
  try {
    const cols = [];
    const stmt = db.prepare('PRAGMA table_info(users)');
    while (stmt.step()) cols.push(stmt.getAsObject().name);
    stmt.free();
    if (!cols.includes('password_hash')) db.run("ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT ''");
    if (!cols.includes('email')) db.run("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''");
    if (!cols.includes('tier')) db.run("ALTER TABLE users ADD COLUMN tier TEXT DEFAULT 'free'");
    if (!cols.includes('name')) db.run("ALTER TABLE users ADD COLUMN name TEXT DEFAULT ''");
    if (!cols.includes('email_alerts')) db.run("ALTER TABLE users ADD COLUMN email_alerts INTEGER DEFAULT 1");
  } catch (e) { console.error('Migración de schema falló:', e.message); }
  save();
  console.log('SQLite conectado');
  return db;
}

// ===== HELPERS =====
async function query(sql, params = []) {
  if (isPostgres) {
    const result = await db.query(sql, params);
    return result.rows;
  }
  const stmt = db.prepare(sql);
  if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH')) {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }
  stmt.bind(params);
  stmt.step();
  stmt.free();
  save();
  return [];
}

async function getOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function save() {
  if (!isPostgres && db && db.export) {
    const fs = require('fs');
    const data = db.export();
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'afip.db'), Buffer.from(data));
  }
}

function close() {
  if (!isPostgres && db && db.close) db.close();
}

// Fechas en hora de Argentina (UTC-3) para métricas y límites
function todayArg() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
}
function monthArg() {
  return todayArg().slice(0, 7);
}
function daysAgoArg(days) {
  return new Date(Date.now() - days * 86400000).toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
}

// ===== USERS =====
async function getUser(userId) {
  return getOne('SELECT * FROM users WHERE id = $1', [userId]);
}

async function getUserByEmail(email) {
  return getOne('SELECT * FROM users WHERE email = $1', [email]);
}

async function createUser({ email, password_hash, name }) {
  const id = uuidv4();
  await query('INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)', [id, email, password_hash, name]);
  return getUser(id);
}

async function getOrCreateUser(userId) {
  let user = await getUser(userId);
  if (!user) {
    const id = userId || uuidv4();
    await query('INSERT INTO users (id) VALUES ($1)', [id]);
    user = await getUser(id);
  }
  return user;
}

async function updateUserTier(userId, tier, mpData = {}) {
  await query("UPDATE users SET tier = $1, mercadopago_id = $2, subscription_id = $3, subscription_status = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5",
    [tier, mpData.mercadopago_id || '', mpData.subscription_id || '', mpData.subscription_status || 'active', userId]);
}

async function getEmailAlerts(userId) {
  const u = await getUser(userId);
  return u ? Number(u.email_alerts) !== 0 : false;
}

async function setEmailAlerts(userId, value) {
  await query('UPDATE users SET email_alerts = $1 WHERE id = $2', [value ? 1 : 0, userId]);
  return getEmailAlerts(userId);
}

async function getUsersForEmailAlerts() {
  return query("SELECT id, name, email FROM users WHERE email <> '' AND email IS NOT NULL AND email_alerts = 1");
}

// ===== EXPENSES =====
async function addExpense(userId, expense) {
  const id = expense.id || uuidv4();
  await query('INSERT INTO expenses (id, user_id, amount, currency, category, description, date) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, userId, expense.amount, expense.currency, expense.category, expense.description, expense.date || new Date().toISOString().split('T')[0]]);
  return getExpense(id);
}

async function getExpense(id) {
  return getOne('SELECT * FROM expenses WHERE id = $1', [id]);
}

async function getExpenses(userId, limit = 50, offset = 0) {
  return query('SELECT * FROM expenses WHERE user_id = $1 ORDER BY date DESC, created_at DESC LIMIT $2 OFFSET $3', [userId, limit, offset]);
}

async function getExpensesSince(userId, since) {
  return query('SELECT * FROM expenses WHERE user_id = $1 AND date >= $2 ORDER BY date ASC', [userId, since]);
}

async function deleteExpense(id, userId) {
  const existing = await getOne('SELECT id FROM expenses WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!existing) return false;
  await query('DELETE FROM expenses WHERE id = $1 AND user_id = $2', [id, userId]);
  return true;
}

async function getExpenseSummary(userId, month, year) {
  const m = String(month).padStart(2, '0');
  const prefix = `${year}-${m}`;
  if (isPostgres) {
    return query("SELECT currency, category, COUNT(*) as count, SUM(amount) as total FROM expenses WHERE user_id = $1 AND date LIKE $2 || '%' GROUP BY currency, category", [userId, prefix]);
  }
  return query("SELECT currency, category, COUNT(*) as count, SUM(amount) as total FROM expenses WHERE user_id = $1 AND date LIKE $2 GROUP BY currency, category", [userId, prefix + '%']);
}

// ===== EXCHANGE RATES =====
async function saveExchangeRate(date, source, buy, sell) {
  const id = uuidv4();
  await query('DELETE FROM exchange_history WHERE date = $1 AND source = $2', [date, source]);
  await query('INSERT INTO exchange_history (id, date, source, buy, sell) VALUES ($1, $2, $3, $4, $5)',
    [id, date, source, buy, sell]);
}

async function getExchangeHistory(source, days = 7) {
  const rows = await query('SELECT * FROM exchange_history WHERE source = $1 ORDER BY date DESC LIMIT $2', [source, days]);
  return rows.reverse();
}

// ===== ALERTS =====
async function createAlert(userId, type, title, message) {
  const id = uuidv4();
  await query('INSERT INTO alerts (id, user_id, type, title, message) VALUES ($1, $2, $3, $4, $5)', [id, userId, type, title, message]);
  return getAlert(id);
}

async function getAlert(id) {
  return getOne('SELECT * FROM alerts WHERE id = $1', [id]);
}

async function getUserAlerts(userId) {
  return query('SELECT * FROM alerts WHERE user_id = $1 AND enabled = 1 ORDER BY created_at DESC', [userId]);
}

// ===== MÉTRICAS =====
async function incrementVisits(vv = 'anon') {
  const today = todayArg();
  if (isPostgres) {
    await query('INSERT INTO visitors (date, vv) VALUES ($1, $2) ON CONFLICT DO NOTHING', [today, vv]);
    await query('INSERT INTO visits (date, count) VALUES ($1, 1) ON CONFLICT (date) DO UPDATE SET count = visits.count + 1', [today]);
  } else {
    await query('INSERT OR IGNORE INTO visitors (date, vv) VALUES ($1, $2)', [today, vv]);
    await query('INSERT OR IGNORE INTO visits (date, count) VALUES ($1, 1)', [today]);
    await query('UPDATE visits SET count = count + 1 WHERE date = $1', [today]);
  }
}

async function incrementSource(source, date) {
  const d = date || todayArg();
  const s = String(source || 'directo').slice(0, 40);
  if (isPostgres) {
    await query('INSERT INTO sources (date, source, count) VALUES ($1, $2, 1) ON CONFLICT (date, source) DO UPDATE SET count = sources.count + 1', [d, s]);
  } else {
    await query('INSERT OR IGNORE INTO sources (date, source, count) VALUES ($1, $2, 1)', [d, s]);
    await query('UPDATE sources SET count = count + 1 WHERE date = $1 AND source = $2', [d, s]);
  }
}

async function getVisitsSeries(days = 14) {
  const start = daysAgoArg(Number(days) - 1);
  return query('SELECT date, count FROM visits WHERE date >= $1 ORDER BY date ASC', [start]);
}

// ===== RESEÑAS =====
async function addReview(userId, name, rating, comment) {
  const id = uuidv4();
  await query('INSERT INTO reviews (id, user_id, name, rating, comment) VALUES ($1, $2, $3, $4, $5)', [id, userId, name, rating, comment]);
  return getReview(id);
}

async function getReview(id) {
  return getOne('SELECT * FROM reviews WHERE id = $1', [id]);
}

async function getReviews(limit = 50) {
  return query('SELECT * FROM reviews ORDER BY created_at DESC LIMIT $1', [limit]);
}

async function getReviewsByUser(userId) {
  return query('SELECT * FROM reviews WHERE user_id = $1', [userId]);
}

async function deleteReview(id) {
  await query('DELETE FROM reviews WHERE id = $1', [id]);
}

async function getMetrics() {
  const today = todayArg();
  const weekStart = daysAgoArg(7);

  const count = async (sql, params = []) => {
    const row = await getOne(sql, params);
    return row ? Number(row.n || row.count || 0) : 0;
  };

  let usuariosHoySql, activosSql, visitasUltimos7Sql, visitasTotalSql;
  let unicosHoySql, unicos7Sql, unicosTotalSql;
  const visitasHoyParams = [today];
  const unicos7Params = [weekStart];
  if (isPostgres) {
    usuariosHoySql = "SELECT COUNT(*) AS n FROM users WHERE to_char(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') = $1";
    activosSql = `SELECT COUNT(*) AS n FROM (
      SELECT DISTINCT user_id FROM expenses WHERE created_at >= NOW() - INTERVAL '7 days'
      UNION
      SELECT DISTINCT user_id FROM alerts WHERE created_at >= NOW() - INTERVAL '7 days'
    ) t`;
    visitasUltimos7Sql = "SELECT COALESCE(SUM(count), 0) AS n FROM visits WHERE date >= $1";
    visitasTotalSql = "SELECT COALESCE(SUM(count), 0) AS n FROM visits";
    unicosHoySql = "SELECT COUNT(*) AS n FROM visitors WHERE date = $1";
    unicos7Sql = "SELECT COUNT(*) AS n FROM (SELECT DISTINCT vv FROM visitors WHERE date >= $1) t";
    unicosTotalSql = "SELECT COUNT(*) AS n FROM (SELECT DISTINCT vv FROM visitors) t";
  } else {
    usuariosHoySql = "SELECT COUNT(*) AS n FROM users WHERE substr(created_at, 1, 10) = $1";
    activosSql = `SELECT COUNT(*) AS n FROM (
      SELECT DISTINCT user_id FROM expenses WHERE created_at >= datetime('now', '-7 days')
      UNION
      SELECT DISTINCT user_id FROM alerts WHERE created_at >= datetime('now', '-7 days')
    ) t`;
    visitasUltimos7Sql = "SELECT COALESCE(SUM(count), 0) AS n FROM visits WHERE date >= $1";
    visitasTotalSql = "SELECT COALESCE(SUM(count), 0) AS n FROM visits";
    unicosHoySql = "SELECT COUNT(*) AS n FROM visitors WHERE date = $1";
    unicos7Sql = "SELECT COUNT(*) AS n FROM (SELECT DISTINCT vv FROM visitors WHERE date >= $1) t";
    unicosTotalSql = "SELECT COUNT(*) AS n FROM (SELECT DISTINCT vv FROM visitors) t";
  }

  const [usuarios, gastos, alertas, registradosHoy, activosUltimos7Dias, visitasHoy, total, ultimos7, unicosHoy, unicos7, unicosTotal, fuentesHoy, fuentes7] = await Promise.all([
    count('SELECT COUNT(*) AS n FROM users'),
    count('SELECT COUNT(*) AS n FROM expenses'),
    count('SELECT COUNT(*) AS n FROM alerts'),
    count(usuariosHoySql, [today]),
    count(activosSql),
    count("SELECT COALESCE(SUM(count), 0) AS n FROM visits WHERE date = $1", visitasHoyParams),
    count(visitasTotalSql),
    count(visitasUltimos7Sql, [weekStart]),
    count(unicosHoySql, [today]),
    count(unicos7Sql, unicos7Params),
    count(unicosTotalSql),
    query('SELECT source, SUM(count) AS count FROM sources WHERE date = $1 GROUP BY source ORDER BY count DESC', [today]),
    query('SELECT source, SUM(count) AS count FROM sources WHERE date >= $1 GROUP BY source ORDER BY count DESC', [weekStart]),
  ]);

  return {
    usuarios, gastos, alertas,
    registradosHoy, activosUltimos7Dias,
    visitas: { hoy: visitasHoy, ultimos7Dias: ultimos7, total },
    visitantesUnicos: { hoy: unicosHoy, ultimos7Dias: unicos7, total: unicosTotal },
    fuentes: {
      hoy: fuentesHoy.map(r => ({ source: r.source, count: Number(r.count) })),
      ultimos7Dias: fuentes7.map(r => ({ source: r.source, count: Number(r.count) })),
    },
  };
}

// ===== RATE LIMITING =====
async function checkRateLimit(userId, max) {
  const month = monthArg();
  const row = await getOne('SELECT * FROM rate_limits WHERE user_id = $1 AND month = $2', [userId, month]);
  const current = row ? row.expense_count : 0;
  return { allowed: current < max, current, max, remaining: max - current };
}

async function incrementRateLimit(userId) {
  const month = monthArg();
  if (isPostgres) {
    await query('INSERT INTO rate_limits (user_id, expense_count, month) VALUES ($1, 1, $2) ON CONFLICT (user_id, month) DO UPDATE SET expense_count = rate_limits.expense_count + 1',
      [userId, month]);
  } else {
    await query("INSERT OR IGNORE INTO rate_limits (user_id, expense_count, month) VALUES ($1, 1, $2)", [userId, month]);
    await query("UPDATE rate_limits SET expense_count = expense_count + 1 WHERE user_id = $1 AND month = $2", [userId, month]);
  }
}

module.exports = { init, save, close,
  getUser, getUserByEmail, createUser, getOrCreateUser, updateUserTier,
  getEmailAlerts, setEmailAlerts, getUsersForEmailAlerts,
  addExpense, getExpense, getExpenses, getExpensesSince, deleteExpense, getExpenseSummary,
  saveExchangeRate, getExchangeHistory,
  createAlert, getUserAlerts,
  checkRateLimit, incrementRateLimit,
  incrementVisits, incrementSource, getVisitsSeries, getMetrics,
  addReview, getReview, getReviews, deleteReview };