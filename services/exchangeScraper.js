const axios = require('axios');

async function getCotizaciones() {
  try {
    const { data } = await axios.get('https://api.bluelytics.com.ar/v2/latest', { timeout: 10000 });

    const blue = data.blue || {};
    const oficial = data.oficial || {};

    return {
      timestamp: new Date().toISOString(),
      blue: { buy: blue.value_buy || null, sell: blue.value_sell || null },
      oficial: { buy: oficial.value_buy || null, sell: oficial.value_sell || null },
      tarjeta: { value: oficial.value_sell ? Math.round(oficial.value_sell * 1.65 * 100) / 100 : null },
      mep: { value: data.mep?.value_avg || data.mep?.value || null },
      ccl: { value: data.ccl?.value_avg || data.ccl?.value || null },
      mayorista: { value: oficial.value_sell ? Math.round((oficial.value_sell - 0.2) * 100) / 100 : null },
      crypto: null,
    };
  } catch {
    return {
      timestamp: new Date().toISOString(),
      blue: { buy: null, sell: null },
      oficial: { buy: null, sell: null },
      tarjeta: { value: null },
      mep: { value: null },
      ccl: { value: null },
      mayorista: { value: null },
      crypto: null,
      error: 'No se pudieron obtener cotizaciones',
    };
  }
}

module.exports = { getCotizaciones };
