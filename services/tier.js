const database = require('./database');

const TIERS = {
  free: { name: 'Free', expensesPerMonth: 99999, alerts: true, export: true, autoRecategorizacion: true, price: 0 },
  pro: { name: 'Pro', expensesPerMonth: 99999, alerts: true, export: true, autoRecategorizacion: true, price: 3000 },
  premium: { name: 'Premium', expensesPerMonth: 99999, alerts: true, export: true, autoRecategorizacion: true, price: 8000 },
};

async function getTier(userId) {
  const user = await database.getUser(userId);
  if (!user) return TIERS.free;
  const tier = user.tier || 'free';
  const status = user.subscription_status || 'inactive';
  if (status === 'inactive' && tier !== 'free') {
    return { ...TIERS.free, downgraded: true };
  }
  return TIERS[tier] || TIERS.free;
}

async function canUseFeature(userId, feature) {
  const tier = await getTier(userId);
  return tier[feature] === true;
}

function requireTier(feature) {
  return (req, res, next) => {
    (async () => {
      const userId = req.userId || 'guest';
      const allowed = await canUseFeature(userId, feature);
      if (!allowed) {
        const tier = await getTier(userId);
        return res.status(402).json({
          error: 'Funcionalidad premium',
          message: 'Necesitás una suscripción Pro o Premium para usar esta función',
          upgrade: true, tier,
        });
      }
      next();
    })().catch(next);
  };
}

async function expenseRateLimit(req, res, next) {
  try {
    const userId = req.userId || 'guest';
    const user = await database.getOrCreateUser(userId);
    const tier = user.tier || 'free';
    const max = (TIERS[tier] || TIERS.free).expensesPerMonth;
    const limit = await database.checkRateLimit(userId, max);
    if (!limit.allowed) {
      return res.status(429).json({
        error: 'Límite de gastos alcanzado',
        message: `Tu plan ${tier} permite ${limit.max} gastos por mes. Actualizá a Pro o Premium.`,
        remaining: 0, limit, upgrade: true,
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

function getPlans() {
  return Object.entries(TIERS).map(([key, val]) => ({ id: key, ...val }));
}

module.exports = { TIERS, getTier, canUseFeature, requireTier, expenseRateLimit, getPlans };