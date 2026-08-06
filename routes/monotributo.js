const express = require('express');
const storage = require('../services/storage');
const vencimientosService = require('../services/vencimientos');
const router = express.Router();

function findCategoryByParam(cats, param, value) {
  for (const cat of cats) {
    if (value <= cat[param]) return cat;
  }
  return cats[cats.length - 1];
}

// Verifica cada parámetro contra los límites de una categoría.
// valores: { ingresos, superficie, energia, alquilerMensual } (null si no se informó)
function verificarParametros(categoria, valores) {
  const checks = [
    { parametro: 'Ingresos anuales', valor: valores.ingresos, limite: categoria.maxIncome, key: 'maxIncome', activo: valores.ingresos != null },
    { parametro: 'Superficie', valor: valores.superficie, limite: categoria.maxArea, key: 'maxArea', activo: valores.superficie != null },
    { parametro: 'Energía anual (kWh)', valor: valores.energia, limite: categoria.maxEnergy, key: 'maxEnergy', activo: valores.energia != null },
    { parametro: 'Alquiler anual', valor: valores.alquilerMensual != null ? valores.alquilerMensual * 12 : null, limite: categoria.maxRent, key: 'maxRent', activo: valores.alquilerMensual != null },
  ];
  return checks.filter(c => c.activo).map(c => ({
    parametro: c.parametro,
    valor: c.valor,
    limite: c.limite,
    ok: c.valor <= c.limite,
  }));
}

router.get('/categorias', (req, res) => {
  res.json(storage.getCategorias());
});

router.post('/calcular', (req, res) => {
  const { ingresosAnuales, superficie, energia, alquilerMensual } = req.body;

  const ingresos = Number(ingresosAnuales);
  if (!Number.isFinite(ingresos) || ingresos < 0) {
    return res.status(400).json({ error: 'Ingresos anuales inválidos' });
  }

  const cats = storage.getCategorias();
  const deducciones = storage.getAnnualDeductions();

  const numOrZero = (v) => (Number.isFinite(Number(v)) && Number(v) > 0) ? Number(v) : 0;
  const sup = numOrZero(superficie);
  const ener = numOrZero(energia);
  const alq = numOrZero(alquilerMensual);

  const catCodes = cats.map(c => c.code);
  const idxIncome = catCodes.indexOf(findCategoryByParam(cats, 'maxIncome', ingresos).code);
  let idxArea = 0;
  let idxEnergy = 0;
  let idxRent = 0;

  if (sup) idxArea = catCodes.indexOf(findCategoryByParam(cats, 'maxArea', sup).code);
  if (ener) idxEnergy = catCodes.indexOf(findCategoryByParam(cats, 'maxEnergy', ener).code);
  if (alq) idxRent = catCodes.indexOf(findCategoryByParam(cats, 'maxRent', alq * 12).code);

  const maxIdx = Math.max(idxIncome, idxArea, idxEnergy, idxRent);
  const recomendada = cats[maxIdx];
  const puedeExcluirse = ingresos > cats[cats.length - 1].maxIncome;

  res.json({
    recomendada: recomendada.code,
    categoria: recomendada,
    ingresosAnuales: ingresos,
    puedeExcluirse,
    verificacion: verificarParametros(recomendada, { ingresos, superficie: sup, energia: ener, alquilerMensual: alq }),
    costosMensuales: {
      total: recomendada.monthlyFee + recomendada.retirement + recomendada.obraSocial,
      monotributo: recomendada.monthlyFee,
      jubilacion: recomendada.retirement,
      obraSocial: recomendada.obraSocial,
    },
    deducciones: {
      conyuge: deducciones.spouse || 0,
      hijos: deducciones.dependents || 0,
    },
  });
});

router.post('/recategorizar', (req, res) => {
  const { categoriaActual, ingresosUltimos12, superficie, energia, alquiler } = req.body;
  if (!categoriaActual || !ingresosUltimos12) {
    return res.status(400).json({ error: 'Categoría actual e ingresos de últimos 12 meses requeridos' });
  }

  const cats = storage.getCategorias();
  const currentIdx = cats.findIndex(c => c.code === categoriaActual.toUpperCase());
  if (currentIdx === -1) return res.status(400).json({ error: 'Categoría inválida' });

  const ingresos = Number(ingresosUltimos12);
  if (!Number.isFinite(ingresos) || ingresos < 0) return res.status(400).json({ error: 'Ingresos de los últimos 12 meses inválidos' });

  const numOrZero = (v) => (Number.isFinite(Number(v)) && Number(v) > 0) ? Number(v) : 0;
  const sup = numOrZero(superficie);
  const ener = numOrZero(energia);
  const alq = numOrZero(alquiler);

  const catCodes = cats.map(c => c.code);
  const idxIncome = catCodes.indexOf(findCategoryByParam(cats, 'maxIncome', ingresos).code);
  let idxArea = 0, idxEnergy = 0, idxRent = 0;
  if (sup) idxArea = catCodes.indexOf(findCategoryByParam(cats, 'maxArea', sup).code);
  if (ener) idxEnergy = catCodes.indexOf(findCategoryByParam(cats, 'maxEnergy', ener).code);
  if (alq) idxRent = catCodes.indexOf(findCategoryByParam(cats, 'maxRent', alq * 12).code);
  const sugerida = cats[Math.max(idxIncome, idxArea, idxEnergy, idxRent)];

  const currentCat = cats[currentIdx];
  const sube = cats.indexOf(sugerida) > currentIdx;
  const baja = cats.indexOf(sugerida) < currentIdx;

  res.json({
    categoriaActual: categoriaActual.toUpperCase(),
    categoriaSugerida: sugerida.code,
    cambia: sube || baja,
    tipoCambio: sube ? 'sube' : baja ? 'baja' : 'sin cambios',
    ingresosUltimos12: ingresos,
    puedePermanecer: !sube && !baja && verificarParametros(currentCat, { ingresos, superficie: sup, energia: ener, alquilerMensual: alq }).every(c => c.ok),
    verificacion: verificarParametros(sugerida, { ingresos, superficie: sup, energia: ener, alquilerMensual: alq }),
    sugerida,
  });
});

router.get('/vencimientos', (req, res) => {
  res.json(vencimientosService.getVencimientos(new Date().getFullYear()));
});

module.exports = router;
