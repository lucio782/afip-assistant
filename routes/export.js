const express = require('express');
const database = require('../services/database');
const { requireTier } = require('../services/tier');
const { requireAuth } = require('../services/auth');
const { getCategorias } = require('../services/storage');
const PDFDocument = require('pdfkit');

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

router.get('/gastos/pdf', requireAuth, requireTier('export'), h(async (req, res) => {
  const expenses = await database.getExpenses(req.userId, 99999);

  const doc = new PDFDocument({ size: 'A4', margins: { top: 48, bottom: 48, left: 48, right: 48 }, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=gastos_arca.pdf');
  doc.pipe(res);

  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(18).text('ARCA Assistant', { align: 'center' });
  doc.moveDown(0.2);
  doc.fillColor('#3b82f6').fontSize(12).text('Registro de Gastos', { align: 'center' });
  doc.moveDown(0.5);
  doc.fillColor('#64748b').fontSize(9).text('Generado: ' + new Date().toLocaleDateString('es-AR'), { align: 'center' });
  doc.moveDown(1.2);

  if (!expenses.length) {
    doc.fillColor('#0f172a').fontSize(11).text('Todavía no registraste gastos.');
    doc.end();
    return;
  }

  const startX = doc.page.margins.left;
  let y = doc.y;
  const colW = { fecha: 70, desc: 200, cat: 110, mon: 50, monto: 90 };
  const rowH = 18;

  const drawHeader = () => {
    doc.fillColor('#1e293b').rect(startX, y, colW.fecha + colW.desc + colW.cat + colW.mon + colW.monto, rowH).fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    doc.text('Fecha', startX + 6, y + 5, { width: colW.fecha - 6 });
    doc.text('Descripción', startX + colW.fecha + 6, y + 5, { width: colW.desc - 6 });
    doc.text('Categoría', startX + colW.fecha + colW.desc + 6, y + 5, { width: colW.cat - 6 });
    doc.text('Moneda', startX + colW.fecha + colW.desc + colW.cat + 6, y + 5, { width: colW.mon - 6 });
    doc.text('Monto', startX + colW.fecha + colW.desc + colW.cat + colW.mon + 6, y + 5, { width: colW.monto - 6 });
    y += rowH;
  };

  drawHeader();
  doc.font('Helvetica').fontSize(9);
  let totals = { ARS: 0, USD: 0 };
  expenses.forEach((e, i) => {
    if (y > doc.page.height - 80) { doc.addPage(); y = doc.page.margins.top; drawHeader(); }
    const monto = Number(e.amount) || 0;
    totals[e.currency === 'USD' ? 'USD' : 'ARS'] += monto;
    if (i % 2 === 0) doc.fillColor('#f8fafc').rect(startX, y, colW.fecha + colW.desc + colW.cat + colW.mon + colW.monto, rowH).fill();
    doc.fillColor('#0f172a');
    doc.text(String(e.date || ''), startX + 6, y + 5, { width: colW.fecha - 6 });
    doc.text(String(e.description || ''), startX + colW.fecha + 6, y + 5, { width: colW.desc - 6 });
    doc.text(String(e.category || ''), startX + colW.fecha + colW.desc + 6, y + 5, { width: colW.cat - 6 });
    doc.text(String(e.currency || 'ARS'), startX + colW.fecha + colW.desc + colW.cat + 6, y + 5, { width: colW.mon - 6 });
    doc.text(monto.toLocaleString('es-AR'), startX + colW.fecha + colW.desc + colW.cat + colW.mon + 6, y + 5, { width: colW.monto - 6 });
    y += rowH;
  });

  y += 14;
  if (y > doc.page.height - 80) { doc.addPage(); y = doc.page.margins.top; }
  doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(10);
  doc.text('Totales', startX, y);
  y += 16;
  doc.font('Helvetica').fontSize(10).fillColor('#0f172a');
  doc.text('Total en ARS: $' + Math.round(totals.ARS).toLocaleString('es-AR'), startX, y);
  y += 16;
  if (totals.USD) doc.text('Total en USD: $' + Math.round(totals.USD).toLocaleString('es-AR'), startX, y);

  doc.end();
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
