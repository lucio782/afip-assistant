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
    // Migrations: add missing columns on existing tables
    const { rows } = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`);
    const cols = rows.map(r => r.column_name);
    if (!cols.includes('password_hash')) await client.query(`ALTER TABLE users ADD COLUMN password_hash TEXT DEFAULT ''`);
    if (!cols.includes('email')) await client.query(`ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''`);
    if (!cols.includes('tier')) await client.query(`ALTER TABLE users ADD COLUMN tier TEXT DEFAULT 'free'`);
    if (!cols.includes('name')) await client.query(`ALTER TABLE users ADD COLUMN name TEXT DEFAULT ''`);
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

async function deleteExpense(id, userId) {
  await query('DELETE FROM expenses WHERE id = $1 AND user_id = $2', [id, userId]);
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
  if (isPostgres) {
    await query('INSERT INTO exchange_history (id, date, source, buy, sell) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
      [id, date, source, buy, sell]);
  } else {
    await query('INSERT OR REPLACE INTO exchange_history (id, date, source, buy, sell) VALUES ($1, $2, $3, $4, $5)',
      [id, date, source, buy, sell]);
  }
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
async function incrementVisits() {
  const today = new Date().toISOString().split('T')[0];
  if (isPostgres) {
    await query('INSERT INTO visits (date, count) VALUES ($1, 1) ON CONFLICT (date) DO UPDATE SET count = visits.count + 1', [today]);
  } else {
    await query('INSERT OR IGNORE INTO visits (date, count) VALUES ($1, 1)', [today]);
    await query('UPDATE visits SET count = count + 1 WHERE date = $1', [today]);
  }
}

async function getMetrics() {
  const today = new Date().toISOString().split('T')[0];

  const count = async (sql, params = []) => {
    const row = await getOne(sql, params);
    return row ? Number(row.n || row.count || 0) : 0;
  };

  let usuariosHoySql, activosSql, visitasUltimos7Sql, visitasTotalSql;
  if (isPostgres) {
    usuariosHoySql = "SELECT COUNT(*) AS n FROM users WHERE created_at::date = CURRENT_DATE";
    activosSql = `SELECT COUNT(*) AS n FROM (
      SELECT DISTINCT user_id FROM expenses WHERE created_at >= NOW() - INTERVAL '7 days'
      UNION
      SELECT DISTINCT user_id FROM alerts WHERE created_at >= NOW() - INTERVAL '7 days'
    ) t`;
    visitasUltimos7Sql = "SELECT COALESCE(SUM(count), 0) AS n FROM visits WHERE date >= to_char(CURRENT_DATE - INTERVAL '7 days', 'YYYY-MM-DD')";
    visitasTotalSql = "SELECT COALESCE(SUM(count), 0) AS n FROM visits";
  } else {
    usuariosHoySql = "SELECT COUNT(*) AS n FROM users WHERE date(created_at) = date('now')";
    activosSql = `SELECT COUNT(*) AS n FROM (
      SELECT DISTINCT user_id FROM expenses WHERE created_at >= datetime('now', '-7 days')
      UNION
      SELECT DISTINCT user_id FROM alerts WHERE created_at >= datetime('now', '-7 days')
    ) t`;
    visitasUltimos7Sql = "SELECT COALESCE(SUM(count), 0) AS n FROM visits WHERE date >= date('now', '-7 days')";
    visitasTotalSql = "SELECT COALESCE(SUM(count), 0) AS n FROM visits";
  }

  const visitsHoy = await count("SELECT COALESCE(SUM(count), 0) AS n FROM visits WHERE date = $1", [today]);
  const total = await count(visitasTotalSql);
  const ultimos7 = await count(visitasUltimos7Sql);

  return {
    usuarios: await count('SELECT COUNT(*) AS n FROM users'),
    gastos: await count('SELECT COUNT(*) AS n FROM expenses'),
    alertas: await count('SELECT COUNT(*) AS n FROM alerts'),
    registradosHoy: await count(usuariosHoySql),
    activosUltimos7Dias: await count(activosSql),
    visitas: { hoy: visitsHoy, ultimos7Dias: ultimos7, total },
  };
}

// ===== RATE LIMITING =====
async function checkRateLimit(userId, tier) {
  const month = new Date().toISOString().slice(0, 7);
  const row = await getOne('SELECT * FROM rate_limits WHERE user_id = $1 AND month = $2', [userId, month]);
  const limits = { free: 99999, pro: 99999, premium: 99999 };
  const max = limits[tier] || 99999;
  const current = row ? row.expense_count : 0;
  return { allowed: current < max, current, max, remaining: max - current };
}

async function incrementRateLimit(userId) {
  const month = new Date().toISOString().slice(0, 7);
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
  addExpense, getExpense, getExpenses, deleteExpense, getExpenseSummary,
  saveExchangeRate, getExchangeHistory,
  createAlert, getUserAlerts,
  checkRateLimit, incrementRateLimit,
  incrementVisits, getMetrics };