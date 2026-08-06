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

module.exports = { isConfigured, send };
