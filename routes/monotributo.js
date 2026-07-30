const express = require('express');
const storage = require('../services/storage');
const router = express.Router();

function findCategoryByParam(cats, param, value) {
  for (const cat of cats) {
    if (value <= cat[param]) return cat;
  }
  return cats[cats.length - 1];
}

router.get('/categorias', (req, res) => {
  res.json(storage.getCategorias());
});

router.post('/calcular', (req, res) => {
  const { ingresosAnuales, superficie, energia, alquilerMensual } = req.body;

  if (!ingresosAnuales) return res.status(400).json({ error: 'Ingresos anuales requeridos' });

  const cats = storage.getCategorias();
  const deducciones = storage.getAnnualDeductions();

  const catCodes = cats.map(c => c.code);
  const idxIncome = catCodes.indexOf(findCategoryByParam(cats, 'maxIncome', ingresosAnuales).code);
  let idxArea = 0;
  let idxEnergy = 0;
  let idxRent = 0;

  if (superficie) idxArea = catCodes.indexOf(findCategoryByParam(cats, 'maxArea', superficie).code);
  if (energia) idxEnergy = catCodes.indexOf(findCategoryByParam(cats, 'maxEnergy', energia).code);
  if (alquilerMensual) idxRent = catCodes.indexOf(findCategoryByParam(cats, 'maxRent', alquilerMensual * 12).code);

  const maxIdx = Math.max(idxIncome, idxArea, idxEnergy, idxRent);
  const recomendada = cats[maxIdx];
  const puedeExcluirse = ingresosAnuales > cats[cats.length - 1].maxIncome;

  res.json({
    recomendada: recomendada.code,
    categoria: recomendada,
    ingresosAnuales,
    puedeExcluirse,
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

  const catCodes = cats.map(c => c.code);
  const idxIncome = catCodes.indexOf(findCategoryByParam(cats, 'maxIncome', ingresosUltimos12).code);
  let idxArea = 0, idxEnergy = 0, idxRent = 0;
  if (superficie) idxArea = catCodes.indexOf(findCategoryByParam(cats, 'maxArea', superficie).code);
  if (energia) idxEnergy = catCodes.indexOf(findCategoryByParam(cats, 'maxEnergy', energia).code);
  if (alquiler) idxRent = catCodes.indexOf(findCategoryByParam(cats, 'maxRent', alquiler * 12).code);
  const sugerida = cats[Math.max(idxIncome, idxArea, idxEnergy, idxRent)];

  const currentCat = cats[currentIdx];
  const sube = cats.indexOf(sugerida) > currentIdx;
  const baja = cats.indexOf(sugerida) < currentIdx;

  res.json({
    categoriaActual: categoriaActual.toUpperCase(),
    categoriaSugerida: sugerida.code,
    cambia: sube || baja,
    tipoCambio: sube ? 'sube' : baja ? 'baja' : 'sin cambios',
    ingresosUltimos12,
    sugerida,
  });
});

router.get('/vencimientos', (req, res) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Simplified calendar - real one varies by CUIT ending
  const vencimientos = [
    { mes: `${year}-01`, concepto: 'Monotributo enero', fecha: '20/01/' + year },
    { mes: `${year}-02`, concepto: 'Monotributo febrero', fecha: '19/02/' + year },
    { mes: `${year}-03`, concepto: 'Monotributo marzo', fecha: '20/03/' + year },
    { mes: `${year}-04`, concepto: 'Monotributo abril', fecha: '18/04/' + year },
    { mes: `${year}-05`, concepto: 'Monotributo mayo', fecha: '20/05/' + year },
    { mes: `${year}-06`, concepto: 'Monotributo junio', fecha: '20/06/' + year },
    { mes: `${year}-07`, concepto: 'Monotributo julio', fecha: '20/07/' + year },
    { mes: `${year}-08`, concepto: 'Monotributo agosto', fecha: '20/08/' + year },
    { mes: `${year}-09`, concepto: 'Monotributo septiembre', fecha: '20/09/' + year },
    { mes: `${year}-10`, concepto: 'Monotributo octubre', fecha: '20/10/' + year },
    { mes: `${year}-11`, concepto: 'Monotributo noviembre', fecha: '20/11/' + year },
    { mes: `${year}-12`, concepto: 'Monotributo diciembre', fecha: '20/12/' + year },
    { mes: year + ' (anual)', concepto: 'Bienes Personales', fecha: '31/03/' + (year + 1) },
    { mes: year + ' (anual)', concepto: 'Ganancias Personas Físicas', fecha: '15/04/' + (year + 1) },
    { mes: `C/${year}`, concepto: 'IVA mensual (respon. inscripto)', fecha: '18/' + String(month).padStart(2, '0') + '/' + year },
  ];

  res.json(vencimientos);
});

module.exports = router;
