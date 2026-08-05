const express = require('express');
const { getCotizaciones } = require('../services/exchangeScraper');
const database = require('../services/database');
const config = require('../config');
const router = express.Router();
const h = require('../services/asyncHandler');

let cache = { data: null, timestamp: 0 };

const RATE_TYPES = ['blue', 'oficial', 'tarjeta', 'mep', 'ccl', 'mayorista', 'euro', 'yen',
  'cripto_bitcoin', 'cripto_ethereum', 'cripto_tether', 'cripto_solana'];

function valueOf(type, cot) {
  switch (type) {
    case 'blue': return cot.blue?.sell;
    case 'oficial': return cot.oficial?.sell;
    case 'tarjeta': return cot.tarjeta?.value;
    case 'mep': return cot.mep?.value;
    case 'ccl': return cot.ccl?.value;
    case 'mayorista': return cot.mayorista?.value;
    case 'euro': return cot.euro?.ars;
    case 'yen': return cot.yen?.ars;
    case 'cripto_bitcoin': return cot.criptos?.bitcoin?.ars;
    case 'cripto_ethereum': return cot.criptos?.ethereum?.ars;
    case 'cripto_tether': return cot.criptos?.tether?.ars;
    case 'cripto_solana': return cot.criptos?.solana?.ars;
    default: return null;
  }
}

function prevValueOf(type, row) {
  if (!row) return null;
  if (type === 'blue' || type === 'oficial') return row.sell;
  return row.buy;
}

async function persist(cot) {
  const today = new Date().toISOString().split('T')[0];
  const specs = {
    blue: [cot.blue?.buy, cot.blue?.sell],
    oficial: [cot.oficial?.buy, cot.oficial?.sell],
    tarjeta: [cot.tarjeta?.value, null],
    mep: [cot.mep?.value, null],
    ccl: [cot.ccl?.value, null],
    mayorista: [cot.mayorista?.value, null],
    euro: [cot.euro?.ars, cot.euro?.usd],
    yen: [cot.yen?.ars, cot.yen?.usd],
    cripto_bitcoin: [cot.criptos?.bitcoin?.ars, cot.criptos?.bitcoin?.usd],
    cripto_ethereum: [cot.criptos?.ethereum?.ars, cot.criptos?.ethereum?.usd],
    cripto_tether: [cot.criptos?.tether?.ars, cot.criptos?.tether?.usd],
    cripto_solana: [cot.criptos?.solana?.ars, cot.criptos?.solana?.usd],
  };
  for (const [type, [buy, sell]] of Object.entries(specs)) {
    if (buy != null) await database.saveExchangeRate(today, type, buy, sell);
  }
}

async function buildVariaciones(cot) {
  const entries = await Promise.all(RATE_TYPES.map(async (type) => {
    let variacion = null;
    try {
      const hist = await database.getExchangeHistory(type, 2);
      const current = valueOf(type, cot);
      if (hist.length >= 2 && current != null) {
        const prev = prevValueOf(type, hist[hist.length - 2]);
        if (prev) {
          variacion = {
            pct: Math.round(((current - prev) / prev) * 10000) / 100,
            delta: Math.round((current - prev) * 100) / 100,
          };
        }
      }
    } catch {}
    return [type, variacion];
  }));
  return Object.fromEntries(entries);
}

router.get('/', h(async (req, res) => {
  if (Date.now() - cache.timestamp < config.exchange.cacheTtl) {
    return res.json(cache.data);
  }

  try {
    const cotizaciones = await getCotizaciones();
    cotizaciones.variaciones = await buildVariaciones(cotizaciones);
    cache = { data: cotizaciones, timestamp: Date.now() };
    await persist(cotizaciones);
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
      const fechas = [...new Set([...histBlue.map(h => h.date), ...histOficial.map(h => h.date)])].sort();
      const data = fechas.map(f => ({
        fecha: f,
        blue: { buy: histBlue.find(h => h.date === f)?.buy || null, sell: histBlue.find(h => h.date === f)?.sell || null },
        oficial: { buy: histOficial.find(h => h.date === f)?.buy || null, sell: histOficial.find(h => h.date === f)?.sell || null },
      }));
      return res.json(data);
    }

    res.json([]);
  } catch {
    res.json([]);
  }
}));

module.exports = router;
