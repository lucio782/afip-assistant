const express = require('express');
const database = require('../services/database');
const { expenseRateLimit } = require('../services/tier');
const { getCotizaciones } = require('../services/exchangeScraper');
const { requireAuth, optionalAuth } = require('../services/auth');

const router = express.Router();

router.get('/', optionalAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  database.getExpenses(req.userId, limit, offset).then(expenses => res.json(expenses));
});

router.post('/', requireAuth, expenseRateLimit, async (req, res) => {
  const { amount, currency, category, description, date } = req.body;
  if (!amount || !currency) return res.status(400).json({ error: 'Monto y moneda requeridos' });

  const expense = await database.addExpense(req.userId, {
    amount: parseFloat(amount), currency: currency.toUpperCase(),
    category: category || 'otros', description: description || '',
    date: date || new Date().toISOString().split('T')[0],
  });
  await database.incrementRateLimit(req.userId);
  res.status(201).json(expense);
});

router.delete('/:id', requireAuth, async (req, res) => {
  await database.deleteExpense(req.params.id);
  res.json({ ok: true });
});

router.post('/resumen', optionalAuth, async (req, res) => {
  const { month, year } = req.body;
  const m = month || new Date().getMonth() + 1;
  const y = year || new Date().getFullYear();
  let summary = await database.getExpenseSummary(req.userId, m, y);
  let cotizaciones = null;
  try { cotizaciones = await getCotizaciones(); } catch {}

  const byCategory = {};
  let totalARS = 0;
  const totalByCurrency = {};

  for (const row of summary) {
    if (!byCategory[row.category]) byCategory[row.category] = { total: 0, count: 0 };
    byCategory[row.category].total += row.total;
    byCategory[row.category].count += row.count;
    if (!totalByCurrency[row.currency]) totalByCurrency[row.currency] = 0;
    totalByCurrency[row.currency] += row.total;
    if (row.currency === 'ARS') totalARS += row.total;
    else if (row.currency === 'USD' && cotizaciones?.blue?.sell) {
      totalARS += row.total * cotizaciones.blue.sell;
    }
  }

  const expenses = await database.getExpenses(req.userId, 50, 0);
  res.json({
    total: expenses.length, totalPorMoneda: totalByCurrency,
    totalEnARS: Math.round(totalARS), porCategoria: byCategory,
    cotizacionesUsadas: cotizaciones,
  });
});

module.exports = router;