const express = require('express');
const crypto = require('crypto');
const database = require('../services/database');
const h = require('../services/asyncHandler');

const router = express.Router();

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// GET /api/metrics — protegido por ADMIN_KEY (header: x-admin-key)
router.get('/', h(async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return res.status(404).json({ error: 'Métricas no disponibles' });
  if (!safeEqual(req.headers['x-admin-key'], adminKey)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  res.json(await database.getMetrics());
}));

// GET /api/metrics/diario?dias=14 — visitas por día (protegido por ADMIN_KEY)
router.get('/diario', h(async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return res.status(404).json({ error: 'Métricas no disponibles' });
  if (!safeEqual(req.headers['x-admin-key'], adminKey)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const dias = Math.min(Math.max(parseInt(req.query.dias) || 14, 7), 90);
  res.json(await database.getVisitsSeries(dias));
}));

module.exports = router;
