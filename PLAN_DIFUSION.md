# Plan de Difusión — ARCA Assistant

Objetivo: convertir ARCA Assistant en la herramienta gratuita de referencia para monotributistas argentinos. Todo gratis, sin pagar publicidad.

## Público objetivo
- Monotributistas (2.4M en Argentina) y "blanqueados" recientes
- Freelancers, diseñadores, programadores, vendedores por MercadoLibre
- Profesionales que recién arrancan y no entienden ARCA (ex AFIP)
- Gente que a la hora de facturar entra en pánico

## Mensaje clave (para todo)
"Calculadora de Monotributo gratis. Sabé tu categoría, cuánto pagás y cuándo vence, sin vueltas. Incluye dólar blue en vivo, control de gastos y avisos de recategorización."

## Paso 0: Base sólida (antes de promocionar)
- [x] README.md en GitHub (qué es, capturas, link a la app)
- [x] Meta tags SEO + favicon + canonical + Open Graph + structured data (FAQ/WebApplication) en index.html
- [x] Sitemap.xml básico + og-image para redes
- [x] Página en la app: "¿Qué es y para qué sirve?" (copy pensado para SEO)
- [ ] Nombre de dominio propio (ej. afipassistant.com.ar) — prioridad si se va a compartir
- [x] Probar el flujo completo como usuario nuevo (registro → calcular → guardar gasto)

## Paso 1: Comunidades gratuitas (semanas 1-2)
- Reddit: r/merval, r/argentina, r/empleos_AR, r/RepublicaArgentina, r/DesarrolloFreelance. Publicar como "Hice esta herramienta gratuita para monotributistas, ¿qué opinan?" (NO spamear; responder todo)
- Facebook: grupos de "Monotributo Argentina", "Emprendedores", "Cuentapropistas". Mismo enfoque.
- Foros: Foro de Negocios Argentina, Taringa (sí, sigue vivo), comunidades de freelancers
- Regla: 1 aporte útil por grupo, responder comentarios, no repetir

## Paso 2: Contenido que se comparte solo (semanas 2-4)
Publicar GRATIS herramientas similares que atraigan gente:
- "Calculadora de recategorización Monotributo 2026" (ya existe) → link en la app
- "Guía: cómo pasar de Responsable Inscripto a Monotributo"
- "Cuánto sale pagar monotributo con IVA: simulador"
- "Dólar blue hoy en vivo" (ya existe el panel) — contenido diario en redes
- Calendario de vencimientos (ya existe) → posteos mensuales "No olvides pagar el 20"

Formatos:
- Thread de Twitter/X explicando cómo calcular tu categoría
- Reel/Short de 30s: "¿Sabés en qué categoría de monotributo estás?"
- LinkedIn: artículo "Monotributo 2026: todo lo que cambió"
- Pinterest: infografías de categorías (con link)

## Paso 3: SEO (meses 1-3, pasivo)
- Apuntar a: "calculadora monotributo 2026", "categoría monotributo", "cuánto paga un monotributista", "dólar blue hoy", "vencimiento monotributo"
- Páginas estáticas por keyword en la SPA (o al menos un blog mínimo con 5 artículos)
- Conseguir 5-10 backlinks: mencionar la app en comentarios útiles de blogs/foros, directorys de herramientas argentinas
- Crear la app en Product Hunt y beta list (gratis)

## Paso 4: Lanzamiento oficial (mes 1)
- Product Hunt launch (buen copy + GIF de la app + responder comentarios)
- Hacker News "Show HN" (inglés, enfocado en el panel de dólar)
- Publicar en directorios de herramientas: ToolFinder, Bento, There's An App For That

## Paso 5: Crecimiento interno (modelo 100% gratis)
- Todas las funciones son gratis e ilimitadas (gastos, alertas, exportación CSV/PDF, gráficos, recordatorios). El valor es el servicio, no la restricción.
- [x] Recordatorios de vencimiento por email (implementados; falta activar SMTP, ver INSTAGRAM_KIT.md o el checklist)
- [ ] Email de bienvenida que muestre las herramientas (recuperar registro) — pendiente de SMTP
- [ ] Referidos: "invitá a un amigo" (seguimiento opcional, no monetizado)
- A futuro, si se quiere monetizar sin romper la promesa gratis: donaciones, versión white-label o sponsor — NUNCA quitar funciones gratuitas existentes

## Paso 6: Métricas a mirar (para saber si funciona)
- Usuarios registrados por día, usuarios activos por semana
- Visitas → registros (meta: >10%), bounce en la landing
- **Dashboard de métricas:** entrá a https://calculararca.duckdns.org/admin.html con la ADMIN_KEY → KPIs, visitas por día y origen de visitas
- **Origen de visitas:** cada link compartido lleva ?utm_source= (whatsapp, instagram, link). Los botones de "Difundí ARCA Assistant" del dashboard ya lo agregan. Semanal: mirá qué canal trae más gente y duplicá ahí.
- Semanal: anotar de dónde vino cada usuario (¿Reddit? ¿Google? ¿WhatsApp? ¿Instagram?)

## Calendario semanal sugerido (primer mes)
- Lunes: 1 post en Reddit + responder
- Miércoles: 1 thread en Twitter + 1 Reel
- Viernes: 1 post en Facebook (grupo distinto) + responder
- Domingo: revisar métricas en /admin.html, ajustar mensaje según el canal que más trajo

## Lo que NO hacer
- No pagar publicidad todavía (gastar $0 hasta probar tracción orgánica)
- No spamear los mismos links en todos lados el mismo día
- No prometer funciones que no existen
