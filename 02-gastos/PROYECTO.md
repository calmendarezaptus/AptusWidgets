# Proyecto Catalyst: Gastos

Captura y calendario de **gastos y reembolsos** sobre ReportesSandbox. Contexto general en
`docs/CONTEXTO_CATALYST.md` (§1.1 organización, §5.1 gastos) y patrón en `docs/DISENO_CATALYST.md`.

| | |
|---|---|
| Proyecto de Catalyst | `ExpensesForAptusFinancials` (`247000003819090`) |
| URL de la función | `https://expensesforaptusfinancials-730085095.development.catalystserverless.com/server/expense_services` |
| Función | `expense_services` → `functions/expense_services` |
| Slates (2 de 3) | Captura de gastos · Calendario de gastos |
| Estado | Función desplegada y probada (2026-11-11); apps apuntando a ella; **En producción** (2026-11-11): función, Slates y CORS verificados; migración terminada |

## Piezas

| Pieza | Carpeta | Repositorio | Slate / Deployment Name |
|---|---|---|---|
| Función | `functions/expense_services` | `AptusExpenseServices` ✓ | — |
| Captura de gastos | `UniversalAptusExpenseEntry` | `UniversalAptusExpenseEntry` ✓ | `universal-aptus-expenseentry` |
| Calendario de gastos | `UniversalExpensesCalendar` | `UniversalExpensesCalendar` ✓ | `universal-expenseentry-calendar` |

Navegación entre Slates:
- Calendario → captura: `?organization_id=&gasto_id=&origin=` (Agregar / Editar).
- Captura → calendario: regresa a `origin`; si no llegó, a `VITE_CALENDAR_URL`
  (`https://universal-expenseentry-calendar.onslate.com/`).

## Rutas de `expense_services`

| Método | Ruta | API de ReportesSandbox |
|---|---|---|
| POST | `/:org/gastos` | `POST /gastos` (201) |
| GET | `/:org/gastos/:id` | `GET /gastos/:id` |
| PATCH | `/:org/gastos/:id` | `PATCH /gastos/:id` (sin `proyecto_id`) |
| DELETE | `/:org/gastos/:id` | `DELETE /gastos/:id` |
| GET | `/:org/gastos` | `GET /gastos` — filtros: `proyecto_id, liberado, facturado, prebill_id, categoria_id, facturable, abogado_id, pagado_por, reembolso_estado` |
| GET | `/:org/clientes`, `/:org/proyectos`, `/:org/abogados` | listas |
| GET | `/:org/categorias-gasto` | `?todos` incluye inactivas |

- Cualquier otra ruta → 404 JSON **sin** `stage`. Un 404 **con** `stage` significa "el gasto ya no
  existe" (el calendario lo quita del listado).
- Errores: `{ error, stage, outcome_unknown }`. 400/404/409/422 conservan el mensaje de la API; el
  resto es 502 genérico. Una escritura sin respuesta → `outcome_unknown: true` y la captura bloquea
  reintentos hasta revisar el listado.
- Validación (`services/GastoService.js`) antes de llamar a la API; solo se reenvían campos
  permitidos. Gasto en Prebill o facturado → 409 de la API (las apps lo avisan antes).

## Configuración en Catalyst

1. **Función** `expense_services` (Node 24, Advanced I/O).
2. **Variable** `AUTH_TOKEN`: viaja en `functions/expense_services/.env` (local, no se versiona),
   igual que en Tiempos. Opcional: moverla a variable de entorno de la función en la consola.
3. **Caché**: funciona con el segmento `Default`; no hace falta crear otro.
4. **Dominios autorizados (CORS)**: solo las 2 Slates de este proyecto:
   `https://universal-aptus-expenseentry.onslate.com`, `https://universal-expenseentry-calendar.onslate.com`.
5. **Slates**: build `npm run build`, salida `dist/`. Variable opcional en las dos:
   `VITE_API_BASE_URL` = URL de `expense_services` (si no se define, usan `FALLBACK_API` de
   `src/lib/api.ts`).

## Despliegue de la función con el CLI

```bash
cd 02-gastos
catalyst project:use 247000003819090      # solo la primera vez en esta máquina
cd functions/expense_services && npm install && npm test && cd ../..
catalyst deploy --only functions:expense_services
```

Verificado en vivo (2026-11-11): `clientes` (2,570), `proyectos` (13), `abogados` (13),
`categorias-gasto` (11) y `gastos` (12) responden 200; `gastos/999999` responde el 404 JSON de la
API; `tiempos` (fuera de la lista blanca) y rutas inexistentes responden 404. La caché funciona con el
segmento `Default` (respuestas en ~0.4 s) y `AUTH_TOKEN` viaja en `.env`, igual que en Tiempos.

## Migración desde el proyecto de Tiempos

1. ~~Crear el proyecto y desplegar la función.~~ Hecho (2026-11-11).
2. ~~Apuntar las dos apps a `expense_services`.~~ Hecho: `FALLBACK_API` en `src/lib/api.ts`.
3. ~~**Crear las 2 Slates en la consola**~~ Hecho y verificado (2026-11-11): cada dominio responde, CORS lo autoriza y el bundle usa `expense_services`, ligadas a GitHub (rama `main`), framework React + Vite:
   - `UniversalAptusExpenseEntry` → Deployment Name `universal-aptus-expenseentry`
   - `UniversalExpensesCalendar` → Deployment Name `universal-expenseentry-calendar`
   - Instalación `npm install`, build `npm run build`, salida `dist`.
4. ~~**Dominios autorizados**~~ Hecho. Ojo: el dominio debe ser el del Deployment Name, no el aleatorio (`universalexpensescal-…`) que Catalyst da por omisión. Dominios (CORS activado): los dos `.onslate.com` anteriores.
5. Probar: listar, crear, editar y borrar un gasto de prueba.
6. ~~Confirmado → quitar las rutas de gastos de `time_entry_services`.~~ Hecho (2026-11-11): prueba
   completa de alta, edición y borrado hecha por el usuario; `time_entry_services` redesplegada sin
   rutas de gastos (responden 404).

## Pruebas

```bash
cd functions/expense_services && npm test        # 12: validación, cliente, rutas, core
cd UniversalAptusExpenseEntry && npm test        # 8
cd UniversalExpensesCalendar && npm test         # 6
```

## Pendientes

- Reembolsos al abogado (`POST /gastos/:id/reembolso`, `GET /reembolsos`): ver `docs/CONTEXTO_CATALYST.md` §5.1.
- El calendario se probó con datos reales (12 gastos, incluido el #31); falta probarlo desplegado.
