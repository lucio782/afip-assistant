const express = require('express');
const router = express.Router();

router.post('/calcular', (req, res) => {
  const { bruto, tipo } = req.body;
  if (!bruto) return res.status(400).json({ error: 'Sueldo bruto requerido' });

  const sueldoBruto = parseFloat(bruto);

  // Simplified Argentine salary deductions (2024 approximations)
  const jubilacion = sueldoBruto * 0.11;
  const pami = sueldoBruto * 0.03;
  const obraSocial = sueldoBruto * 0.03;
  const sindicato = sueldoBruto * 0.02;
  const seguroVida = 150;

  // Ganancias deduction (simplified - real calculation is complex per scale)
  let ganancias = 0;
  const deduccionEspecial = sueldoBruto > 800000 ? sueldoBruto * 0.1 : 0;
  const baseGanancias = sueldoBruto - jubilacion - obraSocial - pami - sindicato - deduccionEspecial;
  // Simplified progressive scale
  if (baseGanancias > 900000) {
    ganancias = (baseGanancias - 900000) * 0.35;
  } else if (baseGanancias > 700000) {
    ganancias = (baseGanancias - 700000) * 0.31;
  } else if (baseGanancias > 500000) {
    ganancias = (baseGanancias - 500000) * 0.27;
  }

  const descuentos = jubilacion + obraSocial + pami + sindicato + seguroVida + ganancias;
  const neto = sueldoBruto - descuentos;

  // SAC (medio aguinaldo)
  const sac = sueldoBruto * 0.5;

  const result = {
    bruto: sueldoBruto,
    neto: Math.round(neto),
    descuentos: {
      total: Math.round(descuentos),
      jubilacion: Math.round(jubilacion),
      obraSocial: Math.round(obraSocial),
      pami: Math.round(pami),
      sindicato: Math.round(sindicato),
      seguroVida,
      ganancias: Math.round(ganancias),
      deduccionEspecial: Math.round(deduccionEspecial),
    },
    aguinaldo: {
      bruto: Math.round(sac),
      neto: Math.round(sac - (descuentos * 0.5)),
    },
    cargasPatronales: Math.round(sueldoBruto * 0.25),
  };

  res.json(result);
});

module.exports = router;
