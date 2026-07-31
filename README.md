# 🏛️ AFIP Assistant

Tu asistente financiero gratuito para Argentina. Calculadora de **Monotributo**, **dólar en vivo**, **control de gastos**, **alertas de vencimientos**, **inflación**, **préstamos** y **sueldos** — todo en una sola app, sin costo y sin registros pagos.

> **100% gratis e ilimitado.** Gastos, alertas y exportación incluidos para todos los usuarios.

**Live:** [https://afip-assistant.onrender.com](https://afip-assistant.onrender.com)

## ✨ Funciones

- 🏷️ **Calculadora de Monotributo**: categoría según ingresos, superficie, energía y alquiler; tabla 2026 actualizada; simulador de recategorización; calendario de vencimientos.
- 💵 **Dólar en vivo**: blue, oficial, tarjeta, MEP y CCL con gráfico histórico (fuente: Bluelytics).
- 💰 **Gastos**: registro ilimitado por categoría y moneda (ARS/USD), resumen mensual y exportación a CSV.
- 🔔 **Alertas inteligentes**: vencimientos de Monotributo, períodos de recategorización y movimientos del dólar.
- 📈 **Herramientas**: calculadora de inflación, simulador de préstamos y conversor de monedas.
- 💼 **Sueldos**: cálculo de sueldo neto con descuentos, aguinaldo y cargas patronales.
- ❓ **Guías y FAQ**: explicaciones pensadas para quienes recién empiezan con AFIP.

## 🚀 Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML/CSS/JS (SPA) + Chart.js |
| Backend | Node.js + Express |
| Base de datos | PostgreSQL (producción) / SQLite (desarrollo) |
| Autenticación | JWT + bcrypt |
| Deploy | Render |

## 🛠️ Desarrollo local

Requisitos: Node.js 18+.

```bash
npm install
npm start        # http://localhost:3000
```

Por defecto corre con SQLite (no requiere configuración). Para modo producción/PostgreSQL:

```bash
set DATABASE_URL=postgresql://usuario:pass@host/db   # Windows
export DATABASE_URL=postgresql://usuario:pass@host/db # Linux/macOS
npm start
```

### Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | No (dev) | Connection string de PostgreSQL |
| `JWT_SECRET` | Sí (prod) | Secreto para firmar tokens. Generar uno aleatorio. |
| `MP_ACCESS_TOKEN` | No | Token de Mercado Pago (a futuro) |

> ⚠️ **`JWT_SECRET` es obligatorio en producción.** Sin él, el servidor usa un secreto de desarrollo inseguro.

## 🧪 Tests

```bash
npm test                                   # local (asume servidor en :3000)
node tests/api.test.js http://localhost:3999
node tests/api.test.js https://mi-dominio.com
```

Los tests corren automáticamente en CI (GitHub Actions) sobre cada push.

## 🌐 API

El servidor expone `/api/status` con estado y lista de endpoints:

```
GET  /api/status
POST /api/auth/register | /login
GET  /api/auth/me
GET  /api/cotizaciones | /api/cotizaciones/historicos
POST /api/monotributo/calcular | /recategorizar
GET  /api/monotributo/categorias | /vencimientos
GET/POST/DELETE /api/gastos  + /api/gastos/resumen
GET  /api/export/gastos/csv | /monotributo/resumen
GET/POST /api/alerts
POST /api/sueldos/calcular
POST /api/tools/inflacion/calcular | /prestamo/calcular
```

## 📄 Licencia y aviso

AFIP Assistant **no es un sitio oficial de AFIP**. Los valores de cuotas, categorías y vencimientos son orientativos y pueden cambiar por disposiciones oficiales. Verificá siempre la información en fuentes oficiales.
