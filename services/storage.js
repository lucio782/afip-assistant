const fs = require('fs');
const path = require('path');
const MONO_FILE = path.join(__dirname, '..', 'data', 'monotributo.json');

let cache = null;

function load() {
  if (cache) return cache;
  try {
    if (!fs.existsSync(MONO_FILE)) return null;
    cache = JSON.parse(fs.readFileSync(MONO_FILE, 'utf-8'));
  } catch { cache = null; }
  return cache;
}

function getCategorias() {
  return load()?.categories || [];
}

function getCategoriaByCode(code) {
  return getCategorias().find(c => c.code === code.toUpperCase());
}

function getAnnualDeductions() {
  return load()?.deductions || {};
}

module.exports = { getCategorias, getCategoriaByCode, getAnnualDeductions };
