const express = require('express');
const crypto = require('crypto');
const database = require('../services/database');
const { getPlans, TIERS } = require('../services/tier');
const { requireAuth } = require('../services/auth');
const config = require('../config');

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

  // Sin MercadoPago configurado: el modo mock solo se habilita en desarrollo (nunca en prod).
  if (!mercadopago) {
    if (!config.payments.mock) {
      return res.status(503).json({ error: 'Pagos no disponibles en este momento' });
    }
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
        title: `${config.app.name} - Plan ${plan.name}`,
        unit_price: plan.price, quantity: 1, currency_id: 'ARS',
      }],
      payer: { email: req.body.email || req.userEmail || 'comprador@email.com' },
      back_urls: {
        success: config.app.url + '/?pago=ok&plan=' + planId,
        failure: config.app.url + '/?pago=error',
        pending: config.app.url + '/?pago=pending',
      },
      auto_return: 'approved',
      notification_url: config.app.url + '/api/payments/webhook',
    };
    const result = await mercadopago.preferences.create(preference);
    res.json({ status: 'ok', init_point: result.body.init_point, preference_id: result.body.id, plan: planId });
  } catch (err) {
    res.status(502).json({ error: 'Error al crear pago' });
  }
}));

// Webhook de MercadoPago: verifica la firma y aplica el upgrade de tier cuando el pago se aprueba.
router.post('/webhook', (req, res) => {
  const token = process.env.MP_ACCESS_TOKEN || '';
  const body = req.body || {};

  if (token) {
    const sig = req.headers['x-signature'] || '';
    const requestId = req.headers['x-request-id'] || '';
    const ts = (sig.match(/ts=(\d+)/) || [])[1] || '';
    const v1 = (sig.match(/v1=([0-9a-f]+)/) || [])[1] || '';
    const dataId = body.data && body.data.id;
    const msg = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const expected = crypto.createHmac('sha256', token).update(msg).digest('hex');
    if (!v1 || expected !== v1) return res.sendStatus(403);
  }

  if (body.type === 'payment' && body.data && body.data.id && token && mercadopago) {
    mercadopago.payment.get(body.data.id)
      .then(result => {
        const p = result.body;
        if (p.status === 'approved' && p.external_reference) {
          return database.updateUserTier(p.external_reference, 'pro', {
            mercadopago_id: String(p.id),
            subscription_id: String(p.id),
            subscription_status: 'active',
          });
        }
      })
      .catch(() => {});
  }

  res.sendStatus(200);
});

router.get('/status/:userId', requireAuth, h(async (req, res) => {
  if (req.params.userId !== req.userId) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const user = await database.getOrCreateUser(req.userId);
  res.json({ userId: user.id, tier: user.tier, subscription_status: user.subscription_status, features: TIERS[user.tier] || TIERS.free });
}));

module.exports = router;
