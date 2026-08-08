// Envío de emails (recordatorios de vencimientos) vía SMTP.
// Si no hay SMTP configurado, todas las funciones son no-op.

const config = require('../config');

function isConfigured() {
  return !!(config.mail.host && config.mail.user && config.mail.pass);
}

async function send({ to, subject, html, text }) {
  if (!isConfigured()) {
    console.log('Email no enviado a ' + to + ': SMTP no configurado');
    return { skipped: true };
  }
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: { user: config.mail.user, pass: config.mail.pass },
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
    html: '<h2>✅ Email funcionando</h2><p>Este es un email de prueba desde ' + config.app.name + '. Si lo estás leyendo, el SMTP está configurado correctamente y los recordatorios de vencimientos se van a poder enviar.</p>',
  });
}

module.exports = { isConfigured, send, sendWelcomeEmail, sendTestEmail };
