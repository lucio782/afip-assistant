const express = require('express');
const database = require('../services/database');
const { requireAuth } = require('../services/auth');
const config = require('../config');
const h = require('../services/asyncHandler');

const router = express.Router();

// GET /api/reviews — pública (para la landing y la sección de opiniones)
router.get('/', h(async (req, res) => {
  const limit = parseInt(req.query.limit) || config.reviews.defaultLimit;
  res.json(await database.getReviews(limit));
}));

// POST /api/reviews — autenticado
router.post('/', requireAuth, h(async (req, res) => {
  const rating = parseInt(req.body.rating);
  const comment = (req.body.comment || '').trim();
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Calificación de 1 a 5 requerida' });
  if (!comment || comment.length < config.reviews.minComment || comment.length > config.reviews.maxComment) return res.status(400).json({ error: 'Comentario de 3 a 500 caracteres' });

  const user = await database.getUser(req.userId);
  const review = await database.addReview(req.userId, (user && user.name) || 'Usuario', rating, comment);
  res.status(201).json(review);
}));

// DELETE /api/reviews/:id — admin (x-admin-key) o dueño de la reseña
router.delete('/:id', requireAuth, h(async (req, res) => {
  const review = await database.getReview(req.params.id);
  if (!review) return res.status(404).json({ error: 'Reseña no encontrada' });

  const adminKey = process.env.ADMIN_KEY;
  const isAdmin = adminKey && req.headers['x-admin-key'] && req.headers['x-admin-key'] === adminKey;
  const isOwner = review.user_id === req.userId;

  if (!isAdmin && !isOwner) return res.status(403).json({ error: 'No autorizado' });

  await database.deleteReview(review.id);
  res.json({ ok: true });
}));

module.exports = router;
