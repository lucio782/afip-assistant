// Configuración central de ARCA Assistant.
// Todos los valores tienen defaults y se pueden sobreescribir con variables de entorno (ver .env.example).
require('dotenv').config();

function env(name, def) {
  const v = process.env[name];
  return v === undefined || v === '' ? def : v;
}

function envNum(name, def) {
  const n = Number(env(name, def));
  return isNaN(n) ? def : n;
}

function envJson(name, def) {
  const v = env(name, null);
  if (!v) return def;
  try { return JSON.parse(v); } catch { return def; }
}

module.exports = {
  app: {
    name: env('APP_NAME', 'ARCA Assistant'),
    version: env('APP_VERSION', '2.2.0'),
    url: env('APP_URL', 'https://calculararca.duckdns.org'),
    port: envNum('PORT', 3000),
    host: env('HOST', '0.0.0.0'),
    bodyLimit: env('BODY_LIMIT', '1mb'),
    autoSaveMs: envNum('AUTO_SAVE_MS', 5 * 60 * 1000),
  },

  security: {
    visitorCookie: env('VISITOR_COOKIE', 'vv'),
    visitorCookieMaxAge: envNum('VISITOR_COOKIE_MAX_AGE', 365 * 24 * 3600),
  },

  exchange: {
    bluelyticsUrl: env('BLUELYTICS_URL', 'https://api.bluelytics.com.ar/v2/latest'),
    erapiUrl: env('ERAPI_URL', 'https://open.er-api.com/v6/latest/USD'),
    coingeckoUrl: env('COINGECKO_URL', 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin%2Cethereum%2Ctether%2Csolana&vs_currencies=ars%2Cusd'),
    dolarapiUrl: env('DOLARAPI_URL', 'https://dolarapi.com/v1/dolares'),
    binanceUrl: env('BINANCE_URL', 'https://api.binance.com/api/v3/ticker/price'),
    binanceSymbols: envJson('BINANCE_SYMBOLS', ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'USDTUSDT']),
    timeout: envNum('EXCHANGE_TIMEOUT_MS', 10000),
    cacheTtl: envNum('EXCHANGE_CACHE_TTL_MS', 60000),
    tarjetaMultiplier: envNum('TARJETA_MULTIPLIER', 1.65),
  },

  news: {
    feedsLocal: envJson('NEWS_FEEDS_LOCAL', [
      'https://news.google.com/rss/search?q=(d%C3%B3lar%20OR%20monotributo%20OR%20econom%C3%ADa%20OR%20AFIP%20OR%20ARCA)%20Argentina&hl=es-419&gl=AR&ceid=AR:es-419',
    ]),
    feedsInternacional: envJson('NEWS_FEEDS_INTERNACIONAL', [
      'https://news.google.com/rss/search?q=mercados%20mundiales%20OR%20wall%20street&hl=es-419&gl=US&ceid=US:es-419',
      'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    ]),
    feedsCripto: envJson('NEWS_FEEDS_CRIPTO', [
      'https://cointelegraph.com/rss',
    ]),
    cacheTtl: envNum('NEWS_CACHE_TTL_MS', 10 * 60 * 1000),
    timeout: envNum('NEWS_TIMEOUT_MS', 12000),
    perCategory: envNum('NEWS_PER_CATEGORY', 12),
    userAgent: env('NEWS_USER_AGENT', 'Mozilla/5.0 (compatible; ARCA-Assistant/1.0)'),
  },

  alerts: {
    dolarThreshold: envNum('DOLAR_ALERT_THRESHOLD', 1500),
    fetchTimeout: envNum('ALERT_FETCH_TIMEOUT_MS', 5000),
  },

  reviews: {
    defaultLimit: envNum('REVIEWS_DEFAULT_LIMIT', 50),
    minComment: envNum('REVIEWS_MIN_COMMENT', 3),
    maxComment: envNum('REVIEWS_MAX_COMMENT', 500),
  },

  database: {
    url: env('DATABASE_URL', null),
  },

  payments: {
    // En producción (con DATABASE_URL) el mock de pagos queda desactivado por seguridad.
    mock: envNum('PAYMENTS_MOCK', env('DATABASE_URL', null) ? 0 : 1),
  },

  mail: {
    // Recordatorios de vencimientos por email.
    // Dos modos (elegido con EMAIL_PROVIDER):
    //  - 'smtp': SMTP clásico (SMTP_HOST/USER/PASS) — sirve en hosting que no bloquea puertos SMTP.
    //  - 'brevo' | 'resend' | 'sendgrid': API por HTTPS (EMAIL_API_KEY) — funciona en Render free tier.
    provider: env('EMAIL_PROVIDER', 'smtp'),
    host: env('SMTP_HOST', ''),
    port: envNum('SMTP_PORT', 587),
    secure: env('SMTP_SECURE', 'false') === 'true',
    user: env('SMTP_USER', ''),
    pass: env('SMTP_PASS', ''),
    apiKey: env('EMAIL_API_KEY', ''),
    from: env('SMTP_FROM', env('APP_NAME', 'ARCA Assistant') + ' <no-reply@calculararca.duckdns.org>'),
    timeoutMs: envNum('EMAIL_TIMEOUT_MS', 20000),
  },

  monetizacion: {
    // Links de afiliados/donaciones. Vacíos = la sección no aparece.
    donarUrl: env('DONAR_URL', ''),
    contador: {
      nombre: env('CONTADOR_NOMBRE', ''),
      descripcion: env('CONTADOR_DESCRIPCION', ''),
      url: env('CONTADOR_URL', ''),
    },
    fintech: envJson('FINTECH_REFS', []), // ej: [{"nombre":"Mercado Pago","url":"https://..."}]
  },
};
