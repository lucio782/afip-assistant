const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const database = require('../services/database');
const { generateToken, requireAuth } = require('../services/auth');
const h = require('../services/asyncHandler');
const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'Demasiados intentos. Esperá 15 minutos e intentá de nuevo.' }),
});

router.post('/register', authLimiter, h(async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const existing = await database.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });

    const password_hash = await bcrypt.hash(password, 10);
    const user = await database.createUser({ email, password_hash, name: name || email.split('@')[0] });
    const token = generateToken(user);

    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier } });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar', detail: err.message });
  }
}));

router.post('/login', authLimiter, h(async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const user = await database.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, tier: user.tier } });
  } catch (err) {
    res.status(500).json({ error: 'Error al iniciar sesión', detail: err.message });
  }
}));

router.get('/me', requireAuth, h(async (req, res) => {
  const user = await database.getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ id: user.id, email: user.email, name: user.name, tier: user.tier, subscription_status: user.subscription_status });
}));

module.exports = router;