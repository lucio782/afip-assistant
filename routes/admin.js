const express = require('express');
const crypto = require('crypto');
const database = require('../services/database');
const mailer = require('../services/mailer');
const h = require('../services/asyncHandler');

const router = express.Router();

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// Todo este router requiere ADMIN_KEY (header: x-admin-key)
router.use((req, res, next) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return res.status(404).json({ error: 'No disponible' });
  if (!safeEqual(req.headers['x-admin-key'], adminKey)) return res.status(401).json({ error: 'No autorizado' });
  next();
});

router.get('/users', h(async (req, res) => {
  res.json(await database.listUsers());
}));

router.get('/reviews', h(async (req, res) => {
  res.json(await database.listReviewsAdmin());
}));

router.delete('/users/:id', h(async (req, res) => {
  await database.deleteUserAndData(req.params.id);
  res.json({ ok: true });
}));

router.delete('/reviews/:id', h(async (req, res) => {
  const review = await database.getReview(req.params.id);
  if (!review) return res.status(404).json({ error: 'Reseña no encontrada' });
  await database.deleteReview(review.id);
  res.json({ ok: true });
}));

// POST /api/admin/test-email { to } — envía un email de prueba si el email está configurado
router.post('/test-email', h(async (req, res) => {
  if (!mailer.isConfigured()) return res.status(400).json({ error: 'Email no configurado' });
  const to = String(req.body && req.body.to || '').trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ error: 'Email inválido' });
  await mailer.sendTestEmail(to);
  res.json({ ok: true });
}));

module.exports = router;
