const express = require('express');
const { getCotizaciones } = require('../services/exchangeScraper');
const database = require('../services/database');
const router = express.Router();
const h = require('../services/asyncHandler');

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 60000; // 1 min

router.get('/', h(async (req, res) => {
  if (Date.now() - cache.timestamp < CACHE_TTL) {
    return res.json(cache.data);
  }

  try {
    const cotizaciones = await getCotizaciones();
    cache = { data: cotizaciones, timestamp: Date.now() };

    // Persist to DB for historical tracking
    const today = new Date().toISOString().split('T')[0];
    if (cotizaciones.blue?.buy) await database.saveExchangeRate(today, 'blue', cotizaciones.blue.buy, cotizaciones.blue.sell);
    if (cotizaciones.oficial?.buy) await database.saveExchangeRate(today, 'oficial', cotizaciones.oficial.buy, cotizaciones.oficial.sell);
    if (cotizaciones.tarjeta?.value) await database.saveExchangeRate(today, 'tarjeta', cotizaciones.tarjeta.value, null);
    if (cotizaciones.mep?.value) await database.saveExchangeRate(today, 'mep', cotizaciones.mep.value, null);
    if (cotizaciones.ccl?.value) await database.saveExchangeRate(today, 'ccl', cotizaciones.ccl.value, null);

    res.json(cotizaciones);
  } catch (err) {
    if (cache.data) return res.json(cache.data);
    res.status(502).json({ error: 'No se pudieron obtener las cotizaciones' });
  }
}));

router.get('/historicos', h(async (req, res) => {
  try {
    const histBlue = await database.getExchangeHistory('blue', 7);
    const histOficial = await database.getExchangeHistory('oficial', 7);

    if (histBlue.length > 0) {
      // Build combined history from DB
      const fechas = [...new Set([...histBlue.map(h => h.date), ...histOficial.map(h => h.date)])].sort();
      const data = fechas.map(f => ({
        fecha: f,
        blue: { buy: histBlue.find(h => h.date === f)?.buy || null, sell: histBlue.find(h => h.date === f)?.sell || null },
        oficial: { buy: histOficial.find(h => h.date === f)?.buy || null, sell: histOficial.find(h => h.date === f)?.sell || null },
      }));
      return res.json(data);
    }

    // Fallback to mock if no history yet
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      data.push({
        fecha: d.toISOString().split('T')[0],
        blue: { buy: 1200 + Math.random() * 50, sell: 1220 + Math.random() * 50 },
        oficial: { buy: 850 + Math.random() * 10, sell: 890 + Math.random() * 10 },
      });
    }
    res.json(data);
  } catch {
    res.json([]);
  }
}));

module.exports = router;
