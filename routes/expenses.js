const express = require('express');
const database = require('../services/database');
const { expenseRateLimit } = require('../services/tier');
const { getCotizaciones } = require('../services/exchangeScraper');
const { requireAuth } = require('../services/auth');

const router = express.Router();
const h = require('../services/asyncHandler');

const CURRENCIES = ['ARS', 'USD'];

router.get('/', requireAuth, h(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  res.json(await database.getExpenses(req.userId, limit, offset));
}));

router.post('/', requireAuth, expenseRateLimit, h(async (req, res) => {
  const { amount, currency, category, description, date } = req.body;
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ error: 'Monto inválido' });
  const cur = String(currency || '').toUpperCase();
  if (!CURRENCIES.includes(cur)) return res.status(400).json({ error: 'Moneda inválida' });

  const expense = await database.addExpense(req.userId, {
    amount: n, currency: cur,
    category: (category || 'otros').toString().slice(0, 50), description: (description || '').toString().slice(0, 200),
    date: date || new Date().toISOString().split('T')[0],
  });
  await database.incrementRateLimit(req.userId);
  res.status(201).json(expense);
}));

router.delete('/:id', requireAuth, h(async (req, res) => {
  const ok = await database.deleteExpense(req.params.id, req.userId);
  if (!ok) return res.status(404).json({ error: 'Gasto no encontrado' });
  res.json({ ok: true });
}));

router.post('/resumen', requireAuth, h(async (req, res) => {
  const { month, year } = req.body;
  const m = month || new Date().getMonth() + 1;
  const y = year || new Date().getFullYear();
  const summary = await database.getExpenseSummary(req.userId, m, y);
  let cotizaciones = null;
  try { cotizaciones = await getCotizaciones(); } catch {}

  const byCategory = {};
  let totalARS = 0;
  const totalByCurrency = {};
  let totalGastos = 0;

  for (const row of summary) {
    if (!byCategory[row.category]) byCategory[row.category] = { total: 0, count: 0 };
    byCategory[row.category].total += row.total;
    byCategory[row.category].count += row.count;
    if (!totalByCurrency[row.currency]) totalByCurrency[row.currency] = 0;
    totalByCurrency[row.currency] += row.total;
    totalGastos += Number(row.count) || 0;
    if (row.currency === 'ARS') totalARS += row.total;
    else if (row.currency === 'USD' && cotizaciones?.blue?.sell) {
      totalARS += row.total * cotizaciones.blue.sell;
    }
  }

  res.json({
    total: totalGastos, totalPorMoneda: totalByCurrency,
    totalEnARS: Math.round(totalARS), porCategoria: byCategory,
    cotizacionesUsadas: cotizaciones,
  });
}));

module.exports = router;
