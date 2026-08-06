// Test suite de API para AFIP Assistant.
// Uso: node tests/api.test.js [BASE_URL]
// Ejemplos:
//   node tests/api.test.js                      -> http://localhost:3000
//   node tests/api.test.js http://localhost:3999
//   node tests/api.test.js https://mi-dominio.com

const BASE = process.argv[2] || 'http://localhost:3000';
let token = null;
let userId = null;
let passed = 0;
let failed = 0;

function check(name, cond, extra) {
  if (cond) { passed++; console.log('  OK  ' + name); }
  else { failed++; console.log('  FAIL ' + name + (extra ? ' => ' + extra : '')); }
}

async function api(method, path, body, auth) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) headers['Authorization'] = 'Bearer ' + token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

(async () => {
  const email = 'test' + Date.now() + '@test.com';
  console.log('\n== AUTENTICACION ==');

  let r = await api('POST', '/api/auth/register', { email, password: 'pass12345', name: 'Tester' });
  check('register 201', r.status === 201, r.text);
  token = r.json.token; userId = r.json.user.id;

  r = await api('POST', '/api/auth/register', { email, password: 'pass12345' });
  check('register duplicado 409', r.status === 409);

  r = await api('POST', '/api/auth/login', { email, password: 'pass12345' });
  check('login 200', r.status === 200);
  token = r.json.token;

  r = await api('POST', '/api/auth/login', { email, password: 'mala123' });
  check('login pass mala 401', r.status === 401);

  r = await api('GET', '/api/auth/me', null, true);
  check('me 200', r.status === 200 && r.json.email === email, r.text);

  r = await api('GET', '/api/auth/me');
  check('me sin token 401', r.status === 401);

  console.log('\n== GASTOS ==');
  r = await api('POST', '/api/gastos', { amount: 1000, currency: 'ARS', category: 'comida', description: 'Prueba' }, true);
  check('crear gasto 201', r.status === 201, r.text);
  const expId = r.json.id;

  r = await api('GET', '/api/gastos', null, true);
  check('listar gastos 200', r.status === 200 && Array.isArray(r.json));

  r = await api('GET', '/api/gastos');
  check('gastos sin token 401', r.status === 401);

  r = await api('POST', '/api/gastos/resumen', { month: new Date().getMonth() + 1, year: new Date().getFullYear() }, true);
  check('resumen 200', r.status === 200 && r.json.total >= 1, r.text);

  r = await api('POST', '/api/gastos/resumen', { month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  check('resumen sin token 401', r.status === 401);

  r = await api('POST', '/api/gastos/evolucion', { meses: 6 }, true);
  check('evolucion 200', r.status === 200 && Array.isArray(r.json.meses) && r.json.meses.length === 6 && typeof r.json.totales === 'object', r.text.slice(0, 100));

  r = await api('POST', '/api/gastos/evolucion', { meses: 6 });
  check('evolucion sin token 401', r.status === 401);

  console.log('\n== ELIMINAR GASTO ==');
  r = await api('DELETE', '/api/gastos/' + expId, null, true);
  check('borrar gasto 200', r.status === 200, r.text);

  r = await api('POST', '/api/gastos', { amount: 500, currency: 'USD', category: 'otros', description: '' }, true);
  const expId2 = r.json.id;
  r = await api('DELETE', '/api/gastos/' + expId2, null, true);
  check('borrar gasto propio ok', r.status === 200);

  console.log('\n== DOLAR / EXCHANGE ==');
  r = await api('GET', '/api/cotizaciones');
  check('cotizaciones 200', r.status === 200 && r.json.blue, r.text.slice(0, 100));

  r = await api('GET', '/api/cotizaciones/historicos');
  check('historicos 200 (array)', r.status === 200 && Array.isArray(r.json), r.text.slice(0, 100));

  r = await api('GET', '/api/cotizaciones');
  check('cotizaciones: euro/criptos presente', r.status === 200 && r.json.euro && r.json.criptos && r.json.criptos.bitcoin !== undefined, r.text.slice(0, 100));

  r = await api('GET', '/api/cotizaciones');
  check('cotizaciones: variaciones y mayorista presente', r.status === 200 && r.json.variaciones && r.json.variaciones.blue !== undefined && r.json.mayorista?.value != null, r.text.slice(0, 100));

  console.log('\n== NOTICIAS ==');
  r = await api('GET', '/api/news');
  check('noticias 200 con local/int/cripto', r.status === 200 && Array.isArray(r.json.local) && Array.isArray(r.json.internacional) && Array.isArray(r.json.cripto), r.text.slice(0, 100));

  r = await api('GET', '/api/news?categoria=cripto');
  check('noticias por categoría cripto', r.status === 200 && Array.isArray(r.json) && r.json.length > 0, r.text.slice(0, 100));

  console.log('\n== MONOTRIBUTO ==');
  r = await api('GET', '/api/monotributo/categorias');
  check('categorias 200', r.status === 200 && Array.isArray(r.json), r.text.slice(0, 100));

  r = await api('POST', '/api/monotributo/calcular', { ingresosAnuales: 2000000, superficie: 40 });
  check('calcular con verificacion', r.status === 200 && Array.isArray(r.json.verificacion) && r.json.verificacion.length >= 2 && r.json.recomendada, r.text.slice(0, 100));

  r = await api('POST', '/api/monotributo/recategorizar', { categoriaActual: 'B', ingresosUltimos12: 1500000 });
  check('recategorizar con verificacion', r.status === 200 && typeof r.json.puedePermanecer === 'boolean' && Array.isArray(r.json.verificacion), r.text.slice(0, 100));

  r = await api('GET', '/api/monotributo/vencimientos');
  check('vencimientos 200 (15 items)', r.status === 200 && Array.isArray(r.json) && r.json.length === 15, r.text.slice(0, 100));

  console.log('\n== PLANES / PAGOS (mock) ==');
  r = await api('GET', '/api/payments/planes');
  check('planes 200', r.status === 200 && Array.isArray(r.json), r.text.slice(0, 80));

  r = await api('POST', '/api/payments/crear-preferencia', { planId: 'pro' }, true);
  const mockOK = r.status === 200 && r.json.status === 'mock';
  const prodBlocked = r.status === 503;
  check('mock upgrade 200 (dev) / bloqueado en prod', mockOK || prodBlocked, r.text.slice(0, 100));

  r = await api('GET', '/api/payments/status/' + userId, null, true);
  check('status 200', r.status === 200 && typeof r.json.tier === 'string', r.text.slice(0, 100));
  if (mockOK) check('status tier=pro (solo dev)', r.json.tier === 'pro', r.text.slice(0, 100));

  r = await api('GET', '/api/payments/status/' + userId);
  check('status sin token 401', r.status === 401);

  r = await api('GET', '/api/payments/status/otro-usuario', null, true);
  check('status de otro usuario 403', r.status === 403);

  console.log('\n== ALERTAS (gratis) ==');
  r = await api('GET', '/api/alerts', null, true);
  check('alertas 200 (gratis)', r.status === 200 && Array.isArray(r.json), r.text.slice(0, 100));

  r = await api('POST', '/api/alerts', { type: 'custom', title: 'Recordatorio', message: 'pagar' }, true);
  check('crear alerta 201', r.status === 201, r.text.slice(0, 100));

  r = await api('GET', '/api/alerts/email/status', null, true);
  check('email status 200', r.status === 200 && typeof r.json.enabled === 'boolean', r.text.slice(0, 100));

  r = await api('POST', '/api/alerts/email/toggle', { enabled: false }, true);
  check('email toggle sin SMTP 503', r.status === 503, r.text.slice(0, 100));

  console.log('\n== EXPORT (gratis) ==');
  r = await api('GET', '/api/export/gastos/csv', null, true);
  check('csv gastos 200', r.status === 200 && r.text.includes('Fecha'), r.text.slice(0, 80));

  const resPdf = await fetch(BASE + '/api/export/gastos/pdf', { headers: { 'Authorization': 'Bearer ' + token } });
  const pdfType = resPdf.headers.get('content-type') || '';
  const pdfData = await resPdf.arrayBuffer();
  const pdfOk = pdfData.byteLength > 200 && pdfType.includes('application/pdf');
  check('pdf gastos 200 (pdf válido)', resPdf.status === 200 && pdfOk, pdfType + ' bytes=' + pdfData.byteLength);

  r = await api('GET', '/api/status');
  check('api/status 200', r.status === 200);

  console.log('\n== RESEÑAS ==');
  r = await api('GET', '/api/reviews');
  check('listar reseñas 200 (público)', r.status === 200 && Array.isArray(r.json), r.text.slice(0, 100));

  r = await api('POST', '/api/reviews', { rating: 5, comment: 'Muy buena herramienta' });
  check('reseña sin token 401', r.status === 401);

  r = await api('POST', '/api/reviews', { rating: 5, comment: 'Muy buena herramienta' }, true);
  check('crear reseña 201', r.status === 201 && r.json.rating === 5, r.text.slice(0, 100));

  r = await api('POST', '/api/reviews', { rating: 99, comment: 'invalida' }, true);
  check('reseña rating inválido 400', r.status === 400);

  r = await api('GET', '/api/reviews');
  check('reseña visible en la lista', r.status === 200 && r.json.length > 0, r.text.slice(0, 100));

  r = await api('DELETE', '/api/reviews/inexistente', null, true);
  check('borrar reseña inexistente 404', r.status === 404);

  console.log('\n== MÉTRICAS (opcional) ==');
  const adminKey = process.env.ADMIN_KEY;
  if (adminKey) {
    r = await api('GET', '/api/metrics');
    check('metrics sin key 401', r.status === 401);

    const res2 = await fetch(BASE + '/api/metrics', { headers: { 'x-admin-key': adminKey } });
    const j2 = await res2.json();
    check('metrics con key 200', res2.status === 200 && typeof j2.usuarios === 'number' && typeof j2.visitas?.total === 'number', JSON.stringify(j2).slice(0, 100));
  } else {
    console.log('  SKIP (definí ADMIN_KEY para probar métricas)');
  }

  console.log('\nRESULTADO: ' + passed + ' OK, ' + failed + ' FAIL');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('ERROR CRASH:', e.message); process.exit(2); });
