# Proyecto Catalyst: Tiempos

Captura y calendario de **tiempos**. Es el proyecto original; contexto en
`docs/CONTEXTO_CATALYST.md` (§3 qué existe, §4 brecha con ReportesSandbox) y patrón en
`docs/DISENO_CATALYST.md`.

| | |
|---|---|
| Proyecto de Catalyst | `TimeEntryForAptusFinancials` (existe) |
| URL de la función | `https://timeentryforaptusfinancials-730085095.development.catalystserverless.com/server/time_entry_services` |
| Función | `time_entry_services` → `functions/time_entry_services` |
| Slates | Captura de tiempos · Calendario de tiempos |
| Estado | **Publicado** (2026-11-11): tiempos vía ReportesSandbox; Slates en los repos V2 y función desplegada. Falta la prueba completa del usuario |

## Piezas

| Pieza | Carpeta | Repositorio | Slate / Deployment Name |
|---|---|---|---|
| Función | `functions/time_entry_services` | `AptusTimeEntryServices` ✓ | — |
| Captura de tiempos | `UniversalAptusTimeEntry` (paquete `widget-ui`) | `UniversalAptusTimeEntryV2` ✓ | `universal-aptus-timeentry` |
| Calendario de tiempos | `UniversalTimesCalendar` (paquete `advancedtimescalendar`) | `UniversalTimesCalendarV2` ✓ | `universal-timeentry-calendar` |

Las carpetas de las apps vienen de los ZIP de los repositorios actuales (copias originales en
`_archivo/`). Se versionan en repositorios nuevos para la etapa de mejoras.

## Rutas de `time_entry_services`

Desde 2026-11-11 **los tiempos van a ReportesSandbox** (decisión del usuario, opción A de
`docs/CONTEXTO_CATALYST.md` §4). La API guarda el tiempo con su tarifa congelada y lo respalda en
Books por su cuenta (crea la tarea, asigna al usuario, reintenta cada noche). La función ya no
escribe time entries en Books.

| Método | Ruta | Destino / reglas |
|---|---|---|
| POST | `/:org/tiempos` | `POST /tiempos`: `abogado_id`, `proyecto_id` (IDs locales), `fecha`, `horas` (decimales, ≤24, 2 decimales), `tarea_estandar_id` **o** `tarea`, `facturable` (bool), `descripcion` (≤500, la nota en Books). 409 sin usuario de Books; 422 sin tarifa |
| GET / PATCH / DELETE | `/:org/tiempos/:id` | PATCH sin abogado ni proyecto. DELETE también lo borra en Books. 409 si está en Prebill o facturado |
| GET | `/:org/tiempos` | filtros: `proyecto_id, abogado_id, liberado, facturado, prebill_id, facturable, tarea_estandar_id, books_estado` |
| GET | `/:org/tareas-estandar` | catálogo de tareas de ReportesSandbox (UTBMS, facturable); `?todos` |
| GET | `/:org/clientes`, `proyectos`, `abogados` | listas |
| GET / POST | `/:org/plantillas` | Books (`cm_plantillas_time_entry`); siguen guardando IDs de Books |

Quitado: `PUT /:org/tiempos/:id` y `GET /:org/tareas` (Books), `TimeEntryService`, `TaskCatalogService`.

### Captura y calendario (2026-11-11)

- **Captura:** IDs locales, horas decimales, tareas estándar, edición por `?tiempo_id=` (antes
  `time_entry_id` de Books) con candado de Prebill/facturado y aviso si el respaldo en Books quedó
  pendiente. Sin cronómetro ni referencia (la API no los recibe). Incremento `0.25` (era `0.55`).
  Aviso en proyectos de cuota fija o iguala. Plantillas anteriores: si su tarea no está entre las
  estándar, se elige a mano.
- **Calendario:** editar por ID local; borrar con `DELETE /tiempos/:id` y solo un 404 JSON con
  `stage` cuenta como ya eliminado (antes cualquier 404 era éxito). Candado, fecha inicial hoy
  (antes septiembre de 2026) y URLs en `src/lib/api.ts`.

### Orden para publicarlo (sin dejar la captura caída)

1. Ligar las dos Slates a `UniversalAptusTimeEntryV2` y `UniversalTimesCalendarV2` (rama `main`).
2. Desplegar la función **justo después**: `catalyst deploy --only functions:time_entry_services`.
   Mientras una pieza sea vieja y la otra nueva, guardar falla con 400 (no escribe nada).
3. Probar: capturar un tiempo de prueba, verlo en el calendario, editarlo y borrarlo.

## Despliegue con el CLI

`01-tiempos/` es la carpeta del proyecto para el CLI (`catalyst.json`; la selección del proyecto
vive en `.catalystrc`, que no se versiona).

```bash
cd 01-tiempos
catalyst project:use 247000003688050      # solo la primera vez en esta máquina
cd functions/time_entry_services && npm install && npm test && cd ../..
catalyst deploy --only functions:time_entry_services
```

No subir archivos sueltos desde la consola: el 2026-11-11 eso dejó la función caída (ver abajo).

## Estado revisado con el CLI (2026-11-11)

- **Función caída antes de la revisión:** en la consola había archivos con otro nombre
  (`core/catalog.js`, `core/AuthServices.js`) mezclados con los anteriores. `index.js` no
  encontraba sus imports y todas las rutas daban 500 o se quedaban sin respuesta. Se volvió a
  desplegar desde el CLI y ahora lo desplegado es idéntico al repositorio `AptusTimeEntryServices`.
- **Rutas en vivo:** `clientes` (2,570), `proyectos` (13), `abogados` (13), `tiempos` (29), `tareas`,
  `plantillas`, `gastos` (12) y `categorias-gasto` (11) responden 200. `gastos/999999` responde el 404
  JSON de la API, y un recurso fuera de la lista blanca (`prebills`) responde 404.
- **Función:** Node 24, 256 MB, sin variables de entorno en la consola (`AUTH_TOKEN` viaja en
  `.env`). Las reglas de seguridad permiten todos los métodos sin autenticación (`optional`).
- **Caché:** solo existe el segmento `Default`, no `APTUS_MIRROR_CONN_DATA`. Las respuestas tardan
  ~0.4 s, así que la conexión sí queda en caché; probablemente el SDK usa el segmento por omisión.
- **Dominios autorizados** (limpiados por el usuario y verificados el 2026-11-11): solo
  `universal-aptus-timeentry.onslate.com` ("Enhanced Time Entry") y
  `universal-timeentry-calendar.onslate.com` ("Advanced Times Calendar"); ambos responden 200 y
  CORS los autoriza. Los dominios aleatorios anteriores ya no responden ni están autorizados.

## Configuración en Catalyst

1. **Variable** `AUTH_TOKEN`: hoy viaja en `.env` dentro del despliegue. Recomendado moverla a
   variable de entorno de la función en la consola.
2. **Caché**: hoy solo existe `Default` (ver arriba). Opcional: crear `APTUS_MIRROR_CONN_DATA`.
3. **Dominios autorizados**: `https://universal-aptus-timeentry.onslate.com`,
   `https://universal-timeentry-calendar.onslate.com` (hecho).
4. **Slates**: build `npm run build`, salida `dist/`.

## Pruebas

```bash
cd functions/time_entry_services && npm test     # 25 (mocks; nunca escriben en Books)
cd UniversalAptusTimeEntry && npm test
```

## Pendientes

1. ~~Tiempos directos a Books~~ Hecho: vía ReportesSandbox.
2. ~~Borrar desde el calendario / 404 como éxito~~ Hecho.
3. ~~Ediciones sin sincronizar con ReportesSandbox~~ Hecho: PATCH a la API.
4. ~~URLs fijas~~ Hecho.
5. ~~Incremento 0.55 y fecha de septiembre~~ Hecho.
6. ~~Publicar~~ Hecho (2026-11-11). Verificado en Chrome sin escribir: la captura carga las 14 tareas
   estándar y solo ofrece Horas e Inicia/Termina; editar el tiempo #78 (Prebill #10) queda bloqueado;
   el calendario carga los 29 tiempos. **Falta la prueba completa del usuario.**
7. Tiempos capturados antes con la captura vieja solo existen en Books: no aparecen en el calendario
   ni entran a Prebills (ReportesSandbox no importa time entries de Books).
