# Aptus Widgets en Catalyst — contexto completo

> Documento de contexto (2026-11-09; organización por proyectos 2026-11-10). Explica qué se está construyendo en Zoho Catalyst, cómo se
> relaciona con **ReportesSandbox** (`CONTEXTO.md`) y su API (`prebill-api.md`), qué existe hoy,
> qué falta y qué decisiones siguen abiertas. El patrón de código a seguir está en
> `DISENO_CATALYST.md`.

---

## 1. Qué es

Una función de **Zoho Catalyst** (Node 24, Express 5, tipo `advancedio`) que sirve de backend a
los widgets de Aptus (interfaz dentro de Zoho Books). La meta es que desde esos widgets se opere el
sistema de **ReportesSandbox**: captura de tiempos, gastos y honorarios fijos, liberaciones,
configuración de proyectos y, después, Prebills.

```
Widget (Zoho Books)  ──►  Catalyst: time_entry_services  ──►  Zoho Books API (directo, vía token de Donatello)
                                                         └──►  ReportesSandbox API  (/reportes/sandbox-wip/api)   ← lo que falta
                                                         └──►  Aptus Mirror DB      (catálogos de solo lectura)
```

| Dato | Valor |
|---|---|
| Carpeta local | `Aptus Widgets/01-tiempos/functions/time_entry_services` |
| Nombre de despliegue | `time_entry_services` (`catalyst-config.json`) |
| Stack | `node24`, ESM (`"type": "module"`), Express 5 |
| Dependencias | `axios`, `express`, `cors`, `dotenv`, `express-validator` (instalada, sin uso), `zcatalyst-sdk-node` |
| Pruebas | `npm test` → `node --test` (mocks, nunca escriben en Books) |
| Secreto local | `.env` → `AUTH_TOKEN` (header para Donatello). **No copiarlo a docs ni a logs.** |
| Variable opcional | `ZOHO_BOOKS_API_BASE_URL` (por omisión `https://www.zohoapis.com/books/v3`) |


### 1.1 Organización: un proyecto de Catalyst por área (2026-11-10)

Catalyst permite **3 Slates por proyecto**, así que el trabajo se divide en 4 proyectos. Cada uno
tiene **su propia función** (controlador), sus Slates y su documento `PROYECTO.md` con la
configuración, el despliegue y los pendientes. Cada función y cada Slate es su propio repositorio de
GitHub. Nombres recomendados: `docs/CONFIGURACION_DESPLIEGUE.md`.

| Carpeta | Proyecto | Función | Slates |
|---|---|---|---|
| `01-tiempos/` | Tiempos | `time_entry_services` | Captura de tiempos · Calendario de tiempos |
| `02-gastos/` | Gastos | `expense_services` | Captura de gastos · Calendario de gastos |
| `03-honorarios-fijos/` | Honorarios fijos | `fixed_fee_services` | Captura · Calendario de honorarios fijos |
| `04-consolidado/` | Consolidado | `aptus_overview_services` | Calendario unificado · Liberaciones · Configuración del proyecto |

- **Código común** (Donatello, conexión `cm_global_vars` + caché, `PrebillApiClient`, contrato de
  errores, catálogos con lista blanca): `shared/catalyst-core/src`. Se copia a `core/` de cada
  función con `node shared/catalyst-core/sync.mjs`; `--check` avisa si alguna copia quedó vieja y
  `tests/core.test.js` de cada función falla si alguien edita su `core/` a mano.
- **Cada proyecto se configura aparte**: variable `AUTH_TOKEN`, segmento de caché
  `APTUS_MIRROR_CONN_DATA` y dominios autorizados (CORS) solo de sus propias Slates.
- **Sin llamadas entre funciones**: el calendario unificado lee tiempos, gastos y cargos fijos
  directo de ReportesSandbox con su propia función. Para editar abre la captura del área.

---

## 2. Sistemas involucrados

### 2.1 ReportesSandbox (el sistema a operar)

Resumen; el detalle está en `CONTEXTO.md` y `prebill-api.md`.

- Prototipo que **reemplaza a ATE**: captura tiempos/gastos/honorarios fijos, arma Prebills y al
  facturar crea la Invoice real en Books.
- Corre en `https://aptuslegal.app/reportes/sandbox-wip`, contra la org sandbox de Books
  **`636939444`**. Es **una sola organización** (no multi-org).
- API JSON en `/reportes/sandbox-wip/api/...`. **El token va en el query string (`?token=`)**; un
  header `Authorization` recibe 401 de Apache.
- Usa **IDs locales** (enteros) para abogados, proyectos, tiempos, gastos, cargos fijos y Prebills;
  cada objeto trae sus vínculos a Books (`zoho_id`, `zoho_project_id`, `zoho_user_id`,
  `cliente_zoho_id`, `zoho_time_entry_id`). Los clientes son el `contact_id` de Books.
- Gastos, honorarios fijos, abogados, tarifas y Prebills son **solo locales** (no existen en
  Books). Los tiempos sí se respaldan en Books como time entries.

### 2.2 Zoho Books (directo desde Catalyst)

- Token OAuth por organización: `GET https://donatello.aptuslegal.app/oauth/token/{organizationId}`
  con header `Authorization: <AUTH_TOKEN>` (`core/AuthService.js`, copia de `shared/catalyst-core`).
- Módulos personalizados usados:
  - `cm_cat_logo_de_tareas` — catálogo global de tareas (`cf_nombre`, `cf_nombre_ingl_s`).
  - `cm_plantillas_time_entry` — plantillas de captura (`cf_clave`, `cf_cliente`, `cf_proyecto`,
    `cf_abogado`, `cf_tarea`, `cf_registrar_como`, `cf_horas_facturables`, `cf_no_facturables`,
    `cf_reference_number`).
  - `cm_global_vars` — variables de configuración por organización (`record_name`, `cf_value`).
- Endpoints estándar: `/projects/{id}/tasks`, `/projects/timeentries`.

### 2.3 Aptus Mirror DB (catálogos)

- Servicio de catálogos de solo lectura. Endpoint y token se guardan en `cm_global_vars` de cada
  organización (`APTUS_MIRROR_DB_ENDPOINT`, `APTUS_MIRROR_DB_TOKEN`) y se cachean 6 h en el segmento
  de Catalyst Cache `APTUS_MIRROR_CONN_DATA` (`services/DbConfigService.js`).
- Se consulta como `GET {endpoint}/{catalogo}?token=...` (clientes, proyectos, abogados, etc.).

---

## 3. Qué existe hoy (función `time_entry_services`)

| Ruta | Servicio | Qué hace |
|---|---|---|
| `POST /:organizationId/tiempos` | `TimeEntryService.create` | Valida, resuelve/crea la tarea en el proyecto de Books y crea el time entry. 201 `{ task_id, task_created, time_entry }`. |
| `GET /:organizationId/tiempos/:timeEntryId` | `TimeEntryService.get` | Lee un time entry de Books. |
| `PUT /:organizationId/tiempos/:timeEntryId` | `TimeEntryService.create(body, id)` | Edita; bloquea si hay cronómetro corriendo (409). |
| `GET /:organizationId/plantillas` | `TemplateService.list` | Lista todas las páginas de `cm_plantillas_time_entry`. |
| `POST /:organizationId/plantillas` | `TemplateService.create` | Crea una plantilla. |
| `GET /:organizationId/tareas` | `TaskCatalogService.getTasks` | Catálogo global de tareas (paginado). |
| `GET /:organizationId/:catalog` | `core/catalogs.js` (`registerCatalogRoutes`) | Desde 2026-11-10 solo `clientes`, `proyectos`, `abogados` y `tiempos` (gastos se movió a `expense_services` el 2026-11-11); cualquier otro recurso → 404. Antes era un proxy genérico a cualquier ruta. **Debe ser la última ruta.** |

Contrato del time entry (detalle en `01-tiempos/functions/time_entry_services/TIME_ENTRY_ENDPOINT.md`):
`project_id` y `user_id` son IDs de **Books** en string; `task_name` es el `cf_nombre` del catálogo;
`log_time` en `HH:mm` (o `begin_time`/`end_time`, o `start_timer: true`); `is_billable` booleano;
`notes` ≤ 500; `cf_referencia` opcional. Errores con `stage`, `task_id`, `task_created`,
`outcome_unknown`.

Estado según `TIME_ENTRY_ENDPOINT.md`: probado con mocks; falta prueba real (referencia y
cronómetro). Los bundles de la interfaz (§3.1) ya llaman a la función desplegada en
`https://timeentryforaptusfinancials-730085095.development.catalystserverless.com/server/time_entry_services`
(entorno **development**).

### 3.1 Interfaz actual (Catalyst Slate)

Dos apps React + Vite + TypeScript publicadas como Slates. Código fuente en la raíz del proyecto
(los bundles `index-*.js/css` ya no hacen falta).

| Vista | Slate | Código fuente | Archivos clave |
|---|---|---|---|
| Captura de tiempos | `https://universal-aptus-timeentry.onslate.com/` | `01-tiempos/UniversalAptusTimeEntry` (paquete `widget-ui`) | `src/App.tsx` (todo el formulario, ~1,700 líneas), `src/lib/time-entry.ts`, `src/lib/templates.ts`, `src/components/StatusModal.tsx`, `tests/*.test.mjs` |
| Calendario / listado | `https://universal-timeentry-calendar.onslate.com/` | `01-tiempos/UniversalTimesCalendar` (paquete `advancedtimescalendar`) | `src/App.tsx`, `src/types.ts` (`TimeEntry`), `src/hooks/use{Clientes,Proyectos,Abogados}.ts`, `src/components/{CalendarHeader,TimeList,MonthGrid,WeekGrid,DayGrid,EventDetailsPanel}.tsx` |

Hallazgos del código fuente (además de la tabla de abajo):
- **URLs fijas.** La captura define `TIME_ENTRY_API` (con `VITE_TIME_ENTRY_API_BASE_URL` y proxy
  de Vite en desarrollo), pero los catálogos (`clientes`, `proyectos`, `abogados`) usan la URL de
  Catalyst escrita a mano, así que ignoran la variable y el proxy. El calendario tiene todas sus
  URLs fijas, sin variable de entorno. Las URLs de las Slates también están fijas en los dos.
- **Fecha inicial del calendario** fija en septiembre de 2026 (`new Date(2026, 8, 1)`, "demo")
  cuando no hay una guardada.
- El calendario descarga **todos** los tiempos de la organización en una sola llamada, sin filtro
  de fechas; filtra y agrupa en el navegador.
- La captura deja elegir proyectos sin `zoho_id`; falla hasta Guardar ("Selecciona un proyecto con
  ID de Books válido").
- En el selector de horas los incrementos son `0.55, 0.50, 0.75, 0.00`. `0.55` se guarda como 33
  minutos (las horas son decimales). Probablemente se quiso `0.25`; confirmar.
- Mensajes como "no está disponible en Aptus Sync": así se llama en la UI al catálogo de Mirror DB.

Parámetros de URL: `organization_id` (si falta, el calendario usa `636939444` fijo),
`time_entry_id` (captura en modo edición) y `origin` (a dónde regresar). El calendario abre la
captura con `?organization_id=…&time_entry_id=<zoho_id>&origin=<url del calendario>`.

Llamadas de la interfaz a la función y si hoy funcionan:

| Vista | Llamada | Ruta que la atiende | Estado |
|---|---|---|---|
| Ambas | `GET /:org/clientes`, `/proyectos`, `/abogados` | genérica `/:org/:catalog` → Mirror DB | OK. Leen campos con la forma exacta de ReportesSandbox (`id`, `zoho_id`, `cliente_id`, `status: "activo"`, `zoho_user_id`, `zoho_user_nombre`, `tipo_nombre`, `foto_url`), así que `APTUS_MIRROR_DB_ENDPOINT` apunta, casi seguro, a la API de ReportesSandbox (falta confirmarlo). Caché en `localStorage` 12 h. |
| Captura | `GET /:org/tareas` | `TaskCatalogService` | OK |
| Captura | `POST /:org/tiempos`, `GET/PUT /:org/tiempos/:id` | `TimeEntryService` | OK con Books. Un `POST` por abogado y por tipo facturable/no facturable; timeout de 180 s; `outcome_unknown` bloquea reenvío. |
| Captura | `GET/POST /:org/plantillas` | `TemplateService` | OK |
| Calendario | `GET /:org/tiempos` | genérica → Mirror DB → `GET /tiempos` de ReportesSandbox | OK. Lee `fecha`, `horas`, `importe`, `tarifa_aplicada`, `moneda`, `status`, `liberado`, `facturado`, `abogado_nombre`, `proyecto_nombre`, `cliente_nombre`, `descripcion`, `zoho_id`. |
| Calendario | `DELETE /:org/tiempos/:zoho_id` | **ninguna** | **Falla en silencio**: Express responde 404 y la UI trata 404 como éxito (`!ok && status !== 404`): quita el registro de la pantalla sin borrar nada. |

Problemas de flujo (consecuencia de la §4):
1. **Lo capturado no aparece en el calendario.** La captura escribe en Books; el calendario lee la
   tabla `tiempos` de ReportesSandbox, que no importa time entries de Books.
2. **Editar desincroniza.** El calendario manda el `zoho_id` (time entry de Books) y la captura hace
   `PUT` directo a Books: ReportesSandbox conserva horas/fecha/tarea viejas (y el `importe`), y se
   salta su candado 409 de "ya facturado o en Prebill". El calendario solo revisa `facturado` antes
   de **borrar**, no antes de editar.
3. Los tiempos con `zoho_id: null` (sin respaldo) no se pueden editar desde el calendario.

---

## 4. Brecha principal: tiempos directos a Books vs. ReportesSandbox

> **Decisión pendiente del usuario.** Es lo primero que hay que resolver antes de construir
> liberaciones y Prebills.

Hoy el widget crea el time entry **directo en Books**. ReportesSandbox no se entera: el tiempo no
existe en su tabla `tiempos`, no tiene tarifa congelada (jerarquía de 9 niveles), no se puede
liberar y **nunca entraría a una Prebill**. En cambio, `POST /api/tiempos` de ReportesSandbox guarda
el tiempo local **y** lo respalda en Books él mismo (crea tarea, asigna usuario, reintento nocturno).

| Opción | Qué implica |
|---|---|
| **A. Capturar vía ReportesSandbox** (recomendada si el objetivo es facturar con Prebills) | El widget llama a Catalyst → `POST /api/tiempos`. Hay que traducir IDs de Books a IDs locales (sección 6), `log_time` `HH:mm` → `horas` decimales, `task_name` → `tarea` (texto) o `tarea_estandar_id`. Se gana tarifa, 409/422 claros, respaldo y reintento. Se pierden cronómetro y `begin/end_time` (la API solo recibe horas). |
| B. Mantener directo a Books | ReportesSandbox necesitaría importar time entries de Books (no existe esa ruta). Duplicaría reglas. |
| C. Ambos | Riesgo de **duplicar** el time entry en Books. No hacerlo. |

Otras diferencias a reconciliar:
- Catálogo de tareas: widget usa `cm_cat_logo_de_tareas` (Books); ReportesSandbox usa
  `/api/tareas-estandar` (local, con UTBMS y `facturable`). Ambos terminan creando la tarea por
  nombre en el proyecto de Books.
- Plantillas (`cm_plantillas_time_entry`) guardan IDs de Books; siguen sirviendo si se traducen.
- `cf_referencia` no existe en ReportesSandbox.

---

## 5. Pantallas a construir y endpoints de ReportesSandbox que usan

Las rutas de Catalyst siguen el patrón existente `/:organizationId/<recurso>` (ver
`DISENO_CATALYST.md`). Rutas de la API relativas a `/reportes/sandbox-wip/api`.

### 5.1 Gastos

| Acción | API ReportesSandbox | Notas |
|---|---|---|
| Listar | `GET /gastos` (`proyecto_id, liberado, facturado, prebill_id, categoria_id, facturable, abogado_id, pagado_por, reembolso_estado`) | |
| Crear | `POST /gastos` | `proyecto_id`, `fecha`, `monto` requeridos. `tipo` `gasto`\|`reembolso` (omitido = el de la categoría). `pagado_por` `despacho`\|`caja_chica`\|`abogado` (con `abogado` → `abogado_id` obligatorio). `facturable` 0/1. |
| Ver / editar / borrar | `GET/PATCH/DELETE /gastos/:id` | 409 si facturado o en Prebill. El proyecto no se edita (fija moneda). |
| Categorías | `GET /categorias-gasto` | Trae `tipo` por omisión y `codigo_utbms`. |
| Reembolsos al abogado | `GET /reembolsos`, `POST/DELETE /gastos/:id/reembolso` | Independiente del cobro al cliente. |

Reglas: monto > 0, fecha `YYYY-MM-DD` real, proyecto/abogado activos. Gasto = con IVA y CFDI;
reembolso = sin IVA ni CFDI. Solo local: **no se escribe nada en Books**.

### 5.2 Honorarios fijos e igualas

| Acción | API | Notas |
|---|---|---|
| Listar | `GET /cargos-fijos` (`proyecto_id, liberado, facturado, prebill_id`) | `periodo` solo en igualas. |
| Crear cargo manual | `POST /cargos-fijos` | `proyecto_id` requerido; `monto` omitido = `honorario_fijo` del proyecto; `concepto` por omisión "Honorarios (cuota fija)"; `fecha` por omisión hoy. |
| Generar igualas del mes | `POST /igualas/generar {periodo:"YYYY-MM"}` | Idempotente: `creados` / `ya_existian`. |
| Ver / editar / borrar | `GET/PATCH/DELETE /cargos-fijos/:id` | PATCH: `fecha`, `concepto`, `monto`. 409 si facturado o en Prebill. |

Solo aplica a proyectos con `tipo_cobro` `fijo` o `iguala` (sus tiempos nacen no facturables).

### 5.3 Liberaciones

| Acción | API | Notas |
|---|---|---|
| Liberar | `POST /liberaciones {desde, hasta, cliente_id?}` | Respuesta `{ tiempos_liberados, gastos_liberados, cargos_fijos_liberados }`. Sin `cliente_id` libera **todos los clientes**: la UI debe pedir confirmación explícita. |
| Ver lo disponible | `GET /liberado-disponible?cliente_id=&moneda=` | `{ tiempos, gastos, cargos_fijos }` listos para Prebill. |

No hay "deshacer liberación" en la API. Los no facturables nunca se liberan. `desde ≤ hasta`.

### 5.4 Configuración del proyecto

| Acción | API | Notas |
|---|---|---|
| Listar / ver | `GET /proyectos`, `GET /proyectos/:id` | `tipo_cobro`, `honorario_fijo`, `moneda`, `zoho_project_id`, `nombre_completo`. |
| Editar | `PATCH /proyectos/:id` | `nombre`, `moneda` (solo sin capturas, si no 409), `activo`, `tipo_cobro` (`horas`\|`fijo`\|`iguala`), `honorario_fijo` (requerido con iguala), `zoho_tax_id` (vacío = el del cliente), `zoho_project_id` (debe ser del mismo cliente, si no 400). `cliente_id` no es editable. |
| Crear | `POST /proyectos` | `nombre`, `cliente_id` requeridos. |
| IVA disponibles | `GET /zoho/impuestos` | Incluye grupos con retenciones. |
| Tareas del proyecto en Books | `GET /proyectos/:id/tareas` | |
| Sincronizar tareas estándar | `POST /proyectos/:id/sincronizar-tareas` | **Escribe en Books** con `confirmar=1`; sin él es vista previa. |
| Crear proyecto en Books | `POST /proyectos/:id/crear-en-books` | **Escribe en Books** con `confirmar=1`; sin él es vista previa. |
| Tarifas del proyecto | `GET /tarifas?proyecto_id=`, `POST /tarifas`, `PATCH/DELETE /tarifas/:id`, `GET /tarifas/resolver?abogado_id=&proyecto_id=` | La tarifa de proyecto debe ir en la moneda del proyecto. |
| Responsables | `GET /responsables/resolver?proyecto_id=`, `POST /responsables`, `DELETE /responsables/:id` | |
| Config del cliente (IVA/idioma) | `GET/PATCH /clientes/:cliente_id/config` | |

### 5.5 Siguientes (cuando se decida)

- **Prebills**: `GET/POST /prebills`, `GET/DELETE /prebills/:id`, `PATCH /:id/lineas`,
  `PATCH /:id/descuento-ajuste`, `PATCH /:id/idioma`, `PATCH /:id/tipo-cambio`,
  `GET /:id/vista-factura`, `POST /:id/estado` (**facturada crea la Invoice en Books**),
  `POST /:id/deshacer-factura` (**borra la Invoice**).
- **Formatos**: `GET /formatos/prebill/:id`, `/formatos/factura/...`, `/formatos/estado-cuenta`,
  `/formatos/ledes/:id` (PDF/HTML/JSON, solo lectura).
- **Configuración del despacho**: `GET/PATCH /config-despacho` (impacta a todo el despacho).
- Catálogos: abogados, niveles, tareas estándar, conceptos de factura.

---

## 6. Traducción de IDs (Books ↔ ReportesSandbox)

El widget vive en Books y maneja IDs de Books; la API espera IDs locales en casi todo.

| Widget envía | La API espera | Cómo resolver |
|---|---|---|
| `project_id` de Books | `proyecto_id` local | `GET /proyectos` → buscar `zoho_project_id === project_id` y `activo === 1`. Sin coincidencia → 409 "El proyecto no está dado de alta en ReportesSandbox". |
| `user_id` de Books | `abogado_id` local | `GET /abogados` → `zoho_user_id === user_id` y `activo === 1`. |
| `contact_id` | `cliente_id` | Igual (es el mismo valor). |
| ID de gasto/cargo/Prebill | ID local | Ya es local; la UI lo obtiene de los listados. |

Alternativa: que la UI cargue los catálogos de ReportesSandbox (`/proyectos`, `/abogados`) y mande
directo los IDs locales. Menos llamadas por operación; recomendado para pantallas nuevas.
Varias coincidencias para el mismo ID de Books → 409 (no adivinar), igual que con tareas duplicadas.

---

## 7. Conexión de Catalyst a ReportesSandbox (propuesta)

Siguiendo el patrón de Mirror DB (`DbConfigService`):

- Guardar en `cm_global_vars` de la organización: `PREBILL_API_ENDPOINT`
  (`https://aptuslegal.app/reportes/sandbox-wip/api`) y `PREBILL_API_TOKEN`. **Pendiente de
  aprobación**: crear esos registros es una escritura en Books.
- Cachear en un segmento de Catalyst Cache (p. ej. `PREBILL_API_CONN_DATA`) con expiración de 6 h.
- Toda llamada: `{endpoint}/{ruta}?token={token}` (axios `params: { token }`), JSON, timeout 30 s.
- Solo la org `636939444` tiene ReportesSandbox. Otra organización → 503 "Faltan parámetros de
  conexión…" (igual que Mirror DB).
- **El token viaja en la URL**: un error de axios trae `config.url`/`config.params` con el token.
  Nunca loguear ni devolver el objeto de error (ver `DISENO_CATALYST.md` §5).

---

## 8. Mapeo de errores de la API hacia el widget

| ReportesSandbox | Catalyst responde | Mensaje |
|---|---|---|
| 400 | 400 | El `error` de la API (ya está en español y dice qué campo falló). |
| 404 | 404 | El `error` de la API. |
| 409 | 409 | El `error` de la API (estado, sin enlace a Books, duplicado). |
| 422 | 422 | El `error` de la API (sin tarifa en la moneda del proyecto). |
| 401 (Apache) | 502 | "No se pudo autenticar con ReportesSandbox." (token mal configurado; avisar a admin) |
| 404 nativo de Apache (HTML) | 502 | Se perdió prefijo o token en la URL. |
| 5xx / sin respuesta | 502 | Mensaje genérico; `outcome_unknown: true` si era escritura sin respuesta. |

Respuesta de error de Catalyst: `{ error, stage, outcome_unknown }` (mismo contrato que tiempos).

---

## 9. Reglas que no se rompen

1. **Toda escritura nueva a Books requiere aprobación del usuario** (facturar, deshacer factura,
   `crear-en-books`, `sincronizar-tareas`, crear registros en `cm_global_vars`). En la UI: vista
   previa + confirmación explícita.
2. Nunca crear Usuarios de Books. Nunca inventar tarifas (la API responde 422; no "arreglarlo" en
   Catalyst).
3. Las reglas de negocio viven en ReportesSandbox (`prebillLogic.js`, `facturacion.js`, etc.).
   **Catalyst no recalcula totales, tarifas, IVA ni estados**: valida forma, traduce IDs y reenvía.
4. Sin reintentos automáticos de escrituras. Escritura sin respuesta → `outcome_unknown: true` y la
   UI bloquea el reenvío hasta revisar.
5. No exponer credenciales, headers, URLs con token ni cuerpos crudos del proveedor.
6. Nada contra `ReportesSandboxECLegal` (cliente real, solo lectura).
7. Pruebas con mocks (`node --test`); nunca contra el servicio real sin aprobación. Para probar
   contra un servidor, usar la copia aislada (`tests/copia-aislada.sh`, puerto 3299,
   `BOOKS_SOLO_LECTURA=1`) — requiere exponerla, decisión del usuario.
8. Rutas específicas antes de la genérica `/:organizationId/:catalog`.
9. Si se agrega una ruta a la API de ReportesSandbox, también va en `consola.js#RUTAS` (regla del
   servidor).

---

## 10. Decisiones abiertas

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿Los tiempos del widget pasan por ReportesSandbox (`POST /api/tiempos`) o siguen directo a Books? | Por ReportesSandbox si se van a facturar con Prebills (sección 4). |
| 2 | ~~¿Una función de Catalyst por módulo o todo en `time_entry_services`?~~ | **Resuelta (2026-11-10):** un proyecto de Catalyst por área, cada uno con su función; el código común vive en `shared/catalyst-core` y se copia a `core/` (§1.1). |
| 3 | ¿Dónde vive el token de la API? | `cm_global_vars` + Catalyst Cache (sección 7). |
| 4 | ¿La UI usa IDs de Books o IDs locales? | IDs locales en pantallas nuevas (sección 6). |
| 5 | ¿Cronómetro y `begin/end_time`? | La API solo recibe horas; convertir en la UI o pedir cambio en ReportesSandbox. |
| 6 | Autenticación por usuario | Hoy quien tenga el token opera todo (prototipo). Catalyst debería validar que la petición viene del widget (pendiente). |
| 7 | ~~¿Pantallas nuevas en una Slate nueva o dentro de las existentes?~~ | **Resuelta (2026-11-10):** una Slate por pantalla, máximo 3 por proyecto de Catalyst (§1.1). |
| 8 | Borrado desde el calendario | Agregar `DELETE /:org/tiempos/:id` (vía `DELETE /api/tiempos/:id` de ReportesSandbox, que borra también en Books) y que la UI deje de tratar 404 como éxito. |

---

## 11. Archivos de referencia

| Archivo | Para qué |
|---|---|
| `CONTEXTO.md` | Contexto completo de ReportesSandbox (servidor, reglas, operación). |
| `prebill-api.md` | Referencia completa de la API (≈120 rutas, cuerpos y respuestas). |
| `DISENO_CATALYST.md` | Patrón de código y de interfaz para las pantallas nuevas. |
| `01-tiempos/functions/time_entry_services/TIME_ENTRY_ENDPOINT.md` | Contrato del endpoint de tiempos actual. |
| `01-tiempos/functions/time_entry_services/services/*.js` | Implementación de referencia (sobre todo `TimeEntryService` y `TemplateService`). |
