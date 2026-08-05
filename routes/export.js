const express = require('express');
const database = require('../services/database');
const { requireTier } = require('../services/tier');
const { requireAuth } = require('../services/auth');
const { getCategorias } = require('../services/storage');

const router = express.Router();
const h = require('../services/asyncHandler');

function csvSafe(value) {
  const s = String(value == null ? '' : value);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

router.get('/gastos/csv', requireAuth, requireTier('export'), h(async (req, res) => {
  const expenses = await database.getExpenses(req.userId, 99999);
  const headers = 'Fecha,Descripción,Categoría,Moneda,Monto\n';
  const rows = expenses.map(e =>
    `"${csvSafe(e.date)}","${csvSafe(e.description).replace(/"/g, '""')}","${csvSafe(e.category).replace(/"/g, '""')}","${csvSafe(e.currency)}",${e.amount}`
  ).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=gastos_arca.csv');
  res.send('\uFEFF' + headers + rows);
}));

router.get('/monotributo/resumen', requireAuth, requireTier('export'), (req, res) => {
  const cats = getCategorias();
  const headers = 'Categoría,Ingreso Máx.,Superficie Máx.,Energía Máx. (kWh),Alquiler/año Máx.,Cuota Mensual\n';
  const rows = cats.map(c =>
    `${c.code},${c.maxIncome},${c.maxArea},${c.maxEnergy},${c.maxRent},${c.monthlyFee}`
  ).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=categorias_monotributo.csv');
  res.send('\uFEFF' + headers + rows);
});

module.exports = router;
