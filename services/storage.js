const fs = require('fs');
const path = require('path');
const MONO_FILE = path.join(__dirname, '..', 'data', 'monotributo.json');

function readJSON(file) {
  try { if (!fs.existsSync(file)) return null; return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return null; }
}

function getCategorias() {
  return readJSON(MONO_FILE)?.categories || [];
}

function getCategoriaByCode(code) {
  return getCategorias().find(c => c.code === code.toUpperCase());
}

function getAnnualDeductions() {
  return readJSON(MONO_FILE)?.deductions || {};
}

module.exports = { getCategorias, getCategoriaByCode, getAnnualDeductions };
