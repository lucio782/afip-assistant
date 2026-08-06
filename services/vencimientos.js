// Calendario de vencimientos impositivos (compartido entre rutas y recordatorios por email).

function toDate(fecha) {
  const p = String(fecha).split('/');
  return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
}

function getVencimientos(year) {
  const y = year || new Date().getFullYear();
  const now = new Date();
  return [
    { mes: `${y}-01`, concepto: 'Monotributo enero', fecha: '20/01/' + y },
    { mes: `${y}-02`, concepto: 'Monotributo febrero', fecha: '19/02/' + y },
    { mes: `${y}-03`, concepto: 'Monotributo marzo', fecha: '20/03/' + y },
    { mes: `${y}-04`, concepto: 'Monotributo abril', fecha: '18/04/' + y },
    { mes: `${y}-05`, concepto: 'Monotributo mayo', fecha: '20/05/' + y },
    { mes: `${y}-06`, concepto: 'Monotributo junio', fecha: '20/06/' + y },
    { mes: `${y}-07`, concepto: 'Monotributo julio', fecha: '20/07/' + y },
    { mes: `${y}-08`, concepto: 'Monotributo agosto', fecha: '20/08/' + y },
    { mes: `${y}-09`, concepto: 'Monotributo septiembre', fecha: '20/09/' + y },
    { mes: `${y}-10`, concepto: 'Monotributo octubre', fecha: '20/10/' + y },
    { mes: `${y}-11`, concepto: 'Monotributo noviembre', fecha: '20/11/' + y },
    { mes: `${y}-12`, concepto: 'Monotributo diciembre', fecha: '20/12/' + y },
    { mes: y + ' (anual)', concepto: 'Bienes Personales', fecha: '31/03/' + (y + 1) },
    { mes: y + ' (anual)', concepto: 'Ganancias Personas Físicas', fecha: '15/04/' + (y + 1) },
    { mes: `C/${y}`, concepto: 'IVA mensual (respon. inscripto)', fecha: '18/' + String(now.getMonth() + 1).padStart(2, '0') + '/' + y },
  ];
}

function getUpcoming(days, year) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(today.getTime() + Number(days) * 86400000);
  return getVencimientos(year).filter(v => {
    const d = toDate(v.fecha);
    return d >= today && d <= end;
  });
}

module.exports = { getVencimientos, getUpcoming, toDate };
