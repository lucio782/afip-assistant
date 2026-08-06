const express = require('express');
const axios = require('axios');
const database = require('../services/database');
const { requireTier } = require('../services/tier');
const { requireAuth } = require('../services/auth');
const config = require('../config');
const mailer = require('../services/mailer');

const router = express.Router();
const h = require('../services/asyncHandler');

router.get('/', requireAuth, requireTier('alerts'), h(async (req, res) => {
  res.json(await database.getUserAlerts(req.userId));
}));

router.post('/', requireAuth, requireTier('alerts'), h(async (req, res) => {
  const { type, title, message } = req.body;
  if (!type || !title) return res.status(400).json({ error: 'Tipo y título requeridos' });
  const alert = await database.createAlert(req.userId, type, title, message);
  res.status(201).json(alert);
}));

router.post('/simular-vencimientos', requireAuth, requireTier('alerts'), h(async (req, res) => {
  const now = new Date();
  const alerts = [];
  const today = new Date().toISOString().split('T')[0];

  const day = now.getDate();
  if (day >= 15 && day <= 20) {
    const alert = await database.createAlert(req.userId, 'vencimiento', 'Vence Monotributo', 'El pago mensual del Monotributo vence el 20. Recordá pagar antes de la fecha.');
    alerts.push(alert);
  }

  const month = now.getMonth() + 1;
  if (month === 6 || month === 12 || month === 1 || month === 7) {
    const alert = await database.createAlert(req.userId, 'recategorizacion', 'Período de Recategorización',
      month === 1 || month === 12 ? 'Enero: recategorización semestral. Revisá tus ingresos.' : 'Julio: recategorización semestral. Revisá tus ingresos.');
    alerts.push(alert);
  }

  try {
    const { data } = await axios.get(config.exchange.bluelyticsUrl, { timeout: config.alerts.fetchTimeout });
    const blue = data.blue?.value_sell;
    if (blue && blue > config.alerts.dolarThreshold) {
      const alert = await database.createAlert(req.userId, 'dolar', '📈 Dólar Blue superó $' + Math.round(blue),
        'El dólar blue está a $' + Math.round(blue) + '. Considerá comprar.');
      alerts.push(alert);
    }
  } catch {}

  res.json({ alerts_creadas: alerts.length, alerts, fecha: today });
}));

router.get('/email/status', requireAuth, requireTier('alerts'), h(async (req, res) => {
  res.json({ enabled: await database.getEmailAlerts(req.userId), configurado: mailer.isConfigured() });
}));

router.post('/email/toggle', requireAuth, requireTier('alerts'), h(async (req, res) => {
  const enabled = Boolean(req.body && req.body.enabled);
  if (!mailer.isConfigured()) {
    return res.status(503).json({ error: 'Los recordatorios por email no están configurados aún. Pronto.', enabled });
  }
  const state = await database.setEmailAlerts(req.userId, enabled);
  res.json({ enabled: state });
}));

module.exports = router;
