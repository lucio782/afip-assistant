const axios = require('axios');

async function fetchJson(url, timeout = 10000) {
  const { data } = await axios.get(url, { timeout });
  return data;
}

async function getCotizaciones() {
  const [bluelytics, fx, crypto] = await Promise.allSettled([
    fetchJson('https://api.bluelytics.com.ar/v2/latest'),
    fetchJson('https://open.er-api.com/v6/latest/USD'),
    fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin%2Cethereum%2Ctether%2Csolana&vs_currencies=ars%2Cusd'),
  ]);

  const base = {
    timestamp: new Date().toISOString(),
    blue: { buy: null, sell: null },
    oficial: { buy: null, sell: null },
    tarjeta: { value: null },
    mep: { value: null },
    ccl: { value: null },
    mayorista: { value: null },
    euro: { ars: null, usd: null },
    yen: { ars: null, usd: null },
    crypto: null,
    criptos: {
      bitcoin: { ars: null, usd: null },
      ethereum: { ars: null, usd: null },
      tether: { ars: null, usd: null },
      solana: { ars: null, usd: null },
    },
  };

  if (bluelytics.status === 'fulfilled') {
    const data = bluelytics.value;
    const blue = data.blue || {};
    const oficial = data.oficial || {};
    base.blue = { buy: blue.value_buy || null, sell: blue.value_sell || null };
    base.oficial = { buy: oficial.value_buy || null, sell: oficial.value_sell || null };
    base.tarjeta = { value: oficial.value_sell ? Math.round(oficial.value_sell * 1.65 * 100) / 100 : null };
    base.mep = { value: data.mep?.value_avg || data.mep?.value || null };
    base.ccl = { value: data.ccl?.value_avg || data.ccl?.value || null };
    base.mayorista = { value: oficial.value_sell ? Math.round((oficial.value_sell - 0.2) * 100) / 100 : null };
  }

  const dolarOficial = base.oficial.sell || base.oficial.buy || base.blue.sell;

  if (fx.status === 'fulfilled' && fx.value.rates && dolarOficial) {
    const eurUsd = fx.value.rates.EUR || null;
    const jpyUsd = fx.value.rates.JPY ? fx.value.rates.JPY / 100 : null;
    base.euro = { usd: eurUsd, ars: eurUsd ? Math.round(eurUsd * dolarOficial * 100) / 100 : null };
    base.yen = { usd: jpyUsd, ars: jpyUsd ? Math.round(jpyUsd * dolarOficial * 100) / 100 : null };
  }

  let criptos = null;
  if (crypto.status === 'fulfilled' && crypto.value && crypto.value.bitcoin) {
    const d = crypto.value;
    criptos = {};
    for (const key of ['bitcoin', 'ethereum', 'tether', 'solana']) {
      if (d[key]) criptos[key] = { ars: d[key].ars != null ? d[key].ars : null, usd: d[key].usd != null ? d[key].usd : null };
    }
  } else {
    // Fallback: Binance (precios en USD) convertidos con el dólar oficial
    try {
      const b = await fetchJson('https://api.binance.com/api/v3/ticker/price?symbols=' + encodeURIComponent('["BTCUSDT","ETHUSDT","SOLUSDT","USDTUSDT"]'));
      const map = { BTCUSDT: 'bitcoin', ETHUSDT: 'ethereum', SOLUSDT: 'solana', USDTUSDT: 'tether' };
      const tmp = {};
      for (const t of b) {
        const usd = parseFloat(t.price);
        if (map[t.symbol] && usd) tmp[map[t.symbol]] = { usd, ars: dolarOficial ? Math.round(usd * dolarOficial * 100) / 100 : null };
      }
      if (tmp.bitcoin || tmp.ethereum) criptos = tmp;
    } catch {}
  }

  if (criptos) {
    for (const key of ['bitcoin', 'ethereum', 'tether', 'solana']) {
      if (criptos[key]) base.criptos[key] = criptos[key];
    }
    base.crypto = base.criptos;
  }

  return base;
}

module.exports = { getCotizaciones };
