const express = require('express');
const database = require('../services/database');
const { requireTier } = require('../services/tier');
const { requireAuth } = require('../services/auth');

const router = express.Router();

router.get('/gastos/csv', requireAuth, requireTier('export'), async (req, res) => {
  const expenses = await database.getExpenses(req.userId, 99999);
  const headers = 'Fecha,Descripción,Categoría,Moneda,Monto\n';
  const rows = expenses.map(e =>
    `"${e.date}","${(e.description || '').replace(/"/g, '""')}","${e.category}","${e.currency}",${e.amount}`
  ).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=gastos_afip.csv');
  res.send('\uFEFF' + headers + rows);
});

router.get('/monotributo/resumen', requireAuth, requireTier('export'), (req, res) => {
  const { getCategorias } = require('../services/storage');
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