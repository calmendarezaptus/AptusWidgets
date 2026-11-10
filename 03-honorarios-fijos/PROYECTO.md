# Proyecto Catalyst: Honorarios fijos

Captura y calendario de **cargos fijos e igualas** sobre ReportesSandbox. Contexto en
`docs/CONTEXTO_CATALYST.md` §5.2 y patrón en `docs/DISENO_CATALYST.md`. Se construye igual que
Gastos (`02-gastos/`), que es la referencia.

| | |
|---|---|
| Proyecto de Catalyst | `FixedFeesForAptusFinancials` (por crear) |
| Función | `fixed_fee_services` → `functions/fixed_fee_services` |
| Slates (2 de 3) | Captura de honorarios fijos · Calendario de honorarios fijos |
| Estado | Función en esqueleto (solo lecturas); apps por construir — siguiente en el orden |

## Piezas

| Pieza | Carpeta | Repositorio | Slate / Deployment Name |
|---|---|---|---|
| Función | `functions/fixed_fee_services` | `AptusFixedFeeServices` (por crear) | — |
| Captura | `UniversalAptusFixedFeeEntry` (por crear) | `UniversalAptusFixedFeeEntry` | `universal-aptus-fixedfeeentry` |
| Calendario | `UniversalFixedFeesCalendar` (por crear) | `UniversalFixedFeesCalendar` | `universal-fixedfeeentry-calendar` |

## Rutas de `fixed_fee_services`

Hoy (esqueleto):

| Método | Ruta | API |
|---|---|---|
| GET | `/:org/clientes`, `/:org/proyectos`, `/:org/abogados` | listas |
| GET | `/:org/cargos-fijos` | filtros: `proyecto_id, liberado, facturado, prebill_id` |

Por construir (fase de captura), con `services/CargoFijoService.js` siguiendo `GastoService`:

| Método | Ruta | API / reglas |
|---|---|---|
| POST | `/:org/cargos-fijos` | `proyecto_id` requerido; `monto` omitido = `honorario_fijo` del proyecto; `concepto` por omisión "Honorarios (cuota fija)"; `fecha` por omisión hoy |
| GET / PATCH / DELETE | `/:org/cargos-fijos/:id` | PATCH: `fecha`, `concepto`, `monto`. 409 si facturado o en Prebill |
| POST | `/:org/igualas/generar` | `{ periodo: "YYYY-MM" }`, idempotente: `creados` / `ya_existian` |

Solo aplica a proyectos con `tipo_cobro` `fijo` o `iguala`: la captura debe filtrar esos proyectos.

## Configuración en Catalyst

1. Función `fixed_fee_services` (Node 24, Advanced I/O).
2. Variable `AUTH_TOKEN` (`.env` local ya creado, no se versiona; mejor como variable de la consola).
3. Caché: segmento `APTUS_MIRROR_CONN_DATA`.
4. Dominios autorizados: `https://universal-aptus-fixedfeeentry.onslate.com`,
   `https://universal-fixedfeeentry-calendar.onslate.com`.
5. Slates: build `npm run build`, salida `dist/`, variable `VITE_API_BASE_URL`.

## Pruebas

```bash
cd functions/fixed_fee_services && npm test      # rutas + core
```

## Pendientes

1. `CargoFijoService` + rutas de escritura + pruebas.
2. Captura (copia del diseño de la captura de gastos, color propio).
3. Calendario (copia del calendario de gastos).
