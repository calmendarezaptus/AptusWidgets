# Proyecto Catalyst: Tiempos

Captura y calendario de **tiempos**. Es el proyecto original; contexto en
`docs/CONTEXTO_CATALYST.md` (§3 qué existe, §4 brecha con ReportesSandbox) y patrón en
`docs/DISENO_CATALYST.md`.

| | |
|---|---|
| Proyecto de Catalyst | `TimeEntryForAptusFinancials` (existe) |
| URL de la función | `https://timeentryforaptusfinancials-730085095.development.catalystserverless.com/server/time_entry_services` |
| Función | `time_entry_services` → `functions/time_entry_services` |
| Slates | Captura de tiempos · Calendario de tiempos (+ la de gastos, que se va a su proyecto) |
| Estado | En uso. Pendiente la etapa de correcciones (abajo) |

## Piezas

| Pieza | Carpeta | Repositorio | Slate / Deployment Name |
|---|---|---|---|
| Función | `functions/time_entry_services` | `AptusTimeEntryServices` (por crear) | — |
| Captura de tiempos | `UniversalAptusTimeEntry` (paquete `widget-ui`) | `UniversalAptusTimeEntryV2` (nuevo, por crear) | `universal-aptus-timeentry` |
| Calendario de tiempos | `UniversalTimesCalendar` (paquete `advancedtimescalendar`) | `UniversalTimesCalendarV2` (nuevo, por crear) | `universal-timeentry-calendar` |

Las carpetas de las apps vienen de los ZIP de los repositorios actuales (copias originales en
`_archivo/`). Se versionan en repositorios nuevos para la etapa de mejoras.

## Rutas de `time_entry_services`

| Método | Ruta | Destino |
|---|---|---|
| POST | `/:org/tiempos` | **Books directo** (`TimeEntryService`): resuelve/crea la tarea y crea el time entry |
| GET / PUT | `/:org/tiempos/:id` | Books directo |
| GET / POST | `/:org/plantillas` | Books (`cm_plantillas_time_entry`) |
| GET | `/:org/tareas` | Books (`cm_cat_logo_de_tareas`) |
| GET | `/:org/clientes`, `proyectos`, `abogados`, `tiempos` | ReportesSandbox, lista blanca (`core/catalogs.js`) |
| POST/GET/PATCH/DELETE | `/:org/gastos…`, GET `/:org/categorias-gasto` | **Transitorio**: se quitan al migrar gastos (`02-gastos/PROYECTO.md`) |

Cambios del 2026-11-10 (requieren volver a desplegar):
- Auth, conexión y cliente de ReportesSandbox ahora vienen de `core/` (código compartido).
- La ruta genérica `GET /:org/:catalog` ya no reenvía cualquier ruta: solo la lista blanca. Las
  apps de tiempos solo usan `clientes`, `proyectos`, `abogados` y `tiempos`.
- Rutas inexistentes responden 404 JSON (antes HTML de Express).

## Configuración en Catalyst

1. **Variable** `AUTH_TOKEN`: hoy viaja en `.env` dentro del despliegue. Recomendado moverla a
   variable de entorno de la función en la consola.
2. **Caché**: segmento `APTUS_MIRROR_CONN_DATA` (ya existe).
3. **Dominios autorizados**: `https://universal-aptus-timeentry.onslate.com`,
   `https://universal-timeentry-calendar.onslate.com`. Quitar el de gastos cuando se migre.
4. **Slates**: build `npm run build`, salida `dist/`.

## Pruebas

```bash
cd functions/time_entry_services && npm test     # 35 (mocks; nunca escriben en Books)
cd UniversalAptusTimeEntry && npm test
```

## Pendientes (etapa de correcciones)

1. **Tiempos directos a Books**: no pasan por ReportesSandbox, así que no entran a Prebills.
   Decisión en `docs/CONTEXTO_CATALYST.md` §4 / §10.1. Cualquier escritura nueva a Books requiere
   aprobación.
2. **Borrar desde el calendario**: no existe `DELETE /:org/tiempos/:id` y la app toma el 404 como
   éxito (el tiempo sigue existiendo). Corregido así en el calendario de gastos.
3. Las ediciones no se sincronizan con ReportesSandbox.
4. URLs fijas en el código (`App.tsx`, hooks): pasar a `src/lib/api.ts` + variables de entorno, como
   en gastos.
5. Incremento de 0.55 h en la captura; fecha inicial fija en septiembre de 2026 en el calendario.
6. Quitar las rutas transitorias de gastos.
