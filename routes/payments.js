const express = require('express');
const database = require('../services/database');
const { getPlans } = require('../services/tier');
const { requireAuth } = require('../services/auth');

const router = express.Router();
const h = require('../services/asyncHandler');

let mercadopago = null;
try {
  mercadopago = require('mercadopago');
  const accessToken = process.env.MP_ACCESS_TOKEN || '';
  if (accessToken) { mercadopago.configure({ access_token: accessToken }); } else { mercadopago = null; }
} catch { mercadopago = null; }

router.get('/planes', (req, res) => { res.json(getPlans()); });

router.post('/crear-preferencia', requireAuth, h(async (req, res) => {
  const { planId } = req.body;
  const plans = getPlans();
  const plan = plans.find(p => p.id === planId);
  if (!plan || plan.price === 0) return res.status(400).json({ error: 'Plan inválido' });

  if (!mercadopago) {
    const user = await database.getOrCreateUser(req.userId);
    await database.updateUserTier(user.id, planId, {
      mercadopago_id: 'mock_' + Date.now(),
      subscription_id: 'sub_mock_' + Date.now(),
      subscription_status: 'active',
    });
    return res.json({
      status: 'mock', message: `Suscripción ${plan.name} activada (modo simulación)`,
      init_point: null, plan: planId,
    });
  }

  try {
    const preference = {
      items: [{
        title: `AFIP Assistant - Plan ${plan.name}`,
        unit_price: plan.price, quantity: 1, currency_id: 'ARS',
      }],
      payer: { email: req.body.email || req.userEmail || 'comprador@email.com' },
      back_urls: {
        success: req.headers.origin + '/?pago=ok&plan=' + planId,
        failure: req.headers.origin + '/?pago=error',
        pending: req.headers.origin + '/?pago=pending',
      },
      auto_return: 'approved',
      notification_url: req.headers.origin + '/api/payments/webhook',
    };
    const result = await mercadopago.preferences.create(preference);
    res.json({ status: 'ok', init_point: result.body.init_point, preference_id: result.body.id, plan: planId });
  } catch (err) {
    res.status(502).json({ error: 'Error al crear pago', detail: err.message });
  }
}));

router.post('/webhook', (req, res) => {
  const payment = req.body;
  if (payment && payment.type === 'payment') console.log('Pago recibido:', payment.id);
  res.sendStatus(200);
});

router.get('/status/:userId', requireAuth, h(async (req, res) => {
  if (req.params.userId !== req.userId) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const user = await database.getOrCreateUser(req.userId);
  const { TIERS } = require('../services/tier');
  res.json({ userId: user.id, tier: user.tier, subscription_status: user.subscription_status, features: TIERS[user.tier] || TIERS.free });
}));

module.exports = router;