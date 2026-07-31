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

  console.log('\n== MONOTRIBUTO ==');
  r = await api('GET', '/api/monotributo/categorias');
  check('categorias 200', r.status === 200 && Array.isArray(r.json), r.text.slice(0, 100));

  console.log('\n== PLANES / PAGOS (mock) ==');
  r = await api('GET', '/api/payments/planes');
  check('planes 200', r.status === 200 && Array.isArray(r.json), r.text.slice(0, 80));

  r = await api('POST', '/api/payments/crear-preferencia', { planId: 'pro' }, true);
  check('mock upgrade 200', r.status === 200 && r.json.status === 'mock', r.text.slice(0, 100));

  r = await api('GET', '/api/payments/status/' + userId, null, true);
  check('status tier=pro', r.status === 200 && r.json.tier === 'pro', r.text.slice(0, 100));

  r = await api('GET', '/api/payments/status/' + userId);
  check('status sin token 401', r.status === 401);

  r = await api('GET', '/api/payments/status/otro-usuario', null, true);
  check('status de otro usuario 403', r.status === 403);

  console.log('\n== ALERTAS (gratis) ==');
  r = await api('GET', '/api/alerts', null, true);
  check('alertas 200 (gratis)', r.status === 200 && Array.isArray(r.json), r.text.slice(0, 100));

  r = await api('POST', '/api/alerts', { type: 'custom', title: 'Recordatorio', message: 'pagar' }, true);
  check('crear alerta 201', r.status === 201, r.text.slice(0, 100));

  console.log('\n== EXPORT (gratis) ==');
  r = await api('GET', '/api/export/gastos/csv', null, true);
  check('csv gastos 200', r.status === 200 && r.text.includes('Fecha'), r.text.slice(0, 80));

  r = await api('GET', '/api/status');
  check('api/status 200', r.status === 200);

  console.log('\nRESULTADO: ' + passed + ' OK, ' + failed + ' FAIL');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('ERROR CRASH:', e.message); process.exit(2); });
