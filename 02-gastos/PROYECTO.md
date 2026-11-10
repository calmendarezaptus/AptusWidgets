# Proyecto Catalyst: Gastos

Captura y calendario de **gastos y reembolsos** sobre ReportesSandbox. Contexto general en
`docs/CONTEXTO_CATALYST.md` (§1.1 organización, §5.1 gastos) y patrón en `docs/DISENO_CATALYST.md`.

| | |
|---|---|
| Proyecto de Catalyst | `ExpensesForAptusFinancials` (por crear) |
| Función | `expense_services` → `functions/expense_services` |
| Slates (2 de 3) | Captura de gastos · Calendario de gastos |
| Estado | Apps terminadas y probadas con datos reales; **función nueva por desplegar** |

## Piezas

| Pieza | Carpeta | Repositorio | Slate / Deployment Name |
|---|---|---|---|
| Función | `functions/expense_services` | `AptusExpenseServices` (por crear) | — |
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
2. **Variable de entorno** `AUTH_TOKEN` (token del broker Donatello, el mismo de tiempos). Hoy la
   función de tiempos lo lee de `.env`; `functions/expense_services/.env` ya está creado localmente
   (no se versiona). Mejor práctica: definirlo en la consola como variable de entorno de la función.
3. **Caché**: segmento `APTUS_MIRROR_CONN_DATA` (guarda endpoint y token de ReportesSandbox 6 h).
4. **Dominios autorizados (CORS)**: solo las 2 Slates de este proyecto:
   `https://universal-aptus-expenseentry.onslate.com`, `https://universal-expenseentry-calendar.onslate.com`.
5. **Slates**: build `npm run build`, salida `dist/`. Variable opcional en las dos:
   `VITE_API_BASE_URL` = URL de `expense_services` (si no se define, usan `FALLBACK_API` de
   `src/lib/api.ts`).

## Migración desde el proyecto de Tiempos (pendiente)

Hoy la captura de gastos está ligada al proyecto de Tiempos y usa `time_entry_services`, que
conserva las rutas de gastos de forma **transitoria**.

1. Crear el proyecto, la función, la variable, el segmento de caché (pasos 1–3).
2. Probar la función: `GET <url>/636939444/categorias-gasto` debe responder la lista.
3. Pasar la URL de la función → se actualiza `FALLBACK_API` en las dos apps y se suben.
4. Quitar la Slate de gastos del proyecto de Tiempos y crear las 2 Slates aquí con los mismos
   repositorios.
5. Dominios autorizados (paso 4) y prueba completa: listar, crear, editar y borrar un gasto de prueba.
6. Confirmado → se quitan las rutas `/gastos` y `categorias-gasto` de `time_entry_services`.

## Pruebas

```bash
cd functions/expense_services && npm test        # 12: validación, cliente, rutas, core
cd UniversalAptusExpenseEntry && npm test        # 8
cd UniversalExpensesCalendar && npm test         # 6
```

## Pendientes

- Desplegar `expense_services` y completar la migración (arriba).
- Reembolsos al abogado (`POST /gastos/:id/reembolso`, `GET /reembolsos`): ver `docs/CONTEXTO_CATALYST.md` §5.1.
- El calendario se probó con datos reales (12 gastos, incluido el #31); falta probarlo desplegado.
