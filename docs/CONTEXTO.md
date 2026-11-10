# ReportesSandbox — contexto completo y guía de uso

> Documento de contexto (2026-11-09). Resume qué es el proyecto, cómo está armado, qué reglas de
> negocio decidió el usuario, cómo se usa (web y API), cómo se opera y qué no se debe hacer.
> El registro detallado, cronológico y con evidencias, sigue siendo `README.md`.

---

## 1. Qué es

**ReportesSandbox** es un **prototipo** (no producción) del **Escenario 3** de
`ReportesAptus/PLAN_MULTI_CLIENTE.md`: un sistema propio que **reemplaza a ATE** (Zoho Creator) para:

1. Capturar **tiempos, gastos y honorarios fijos** de abogados.
2. Armar **Prebills** (con descuentos/ajustes e incluir/excluir líneas).
3. Al facturar, crear la **Invoice real en Zoho Books**.
4. Respaldar cada tiempo en Books, generar **formatos imprimibles** (Prebill, factura, estado de
   cuenta, LEDES) y consultar el **WIP**.

Corre contra el **sandbox de Zoho Books, org `636939444`** (datos de prueba reusados por muchas
apps; no es un cliente real). El CFDI (timbrado) queda fuera a propósito.

Está **deliberadamente separado de `ReportesAptus/`**: el código compartido se copió (no se
importa), para poder borrar la carpeta completa sin romper nada si el experimento no sigue.

| Dato | Valor |
|---|---|
| Carpeta | `/var/www/html/NodeProyects/ReportesSandbox` |
| Proceso pm2 | `sandbox-wip` (entrypoint `server.js`) |
| Puerto | `3210` (variable `SANDBOX_PORT`) |
| URL pública | `https://aptuslegal.app/reportes/sandbox-wip?token=<token general de reportes>` |
| Base de datos | `data/sandbox.sqlite` (`node:sqlite`, sin dependencias npm) |
| Node | sistema, v24.x (NodeSource) |
| Org de Books | `636939444` (sandbox, `organization.version = "global"`) |
| Acceso a Zoho | broker **Donatello** (bearer + key en `config.js`) |

### Proyecto hermano: ReportesSandboxECLegal

Copia **de solo lectura** en `/var/www/html/NodeProyects/ReportesSandboxECLegal` contra la org
**real** de EC Legal Centro SC (`673221150`): pm2 `sandbox-eclegal`, puerto `3211`,
`/reportes/sandbox-eclegal`. Doble candado: `server.js` responde 403 a todo lo que no sea GET/HEAD
y `booksApi.js` rechaza cualquier no-GET con `config.books.soloLectura`. Ahí vive `/ingresos`
(equivalente al Reporte 03 + conciliación Books↔CFDI). **Nunca se le quita el solo lectura sin
aprobación explícita del usuario** (es un cliente real; además cuidar su cuota de 5,000 llamadas/día).
Lo aprendido de EC Legal se trasladó al sandbox como **configuración por despacho** (sección 5.7).

---

## 2. Infraestructura

- **Apache** (`/etc/apache2/sites-enabled/000-default-le-ssl.conf`):
  `ProxyPass /reportes/sandbox-wip http://127.0.0.1:3210/` (+ `ProxyPassReverse`).
  Lo protege `<Location /reportes/>`: Basic Auth **o** `?token=...` en el **query string**
  (un header `Authorization` no sirve). El proceso Node no revalida nada.
- **Gzip de JSON** solo bajo `/reportes/` (bloque `<If>` en `mods-available/deflate.conf`).
  Los webservices PHP de fuera no se tocaron (regla: no romper APIs externas).
- **Bloqueo estático**: `/etc/apache2/conf-available/bloquear-nodeproyectos.conf` impide que Apache
  sirva como archivos `NodeProyects/` (config con tokens, sqlite, README). Rotación del token de
  Donatello: **pendiente** (decisión del usuario).
- **Cron** (usuario ubuntu, hora de México):
  - `23:15` → `node reintentarBooks.js` (reintenta tiempos con respaldo en Books `pendiente`),
    log `/home/ubuntu/respaldos/reportes-sandbox/books.log`.
  - `23:30` → `node respaldo.js` (respaldo de la base), log `.../cron.log`.
- **Puppeteer** para PDF: usa el instalado en `../ReportesAptus` (ruta alternativa con
  `SANDBOX_PUPPETEER_DESDE`). Sin él, `salida=pdf` da 503 y HTML/JSON siguen funcionando.

### Gotchas de infraestructura (ya resueltos, no reintroducir)

1. **Doble slash**: el `ProxyPass` entrega `//prebills/1`; `new URL()` lo tomaría como host. Se
   colapsa `req.url` con `replace(/^\/{2,}/, '/')` **antes** de `new URL()` (ver `server.js`).
2. **Prefijo + token en todo**: todo link, `action` de formulario y redirect se arma con
   `helpers.js#ruta(path, token)`; los `<form method="GET">` llevan además `campoToken(token)`
   (el GET reemplaza el query string del action). Un 404 **nativo de Apache** = se perdió el token
   o el prefijo; un "Ruta no encontrada" = 404 de este servidor.

---

## 3. Estructura del código

| Archivo | Responsabilidad |
|---|---|
| `server.js` | Todas las rutas HTML (menú, catálogos, captura, liberaciones, Prebills, WIP, consola). Monta `apiRoutes.js` bajo `/api/` primero. Precarga cachés al arrancar. |
| `apiRoutes.js` | API JSON completa (siempre JSON, nunca HTML). |
| `db.js` | Esquema SQLite, migraciones idempotentes (`PRAGMA table_info` + `ALTER TABLE`, `user_version`), triggers de validación, siembra de catálogos. |
| `prebillLogic.js` | **Única** fuente de reglas de Prebill: totales, líneas, estados, liberación, edición, facturar, deshacer factura. La usan web y API. |
| `facturacion.js` | `vistaFactura`: arma la Invoice sin escribir. Vista previa == lo que se manda. `reemplazarLineasFactura` (dos pasos). |
| `tarifas.js` | Jerarquía de tarifas de 9 niveles por moneda. |
| `captura.js` | Crear/editar/borrar tiempos, gastos, reembolsos, honorarios fijos; cambio de moneda de proyecto. |
| `validacion.js` | Validaciones de captura (fechas, horas, montos, activos). |
| `respaldoBooks.js` / `reintentarBooks.js` | Respaldo de cada tiempo como time entry de Books; reintento nocturno. |
| `catalogoOps.js` / `catalogos.js` | Niveles, abogados, proyectos (incl. `crearProyectoEnBooks`), tareas estándar, categorías, sincronización de tareas a Books. |
| `configDespacho.js` | Configuración por despacho (tabla `config_despacho`). |
| `responsables.js` | Responsables de facturación y cobranza (cascada de fuentes). |
| `cfdi.js` | Proveedor de CFDI: `creator` (solo GET), `interno`, `ninguno`. |
| `zohoRef.js` | Lecturas de referencia de Books (usuarios, proyectos, artículos, facturas, tareas) y resolvers de enlace. |
| `booksApi.js` | Cliente de Books (throttle 350 ms; `BOOKS_SOLO_LECTURA=1` bloquea no-GET). |
| `cacheVivo.js` | Cachés stale-while-revalidate de Books; estado en `GET /api/caches`. |
| `formatos.js`, `pantallasFormatos.js`, `pdf.js`, `numeroLetra.js` | Formatos imprimibles (datos+diseño, rutas, HTML→PDF, importe con letra). |
| `pantallasEdicion.js`, `pantallasDespacho.js`, `consola.js` | Pantallas de edición, configuración y consola de la API. |
| `banxico.js` | Tipo de cambio FIX. |
| `demoData.js`, `seed.js` | Datos de prueba `[DEMO]`. |
| `respaldo.js` | Respaldo diario de la base con retención escalonada. |
| `booksApi.js`, `sandboxData.js`, `template.js`, `group.js`, `moneyFormat.js`, `htmlTreeCollapse.js` | Reporte WIP original y piezas copiadas verbatim de ReportesAptus. |
| `config.js` | Org, Donatello, campos personalizados, `permiteMonedaDistintaAlCliente`. **Contiene secretos.** |
| `tests/` | `copia-aislada.sh`, `regresion.mjs`, `pantallas.mjs`, `despacho.mjs`, `formatos.mjs`. |

### Tablas principales (`data/sandbox.sqlite`)

`tipos_abogado` (niveles), `abogados`, `proyectos`, `clientes_config` (IVA/idioma por cliente),
`tarifas` (tabla única; `tarifas_cliente`/`tarifas_proyecto` son legado y ya no se leen),
`tiempos`, `gastos`, `cargos_fijos`, `prebills`, `prebill_movimientos` (bitácora),
`tareas_estandar`, `categorias_gasto`, `conceptos_factura`, `config_despacho`,
`responsables_asignados`, `cfdi_interno`.

Estado al 2026-11-09: 13 abogados, 13 proyectos (todos con ID de Books), 29 tiempos, 11 gastos,
3 cargos fijos, 8 Prebills, 26 tarifas, 14 tareas estándar, 11 categorías de gasto.

---

## 4. Qué toca Books y qué no

**Lectura**: contactos (clientes), proyectos, tareas, usuarios, artículos, impuestos, monedas,
facturas, time entries y gastos (WIP).

**Escritura** (todo en la org sandbox):
- **Tiempos**: cada tiempo capturado se crea/actualiza/borra como time entry en Books. Se crean
  tareas faltantes en el proyecto de Books y se asigna el usuario al proyecto si no estaba.
- **Facturas**: crear al pasar a *Facturada*; actualizar líneas mientras siga en borrador;
  borrar con *Deshacer factura*.
- **A pedido, con vista previa y confirmación**: artículos de conceptos, tareas estándar en
  proyectos, crear el proyecto en Books (`crear-en-books`).

**Nunca**: crear Usuarios reales de Books (dispararía invitaciones por correo). "Abogados" es un
catálogo local que se **enlaza** a un usuario existente.

**Solo local**: gastos, honorarios fijos, abogados, tarifas, Prebills.

> Regla de trabajo: cualquier escritura nueva a Books (items, tareas, facturas, borrados) requiere
> aprobación del usuario.

---

## 5. Reglas de negocio (decisiones del usuario)

### 5.1 Flujo de una Prebill

1. **Catálogos**: Niveles (tipos de abogado) → Abogados (enlazados a usuario de Books) →
   Proyectos (cliente real de Books, enlazados a proyecto de Books) → Tarifas.
2. **Captura**: tiempo (con tarea obligatoria) / gasto / honorario fijo. La tarifa se resuelve y
   **se congela** al capturar.
3. **Liberación** por rango de fechas (+ cliente opcional): marca listo para facturar.
4. **Nueva Prebill**: un cliente + **una sola moneda**; incluir/excluir línea por línea.
5. **Detalle**: descuento y/o ajuste (monto o %), **solo sobre honorarios (horas + fijos)**, nunca
   gastos.
6. **Estados** (solo hacia adelante): Borrador → En revisión → Autorizada → **Facturada**
   (crea la Invoice; guarda `invoice_id`/número). La transición se "reclama" con UPDATE atómico
   (`facturando`) para evitar doble factura; si Books falla vuelve a Autorizada.

### 5.2 Tarifas (9 niveles, por moneda, nunca inventar)

Se busca **solo en la moneda del proyecto**, de lo más específico a lo más general:
1 proyecto+abogado · 2 proyecto+nivel · 3 proyecto · 4 cliente+abogado · 5 cliente+nivel ·
6 cliente · 7 propia del abogado · 8 nivel del abogado · 9 general del despacho.
Sin tarifa → **422** y el tiempo no se guarda. Cada tiempo guarda `tarifa_nivel` y `tarifa_id`.
Herramientas: `GET /api/tarifas/resolver?abogado_id=&proyecto_id=`, `GET /api/tarifas/cobertura`.

### 5.3 Captura y respaldo en Books (2026-10-12)

- **Sin enlace no se captura (409)**: el proyecto debe estar ligado a un proyecto de Books **del
  mismo cliente** y el abogado a un usuario de Books **activo** (configurable: con
  `respaldo.exigir_usuario_books = false` se usa `usuario_books_omision` y la nota lleva
  `[Nombre del abogado]`).
- **Tarea obligatoria**; si no existe en el proyecto de Books, se crea.
- Si Books falla → `books_estado = pendiente`; se reintenta por cron 23:15, botón en
  "Ver lo capturado" o `POST /api/tiempos/respaldar-pendientes`.
- Editar/borrar local sincroniza a Books; si Books no deja borrar, no se borra local.
- `[DEMO]` → `no_aplica`; tiempos anteriores al respaldo → `NULL`.
- Lo ya facturado antes del 2026-10-12 **no** se respaldó (en Books se vería como no facturado).
- Facturable/no facturable: explícito > cuota fija/iguala ⇒ no > tarea estándar. Los no
  facturables nunca se liberan ni entran a Prebill (`ids_ignorados` vía API).
- Validación en 3 capas (UI, API, triggers SQLite): fecha AAAA-MM-DD real, 0 < horas ≤ 24,
  monto > 0, proyecto/abogado activos.

### 5.4 Facturación

- **Modo por despacho** (`configDespacho.factura.modo`):
  - `concepto` (actual): **una línea por concepto** — HONORARIOS, HONORARIOS FIJOS, GASTOS,
    REEMBOLSOS — con artículo en español o inglés (HONORARIOS PROFESIONALES / PROFESSIONAL FEES,
    FIXED FEES, EXPENSES, REIMBURSEMENTS).
  - `tarea`: una línea de honorarios por tarea.
  - `detallado`: una línea por tiempo/gasto/fijo (" : dd mmm yyyy : descripción", estilo EC Legal);
    el ajuste va en línea aparte. `lineas_detalladas` = `con_articulo` | `sin_articulo`.
- Cada línea de honorarios lleva `time_entry_ids` + `project_id` → Books marca esos tiempos como
  facturados.
- **IVA**: impuesto de Books a nivel proyecto o cliente (gana el más específico). Aplica a todo
  **menos reembolsos**. Sin IVA no se factura. IVA mixto en una Prebill → el concepto se parte por
  impuesto. Avolar y Go Sharp = "IVA" 16%.
- **Gasto vs reembolso**: gasto = con IVA, genera CFDI; reembolso = pago a cuenta del cliente, sin
  IVA, sin CFDI. (Distinto del reembolso **al abogado** que pagó: `pagado_por` / `reembolso_estado`,
  pantalla `/reembolsos`.)
- **Moneda**: el proyecto hereda la del cliente en Books; Prebill = una moneda. Este Books
  **ignora `currency_id`** y factura en la moneda del contacto (probado con INV-000864), así que
  `permiteMonedaDistintaAlCliente = false` bloquea antes de facturar. Con `true` se verifica la
  respuesta y se borra el borrador si salió en otra moneda.
- **Idioma** por factura: Prebill > configuración del cliente > `language_code` del contacto.
- **Candado de importes**: si el subtotal de Books ≠ vista previa, se borra el borrador.
- **Editar después de facturar**: permitido mientras la Invoice esté en borrador, sin enviar y sin
  pagos; se rearma en Books y se revierte local si Books falla. Una edición a la vez por Prebill.
- **Deshacer factura**: solo borrador sin enviar, sin pagos y con referencia `Prebill-N`; borra la
  Invoice y regresa la Prebill a Autorizada.

### 5.5 Peculiaridades de Books verificadas (contradicen o no salen en la doc)

| Caso | Comportamiento |
|---|---|
| `currency_id` en invoice | Ignorado en esta versión (`global`): sale en moneda del contacto. |
| `time_entry_ids` | Debe ir como **arreglo JSON**; como texto → "JSON is not well formed". |
| Línea con tiempos | Requiere `project_id` y solo tiempos de **un** proyecto (code 20020) → se parte por proyecto. |
| Proyecto con aprobación de horas | No factura tiempos no aprobados (code 20102); no hay API para aprobar → la vista previa bloquea; se aprueban en Books (Hojas de horas). |
| PUT de líneas de un borrador | Un solo PUT desliga tiempos → se hace en dos pasos y se verifica. |
| Usuario con tarifa en proyecto no `based_on_staff_hours` | Rechazado (code 20068) → se asigna sin tarifa. |
| Número de proyecto | `project_code` casi siempre vacío; el real es el campo "Clave Asunto" `cf_446794000000142123`. |

### 5.6 Honorarios fijos e igualas

`proyectos.tipo_cobro` = `horas` | `fijo` | `iguala`. Tabla `cargos_fijos`, mismo ciclo que
tiempos/gastos. Igualas por mes con índice único (proyecto, periodo): `POST /api/igualas/generar
{periodo:"YYYY-MM"}` no duplica.

### 5.7 Configuración por despacho (`configDespacho.js`)

Pantalla "Configuración", API `GET/PATCH /api/config-despacho`. Los valores por omisión reproducen
el comportamiento original.
- **Responsables** de facturación y cobranza, cascada de fuentes: `campo_cliente` (custom field del
  contacto), `rol_proyecto` (usuarios con ese rol en el proyecto de Books; EC Legal = "Admin Firm"),
  `local` (`responsables_asignados`; proyecto gana a cliente). El WIP agrupa por `responsables.rol_wip`.
- **Factura**: `modo`, `lineas_detalladas`.
- **CFDI**: proveedor `creator` | `interno` | `ninguno`. **El CFDI solo cuenta con la factura
  PAGADA** (`cfdi.solo_pagadas`). Sin regla especial para extranjeros.
- **Respaldo**: `exigir_usuario_books`, `usuario_books_omision`.
- **Formatos**: membrete, datos bancarios por moneda, firma, nota de pie, formato de Prebill por
  omisión, campos de razón social/RFC del contacto.

El usuario indicó que "está por definirse mucho": se mantienen abiertos ambos modelos.

### 5.8 Reglas de borrado

- Niveles, tarifas, tiempos, gastos y Prebills (solo Borrador): borrado real; en uso / facturado /
  en Prebill / fuera de Borrador → **409**.
- Abogados y proyectos: **soft delete** (`activo=0`), responde `soft_delete: true`.
- Tareas estándar y categorías: soft delete.

---

## 6. Uso: interfaz web

Todo desde `https://aptuslegal.app/reportes/sandbox-wip?token=<token>`.

| Pantalla | Ruta |
|---|---|
| Niveles / Abogados / Proyectos / Clientes (IVA, idioma) | `/tipos-abogado`, `/abogados`, `/proyectos`, `/clientes` |
| Tarifas (jerarquía, cobertura, "Probar qué tarifa aplica") | `/tarifas` |
| Conceptos de factura | `/conceptos-factura` |
| Tareas estándar / Categorías de gasto / Honorarios fijos | `/tareas-estandar`, `/categorias-gasto`, `/honorarios-fijos` |
| Agregar tiempo / gasto | `/tiempos/nuevo`, `/gastos/nuevo` |
| Ver, editar y borrar lo capturado (+ reintentar respaldo) | `/capturado` |
| Reembolsos a abogados | `/reembolsos` |
| Liberaciones | `/liberaciones` |
| Prebills (lista, nueva, detalle con vista previa de factura) | `/prebills`, `/prebills/nueva`, `/prebills/:id` |
| Formatos imprimibles | `/formatos` (`?cliente_id=`) |
| Reporte WIP de Books | `/wip` (`?forzar=1` para refrescar) |
| Catálogos de Books (buscar IDs) | `/books` |
| Configuración del despacho, CFDI | menú Configuración |
| Datos de prueba | `/demo` |
| Consola de la API | `/consola` |

El selector de cliente es un buscador (`helpers.js#campoCliente`) que carga `/api/clientes` una vez
(10 min en sessionStorage) en lugar de un `<select>` de 2,570 opciones.

---

## 7. Uso: API JSON

Base: `https://aptuslegal.app/reportes/sandbox-wip/api/...?token=<token>` — el token **siempre en
el query string**. Body JSON o `x-www-form-urlencoded`. Manual publicado:
https://claude.ai/artifact/KQoQmbdQtqNecNbGRsuaYE. La consola (`/consola`) lista ~113 rutas,
prellena ejemplos y genera `curl`; las rutas que escriben en Books están en rojo y piden confirmación.
**Si se agrega una ruta a la API, hay que agregarla a `RUTAS` en `consola.js`.**

Cada objeto trae `zoho_id` (o `null` si es local), `status` y vínculos (`cliente_zoho_id`,
`zoho_user_id`, `zoho_project_id`, `zoho_time_entry_id`, etc.).

| Recurso | Rutas principales |
|---|---|
| Clientes (Books) | `GET /api/clientes` |
| Niveles | `GET/POST /api/tipos-abogado`, `GET/PATCH/DELETE /api/tipos-abogado/:id` |
| Abogados | `GET/POST /api/abogados`, `GET/PATCH/DELETE /:id`, `POST /:id/sincronizar-zoho` |
| Proyectos | `GET/POST /api/proyectos`, `GET/PATCH/DELETE /:id`, `POST /:id/sincronizar-zoho`, `GET /:id/tareas`, `POST /:id/sincronizar-tareas`, `POST /:id/crear-en-books` (sin `confirmar=1` = vista previa) |
| Tarifas | `GET/POST /api/tarifas`, `GET/PATCH/DELETE /:id`, `GET /api/tarifas/resolver`, `GET /api/tarifas/cobertura` (legado: `/api/tarifas-cliente`, `/api/tarifas-proyecto`) |
| Tiempos | `GET/POST /api/tiempos` (filtros `proyecto_id, abogado_id, liberado, facturado, prebill_id, books_estado`), `GET/PATCH/DELETE /:id`, `POST /:id/respaldar`, `GET /api/tiempos/respaldo-books`, `POST /api/tiempos/respaldar-pendientes` |
| Gastos | `GET/POST /api/gastos`, `GET/PATCH/DELETE /:id`, `POST/DELETE /:id/reembolso`, `GET /api/reembolsos` |
| Honorarios fijos | `GET/POST /api/cargos-fijos`, `GET/PATCH/DELETE /:id`, `POST /api/igualas/generar` |
| Catálogos | `/api/tareas-estandar`, `/api/categorias-gasto` |
| Liberación | `POST /api/liberaciones {desde, hasta, cliente_id?}`, `GET /api/liberado-disponible?cliente_id=&moneda=` |
| Prebills | `GET/POST /api/prebills` (`{cliente_id, moneda, tiempo_id:[], gasto_id:[]}`), `GET/DELETE /:id`, `PATCH /:id/lineas`, `PATCH /:id/descuento-ajuste`, `PATCH /:id/idioma`, `POST /:id/estado {nuevo_estado}`, `GET /:id/vista-factura`, `GET /:id/edicion`, `GET /:id/disponible`, `GET /:id/movimientos`, `POST /:id/deshacer-factura` |
| Zoho (lectura) | `GET /api/zoho/usuarios|proyectos|articulos|facturas|tareas` (`?forzar=1`) |
| Configuración | `GET/PATCH /api/config-despacho`, `/api/cfdi`, `/api/facturas-cfdi` |
| Formatos (solo GET) | `GET /api/formatos`, `/api/formatos/prebill/:id`, `/api/formatos/factura/:prebill_id`, `/api/formatos/factura?invoice_id=`, `/api/formatos/estado-cuenta?cliente_id=`, `/api/formatos/ledes/:prebill_id` |
| Demo | `GET /api/demo`, `POST /api/demo/sembrar`, `POST /api/demo/limpiar` |
| Cachés | `GET /api/caches` |

Ejemplos:

```bash
T="token=<token>"
B="https://aptuslegal.app/reportes/sandbox-wip/api"
curl "$B/abogados?$T"
curl -X POST "$B/tiempos?$T" -H 'Content-Type: application/json' \
  -d '{"abogado_id":24,"proyecto_id":3,"fecha":"2026-11-09","horas":1.5,"zoho_task_id":"...","descripcion":"Revisión"}'
curl "$B/tarifas/resolver?abogado_id=24&proyecto_id=3&$T"
curl -o prebill.pdf "$B/formatos/prebill/9?formato=carta&$T"
curl -o ledes.txt  "$B/formatos/ledes/9?$T"
```

### Formatos imprimibles (portados de `aptusCFDIRF`, solo lectura)

| Formato | Equivale a | Salidas |
|---|---|---|
| Prebill carta | `wsPreBillZB_Moderno`, `_Seplaw`, `_Sainz`, `_Cervantes` | pdf, html, json |
| Prebill detallado | `wsPreBillZB_Moderno_Arochi`, `_RVA` | pdf, html, json |
| Factura | `wsInvoicePDF_v40_*` (sin sello; leyenda "no es representación impresa de un CFDI") | pdf, html, json |
| Estado de cuenta | `wsEdoCuenta_Arochi`, `_eclegal` | pdf, html, json |
| LEDES 1998B | `wsFileLedes1998B.PHP` | txt, json |

A diferencia de los PHP, **no adjuntan nada** a Books ni Creator. Fuera de alcance: notas de
crédito, complementos de pago, timbrado/cancelación, LEDES 98BI. En una Prebill ya facturada, el
IVA del formato se calcula con la configuración **actual** (avisa si difiere de Books).

---

## 8. Rendimiento y cachés

- `cacheVivo.js`: stale-while-revalidate para contactos, clientes, usuarios, proyectos, artículos,
  facturas, impuestos, monedas y WIP. Precarga al arrancar (~40 s; `SANDBOX_SIN_PRECARGA=1` la
  salta). **No se renuevan por reloj** (cuidar cuota de Books). Vigencia 5 min; WIP 4 horas.
- WIP usa la consulta global `/projects/timeentries` (31.6 s → 1.2 s, verificado idéntico).
- Primer PDF tras reiniciar ~30 s; siguientes < 1-2 s. Chromium se cierra a los 10 min sin uso.

---

## 9. Operación

```bash
pm2 status sandbox-wip
pm2 logs sandbox-wip --lines 100
pm2 restart sandbox-wip          # tras cambiar código (la precarga tarda ~40 s)
node seed.js estado|sembrar|limpiar
node respaldo.js listar
node respaldo.js verificar sandbox-AAAA-MM-DD.sqlite.gz
```

### Respaldos de la base

- Diario 23:30, `VACUUM INTO` + `integrity_check` + gzip, en `/home/ubuntu/respaldos/reportes-sandbox/`
  (permisos 700). Retención: 7 diarios + 4 semanales + 12 mensuales (máx. ~21 archivos).
- Respaldo manual previo a la migración a Books:
  `/home/ubuntu/respaldos/reportes-sandbox-manual/sandbox-2026-10-12-antes-migracion-books.sqlite.gz`.
- Copia externa (S3): pendiente.

Restaurar (Books **no** se restaura: lo creado allá después del respaldo sigue existiendo):

```bash
cd /var/www/html/NodeProyects/ReportesSandbox
node respaldo.js listar
node respaldo.js verificar sandbox-AAAA-MM-DD.sqlite.gz
pm2 stop sandbox-wip
mkdir -p data/antes-de-restaurar && mv data/sandbox.sqlite* data/antes-de-restaurar/
gunzip -c /home/ubuntu/respaldos/reportes-sandbox/sandbox-AAAA-MM-DD.sqlite.gz > data/sandbox.sqlite
pm2 start sandbox-wip
```

### Pruebas (SIEMPRE contra la copia aislada)

La base real contiene IDs reales de Books: **nunca** correr pruebas contra el servicio ni contra
una copia simple.

```bash
cd /var/www/html/NodeProyects/ReportesSandbox
bash tests/copia-aislada.sh     # /tmp/qa, puerto 3299, BOOKS_SOLO_LECTURA=1, sin IDs de tiempos
node tests/regresion.mjs        # ~139 pruebas
node tests/pantallas.mjs        # 37
node tests/despacho.mjs         # ~103 (PROBAR_CREATOR=1 lee la app real de CFDI de EC Legal, solo GET)
node tests/formatos.mjs         # 52
```

### Quitar el proyecto por completo

`pm2 delete sandbox-wip && pm2 save`, quitar las líneas `ProxyPass`/`ProxyPassReverse` de
`/reportes/sandbox-wip` en el vhost, quitar las dos entradas de cron, y borrar la carpeta.

---

## 10. Evidencia y datos de prueba en el sandbox

- Facturas reales de prueba en Books: INV-000859 (Prebill #1), INV-000861 (Prebill #3),
  INV-000862 (prueba de carrera), INV-000863 (Prebill #7, 4 conceptos, 122,998.60).
  INV-000864 y 865-870 fueron borradores deshechos.
- Prebills #9 (Avolar) y #10 (Go Sharp) en Autorizada con tiempos respaldados (#73-78).
- Tiempos #10 y #75 (proyecto "Prueba Emmanuel") esperan aprobación de horas en Books.
- Abogados activos enlazados: Jenny Morales (#24), Linda Lawson (#25), etc.; Juan Perez,
  Juan Pérez QA y Carlos Sosa QA desactivados (sus tiempos pasaron a Jenny/Linda).
- Datos `[DEMO]` bajo el cliente "Cliente de Prueba" (446794000015629019).

---

## 11. Huecos conocidos y pendientes

- `billed_status` de Books y `liberado/facturado` locales no se cruzan.
- `/wip` muestra los time entries de Books (incluidos ya los respaldados), con tarifa plana del
  proyecto como placeholder para los históricos.
- **Sin autenticación por usuario**: quien tenga el token opera todo (válido solo para prototipo).
- Comprobantes/CFDI de gastos: diferido "para el final" por el usuario.
- "Eventos" de EC Legal (fijos/gastos capturados como tiempos de 1:00): diferido.
- Rotación del token de Donatello y copia externa de respaldos: pendientes.
- Proyecto relacionado en curso (2026-11-06): migración desde SQL Server legado (ALSuite_RVA) hacia
  la forma de ReportesSandbox, en la PC del usuario, fase de solo revisión — nada se manda a Books
  todavía. Paquete de contexto: `/home/ubuntu/paquetes/migracion-sql-sandbox/`.

---

## 12. Reglas para quien trabaje en esto

1. Lógica de Prebill solo en `prebillLogic.js`; armado de factura solo en `facturacion.js`
   (vista previa == lo que se envía). Web y API llaman a las mismas funciones.
2. No confiar en la documentación de Books sobre moneda; verificar con un borrador real por org.
3. Cualquier escritura nueva a Books requiere aprobación del usuario.
4. Nunca crear usuarios de Books; nunca inventar tarifas.
5. Pruebas solo con `tests/copia-aislada.sh`.
6. Ruta nueva en la API → agregarla a `consola.js#RUTAS`.
7. Links/forms/redirects con `ruta()` y `campoToken()`.
8. Migraciones de base idempotentes en `db.js`; nunca borrar columnas/tablas viejas sin acuerdo.
9. No tocar `ReportesSandboxECLegal` para escribir: es un cliente real.
10. `config.js` tiene secretos: no copiarlo fuera del servidor ni publicarlo.
