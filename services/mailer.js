// Envío de emails (recordatorios de vencimientos, bienvenida, pruebas).
// Modos: 'smtp' (nodemailer) o API por HTTPS ('brevo' | 'resend' | 'sendgrid').
// Si no hay nada configurado, todas las funciones son no-op.

const config = require('../config');

const HTTP_PROVIDERS = ['brevo', 'resend', 'sendgrid'];

function isConfigured() {
  if (config.mail.apiKey && HTTP_PROVIDERS.includes(config.mail.provider)) return true;
  return !!(config.mail.host && config.mail.user && config.mail.pass);
}

function parseFrom(from) {
  const m = String(from).match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1], email: m[2] } : { name: '', email: String(from).trim() };
}

async function httpPost(url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.mail.timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error('Email API HTTP ' + res.status + ': ' + text.slice(0, 300));
  }
  return { ok: true, status: res.status };
}

async function sendViaApi({ to, subject, html }) {
  const from = parseFrom(config.mail.from);
  const ct = { 'Content-Type': 'application/json' };
  if (config.mail.provider === 'brevo') {
    return httpPost('https://api.brevo.com/v3/smtp/email',
      { 'api-key': config.mail.apiKey, ...ct },
      { sender: { name: from.name || undefined, email: from.email }, to: [{ email: to }], subject, htmlContent: html });
  }
  if (config.mail.provider === 'resend') {
    return httpPost('https://api.resend.com/emails',
      { Authorization: 'Bearer ' + config.mail.apiKey, ...ct },
      { from: from.email, to: [to], subject, html });
  }
  if (config.mail.provider === 'sendgrid') {
    return httpPost('https://api.sendgrid.com/v3/mail/send',
      { Authorization: 'Bearer ' + config.mail.apiKey, ...ct },
      { personalizations: [{ to: [{ email: to }] }], from: { email: from.email, name: from.name || undefined }, subject, content: [{ type: 'text/html', value: html }] });
  }
  throw new Error('EMAIL_PROVIDER desconocido: ' + config.mail.provider);
}

async function send({ to, subject, html, text }) {
  if (!isConfigured()) {
    console.log('Email no enviado a ' + to + ': no configurado');
    return { skipped: true };
  }
  if (config.mail.provider !== 'smtp') {
    return sendViaApi({ to, subject, html });
  }
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: { user: config.mail.user, pass: config.mail.pass },
    connectionTimeout: config.mail.timeoutMs,
    greetingTimeout: config.mail.timeoutMs,
    socketTimeout: config.mail.timeoutMs,
  });
  return transporter.sendMail({
    from: config.mail.from,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ' '),
  });
}

async function sendWelcomeEmail(to, name) {
  if (!isConfigured()) return { skipped: true };
  const appUrl = config.app.url;
  const displayName = (name || 'hola').replace(/<[^>]+>/g, '');
  return send({
    to,
    subject: 'Bienvenido a ' + config.app.name + ' 🎉',
    html: '<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:0 auto">' +
      '<h2>¡Bienvenido a ' + config.app.name + ', ' + displayName + '!</h2>' +
      '<p>Todas las herramientas son gratis e ilimitadas:</p>' +
      '<ul>' +
      '<li>🧮 Calculadora de categoría de Monotributo 2026 (con verificación por parámetro)</li>' +
      '<li>💵 Dólares en vivo (blue, oficial, tarjeta, MEP, CCL) y criptos</li>' +
      '<li>💰 Registro de gastos con gráficos y exportación a CSV y PDF</li>' +
      '<li>📅 Vencimientos y recordatorios por email (podés desactivarlos en Alertas)</li>' +
      '<li>📲 Se instala en tu celular como app (PWA), con modo claro y oscuro</li>' +
      '</ul>' +
      '<p><a href="' + appUrl + '" style="background:#3b82f6;color:#fff;padding:10px 20px;border-radius:20px;text-decoration:none">Abrir la app</a></p>' +
      '<p style="color:#888;font-size:12px">No respondas a este email. Tu cuenta es privada y tus datos no se comparten.</p>' +
      '</div>',
  });
}

async function sendTestEmail(to) {
  return send({
    to,
    subject: 'Prueba de email — ' + config.app.name,
    html: '<h2>✅ Email funcionando</h2><p>Este es un email de prueba desde ' + config.app.name + '. Si lo estás leyendo, el email está configurado correctamente y los recordatorios de vencimientos se van a poder enviar.</p>',
  });
}

module.exports = { isConfigured, send, sendWelcomeEmail, sendTestEmail };
