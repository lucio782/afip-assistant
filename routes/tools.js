const express = require('express');
const router = express.Router();

// Historical inflation data (INDEC approximate, for reference)
const INFLACION_ANUAL = {
  2020: 36.1, 2021: 50.9, 2022: 94.8, 2023: 211.4, 2024: 117.8, 2025: 45.0, 2026: 30.0
};

const IPC_MENSUAL = {
  '2023-01': 6.0, '2023-02': 6.6, '2023-03': 7.7, '2023-04': 8.4, '2023-05': 7.8,
  '2023-06': 6.0, '2023-07': 6.3, '2023-08': 12.4, '2023-09': 12.7, '2023-10': 8.3,
  '2023-11': 12.8, '2023-12': 25.5,
  '2024-01': 20.6, '2024-02': 13.2, '2024-03': 11.0, '2024-04': 8.8, '2024-05': 4.2,
  '2024-06': 4.6, '2024-07': 4.0, '2024-08': 4.2, '2024-09': 3.5, '2024-10': 2.7,
  '2024-11': 2.4, '2024-12': 2.7,
  '2025-01': 2.2, '2025-02': 2.4, '2025-03': 3.0, '2025-04': 2.8, '2025-05': 2.5,
  '2025-06': 2.3, '2025-07': 2.5, '2025-08': 2.2, '2025-09': 2.0, '2025-10': 2.5,
  '2025-11': 2.3, '2025-12': 2.5,
  '2026-01': 2.5, '2026-02': 2.5, '2026-03': 2.5, '2026-04': 2.5, '2026-05': 2.5,
  '2026-06': 2.5, '2026-07': 2.5,
};

router.get('/inflacion/indec', (req, res) => {
  res.json({
    fuente: 'INDEC (aproximado)',
    anual: INFLACION_ANUAL,
    mensual: IPC_MENSUAL,
  });
});

router.post('/inflacion/calcular', (req, res) => {
  const { monto, mesDesde, anioDesde, mesHasta, anioHasta } = req.body;

  if (!monto || !mesDesde || !anioDesde || !mesHasta || !anioHasta) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }

  // Calculate accumulated inflation between two dates
  let factor = 1.0;
  const start = new Date(anioDesde, mesDesde - 1, 1);
  const end = new Date(anioHasta, mesHasta - 1, 1);

  if (start >= end) {
    return res.json({ error: 'La fecha final debe ser posterior a la inicial', montoOriginal: monto, montoAjustado: monto, factor: 1 });
  }

  let current = new Date(start);
  while (current < end) {
    const key = current.getFullYear() + '-' + String(current.getMonth() + 1).padStart(2, '0');
    const inflacion = IPC_MENSUAL[key];
    if (inflacion) {
      factor *= (1 + inflacion / 100);
    } else {
      // Use annual estimate for missing months
      const year = current.getFullYear();
      const anual = INFLACION_ANUAL[year];
      if (anual) {
        factor *= Math.pow(1 + anual / 100, 1 / 12);
      }
    }
    current.setMonth(current.getMonth() + 1);
  }

  const ajustado = monto * factor;

  res.json({
    montoOriginal: monto,
    montoAjustado: Math.round(ajustado * 100) / 100,
    factor: Math.round(factor * 10000) / 10000,
    inflacionAcumulada: Math.round((factor - 1) * 10000) / 100 + '%',
    desde: `${mesDesde}/${anioDesde}`,
    hasta: `${mesHasta}/${anioHasta}`,
    periodoMeses: Math.round((end - start) / (30 * 24 * 60 * 60 * 1000)),
  });
});

router.post('/prestamo/calcular', (req, res) => {
  const { monto, cuotas, interesAnual } = req.body;

  if (!monto || !cuotas) return res.status(400).json({ error: 'Monto y cuotas requeridos' });

  const tasaMensual = ((interesAnual || 85) / 12) / 100; // Default 85% annual
  const n = cuotas;
  const p = monto;

  // French system (cuota fija)
  if (tasaMensual > 0) {
    const cuotaMensual = p * (tasaMensual * Math.pow(1 + tasaMensual, n)) / (Math.pow(1 + tasaMensual, n) - 1);
    const total = cuotaMensual * n;
    const interesTotal = total - p;

    // Generate payment schedule
    const schedule = [];
    let saldo = p;
    for (let i = 1; i <= n; i++) {
      const interesCuota = saldo * tasaMensual;
      const amortizacion = cuotaMensual - interesCuota;
      saldo -= amortizacion;
      schedule.push({
        cuota: i,
        monto: Math.round(cuotaMensual * 100) / 100,
        interes: Math.round(interesCuota * 100) / 100,
        amortizacion: Math.round(amortizacion * 100) / 100,
        saldo: Math.round(Math.max(saldo, 0) * 100) / 100,
      });
    }

    res.json({
      monto: p,
      cuotas: n,
      tasaMensual: Math.round(tasaMensual * 10000) / 100 + '%',
      tasaAnual: interesAnual + '%',
      cuotaMensual: Math.round(cuotaMensual * 100) / 100,
      total: Math.round(total * 100) / 100,
      interesTotal: Math.round(interesTotal * 100) / 100,
      schedule: schedule.slice(0, 12), // First 12 rows
    });
  } else {
    const cuotaMensual = p / n;
    res.json({
      monto: p, cuotas: n, tasaMensual: '0%', tasaAnual: '0%',
      cuotaMensual: Math.round(cuotaMensual * 100) / 100,
      total: p, interesTotal: 0,
      schedule: [],
    });
  }
});

router.post('/convertir', (req, res) => {
  const { monto, desde, hasta, cotizacionPersonalizada } = req.body;

  if (!monto || !desde || !hasta) {
    return res.status(400).json({ error: 'Monto, moneda origen y destino requeridos' });
  }

  // Use custom rate or try to get live rate
  // For now return with placeholder - frontend will get live rates
  res.json({
    monto: parseFloat(monto),
    desde,
    hasta,
    resultado: null, // Frontend calculates with live rate
    mensaje: 'Usá la cotización en vivo del panel. El resultado se calcula automáticamente.',
  });
});

router.get('/guias', (req, res) => {
  res.json({
    monotributo: {
      titulo: 'Guía rápida de Monotributo',
      pasos: [
        'Ingresá tus ingresos anuales estimados (los que declaraste o planeás declarar)',
        'Opcional: completá superficie, consumo de energía y alquiler para mayor precisión',
        'La calculadora te muestra la categoría que te corresponde y cuánto pagarías por mes',
        'Si cambiaron tus ingresos, usá el simulador de recategorización (enero y julio)',
        'Consultá el calendario de vencimientos para no olvidar ningún pago',
      ],
      tip: 'Los valores de las categorías se actualizan cada año por ley. Este sistema usa los valores de 2026.',
    },
    dolares: {
      titulo: 'Guía de Cotizaciones',
      explicacion: [
        'Blue: dólar informal (cuevas/arbolitos). Referencia del mercado paralelo.',
        'Oficial: cotización del Banco Nación. Usada para importaciones y exportaciones.',
        'Tarjeta: oficial + impuestos (30% PAIS + 35% percepción ganancias). Usado en consumos en dólares.',
        'MEP: dólar bursátil. Comprando bonos en pesos y vendiéndolos en dólares.',
        'CCL: "Contado con Liqui". Similar al MEP pero envía los dólares al exterior.',
      ],
    },
    gastos: {
      titulo: 'Cómo usar el registro de gastos',
      pasos: [
        'Registrá tus gastos diarios seleccionando monto, moneda (ARS o USD) y categoría',
        'El plan Free permite hasta 10 gastos por mes. Pro: 200. Premium: ilimitado.',
        'El resumen muestra totales por moneda y por categoría',
        'Con Premium podés exportar todo a CSV para llevarlo a Excel',
        'Los gastos en USD se convierten automáticamente a ARS usando la cotización del día',
      ],
    },
  });
});

module.exports = router;
