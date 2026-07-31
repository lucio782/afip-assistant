const express = require('express');
const database = require('../services/database');
const h = require('../services/asyncHandler');

const router = express.Router();

// GET /api/metrics — protegido por ADMIN_KEY (header: x-admin-key)
router.get('/', h(async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return res.status(404).json({ error: 'Métricas no disponibles' });
  if (!req.headers['x-admin-key'] || req.headers['x-admin-key'] !== adminKey) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  res.json(await database.getMetrics());
}));

module.exports = router;
