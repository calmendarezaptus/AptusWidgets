# Prebill API

> ReportesSandbox · Referencia de API

Endpoints JSON del backend de captura de tiempos (con su tarea), gastos y honorarios fijos, tarifas por moneda, respaldo de cada tiempo en Zoho Books, generación de Prebills sobre el sandbox de Books, configuración por despacho (factura detallada, responsables, CFDI) y formatos imprimibles (Prebill, factura, estado de cuenta, LEDES) en PDF, HTML o JSON. Pensado para que otra interfaz — distinta a la UI HTML incluida — opere el mismo sistema.

| Dato | Valor |
|---|---|
| Base URL | /reportes/sandbox-wip/api |
| Autenticación | ?token=… en la URL |
| Actualizado | 2026-11-13 |
| Formato | JSON (form-urlencoded también aceptado); /formatos: PDF, HTML, TXT |
| Escritura real en Books | Cada tiempo (time entry) · Invoice al facturar · tareas |

> Documento generado desde la referencia publicada de la Prebill API (versión del 2026-11-13) para tenerla a la mano en un proyecto nuevo.

## Contenido

- [Autenticación](#autenticacion)
- [Convenciones](#convenciones)
- [Referencias de Zoho en cada respuesta](#zoho-refs)
- [Cambios del 2026-11-13](#novedades-1113)
- [Cambios del 2026-11-04](#novedades-1104)
- [Cambios del 2026-10-12](#novedades-1012)
- [Cambios del 2026-10-05](#novedades-1005)
- [Cambios del 2026-10-02](#novedades)
- [Clientes](#clientes)
- [Niveles de abogado (tipos)](#tipos-abogado)
- [Abogados](#abogados)
- [Proyectos](#proyectos)
- [Zoho — catálogos de Books (solo lectura)](#zoho-endpoints)
- [Tarifas](#tarifas)
- [Tareas estándar](#tareas-estandar)
- [Categorías de gasto](#categorias-gasto)
- [IVA e idioma por cliente](#clientes-config)
- [Conceptos de factura](#conceptos-factura)
- [Tiempos](#tiempos)
- [Gastos](#gastos)
- [Honorarios fijos e igualas](#cargos-fijos)
- [Liberaciones](#liberaciones)
- [Disponible para Prebill](#disponible)
- [Prebills — crear y listar](#prebills)
- [Prebills — detalle y eliminar](#prebill-detalle)
- [Prebills — agregar y quitar líneas](#prebill-lineas)
- [Prebills — descuento y ajuste](#prebill-descuento)
- [Cómo se arma la factura](#factura)
- [Prebills — cambiar estado](#prebill-estado)
- [Configuración del despacho](#config-despacho)
- [Responsables de facturación y cobranza](#responsables)
- [CFDI](#cfdi)
- [Formatos imprimibles](#formatos)
- [Reglas de eliminar](#reglas-eliminar)
- [Jerarquía de tarifas](#jerarquia)
- [Máquina de estados de una Prebill](#maquina-estados)
- [Datos de prueba](#demo)
- [Rutas de tarifas anteriores](#tarifas-compat)
- [Flujo de ejemplo completo](#flujo)

<a id="autenticacion"></a>

## Autenticación

Toda la API vive bajo `/reportes/sandbox-wip/`, protegida por Apache exactamente igual que el resto de `/reportes/`: un `Require expr` que revisa el **query string** de la URL en busca de `token=…`, antes de que la petición llegue a este proceso de Node. Este servicio no vuelve a validar nada por su cuenta — Apache es el único portón.

> **El token va en la URL, no en un header.** Apache no inspecciona `Authorization` ni ningún otro header para esta regla — solo el query string. Un cliente que mande el token como `Bearer` y lo omita de la URL recibirá 401 de Apache antes de que este código se entere de la petición.

*curl*

```bash
curl "https://aptuslegal.app/reportes/sandbox-wip/api/abogados?token=<token>"
```

<a id="convenciones"></a>

## Convenciones

|  |  |
|---|---|
| Content-Type de entrada | `application/json` (preferido) o `application/x-www-form-urlencoded` — útil para probar con `curl -d "campo=valor"` sin armar JSON a mano. |
| Content-Type de salida | `application/json` siempre, incluyendo errores. Excepción: [`/formatos`](#formatos) responde `application/pdf`, `text/html` o `text/plain` según `salida` (sus errores sí son JSON). |
| Fechas | `YYYY-MM-DD` (texto, sin zona horaria). Otro formato, o una fecha que no existe (`2026-02-30`), responde [400]. |
| Dinero | Número plano (sin símbolo, sin separador de miles) en la moneda del proyecto/Prebill correspondiente. |
| Listas repetidas | Un mismo campo puede mandarse varias veces (form-urlencoded: `tiempo_id=2&tiempo_id=3`) o como arreglo JSON (`"tiempo_id":[2,3]`). |

<a id="validacion"></a>

### Reglas de validación

Aplican igual en la API, en la UI web y en la base de datos (que rechaza lo mismo aunque algo se salte la API).

| Campo | Regla | Aplica en |
|---|---|---|
| fecha | `YYYY-MM-DD` y existente en el calendario | tiempos, gastos, honorarios fijos |
| horas | número mayor que 0 y hasta 24 por registro | tiempos |
| tarea | obligatoria: `tarea_estandar_id`, `zoho_task_id` o `tarea` (Books no acepta un tiempo sin tarea) | tiempos |
| monto | número mayor que 0 | gastos, honorarios fijos |
| facturable | `1` o `0` (también true/false, si/no) | gastos, tiempos |
| pagado_por | `despacho` \| `caja_chica` \| `abogado`; si es `abogado`, `abogado_id` obligatorio | gastos |
| proyecto_id / abogado_id | debe existir y estar activo | tiempos, gastos, honorarios fijos |
| desde / hasta | fechas válidas y `desde ≤ hasta` | liberaciones |

También aplican en `PATCH`: solo se validan los campos que mandes.

### Formato de error

Cualquier fallo responde con el status HTTP correspondiente y un cuerpo `{ "error": "…" }`. No hay códigos de error propios más allá del status HTTP.

|  |  |
|---|---|
| [400] | Faltan campos requeridos o un valor no es válido. El mensaje dice cuál y qué llegó, ej. `"horas debe ser mayor que 0; llegó -3"`. Ver [reglas de validación](#validacion). |
| [403] | El abogado no está marcado para ese rol de responsable (ver [Responsables](#responsables)). |
| [404] | El recurso (o el id dentro de la ruta) no existe. |
| [409] | La operación es válida en general pero no en el estado actual del recurso — ver [reglas de eliminar](#reglas-eliminar) y [máquina de estados](#maquina-estados). También al capturar un tiempo si el proyecto o el abogado no están enlazados a Books (ver [Respaldo en Books](#respaldo-books)). |
| [422] | No hay tarifa para ese abogado en la moneda del proyecto en ningún nivel de la [jerarquía](#jerarquia). El tiempo no se guarda; el mensaje dice qué falta. También al asignar como responsable a un abogado inactivo. |
| [502] | Un `sincronizar-zoho` no pudo leer de Books (sin respuesta, o el user/project enlazado ya no existe); un `/tiempos/:id/respaldar` que no logró respaldar; o un `DELETE /tiempos/:id` que Books no dejó borrar (entonces tampoco se borra aquí). |
| [500] | Error inesperado (por ejemplo, Books no respondió al crear la Invoice). |

<a id="zoho-refs"></a>

## Referencias de Zoho en cada respuesta

Como todo el sistema real se maneja con IDs de Zoho Books, **cada objeto que devuelve la API** trae estos campos, además de los suyos propios:

| Campo | Qué es |
|---|---|
| zoho_id | El id del elemento en Zoho Books — o `null` si es un catálogo puramente local (tipos de abogado, tarifas, y el abogado / gasto en sí, que viven solo en la base de este servicio). En un **tiempo** es el id de su time entry en Books (el mismo que `zoho_time_entry_id`; `null` si aún no se respalda). En una Prebill `facturada`, es el id real de la Invoice (también expuesto como `zoho_invoice_id`). |
| status | Estado del elemento. Real donde hay ciclo de vida (ver cada recurso); constante `"activo"` en los catálogos locales que no se desactivan. |
| cliente_zoho_id | En todo lo que cuelga de un cliente (proyectos, tarifas, tiempos, gastos, honorarios fijos, Prebills) — el `contact_id` de Books. |

Vínculos opcionales a Zoho que se pueden establecer y que luego se propagan:

|  |  |
|---|---|
| abogados | `zoho_user_id` → un User de Books; al enlazar se cachean `foto_url`, `email`, `zoho_user_nombre`, `zoho_user_email`, `zoho_user_status`. |
| proyectos | `zoho_project_id` → un Project de Books; se cachean `zoho_project_name` y `zoho_project_code` (el número). `nombre_completo` = el nombre de Zoho si está enlazado, si no el local — nunca solo la descripción. |
| tiempos | `zoho_time_entry_id` → el time entry de Books donde está respaldado; `zoho_task_id` → la tarea del Project de Books (el `task_id` del time entry), con su nombre en `tarea`. Ver [Tiempos](#tiempos) y [Respaldo en Books](#respaldo-books). |
| tiempos / gastos | arrastran `proyecto_zoho_id` / `proyecto_zoho_nombre` / `proyecto_zoho_codigo` (y `abogado_zoho_user_id` en tiempos) del proyecto/abogado al que pertenecen. |

<a id="novedades-1113"></a>

## Cambios del 2026-11-13

**Los responsables capturados aquí (fuente `local`) solo pueden ser abogados registrados y activos, y solo si en el abogado se marcó que pueden serlo.** Las fuentes que vienen de Books (`campo_cliente`, `rol_proyecto`) no cambian. No hay rutas nuevas.

| Tema | Qué cambió |
|---|---|
| Abogados  *(nuevo)* | Campo `responsable`: `null` (no puede ser responsable, omisión) \| `facturacion` \| `cobranza` \| `general` (los dos roles). Sale en `GET /abogados` y `GET /abogados/:id`; se fija en `POST /abogados` y `PATCH /abogados/:id` (vacío o `null` lo quita; otro valor → [400]). En la web: "Puede ser responsable" en Abogados. |
| POST /responsables  *(cambia)* | Pide `abogado_id` en lugar de `nombre`; **ya no se aceptan nombres libres** ([400]). Abogado inexistente [404], inactivo [422], sin la marca del rol [403]. El nombre guardado es el del abogado (`zoho_user_nombre`, si no `nombre`). Nuevo `rol: "ambos"` para abogados `general`. |
| GET /responsables | Cada asignación trae `abogado_id` (`null` en las de nombre libre anteriores) y `abogado_cubre_rol`. |
| Quitar la marca | **No borra** las asignaciones del abogado: siguen contando en `/responsables/resolver` hasta que se borren con `DELETE /responsables/:id`. `abogado_cubre_rol` pasa a `false`. |

<a id="novedades-1104"></a>

## Cambios del 2026-11-04

**Formatos imprimibles** tomados de `aptusCFDIRF` y rehechos con los datos del sandbox: Prebill (carta y detallado), factura, estado de cuenta del cliente y archivo LEDES 1998B. Salen en PDF, HTML o JSON, en la web (menú Reportes → Formatos) y por la API. Son de solo lectura: no adjuntan nada en Books ni en Creator. 6 rutas nuevas; la consola ahora tiene 120.

| Tema | Qué cambió |
|---|---|
| Formatos  *(nuevo)* | Recurso [`/formatos`](#formatos): catálogo, `/formatos/prebill/:id`, `/formatos/factura/:prebill_id` (o `?invoice_id=`), `/formatos/estado-cuenta?cliente_id=` y `/formatos/ledes/:prebill_id`. Solo `GET`. |
| Salida | Por omisión la API responde el **PDF** (LEDES: texto). `salida=html` o `salida=json` para los datos; `descargar=1` lo manda como archivo adjunto. |
| Configuración | Nueva sección `formatos` en [`/config-despacho`](#formato-membrete): membrete, cuentas bancarias por moneda, ciudad, firma, formato de Prebill por omisión y los campos de Books con la razón social y el RFC del cliente. |
| Rendimiento | Las listas de Books (clientes, proyectos, facturas, usuarios, impuestos, artículos) responden con la copia guardada y se renuevan en segundo plano; puede verse lo de hace unos minutos. Nueva `GET /caches`: edad, última descarga y errores de cada copia. Las respuestas JSON bajo `/reportes/` se comprimen con gzip si el cliente lo pide (`/clientes`: 510 KB → 69 KB). |
| Equivalencias | `wsPreBillZB_Moderno / _Seplaw / _Sainz / _Cervantes` → carta; `_Moderno_Arochi / _RVA` → detallado; `wsInvoicePDF_v40_*` → factura (sin sello: el sandbox no timbra); `wsEdoCuenta_Arochi / _eclegal` → estado de cuenta; `wsFileLedes1998B` → LEDES. |

<a id="novedades-1012"></a>

## Cambios del 2026-10-12

**Cada tiempo se respalda en Zoho Books** como time entry, en la tarea de su propio proyecto de Books, para que la información no se pierda. La factura queda ligada a esos tiempos. 4 rutas nuevas; la consola ahora tiene 113.

| Tema | Qué cambió |
|---|---|
| Captura  *(cambia)* | Para capturar un tiempo, el proyecto debe estar enlazado a un proyecto de Books y el abogado a un usuario activo de Books; si no, [409]. La **tarea es obligatoria** ([400]). Antes ninguna de las dos cosas se pedía. El usuario de Books se puede volver opcional por despacho (`respaldo.exigir_usuario_books`). |
| Proyectos en Books | Nueva [`POST /proyectos/:id/crear-en-books`](#proyectos): crea en Books el proyecto de un proyecto local, con la numeración del cliente, y lo enlaza. Los 13 proyectos del sandbox ya tienen ID de Books. |
| Respaldo | Al crear, editar o borrar un tiempo aquí, se crea, actualiza o borra en Books. Si la tarea no existe en el proyecto de Books, se crea ahí. Si Books falla, el tiempo se guarda como `pendiente` y se reintenta (cron nocturno 23:15, botón o API). Ver [Respaldo en Books](#respaldo-books). |
| ID de Books | Cada tiempo trae `zoho_time_entry_id` (también en `zoho_id`), `books_estado`, `books_error`, `books_sincronizado_en` y `books_aprobacion`. `GET /tiempos` acepta `?books_estado=`. |
| Factura | Tres modos por despacho: `concepto` (resumida), `tarea`  *(nuevo)* (una línea de honorarios por tarea) y `detallado` (una por tiempo). En los tres, cada línea de honorarios lleva los `time_entry_ids` de sus tiempos, así Books los marca como facturados. Ver [Cómo se arma la factura](#factura). |
| Bloqueos nuevos | No se factura con tiempos `pendiente` de respaldo ni con tiempos que esperan aprobación de horas en Books. |
| Proyectos | Enlazar un proyecto a un proyecto de Books de **otro cliente** ahora responde [400]. |
| Datos de prueba | Los tiempos `[DEMO]` no se mandan a Books (`books_estado = "no_aplica"`). |

<a id="novedades-1005"></a>

## Cambios del 2026-10-05

Configuración por despacho, a partir de una prueba de solo lectura con un cliente real (EC Legal Centro), que factura distinto a este sandbox. **Los valores por omisión reproducen el comportamiento anterior**: nada cambia hasta que alguien modifica la configuración. 13 rutas nuevas; la consola ahora tiene 109.

| Tema | Qué cambió |
|---|---|
| Configuración | Nuevo recurso [`/config-despacho`](#config-despacho): modo de factura, fuentes de responsables y proveedor de CFDI. Es una sola configuración para todo el despacho. |
| Factura detallada | Con `factura.modo = "detallado"`, una línea por cada tiempo (horas × tarifa), gasto, reembolso y cargo fijo, con o sin artículo de Books. El total antes de impuestos es el mismo que en el modo por concepto. Ver [Cómo se arma la factura](#factura). |
| Responsables | Dos roles, **facturación** y **cobranza**, cada uno con su lista de fuentes. Nuevo recurso [`/responsables`](#responsables). `GET /prebills/:id` trae `responsables`. |
| CFDI | Proveedor configurable: app de CFDI en Zoho Creator (solo lectura), registro interno o ninguno. **El CFDI solo cuenta cuando la factura está pagada en Books.** Nuevos [`/facturas-cfdi` y `/cfdi`](#cfdi). `GET /prebills/:id` trae `cfdi` si está facturada. |
| Vista de factura | Cada línea trae `cantidad`, `precio`, `registro_tipo` y `registro_id`; la respuesta trae `modo_factura` y `lineas_detalladas`. |
| Reporte WIP | Agrupa por el responsable del rol de `responsables.rol_wip`. Si no hay nombre, conserva el criterio anterior. |

<a id="novedades"></a>

## Cambios del 2026-10-02

Lo que cambió respecto a la versión anterior de este manual. Todo es compatible hacia atrás salvo lo marcado.

| Tema | Qué cambió |
|---|---|
| Tiempos | Cada tiempo trae su **tarea** (`tarea_estandar_id`, `zoho_task_id`, `tarea`), si es **facturable**, y de qué nivel salió su tarifa (`tarifa_nivel`). Nuevo status `no_facturable`. |
| Tarifas | Ahora tienen **moneda** y 9 niveles de jerarquía. Sin tarifa en la moneda del proyecto: [422], nunca se usa la de otra moneda. Nuevo recurso [`/tarifas`](#tarifas). |
| Catálogos | Nuevos: [tareas estándar](#tareas-estandar) y [categorías de gasto](#categorias-gasto), con código UTBMS opcional. |
| Proyectos | `tipo_cobro` (`horas` \| `fijo` \| `iguala`) y `honorario_fijo`. |
| Honorarios fijos | Nuevo recurso [`/cargos-fijos`](#cargos-fijos): tercer tipo de línea de Prebill, junto a tiempos y gastos. |
| Prebills | Aceptan `cargo_fijo_id`; los totales desglosan `subtotalHonorariosHoras` y `subtotalHonorariosFijos`. |
| Gastos | `tipo` (gasto con IVA / reembolso sin IVA), `facturable`, `pagado_por`, `abogado_id` y reembolso al abogado (`/reembolsos`, `/gastos/:id/reembolso`). |
| Factura | **Una línea por concepto** (HONORARIOS, HONORARIOS FIJOS, GASTOS, REEMBOLSOS) con artículo de Books en español o inglés, IVA del proyecto o cliente, y la moneda de la Prebill, que debe ser la del cliente en Books. Ver [Cómo se arma la factura](#factura). |
| Consola | Dentro del sistema hay una **consola de la API** (menú "Consola de la API", ruta `/reportes/sandbox-wip/consola`) para probar las 96 rutas sin escribir código: llena parámetros, ejecuta y muestra la respuesta y el `curl` equivalente. |
| Proyectos: moneda | Cambiar `moneda` con `PATCH /proyectos/:id` recalcula las tarifas de sus tiempos en la moneda nueva (respuesta en `cambio_moneda`). Se rechaza ([409]) si algo ya está en una Prebill o facturado, o si tiene gastos u honorarios fijos. |
| `activo` | Corregido: `activo=0` enviado como formulario ahora sí desactiva abogados y proyectos (antes se interpretaba como verdadero). |
| Idioma por factura | Cada Prebill puede salir en español o inglés aunque el cliente tenga otro idioma (`PATCH /prebills/:id/idioma`). |
| Editar Prebills | Agregar y quitar líneas en cualquier estado antes de facturar, y ya facturada mientras la factura siga en borrador en Books (se actualiza la factura). Bitácora de movimientos. Ver [Agregar y quitar líneas](#prebill-lineas). |
| Validación | Tiempos, gastos, honorarios fijos y liberaciones rechazan con [400] fechas mal formadas, horas o montos ≤ 0, más de 24 horas, y proyectos o abogados inactivos. Antes se aceptaban. Ver [reglas](#validacion). |
| Compatibilidad | `/tarifas-cliente` y `/tarifas-proyecto` siguen funcionando, pero **sus `id` cambiaron** (ahora son ids de `/tarifas`). Ver [rutas anteriores](#tarifas-compat). |

<a id="clientes"></a>

## Clientes

Solo lectura — son los Contactos tipo `customer` reales de Books, cacheados 5 minutos. No hay "crear cliente" en esta API a propósito: los clientes se dan de alta en Books, no aquí.

#### `GET /clientes` — Lista para poblar un selector de cliente

*Respuesta 200*

```json
[
  {
    "id": "446794000018976769",
    "zoho_id": "446794000018976769",
    "nombre": "00002 Go Sharp Technologies, S.A. de C.V.",
    "status": "active"
  }
]
```

`id` se mantiene por compatibilidad con la UI HTML; es el mismo valor que `zoho_id`.

<a id="tipos-abogado"></a>

## Niveles de abogado (tipos)

Socio, Asociado, Pasante, etc. Cada abogado pertenece a un nivel. El nivel tiene su tarifa por hora **en cada moneda**; es el nivel 8 de la [jerarquía](#jerarquia). Todos los niveles deberían tener tarifa en MXN y USD.

#### `GET /tipos-abogado` — Lista todos, con sus tarifas por moneda

*Respuesta 200*

```json
[{
  "id": 2, "nombre": "Socio QA",
  "tarifas": { "MXN": 2000, "USD": 110, "EUR": null },
  "avisos_tarifa": [],
  "tarifa_default": 2000, "moneda": "MXN",
  "zoho_id": null, "status": "activo"
}]
```

`avisos_tarifa` lista las monedas requeridas (MXN, USD) en las que el nivel no tiene tarifa. `tarifa_default` + `moneda` se conservan por compatibilidad: es la tarifa en la moneda principal del nivel.

#### `POST /tipos-abogado` — Crea uno

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| nombre | string | requerido |
| tarifa_mxn | number | tarifa por hora en MXN |
| tarifa_usd | number | tarifa por hora en USD |
| tarifa_eur | number | opcional |
| tarifa_default + moneda | number, string | opcional — forma anterior, sigue aceptándose |

Se pide al menos una tarifa.

*curl*

```bash
curl -X POST ".../api/tipos-abogado?token=<token>" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Socio","tarifa_mxn":3500,"tarifa_usd":200}'
```

#### `GET /tipos-abogado/:id`

#### `PATCH /tipos-abogado/:id` — nombre / tarifa_mxn / tarifa_usd / tarifa_eur

Solo cambia lo que mandes. Una tarifa vacía (`"tarifa_usd": ""`) la quita.

#### `DELETE /tipos-abogado/:id`

> **409** si algún abogado sigue usando este nivel. Al borrar se borran también sus tarifas.

<a id="abogados"></a>

## Abogados

Catálogo propio — **no crea Usuarios reales en Books** (evita disparar invitaciones por correo). Un abogado puede tener **tarifa propia por moneda** (nivel 7, gana a la de su nivel) y puede enlazarse a un User real de Books para heredar su foto, nombre y estado.

#### `GET /abogados` — Lista, con nivel y tarifas resueltas

*Respuesta 200*

```json
[{
  "id": 3, "nombre": "Ana Ruiz QA", "tipo_id": 3, "tipo_nombre": "Junior QA", "activo": 1,
  "tarifa_propia": 900,
  "tarifas_propias": { "MXN": 900, "USD": 50, "EUR": null },
  "tarifas_base": {
    "MXN": { "tarifa": 900, "nivel": "abogado", "nivel_etiqueta": "Tarifa propia del abogado" },
    "USD": { "tarifa": 50, "nivel": "abogado", "nivel_etiqueta": "Tarifa propia del abogado" },
    "EUR": null
  },
  "avisos_tarifa": [],
  "zoho_id": null, "status": "activo",
  "zoho_user_id": "446794000000231041",
  "email": "carolina.litter@aptus-legal.com.mx",
  "foto_url": "https://contacts.zoho.com/file?t=user&ID=637497560&fs=thumb",
  "zoho_user_nombre": "Carolina Litter",
  "zoho_user_email": "carolina.litter@aptus-legal.com.mx",
  "zoho_user_status": "inactive",
  "responsable": "general"
}]
```

`responsable`: si puede ser responsable de facturación o cobranza (ver [Responsables](#responsables)); `null` = no. `tarifas_base` es lo que se cobra por moneda cuando el proyecto/cliente no tiene tarifa especial: la propia, si no la de su nivel, si no la general. `avisos_tarifa` dice en qué moneda requerida no tiene ninguna (ej. `"Sin tarifa asignada en USD (ni propia, ni de su nivel, ni general)"`): ese abogado recibirá [422] al capturar en esa moneda. `tarifa_propia` = la propia en MXN, por compatibilidad. `email` es el efectivo; `zoho_user_email` el crudo del User.

#### `POST /abogados`

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| nombre | string | requerido |
| tipo_id | number | requerido, debe existir |
| tarifa_propia_mxn | number | opcional — vacío/omitido = usa la de su nivel |
| tarifa_propia_usd | number | opcional |
| tarifa_propia_eur | number | opcional |
| tarifa_propia | number | opcional — forma anterior, se toma como MXN |
| zoho_user_id | string | opcional — `user_id` de Books; se cachean foto, nombre, status y correo |
| foto_url | string | opcional — gana sobre la del User de Books |
| email | string | opcional — gana sobre el del User de Books |
| responsable | string | opcional — `facturacion` \| `cobranza` \| `general` \| vacío/`null` (omisión: no puede ser responsable). Otro valor: [400] |

#### `GET /abogados/:id`

#### `PATCH /abogados/:id` — nombre / tipo_id / tarifa_propia_* / activo / zoho_user_id / foto_url / email / responsable

Una `tarifa_propia_*` vacía quita esa tarifa propia (vuelve a la de su nivel). Mandar `zoho_user_id` (aunque sea vacío para desenlazar) re-resuelve foto/nombre/status/correo desde Books. `responsable`: mismos valores que en el alta; vacío o `null` quita la marca, omitido no la toca. **Quitar la marca no borra sus asignaciones** de responsable (siguen contando hasta que se borren a mano).

#### `POST /abogados/:id/sincronizar-zoho` — refresca foto/nombre/status/correo del User enlazado

[409] si no tiene `zoho_user_id`; [502] si Books no responde o el user ya no existe.

#### `DELETE /abogados/:id` — soft-delete

> **No borra la fila.** Pone `activo=0` y responde `{ "ok": true, "soft_delete": true, "nota": "…" }` — ver [reglas de eliminar](#reglas-eliminar).

<a id="proyectos"></a>

## Proyectos

Un proyecto pertenece a un cliente real de Books (`cliente_id`), define la **moneda** de todo lo que se capture en él (y por tanto en qué moneda se busca la tarifa) y su **tipo de cobro**. Puede enlazarse a un Project real de Books para traer su nombre, número y tareas.

#### `GET /proyectos`

*Respuesta 200*

```json
[{
  "id": 20, "nombre": "Iguala corporativa mensual", "moneda": "MXN", "activo": 1,
  "tipo_cobro": "iguala", "tipo_cobro_etiqueta": "Iguala mensual", "honorario_fijo": 25000,
  "zoho_id": "446794000021084009",
  "zoho_project_id": "446794000021084009",
  "zoho_project_name": "Prueba Emmanuel",
  "zoho_project_code": "1174",
  "nombre_completo": "Prueba Emmanuel",
  "cliente_zoho_id": "446794000015629019", "status": "activo"
}]
```

`tipo_cobro`: `horas` (default) se cobra por tiempo; `fijo` (cuota fija del asunto) e `iguala` (cuota mensual) se cobran con [honorarios fijos](#cargos-fijos), y sus tiempos nacen como **no facturables** (se registran para control). `nombre_completo` = el nombre de Zoho si está enlazado, si no el local. `zoho_project_code` es el campo "Clave Asunto" de Books.

#### `POST /proyectos`

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| nombre | string | requerido |
| cliente_id | string | requerido — contact_id real de Books |
| cliente_nombre | string | opcional — se resuelve de Books si se omite |
| moneda | string | opcional — default: la del cliente en Books. Puede ser otra (MXN, USD, EUR) |
| zoho_tax_id | string | opcional — IVA propio del proyecto (ver [`/zoho/impuestos`](#clientes-config)); vacío = el del cliente |
| tipo_cobro | string | opcional — `horas` (default) \| `fijo` \| `iguala` |
| honorario_fijo | number | opcional — cuota fija o iguala mensual; **requerido** si `tipo_cobro=iguala` |
| zoho_project_id | string | opcional — `project_id` de Books; se cachea nombre + código |

#### `GET /proyectos/:id`

#### `PATCH /proyectos/:id` — nombre / moneda (recalcula tiempos) / activo / tipo_cobro / honorario_fijo / zoho_tax_id / zoho_project_id

`cliente_id` no es editable a propósito — si el proyecto cambia de cliente, crea uno nuevo. `zoho_project_id` debe ser un proyecto de Books del mismo cliente ([400] si es de otro). La `moneda` solo se puede cambiar mientras el proyecto no tenga capturas ([409]).

#### `GET /proyectos/:id/tareas` — tareas del Project de Books enlazado

*Respuesta 200*

```json
[{
  "zoho_id": "446794000021075007", "nombre": "Pasante",
  "status": "active", "facturable": true, "descripcion": ""
}]
```

`[]` si el proyecto no está enlazado a Books. Caché de 5 min; `?forzar=1` la salta. El `zoho_id` es el que se manda como `zoho_task_id` al capturar un tiempo.

#### `POST /proyectos/:id/crear-en-books` — crea el proyecto en Books y lo enlaza

Para un proyecto local que todavía no existe en Books. Sin `confirmar=1` es una **vista previa**: responde el nombre que tendría y los usuarios que se asignarían, sin escribir nada. Con `{"confirmar":1}` lo crea y lo enlaza.

| Regla | Detalle |
|---|---|
| Nombre | La numeración del cliente en Books: el siguiente al número más alto de sus proyectos (ej. `00001.004 Asunto de prueba`). Si el cliente no tiene proyectos numerados, el número del contacto + `.001`; si tampoco tiene número, el nombre local tal cual. |
| Tipo | Como los existentes: facturación por horas del personal, sin aprobación de horas. |
| Usuarios | Los usuarios de Books de los abogados que ya capturaron en el proyecto, con su tarifa. |

*Respuesta 201 (con confirmar=1)*

```json
{
  "proyecto_id": 1, "nombre_books": "00001.004 Asunto de prueba",
  "cliente_id": "446794000018976759", "cliente_nombre": "00001 Avolar Aerolíneas S.A. de C.V.",
  "usuarios": [ { "userId": "446794000000231049", "rate": 200 } ],
  "confirmado": true, "zoho_project_id": "446794000050257061"
}
```

> **Escribe en Books** (solo con `confirmar=1`). [409] si ya está enlazado, o si el cliente ya tiene en Books un proyecto con ese nombre (enlázalo en lugar de duplicarlo). Si Books no responde, falla sin crear nada (la numeración se lee directo de Books).

#### `POST /proyectos/:id/sincronizar-tareas` — crea en Books las tareas estándar que falten

Sin `confirmar=1` es una **vista previa**: no escribe nada y responde qué faltaría. Con `{"confirmar":1}` crea en el Project de Books las [tareas estándar](#tareas-estandar) que no existan (compara sin importar acentos ni mayúsculas).

*Respuesta 200 (vista previa)*

```json
{
  "proyecto_id": 8, "zoho_project_id": "446794000019007841",
  "confirmado": false,
  "ya_existen": [],
  "faltantes": ["Asesoría y consulta", "Investigación jurídica", "..."],
  "creadas": [], "errores": []
}
```

> **Escribe en Books.** Solo con `confirmar=1`, un proyecto a la vez. [409] si el proyecto no está enlazado. Si Books no responde, falla en lugar de crear duplicadas.

#### `POST /proyectos/:id/sincronizar-zoho` — refresca nombre + código del Project enlazado

[409] sin `zoho_project_id`; [502] si Books no responde.

#### `DELETE /proyectos/:id` — soft-delete

<a id="zoho-endpoints"></a>

## Zoho — catálogos de Books (solo lectura)

Espejo de solo lectura de Zoho Books para elegir a qué enlazar abogados/proyectos y para consultar facturas/artículos por su id de Zoho. Caché de 5 min, tolerante a fallas (si Books no responde, devuelve lo último cacheado o vacío). Nunca escriben en Books. Agrega `?forzar=1` para saltar la caché.

#### `GET /zoho/usuarios` — Users de Books — para enlazar abogados y sus fotos

*Respuesta 200*

```json
[{
  "zoho_id": "446794000000052001", "nombre": "AM - Alberti Martinolli",
  "email": "alberti.martinolli@aptus-legal.com.mx", "status": "active",
  "foto_url": "https://contacts.zoho.com/file?t=user&ID=26842747&fs=thumb", "rol": "admin"
}]
```

#### `GET /zoho/proyectos` — Projects de Books — para enlazar proyectos

*Respuesta 200*

```json
[{
  "zoho_id": "446794000021084009", "nombre": "Prueba Emmanuel", "codigo": "1174",
  "cliente_zoho_id": "446794000018976759", "cliente_nombre": "00001 Avolar…",
  "status": "active", "moneda": "MXN", "rate": 100, "descripcion": "…"
}]
```

#### `GET /zoho/tareas` — ?zoho_project_id= — tareas de un Project de Books

Igual que [`GET /proyectos/:id/tareas`](#proyectos), pero por `project_id` de Books directamente. Requerido: `?zoho_project_id=`.

#### `GET /zoho/articulos` — Items de Books

*Respuesta 200*

```json
[{
  "zoho_id": "446794000004440001", "nombre": "14 Hands Wine",
  "status": "active", "rate": 100, "unidad": "Box", "descripcion": ""
}]
```

#### `GET /zoho/facturas` — Invoices de Books — incluye las que generó este sistema

*Respuesta 200*

```json
[{
  "zoho_id": "446794000048798024", "numero": "INV-000862", "status": "draft",
  "cliente_zoho_id": "446794000018976759", "cliente_nombre": "00001 Avolar…",
  "total": 400, "fecha": "2026-09-09", "referencia": "Prebill-5"
}]
```

La `referencia` `Prebill-N` ata cada Invoice a la Prebill local que la generó.

<a id="tarifas"></a>

## Tarifas

Un solo recurso para todas las tarifas. Cada tarifa tiene **moneda**, un **ámbito** opcional (un proyecto *o* un cliente) y un **quién** opcional (un abogado *o* un nivel). La combinación define su nivel en la [jerarquía](#jerarquia). Sin ámbito ni quién = tarifa general del despacho en esa moneda.

| # | nivel | Ámbito | Quién |
|---|---|---|---|
| 1 | proyecto_abogado | proyecto_id | abogado_id |
| 2 | proyecto_tipo | proyecto_id | tipo_id |
| 3 | proyecto | proyecto_id | — (todos) |
| 4 | cliente_abogado | cliente_id | abogado_id |
| 5 | cliente_tipo | cliente_id | tipo_id |
| 6 | cliente | cliente_id | — (todos) |
| 7 | abogado | — | abogado_id |
| 8 | tipo | — | tipo_id |
| 9 | general | — | — |

#### `GET /tarifas` — filtros: moneda, proyecto_id, cliente_id, abogado_id, tipo_id, nivel

*Respuesta 200*

```json
[{
  "id": 26, "moneda": "MXN", "tarifa": 1000,
  "proyecto_id": 18, "proyecto_nombre": "Litigio mercantil (por hora)",
  "cliente_id": null, "abogado_id": null,
  "tipo_id": 13, "tipo_nombre": "Pasante",
  "nivel": "proyecto_tipo", "nivel_etiqueta": "Proyecto + nivel del abogado", "nivel_orden": 2,
  "zoho_id": null, "status": "activo"
}]
```

Ordenadas por `nivel_orden` (de más a menos específica).

#### `POST /tarifas` — crea o reemplaza (misma combinación + moneda = misma fila)

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| moneda | string | requerido — MXN \| USD \| EUR |
| tarifa | number | requerido, ≥ 0 |
| proyecto_id | number | opcional — la moneda debe ser la del proyecto |
| cliente_id | string | opcional — no junto con proyecto_id |
| abogado_id | number | opcional |
| tipo_id | number | opcional — no junto con abogado_id |

*curl — tarifa de los pasantes en un proyecto*

```bash
curl -X POST ".../api/tarifas?token=<token>" -H "Content-Type: application/json" \
  -d '{"moneda":"MXN","tarifa":1000,"proyecto_id":18,"tipo_id":13}'
```

[400] si mandas proyecto y cliente a la vez, abogado y nivel a la vez, una tarifa de proyecto en otra moneda, o una tarifa negativa.

#### `GET /tarifas/resolver` — ?abogado_id=&proyecto_id= — qué tarifa aplicaría y por qué

*Respuesta 200*

```json
{
  "abogado": { "id": 16, "nombre": "Sofía Pasante" },
  "proyecto": { "id": 18, "nombre": "Litigio mercantil (por hora)" },
  "moneda": "MXN",
  "aplicada": { "orden": 2, "nivel": "proyecto_tipo", "etiqueta": "Proyecto + nivel del abogado", "tarifa": 1000, "tarifa_id": 26 },
  "cadena": [
    { "orden": 1, "nivel": "proyecto_abogado", "tarifa": null },
    { "orden": 2, "nivel": "proyecto_tipo", "tarifa": 1000 },
    { "orden": 4, "nivel": "cliente_abogado", "tarifa": 900 },
    /* ... los 9 niveles ... */
  ],
  "aviso": null
}
```

Solo lectura, no captura nada. Si no hay tarifa en ningún nivel: `"aplicada": null` y `aviso` con el texto.

#### `GET /tarifas/cobertura` — abogados activos sin tarifa base en MXN o USD

*Respuesta 200*

```json
{
  "monedas_requeridas": ["MXN", "USD"],
  "sin_cobertura": [
    { "abogado_id": 17, "nombre": "Pedro Paralegal", "faltan": ["USD"], "tarifas_base": { "...": "..." } }
  ],
  "abogados": [ /* todos los activos */ ]
}
```

#### `GET /tarifas/:id`

#### `PATCH /tarifas/:id` — solo tarifa

Para cambiar ámbito, quién o moneda, crea otra tarifa y borra esta.

#### `DELETE /tarifas/:id` — borra la fila

No afecta tiempos ya capturados: su tarifa quedó congelada en `tarifa_aplicada`.

<a id="tareas-estandar"></a>

## Tareas estándar

Catálogo único de tareas para **todos** los proyectos (14 iniciales: asesoría, investigación, contratos, corporativo, trámites, juntas y 5 etapas de litigio, más una de administración interna no facturable). `codigo_utbms` es la referencia opcional al estándar UTBMS (ABA/LEDES). Una tarea con `facturable: 0` hace que sus tiempos nazcan como no cobrables.

#### `GET /tareas-estandar` — activos; `?todos` incluye inactivos

*Respuesta 200*

```json
[{
  "id": 9, "nombre": "Litigio: análisis y estrategia del caso",
  "codigo_utbms": "L100", "facturable": 1, "activo": 1, "orden": 90,
  "zoho_id": null, "status": "activo"
}]
```

#### `POST /tareas-estandar`

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| nombre | string | requerido, único |
| codigo_utbms | string | opcional, ej. L210, C300 |
| facturable | 0 \| 1 | opcional, default 1 |

[409] si el nombre ya existe.

#### `GET /tareas-estandar/:id`

#### `PATCH /tareas-estandar/:id` — nombre / codigo_utbms / activo / orden / facturable

#### `DELETE /tareas-estandar/:id` — soft-delete (activo=0)

<a id="categorias-gasto"></a>

## Categorías de gasto

Catálogo de categorías para clasificar gastos (11 iniciales: copias, mensajería, derechos y aranceles, notario, peritos, viáticos…), con su código UTBMS de gastos (E1xx) opcional. Cada categoría tiene un `tipo` por defecto para sus gastos: `gasto` o `reembolso` (iniciales como reembolso: derechos y aranceles, notario).

#### `GET /categorias-gasto` — activos; `?todos` incluye inactivos

*Respuesta 200*

```json
[{
  "id": 3, "nombre": "Bases de datos e investigación en línea",
  "codigo_utbms": "E106", "activo": 1, "orden": 30,
  "zoho_id": null, "status": "activo"
}]
```

#### `POST /categorias-gasto`

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| nombre | string | requerido, único |
| codigo_utbms | string | opcional, ej. E107 |
| tipo | string | opcional — gasto (default) \| reembolso |

[409] si el nombre ya existe.

#### `GET /categorias-gasto/:id`

#### `PATCH /categorias-gasto/:id` — nombre / codigo_utbms / activo / orden / tipo

#### `DELETE /categorias-gasto/:id` — soft-delete (activo=0)

<a id="clientes-config"></a>

## IVA e idioma por cliente

El IVA del cliente aplica a todos sus proyectos que no tengan uno propio (lo más específico gana). El idioma decide si la factura usa los conceptos en español o en inglés; por defecto es el del contacto en Books. La moneda del cliente es la de Books y la heredan sus proyectos nuevos.

#### `GET /zoho/impuestos` — impuestos de Books para elegir el IVA

*Respuesta 200*

```json
[
  { "zoho_id": "446794000008083135", "nombre": "IVA", "porcentaje": 16, "tipo": "tax" },
  { "zoho_id": "446794000009144786", "nombre": "HONORARIOS", "porcentaje": 5.3333, "tipo": "tax_group" },
  { "zoho_id": "446794000012115389", "nombre": "IVA0%", "porcentaje": 0, "tipo": "tax" }
]
```

Incluye grupos con retenciones (ej. "HONORARIOS"), que se mandan a Books tal cual.

#### `GET /clientes/:cliente_id/config`

*Respuesta 200*

```json
{
  "cliente_id": "446794000015629019", "nombre": "Cliente de Prueba",
  "moneda": "MXN", "idioma_books": "es",
  "idioma": null, "idioma_factura": "es",
  "zoho_tax_id": "446794000008083135",
  "impuesto": { "zoho_id": "446794000008083135", "nombre": "IVA", "porcentaje": 16 }
}
```

#### `PATCH /clientes/:cliente_id/config`

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| zoho_tax_id | string | opcional — vacío lo quita |
| idioma | string | opcional — es \| en \| vacío (= el de Books) |

<a id="conceptos-factura"></a>

## Conceptos de factura

Cada concepto es una línea de la factura y se liga a un artículo de Books en español y otro en inglés. Sin vínculo manual se usa el artículo con exactamente ese nombre. Mientras falte un artículo, no se puede facturar una Prebill que use ese concepto.

| clave | Español | Inglés | Qué junta |
|---|---|---|---|
| honorarios | HONORARIOS | FEES | todos los tiempos de la Prebill |
| honorarios_fijos | HONORARIOS FIJOS | FIXED FEES | cuotas fijas e igualas |
| gastos | GASTOS | EXPENSES | gastos tipo `gasto` (con IVA) |
| reembolsos | REEMBOLSOS | REIMBURSEMENTS | gastos tipo `reembolso` (sin IVA) |

#### `GET /conceptos-factura` — con el artículo de Books de cada idioma

*Respuesta 200*

```json
[{
  "clave": "gastos", "nombre_es": "GASTOS", "nombre_en": "EXPENSES",
  "es": { "item_id": "446794000008967063", "nombre_books": "GASTOS", "origen": "mismo nombre" },
  "en": { "item_id": "446794000010531049", "nombre_books": "EXPENSES", "origen": "mismo nombre" }
}]
```

#### `PATCH /conceptos-factura/:clave` — vincula a otro artículo

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| item_id_es | string | opcional |
| item_id_en | string | opcional |

#### `POST /conceptos-factura/crear-en-books` — crea los artículos que falten

Sin `confirmar=1` solo lista los que faltan (no escribe). Con `{"confirmar":1}` los crea en Books como servicios.

> **Escribe en Books.** Solo con `confirmar=1`.

<a id="tiempos"></a>

## Tiempos

Cada tiempo lleva su **tarea** (igual que el `task_id` / `task_name` del time entry de Books) y si se cobra o no, y **se respalda en Books** como time entry (ver [Respaldo en Books](#respaldo-books)). Al crearlo, la tarifa se resuelve con [la jerarquía](#jerarquia) **en la moneda del proyecto** y se **congela** en `tarifa_aplicada`; cambios posteriores a las tarifas no la recalculan.

#### `GET /tiempos` — admite filtros por query

**Query params (todos opcionales, combinables)**

|  |  |  |  |
|---|---|---|---|
| proyecto_id | abogado_id | liberado | facturado |
| prebill_id | facturable | tarea_estandar_id | books_estado |

`books_estado`: `respaldado` | `pendiente` | `no_aplica` | `anterior` (capturado antes del 2026-10-12).

*curl*

```bash
curl ".../api/tiempos?facturable=1&liberado=0&token=<token>"
```

#### `POST /tiempos`

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| abogado_id | number | requerido |
| proyecto_id | number | requerido |
| fecha | string | requerido, YYYY-MM-DD |
| horas | number | requerido |
| descripcion | string | opcional |
| tarea_estandar_id | number | **una de las tres es requerida** — tarea del [catálogo estándar](#tareas-estandar) (recomendado) |
| zoho_task_id | string | o tarea del Project de Books enlazado (ver [`/proyectos/:id/tareas`](#proyectos)) |
| tarea | string | o texto libre; en Books se crea una tarea con ese nombre si no existe |
| facturable | 0 \| 1 | opcional — omitido = automático (ver abajo) |

**Cómo se resuelve la tarea**

| Mandas | Queda |
|---|---|
| tarea_estandar_id | `tarea` = nombre del catálogo. Si el proyecto está enlazado a Books y allá hay una tarea con el mismo nombre (sin importar acentos ni mayúsculas), también se llena `zoho_task_id`. |
| zoho_task_id | Debe ser una tarea del Project de Books enlazado al proyecto, si no [400]. `tarea` = su nombre en Books; si coincide con una estándar, se liga también `tarea_estandar_id`. |
| tarea | Texto libre; `tarea_estandar_id` queda en `null`. `zoho_task_id` se llena al respaldar. |

**facturable automático**

|  |
|---|
| 1. Si mandas `facturable`, gana. |
| 2. Proyecto de cuota fija o iguala → `0` (lo que se cobra es el honorario fijo). |
| 3. Si no, lo que diga la tarea estándar (ej. "Administración interna" → `0`). |
| 4. Si no, `1`. |

*curl*

```bash
curl -X POST ".../api/tiempos?token=<token>" -H "Content-Type: application/json" \
  -d '{"abogado_id":6,"proyecto_id":8,"fecha":"2026-10-12","horas":2.5,
       "tarea_estandar_id":1,"descripcion":"Revisión del contrato de arrendamiento"}'
```

*Respuesta 201*

```json
{
  "id": 73, "abogado_id": 6, "proyecto_id": 8,
  "fecha": "2026-10-12", "horas": 2.5, "descripcion": "Revisión del contrato de arrendamiento",
  "tarea_estandar_id": 1, "tarea": "Asesoría y consulta", "tarea_codigo_utbms": "C300",
  "zoho_task_id": "446794000050250005",
  "facturable": 1, "tarifa_aplicada": 800, "moneda": "MXN",
  "tarifa_nivel": "tipo", "tarifa_id": 3,
  "liberado": 0, "prebill_id": null, "facturado": 0,
  "zoho_id": "446794000050252004",
  "zoho_time_entry_id": "446794000050252004",
  "books_estado": "respaldado", "books_error": null,
  "books_sincronizado_en": "2026-10-12T15:54:57.884Z", "books_aprobacion": null,
  "status": "capturado", "importe": 2000,
  "abogado_nombre": "Prueba Email QA", "abogado_zoho_user_id": "446794000000052001",
  "proyecto_nombre": "Avolar General", "proyecto_tipo_cobro": "horas",
  "cliente_zoho_id": "446794000018976759",
  "proyecto_zoho_id": "446794000019007841", "proyecto_zoho_nombre": "00001.002 Avolar - General", "proyecto_zoho_codigo": "1173"
}
```

*Respuesta 409 — sin enlace a Books*

```json
{
  "error": "Juan Perez no tiene usuario de Books. Cada tiempo se respalda en Books a nombre de su abogado, así que primero hay que enlazarlo (Abogados > Editar)."
}
```

*Respuesta 422 — sin tarifa en la moneda del proyecto*

```json
{
  "error": "Pedro Paralegal no tiene tarifa asignada en USD para \"Contrato de distribución\". No hay tarifa en USD en ningún nivel (proyecto, cliente, abogado, nivel del abogado ni general). Agrégala en Tarifas antes de capturar este tiempo."
}
```

`status`: `capturado` → `liberado` → `en_prebill` → `facturado`, o `no_facturable` (se registra pero nunca se libera ni entra a una Prebill). `importe` = `horas × tarifa_aplicada`; en un no facturable es el valor del tiempo, no un cobro. `tarifa_nivel` / `tarifa_id` dicen de qué tarifa salió. Tiempos capturados antes del 2026-10-02 traen la tarea y `tarifa_nivel` en `null`. Si Books no respondió, el tiempo **sí se guarda** (201) con `books_estado: "pendiente"` y la razón en `books_error`.

#### `GET /tiempos/:id`

#### `PATCH /tiempos/:id` — fecha / horas / descripcion / tarea_estandar_id / zoho_task_id / tarea / facturable

Si cambias la tarea sin mandar `facturable`, se recalcula con la regla automática. La tarifa no se recalcula. El cambio se manda al mismo time entry de Books (si falla, queda `pendiente`).

> **409** si ya está `facturado` o ya tiene `prebill_id`: `"No editable/eliminable: ya está facturado o incluido en una Prebill"`.

#### `DELETE /tiempos/:id` — mismo candado que PATCH; también lo borra en Books

Primero se borra el time entry en Books. Si Books no deja borrarlo, responde [502] y **tampoco se borra aquí**, para que no queden tiempos huérfanos en Books. Si en Books ya no existía, se borra aquí normalmente.

<a id="respaldo-books"></a>

### Respaldo en Books

Books tiene que tener cada tiempo. Al capturarlo aquí se crea su time entry en el proyecto de Books enlazado, a nombre del usuario de Books del abogado, en la tarea con el mismo nombre (sin importar acentos ni mayúsculas; si no existe, se crea). Si ese usuario no está asignado al proyecto de Books, se asigna (con la tarifa del tiempo en proyectos por horas del personal; en los demás tipos Books no acepta tarifa por usuario). Se manda fecha, horas (`HH:MM`), si es facturable y la descripción como nota (máx. 500 caracteres).

| books_estado | Qué significa |
|---|---|
| respaldado | Existe en Books; `zoho_time_entry_id` es su id. |
| pendiente | Se guardó aquí pero Books falló o falta algo; la razón está en `books_error`. Se reintenta cada noche (23:15), con el botón de la pantalla "Ver lo capturado" o con la API. **Bloquea facturar** la Prebill que lo incluya. |
| no_aplica | Datos `[DEMO]`: no se mandan a Books. |
| anterior | Capturado antes del 2026-10-12. Se factura sin ligarse a un time entry (aviso en la vista de factura). |

**Requisitos (si falta uno, la captura responde 409)**

|  |
|---|
| El proyecto está enlazado a un proyecto de Books (`zoho_project_id`), y ese proyecto es del mismo cliente. |
| El abogado está enlazado a un usuario de Books (`zoho_user_id`) y ese usuario está activo. **Salvo** que el despacho no lo exija ([`respaldo.exigir_usuario_books = false`](#config-despacho)): entonces el tiempo va a nombre del usuario de Books por omisión, con `[Nombre del abogado]` al inicio de la nota. |
| El tiempo tiene tarea ([400] si no). |

> **Aprobación de horas.** Si el proyecto de Books exige aprobar las horas, Books no deja facturar un tiempo sin aprobar (code 20102), y la API de Books no permite aprobarlo. `books_aprobacion` guarda el estado (`null` = el proyecto no lo exige); la vista de factura lo vuelve a consultar y bloquea hasta que se aprueben en Books (Hojas de horas) o se quiten de la Prebill.

#### `GET /tiempos/respaldo-books` — cuántos tiempos hay en cada estado

*Respuesta 200*

```json
{ "anterior": 10, "no_aplica": 13, "respaldado": 6 }
```

Solo aparecen los estados que tienen al menos un tiempo.

#### `POST /tiempos/respaldar-pendientes` — reintenta todos los pendientes

*Respuesta 200*

```json
{
  "revisados": 2, "respaldados": 1,
  "siguen_pendientes": [ { "tiempo_id": 80, "error": "El proyecto \"Proyecto desde HTML\" está enlazado a \"General\", que en Books es de otro cliente…" } ]
}
```

Es lo mismo que corre el cron nocturno (`reintentarBooks.js`).

#### `POST /tiempos/:id/respaldar` — respalda (o vuelve a mandar) uno

Responde el tiempo con un campo extra `respaldo`: `{ "ok": true, "estado": "respaldado", "zoho_time_entry_id": "…", "tarea_creada": false, "usuario_asignado": false, "usuario_por_omision": false }`. Si no se pudo, [502] con `respaldo.error` y el tiempo queda `pendiente`. Si ya estaba respaldado, actualiza el mismo time entry.

<a id="gastos"></a>

## Gastos

Monto directo, con categoría, si se cobra al cliente y quién lo pagó. Mismo ciclo que los tiempos.

#### `GET /gastos` — filtros: proyecto_id, liberado, facturado, prebill_id, categoria_id, facturable, abogado_id, pagado_por, reembolso_estado

#### `POST /gastos`

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| proyecto_id | number | requerido |
| fecha | string | requerido, YYYY-MM-DD |
| monto | number | requerido, mayor que 0 |
| descripcion | string | opcional |
| categoria_id | number | opcional — ver [categorías](#categorias-gasto) |
| tipo | string | opcional — `gasto` (con IVA, genera CFDI) \| `reembolso` (sin IVA, no genera CFDI); omitido = el de la categoría |
| facturable | 0 \| 1 | opcional, default 1 — 0 = lo absorbe el despacho |
| pagado_por | string | opcional — `despacho` (default) \| `caja_chica` \| `abogado` |
| abogado_id | number | opcional — quién lo realizó; **requerido** si `pagado_por=abogado` |

*Respuesta 201*

```json
{
  "id": 22, "proyecto_id": 18, "fecha": "2026-09-24",
  "monto": 640, "moneda": "MXN", "descripcion": "Taxis a juzgados",
  "categoria_id": 5, "categoria_nombre": "Transporte local", "categoria_codigo_utbms": "E109",
  "tipo": "gasto",
  "facturable": 1,
  "pagado_por": "abogado", "abogado_id": 15, "abogado_nombre": "Luis Asociado",
  "reembolso_estado": "pendiente", "reembolsado_en": null,
  "liberado": 0, "prebill_id": null, "facturado": 0,
  "zoho_id": null, "status": "capturado", "cliente_zoho_id": "446794000015629019"
}
```

`status`: `capturado` → `liberado` → `en_prebill` → `facturado`, o `no_facturable` (nunca se libera ni entra a una Prebill). `reembolso_estado` solo existe si lo pagó un abogado: `pendiente` o `reembolsado`.

#### `GET /gastos/:id`

#### `PATCH /gastos/:id` — fecha / monto / descripcion / categoria_id / tipo / facturable / pagado_por / abogado_id

Pasar a `facturable=0` lo saca de "liberado". Cambiar `pagado_por` a `abogado` crea el reembolso pendiente; cambiarlo a otro lo quita. El proyecto no se edita (fija la moneda).

> **409** si ya está facturado o en una Prebill.

#### `DELETE /gastos/:id` — bloqueado si facturado o en una Prebill

#### `GET /reembolsos` — gastos pagados por abogados, pendientes de reembolso

*Respuesta 200*

```json
[{
  "abogado_id": 15, "abogado_nombre": "Luis Asociado", "moneda": "MXN",
  "total": 640,
  "gastos": [ /* gastos pendientes, con su estado con el cliente */ ]
}]
```

Agrupado por abogado y moneda.

#### `POST /gastos/:id/reembolso` — marca el reembolso al abogado

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| fecha | string | opcional, default hoy |

Funciona aunque el gasto ya esté en una Prebill o facturado: el reembolso al abogado es independiente del cobro al cliente. [409] si no lo pagó un abogado o ya estaba reembolsado.

#### `DELETE /gastos/:id/reembolso` — deshace: regresa a pendiente

<a id="cargos-fijos"></a>

## Honorarios fijos e igualas

Tercer tipo de línea de una Prebill, con el mismo ciclo que tiempos y gastos (capturado → liberado → en Prebill → facturado). Para proyectos de **cuota fija** (el cargo completo o por hitos, ej. "Anticipo 50%") y de **iguala mensual** (un cargo por mes).

#### `GET /cargos-fijos` — filtros: proyecto_id, liberado, facturado, prebill_id

*Respuesta 200*

```json
[{
  "id": 10, "proyecto_id": 20, "fecha": "2026-10-01",
  "concepto": "Iguala 2026-10", "monto": 25000, "moneda": "MXN",
  "periodo": "2026-10",
  "proyecto_nombre": "Iguala corporativa mensual", "proyecto_tipo_cobro": "iguala",
  "liberado": 0, "prebill_id": null, "facturado": 0,
  "zoho_id": null, "status": "capturado", "cliente_zoho_id": "446794000015629019"
}]
```

`periodo` (YYYY-MM) solo lo llevan las igualas.

#### `POST /cargos-fijos` — cargo manual (cuota fija o hito)

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| proyecto_id | number | requerido |
| monto | number | opcional — omitido = `honorario_fijo` del proyecto |
| concepto | string | opcional, default "Honorarios (cuota fija)" |
| fecha | string | opcional, default hoy |

#### `POST /igualas/generar` — genera la iguala del mes para todos los proyectos con iguala

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| periodo | string | opcional — YYYY-MM, default el mes actual |

*Respuesta 200*

```json
{ "periodo": "2026-10", "creados": [20], "ya_existian": [] }
```

Idempotente: correrlo dos veces para el mismo mes no duplica (el proyecto aparece en `ya_existian`).

#### `GET /cargos-fijos/:id`

#### `PATCH /cargos-fijos/:id` — fecha / concepto / monto

#### `DELETE /cargos-fijos/:id` — bloqueado si facturado o en una Prebill

<a id="liberaciones"></a>

## Liberaciones

Acción, no un catálogo: marca tiempos, gastos y honorarios fijos de un rango de fechas como listos para entrar a una Prebill. No crea ni borra registros, solo cambia la bandera `liberado`. Los tiempos **no facturables nunca se liberan**.

#### `POST /liberaciones`

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| desde | string | requerido, YYYY-MM-DD |
| hasta | string | requerido, YYYY-MM-DD |
| cliente_id | string | opcional — sin esto, libera de todos los clientes |

*Respuesta 200*

```json
{ "tiempos_liberados": 7, "gastos_liberados": 5, "cargos_fijos_liberados": 3 }
```

<a id="disponible"></a>

## Disponible para Prebill

Lo que ya está liberado, sin facturar y sin asignar a otra Prebill, para un cliente + moneda — es el mismo cálculo que alimenta el paso 2 del asistente en la UI HTML.

#### `GET /liberado-disponible` — ?cliente_id=&moneda=

*Respuesta 200*

```json
{ "tiempos": [ /* solo facturables */ ], "gastos": [ ], "cargos_fijos": [ ] }
```

<a id="prebills"></a>

## Prebills — crear y listar

Una Prebill agrupa tiempos, gastos y honorarios fijos liberados de **un cliente y una moneda** (nunca se mezclan). Nace en estado `borrador`.

#### `GET /prebills` — lista todas, con totales ya calculados

#### `POST /prebills`

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| cliente_id | string | requerido |
| moneda | string | requerido |
| cliente_nombre | string | opcional, se resuelve de Books |
| tiempo_id | number[] | opcional — ids de [disponible](#disponible) a incluir |
| gasto_id | number[] | opcional |
| cargo_fijo_id | number[] | opcional — honorarios fijos / igualas |

Un id que no esté liberado, ya facturado, ya en otra Prebill, **o que no sea del mismo cliente/moneda que esta Prebill, o un tiempo no facturable**, se ignora (no rompe la petición) — pero se reporta de vuelta en `ids_ignorados: { tiempo_id: [...], gasto_id: [...], cargo_fijo_id: [...] }` junto con la Prebill creada, para que se note que algo no entró.

<a id="prebill-detalle"></a>

## Prebills — detalle y eliminar

#### `GET /prebills/:id` — totales + líneas incluidas

*Respuesta 200*

```json
{
  "id": 3, "cliente_nombre": "00002 Go Sharp Technologies…",
  "moneda": "MXN", "status": "facturada",
  "invoice_number": "INV-000861",
  "totales": {
    "subtotalHonorariosHoras": 35450, "subtotalHonorariosFijos": 72500,
    "subtotalHonorarios": 107950, "subtotalGastos": 9120,
    "descuento": 10795, "ajuste": 0,
    "honorariosFinal": 97155, "total": 106275
  },
  "responsables": {
    "facturacion": { "nombres": ["Laura Romero M."], "fuente": "campo_cliente", "texto": "Laura Romero M." },
    "cobranza": { "nombres": [], "fuente": null, "texto": "Sin responsable" }
  },
  "cfdi": { "factura": { "numero": "INV-000861", "status": "draft" }, "aplica": false, "motivo": "…solo cuenta con la factura pagada" },
  "tiempos": [ /* líneas de tiempo incluidas, con su tarea */ ],
  "gastos": [ /* líneas de gasto incluidas */ ],
  "cargos_fijos": [ /* honorarios fijos incluidos */ ]
}
```

`responsables`: ver [Responsables](#responsables). `cfdi` es `null` si la Prebill no está facturada; ver [CFDI](#cfdi).

#### `DELETE /prebills/:id`

> Solo funciona en `borrador` — en cualquier otro estado responde [409] `"Solo se puede eliminar una Prebill en estado Borrador"`. Al borrar, libera sus líneas (`prebill_id = NULL`) para que puedan usarse en otra Prebill.

<a id="prebill-lineas"></a>

## Prebills — agregar y quitar líneas

Agrega o quita tiempos, gastos y honorarios fijos de una Prebill **antes de facturarla** y también **ya facturada**, mientras su factura siga en borrador en Books. En ese caso se actualiza la factura en Books en el mismo momento.

| Estado | ¿Se pueden cambiar las líneas? |
|---|---|
| borrador · en_revision · autorizada | Sí. Solo cambia la Prebill. |
| facturada, factura en borrador | Sí. Se rearma la factura (con el modo del despacho) y se reemplazan sus líneas en Books en dos pasos (primero sin tiempos ligados, luego con ellos) y se verifica que Books devuelva ligados todos los tiempos esperados. Si algo falla, el cambio se revierte. |
| facturada, factura enviada, con pagos, vencida o anulada | No. [409] con la razón. |
| facturando | No, hasta que termine. |

#### `GET /prebills/:id/edicion` — ¿se puede editar ahora? (consulta la factura en Books)

*Respuesta 200 — factura en borrador*

```json
{
  "prebill_id": 7, "editable": true, "etapa": "factura_borrador",
  "motivo": "La factura INV-000863 sigue en borrador en Books; los cambios se aplican también a la factura.",
  "factura": { "numero": "INV-000863", "status": "draft", "enviada": false, "pagado": 0, "total": 122998.6, "moneda": "MXN" }
}
```

*Respuesta 200 — factura enviada*

```json
{
  "prebill_id": 3, "editable": false, "etapa": "bloqueada",
  "motivo": "La factura INV-000861 ya no se puede modificar: en Books está en estado \"sent\", ya se envió."
}
```

`etapa`: `prebill` (antes de facturar), `factura_borrador` o `bloqueada`.

#### `GET /prebills/:id/disponible` — lo que se le puede agregar

Liberado, sin facturar, no facturable excluido, del mismo cliente y moneda que la Prebill. Responde `{ tiempos, gastos, cargos_fijos }`.

#### `PATCH /prebills/:id/lineas` — aplica altas y bajas

**Body (todos opcionales, listas de ids)**

|  |  |  |
|---|---|---|
| agregar_tiempo_id | quitar_tiempo_id | agregar_gasto_id |
| quitar_gasto_id | agregar_cargo_fijo_id | quitar_cargo_fijo_id |

*curl*

```bash
curl -X PATCH ".../api/prebills/7/lineas?token=<token>" -H "Content-Type: application/json" \
  -d '{"agregar_tiempo_id":[72],"quitar_gasto_id":[24]}'
```

*Respuesta 200 — ya facturada*

```json
{
  "id": 7, "status": "facturada", "etapa": "factura_borrador",
  "movimientos_aplicados": [
    { "accion": "agregar", "tipo": "tiempo", "registro_id": 72 },
    { "accion": "quitar", "tipo": "gasto", "registro_id": 24 }
  ],
  "factura_actualizada": {
    "numero": "INV-000863",
    "subtotal_books": 112165, "impuestos_books": 16610.4, "total_books": 128775.4,
    "subtotal_esperado": 112165, "cuadra": true
  },
  "totales": { /* ... */ }
}
```

Lo quitado vuelve a quedar liberado y sin facturar, disponible para otra Prebill. Los ids que no se pueden aplicar (de otro cliente o moneda, no liberados, no facturables, o que no estaban en la Prebill) se ignoran y se reportan en `ids_ignorados` (incluye `quitar_*`). `factura_actualizada.cuadra` compara el subtotal que devolvió Books con el esperado.

> [409] si ya no es editable, si otra edición de la misma Prebill está en curso, si la factura quedaría sin líneas (usa [Deshacer factura](#prebill-estado)), o si la factura no se puede rearmar (ej. un proyecto sin IVA). En todos esos casos **no se aplica ningún cambio**, ni local ni en Books.

#### `GET /prebills/:id/movimientos` — bitácora de altas y bajas

*Respuesta 200*

```json
[{
  "id": 4, "prebill_id": 7, "fecha": "2026-10-03T00:46:28.511Z",
  "accion": "quitar", "tipo": "tiempo", "registro_id": 72,
  "importe": 6000, "moneda": "MXN",
  "etapa": "factura_borrador", "estado_prebill": "facturada",
  "factura_numero": "INV-000863", "origen": "web"
}]
```

<a id="prebill-descuento"></a>

## Prebills — descuento y ajuste

Ambos se aplican **solo sobre el subtotal de honorarios** (por hora + fijos), nunca sobre gastos — regla de negocio confirmada explícitamente para este sistema.

#### `PATCH /prebills/:id/descuento-ajuste`

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| descuento_tipo | string | `"monto"` \| `"porcentaje"` \| vacío/omitido |
| descuento_valor | number | monto fijo o % según el tipo |
| ajuste_tipo | string | mismos valores — sube el total |
| ajuste_valor | number |  |

> Solo editable en `borrador`. En cualquier otro estado: [409] `"Solo se puede editar en estado Borrador"` — validado en el servidor, no solo escondido en la interfaz.

<a id="factura"></a>

## Cómo se arma la factura

Lo mismo que se ve en la vista previa es lo que se manda a Books. Hay tres formatos y el despacho elige uno en [`factura.modo`](#config-despacho); el total antes de impuestos es el mismo en los tres.

| Regla | Detalle |
|---|---|
| `concepto` — resumida (omisión) | Una línea por concepto: HONORARIOS = suma de todos los tiempos; HONORARIOS FIJOS; GASTOS; REEMBOLSOS. Con el artículo de Books del idioma de la factura. |
| `tarea` — por tarea  *(nuevo)* | Como la resumida, pero los honorarios van en **una línea por tarea**, con sus horas sumadas: `"Prebill #9 -- Asesoría y consulta -- 3.5 h"`. Gastos, fijos y reembolsos siguen en una línea por concepto. Un tiempo sin tarea (anterior) va en "Sin tarea". |
| `detallado` — por cada tiempo | Una línea por cada tiempo, gasto, reembolso y cargo fijo, con la descripción `" : 02 sep 2026 : texto"`. Un tiempo va como cantidad = horas y precio = tarifa (si Books lo puede representar exacto con 2 decimales; si no, 1 × importe). El ajuste va en una línea aparte, "Ajuste de honorarios" ("Fee adjustment"), una por cada IVA. Con `lineas_detalladas = "sin_articulo"` las líneas van sin artículo (con `name`) y no se bloquea por artículos faltantes. |
| Ligada a los tiempos de Books  *(nuevo)* | Cada línea de honorarios lleva `time_entry_ids` (arreglo) y `project_id`; Books marca esos tiempos como facturados y los desmarca si se deshace la factura. Books solo acepta tiempos de **un** proyecto por línea, así que si la Prebill tiene tiempos de varios proyectos de Books, los honorarios se parten por proyecto (con el nombre del proyecto en la descripción). |
| Idioma | Lo más específico gana: el elegido para esta Prebill (`PATCH /prebills/:id/idioma`), si no el configurado para el cliente, si no el del cliente en Books. |
| IVA | El del proyecto, si no el del cliente. Aplica a todo menos REEMBOLSOS. En el formato por concepto, si hay proyectos con IVA distinto, ese concepto se parte en una línea por IVA. |
| Descuento / ajuste | Solo sobre honorarios y honorarios fijos, repartido en proporción; el descuento va por línea antes de impuestos. El ajuste se suma a las líneas en el formato por concepto y va en línea aparte en el detallado. |
| Moneda | La de la Prebill (una sola). Depende de la versión de Books: hay versiones que facturan en la moneda que se les manda y otras que **siempre usan la del cliente**. Se configura por organización (`permiteMonedaDistintaAlCliente`); el sandbox actual (versión "global") **no lo permite**, verificado con una factura real, así que ahí la Prebill debe estar en la moneda del cliente en Books. Cuando sí se permite, se verifica la respuesta de Books y, si cambió la moneda, se borra ese borrador y se avisa. Se manda `currency_id` + `exchange_rate` (FIX de Banxico o el capturado). |
| Bloquea | Proyecto sin IVA, concepto sin artículo en Books (salvo detallada sin artículo), moneda de la Prebill distinta a la del cliente en Books, sin tipo de cambio, tiempos `pendiente` de respaldo, o tiempos sin aprobar en Books. Después de crear la factura se compara su subtotal con la vista previa; si no cuadra, se borra ese borrador y responde [409]. `POST /estado` a facturada responde [409] con la razón. |

#### `GET /prebills/:id/vista-factura` — vista previa, no escribe nada

*Respuesta 200*

```json
{
  "prebill_id": 7, "moneda": "MXN", "currency_id": "446794000000052020",
  "tipo_cambio": null, "idioma": "es", "idioma_origen": "Books",
  "modo_factura": "concepto", "lineas_detalladas": null,
  "lineas": [
    { "concepto": "honorarios", "nombre": "HONORARIOS", "tax_id": "446794000008083135", "iva": "IVA 16%",
      "subtotal": 35750, "ajuste": 0, "descuento": 3575, "importe": 32175, "description": "Prebill #7 -- 14 h",
      "tarea": null, "zoho_project_id": "446794000019007841",
      "time_entry_ids": ["446794000050252004", "446794000050241008"] },
    { "concepto": "honorarios_fijos", "nombre": "HONORARIOS FIJOS", "iva": "IVA 16%", "subtotal": 72500, "descuento": 7250, "importe": 65250 },
    { "concepto": "gastos", "nombre": "GASTOS", "iva": "IVA 16%", "subtotal": 1410, "descuento": 0, "importe": 1410 },
    { "concepto": "reembolsos", "nombre": "REEMBOLSOS", "tax_id": null, "iva": "sin IVA", "subtotal": 8350, "importe": 8350 }
  ],
  "total_antes_de_impuestos": 107185,
  "avisos": [],
  "bloqueantes": []
}
```

*Una línea en formato detallado*

```json
{
  "concepto": "honorarios", "nombre": "HONORARIOS PROFESIONALES", "item_id": "446794000008967051",
  "registro_tipo": "tiempo", "registro_id": 81,
  "cantidad": 2.5, "precio": 3500, "rate": 8750,
  "descuento": 875, "importe": 7875, "iva": "IVA 16%",
  "description": " : 28 sep 2026 : Asesoría y consulta: Revisión del contrato"
}
```

En todos los formatos `cantidad × precio = rate` e `importe = rate − descuento`. En los formatos por concepto y por tarea `cantidad` siempre es 1. `tarea` solo se llena en el modo por tarea. `time_entry_ids` está vacío en líneas que no son de tiempos o con tiempos anteriores al respaldo.

#### `PATCH /prebills/:id/tipo-cambio` — tipo de cambio manual (moneda distinta a MXN)

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| tipo_cambio | number | vacío = FIX de Banxico al facturar |

Editable hasta `autorizada`. Al facturar se guarda en la Prebill el tipo de cambio usado (`tipo_cambio`, `tipo_cambio_fuente`).

#### `PATCH /prebills/:id/idioma` — idioma de esta factura

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| idioma | string | es \| en \| vacío (= el del cliente) |

Mismas reglas que [las líneas](#prebill-lineas): antes de facturar, o con la factura en borrador en Books (se rearma con los artículos del otro idioma y se actualiza; si Books falla, se revierte). [409] si la factura ya se envió o tiene pagos.

<a id="prebill-estado"></a>

## Prebills — cambiar estado

Aquí se crea la factura en Books, al llegar a `facturada`. Las otras escrituras en Books son el [respaldo de cada tiempo](#respaldo-books) (y las tareas que haga falta crear) y [`sincronizar-tareas`](#proyectos) con `confirmar=1`.

#### `POST /prebills/:id/estado`

**Body**

|  |  |  |
|---|---|---|
| nuevo_estado | string | requerido — debe ser exactamente el siguiente estado, ver abajo |

> **Transición estrictamente hacia adelante.** Pedir un estado que no sea el inmediato siguiente responde [409] `Transición inválida (esperaba pasar a "X")` — no se puede saltar Borrador → Facturada.

> **A prueba de doble clic.** Al llegar a `facturada`, la transición se "reclama" con un UPDATE atómico antes de llamar a Books. Dos peticiones casi simultáneas nunca crean dos Invoices: la que pierde la carrera recibe [409] `"Esta Prebill ya está siendo facturada por otra petición (o cambió de estado) -- refresca antes de reintentar"`. Si Books falla a mitad del proceso, la Prebill vuelve sola a `autorizada` en vez de quedar atorada.

Al pasar a `facturada`: crea la Invoice en Books (`POST /invoices`, con el modo del despacho y ligada a los time entries, ver [Cómo se arma la factura](#factura)), guarda `invoice_id`/`invoice_number` en la Prebill, y marca `facturado=1` en todas sus líneas.

*Respuesta 200*

```json
{
  "id": 3, "status": "facturada",
  "invoice_id": "446794000048776023",
  "invoice_number": "INV-000861",
  "totales": { /* … */ }
}
```

#### `POST /prebills/:id/deshacer-factura` — borra la Invoice si sigue en borrador y reabre la Prebill

Solo si en Books la factura sigue en **borrador**, sin enviar, sin pagos y con referencia `Prebill-N`; si no, [409] (anúlala en Books). La borra y regresa la Prebill a `autorizada` con sus líneas sin facturar. Responde la Prebill con `factura_borrada`.

> **Escribe en Books** (borra la factura).

<a id="config-despacho"></a>

## Configuración del despacho

Cómo trabaja este despacho: formato de factura, si se exige usuario de Books para capturar, de dónde salen los responsables y quién lleva los CFDI. Nació de la prueba con un cliente real que factura una línea por tiempo, tiene a sus analistas asignados por proyecto y guarda sus CFDI en Zoho Creator. Solo se guarda lo que se cambia; lo demás toma los valores por omisión, que son el comportamiento original. También se edita en la pantalla `/reportes/sandbox-wip/configuracion`.

#### `GET /config-despacho` — configuración actual y valores válidos

*Respuesta 200 (valores por omisión)*

```json
{
  "config": {
    "factura": { "modo": "concepto", "lineas_detalladas": "con_articulo" },
    "respaldo": { "exigir_usuario_books": true, "usuario_books_omision": "" },
    "responsables": {
      "facturacion": { "fuentes": [ { "tipo": "campo_cliente", "campo": "cf_analista_de_facturaci_n" }, { "tipo": "local" } ] },
      "cobranza": { "fuentes": [ { "tipo": "campo_cliente", "campo": "cf_analista_de_cobranza" }, { "tipo": "local" } ] },
      "rol_wip": "facturacion"
    },
    "cfdi": {
      "proveedor": "interno", "solo_pagadas": true,
      "creator": { "token_key": "", "account_owner": "", "app": "",
        "reporte_timbrados": "CFDI_v33_Timbrados", "reporte_cancelados": "CFDI_v33_Cancelados",
        "campos": { "factura": "invoice", "serie": "serieCFDI", "folio": "Folio", "uuid": "timUUID",
          "total": "Total_CFDI", "moneda": "moneda", "tipo_cambio": "tipoCambio", "fecha": "fechaFactura" } }
    }
  },
  "opciones": { /* tipos de fuente, roles, modos de factura y proveedores, con su etiqueta */ }
}
```

#### `PATCH /config-despacho` — cambio parcial

**Campos**

| Campo | Valores |
|---|---|
| factura.modo | `concepto` (resumida) \| `tarea` (una línea de honorarios por tarea) \| `detallado` (una por tiempo) |
| respaldo.exigir_usuario_books | `true` (omisión): un abogado sin usuario activo de Books no captura ([409]) \| `false`: captura a nombre del usuario por omisión |
| respaldo.usuario_books_omision | `user_id` de Books (solo dígitos); **obligatorio** si `exigir_usuario_books` es `false` |
| factura.lineas_detalladas | `con_articulo` \| `sin_articulo` |
| responsables.facturacion.fuentes | lista de 1 a 5 fuentes, en orden (ver [Responsables](#responsables)); se reemplaza completa |
| responsables.cobranza.fuentes | igual |
| responsables.rol_wip | `facturacion` \| `cobranza`: por cuál agrupa el reporte WIP |
| cfdi.proveedor | `ninguno` \| `interno` \| `creator`; con `creator` son obligatorios `token_key` (key de Donatello), `account_owner`, `app` y `reporte_timbrados` |
| cfdi.solo_pagadas | `true` (omisión) \| `false` |
| formatos.* | membrete y datos de pago de los formatos imprimibles; ver [Membrete y datos de pago](#formato-membrete) |

*curl — factura detallada*

```bash
curl -X PATCH ".../api/config-despacho?token=<token>" -H "Content-Type: application/json" \
  -d '{"factura":{"modo":"detallado","lineas_detalladas":"con_articulo"}}'
```

[400] con una sección desconocida o un valor inválido (el mensaje dice cuál). Responde `{ "config": … }` completa.

#### `POST /config-despacho/restablecer` — vuelve a los valores por omisión

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| seccion | string | opcional — `factura` \| `respaldo` \| `responsables` \| `cfdi` \| `formatos`; sin ella, todo |

<a id="responsables"></a>

## Responsables de facturación y cobranza

Cada rol tiene una lista de fuentes que se prueban en orden; gana la primera que dé al menos un nombre. Puede haber varias personas en un rol (por ejemplo, dos analistas asignados al mismo proyecto): se devuelven todas y el texto las une con " + ".

| Fuente (`tipo`) | Parámetro | De dónde sale |
|---|---|---|
| campo_cliente | `campo`, ej. `cf_analista_de_facturaci_n` | Campo personalizado del contacto en Books (así trabaja este sandbox). |
| rol_proyecto | `rol`, ej. `Admin Firm` | Usuarios de Books con ese rol en el Project enlazado al proyecto (así trabaja EC Legal). Sin mayúsculas/minúsculas. Una llamada a Books por proyecto, caché de 30 min. |
| local | — | Asignaciones capturadas aquí; la de proyecto le gana a la de cliente. Solo abogados marcados (ver abajo). |

> **Quién puede ser responsable local (2026-11-13).** Solo un abogado registrado, activo y con `responsable` marcado en [Abogados](#abogados): `facturacion` cubre facturación, `cobranza` cubre cobranza y `general` cubre los dos. Se guarda el nombre que muestra `GET /abogados` (`zoho_user_nombre`, si no `nombre`). Quitarle la marca después no borra sus asignaciones: siguen contando en el resolver hasta que se borren. Las fuentes `campo_cliente` y `rol_proyecto` vienen de Books y no se filtran.

#### `GET /responsables/resolver` — ?cliente_id=&proyecto_id= — quién es responsable

*Respuesta 200*

```json
{
  "facturacion": { "nombres": ["AM - Alberti Martinolli", "Luis Fonsi"], "fuente": "rol_proyecto", "texto": "AM - Alberti Martinolli + Luis Fonsi" },
  "cobranza": { "nombres": ["Ana Cobranza"], "fuente": "local", "texto": "Ana Cobranza" }
}
```

Al menos uno de los dos parámetros ([400] sin ninguno); con solo `proyecto_id` el cliente sale del proyecto. Sin nombre en ninguna fuente: `"fuente": null`, `"texto": "Sin responsable"`.

#### `GET /responsables` — asignaciones locales

*Respuesta 200*

```json
[{
  "id": 4, "rol": "cobranza", "cliente_id": "446794000015629019", "proyecto_id": null,
  "nombre": "AM - Alberti Martinolli", "abogado_id": 6, "abogado_cubre_rol": true,
  "creado_en": "2026-11-13T18:05:12.000Z",
  "proyecto_nombre": null, "proyecto_cliente_nombre": null,
  "zoho_id": null, "cliente_zoho_id": "446794000015629019", "status": "activo"
}]
```

`abogado_id` es `null` en las asignaciones de nombre libre anteriores al 2026-11-13. `abogado_cubre_rol`: `true` si el abogado sigue activo y marcado para ese rol, `false` si ya no (la asignación sigue contando), `null` sin abogado.

#### `POST /responsables` — asigna a un cliente o a un proyecto

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| rol | string | requerido — `facturacion` \| `cobranza` \| `ambos` (solo abogados `general`) |
| abogado_id | integer | requerido — abogado activo y marcado para el rol |
| cliente_id | string | contact_id de Books |
| proyecto_id | number | gana sobre cliente_id; el cliente se toma del proyecto |

**Respuestas**

| Status | Cuándo |
|---|---|
| [201] | Creada. Con un rol responde la asignación; con `ambos`, `{ "rol": "ambos", "asignaciones": […] }` con las dos, y `ya_existia: true` en la que ya estaba (no es error). |
| [400] | Rol inválido, sin `abogado_id` (también si mandas `nombre`: ya no se aceptan nombres libres), `abogado_id` no entero, o sin `cliente_id` ni `proyecto_id`. |
| [403] | El abogado no está marcado, o su marca no cubre el rol (ej. `facturacion` pedido como cobranza, o `ambos` sin ser `general`). |
| [404] | El abogado o el proyecto no existe. |
| [422] | El abogado está inactivo. |
| [409] | La asignación ya existe (mismo rol, cliente/proyecto y abogado o nombre). Con `ambos`, solo si ya existían las dos. |

*curl — un abogado general en los dos roles*

```bash
curl -X POST ".../api/responsables?token=<token>" -H "Content-Type: application/json" \
  -d '{"rol":"ambos","abogado_id":6,"cliente_id":"446794000015629019"}'
```

*Respuesta 201*

```json
{
  "rol": "ambos",
  "asignaciones": [
    { "id": 3, "rol": "cobranza", "nombre": "AM - Alberti Martinolli", "abogado_id": 6, "ya_existia": false, /* … */ },
    { "id": 2, "rol": "facturacion", "nombre": "AM - Alberti Martinolli", "abogado_id": 6, "ya_existia": true, /* … */ }
  ]
}
```

*Respuesta 403*

```json
{ "error": "Prueba Email QA está marcado como \"Solo facturación\"; no puede ser responsable de cobranza. Cámbialo en Abogados (\"Puede ser responsable\")." }
```

#### `DELETE /responsables/:id` — borra la asignación

<a id="cfdi"></a>

## CFDI

El CFDI se liga a la factura de Books por su número (`INV-…`). Este sistema no timbra: lee los CFDI de la app del despacho en Creator o de un registro propio. **El CFDI solo cuenta cuando la factura está pagada en Books** (`cfdi.solo_pagadas`); en cualquier otro estado la validación responde `"aplica": false` con el motivo.

| Validación | Severidad | Cuándo |
|---|---|---|
| SIN_CFDI | revisar | no hay CFDI vigente ni cancelado con ese número |
| CFDI_SOLO_CANCELADO | error | solo hay CFDI cancelados |
| CFDI_DUPLICADO | error | más de un CFDI vigente |
| TOTAL_CFDI_DIFIERE | error | misma moneda y los totales difieren en más de 1 |
| MONEDA_CFDI_DIFIERE | error | moneda distinta y el total no cuadra con el tipo de cambio del CFDI |
| CFDI_EN_MXN | aviso | factura en otra moneda timbrada en MXN; total de Books × TC del CFDI = total del CFDI (±0.5%) |

#### `GET /facturas-cfdi` — Prebills facturadas, estado en Books y su CFDI

*Respuesta 200*

```json
{
  "proveedor": "interno", "solo_pagadas": true,
  "facturas": [{
    "prebill_id": 3, "cliente_nombre": "00001 Avolar…",
    "factura": { "numero": "INV-000861", "status": "paid", "total": 1206.4, "moneda": "MXN" },
    "aplica": true,
    "cfdi": { "estado": "vigente", "serie": "A", "folio": "100", "uuid": "…", "total": 1206.4 },
    "problemas": []
  }]
}
```

Con el proveedor `creator` los CFDI se guardan en caché 60 min; `?forzar=1` vuelve a leer. Cada problema trae `tipo`, `severidad`, `descripcion` y `detalle`.

### Registro interno (proveedor `interno`)

#### `GET /cfdi` — ?invoice_number= opcional

#### `POST /cfdi` — registra un CFDI

**Body**

| Campo | Tipo | Notas |
|---|---|---|
| invoice_number | string | requerido — número de la factura en Books |
| serie / folio | string | opcional |
| uuid | string | opcional — formato 8-4-4-4-12, único |
| estado | string | `vigente` (omisión) \| `cancelado` |
| total / tipo_cambio | number | ≥ 0 |
| moneda | string | MXN \| USD \| EUR |
| fecha / notas | string | opcional |

[400] con un dato inválido; [409] si el UUID ya está registrado.

#### `GET /cfdi/:id`

#### `PATCH /cfdi/:id` — mismos campos; ej. `{"estado":"cancelado"}`

#### `DELETE /cfdi/:id` — borra el registro

<a id="formatos"></a>

## Formatos imprimibles

Los formatos de `aptusCFDIRF` que aplican al sandbox, generados con sus propios datos. Los PHP originales leen la Prebill de Zoho Creator y suben el PDF a Creator y a Books, y cada uno trae fijo el membrete de un despacho; aquí la Prebill vive en la base propia y el membrete es configuración. **Ninguna de estas rutas escribe**: leen la base y hacen `GET` a Books (contacto, factura, facturas del cliente).

| Formato | Ruta | Salidas | Equivale a |
|---|---|---|---|
| Prebill carta | `/formatos/prebill/:id?formato=carta` | pdf · html · json | `wsPreBillZB_Moderno`, `_Seplaw_*`, `_Sainz_*`, `_Cervantes_*` |
| Prebill detallado | `/formatos/prebill/:id?formato=detallado` | pdf · html · json | `wsPreBillZB_Moderno_Arochi`, `_RVA` |
| Factura | `/formatos/factura/:prebill_id` · `/formatos/factura?invoice_id=` | pdf · html · json | `wsInvoicePDF_v40_*` |
| Estado de cuenta | `/formatos/estado-cuenta?cliente_id=` | pdf · html · json | `wsEdoCuenta_Arochi`, `_eclegal` |
| LEDES 1998B | `/formatos/ledes/:prebill_id` | txt · json | `wsFileLedes1998B` |

**Parámetros comunes (query string)**

| Parámetro | Valores |
|---|---|
| salida | `pdf` (omisión en la API) \| `html` (omisión en la web; trae barra para imprimir y descargar) \| `json` (los datos con que se arma). LEDES: `txt` (omisión) \| `json`. |
| idioma | `es` \| `en`. Sin él: el de la Prebill, si no el configurado para el cliente, si no el del contacto en Books (como la factura). El estado de cuenta usa el del contacto. |
| descargar | `1` = `Content-Disposition: attachment` con nombre de archivo (ej. `Prebill-9-carta.pdf`); sin él, `inline`. |

> **Errores en JSON.** [400] parámetro inválido (`salida`, `idioma`, `formato`, fechas, ids) · [404] Prebill, factura o cliente inexistente · [405] cualquier método que no sea GET · [409] factura de una Prebill sin facturar · [502] Books no respondió · [503] PDF no disponible (no se encontró Puppeteer; `html` y `json` siguen funcionando). El primer PDF tras reiniciar el servicio tarda unos 30 s; los siguientes, uno o dos.

#### `GET /formatos` — catálogo, configuración del membrete y opciones

Responde `formatos` (clave, nombre, ruta, salidas, `origen_php`), `no_compatibles` (los PHP que no aplican y por qué), `configuracion` (la sección `formatos` del despacho) y `opciones`.

<a id="formato-prebill"></a>

### Prebill

#### `GET /formatos/prebill/:id` — formato=carta | detallado · idioma · salida · descargar

Cualquier estado de la Prebill. `formato` omitido = `formatos.prebill_formato` del despacho. La **carta** trae I. honorarios, II. honorarios fijos, III. gastos, IV. reembolsos, descuento/ajuste, subtotal, IVA, total, importe con letra, datos bancarios y firma, y en un anexo la relación de servicios por proyecto, el resumen por abogado, los fijos y los gastos. El **detallado** trae resúmenes por proyecto, abogado (con su nivel) y tipo de cargo, totales y el detalle de servicios con el código UTBMS de cada tarea.

*curl*

```bash
curl -o prebill.pdf "https://aptuslegal.app/reportes/sandbox-wip/api/formatos/prebill/9?formato=carta&token=<token>"
```

*Respuesta 200 con salida=json (resumida)*

```json
{
  "tipo": "prebill", "idioma": "es", "fecha_emision": "2026-11-04", "formato": "carta",
  "prebill": { "id": 9, "status": "autorizada", "moneda": "MXN", "invoice_number": null },
  "periodo": { "desde": "2026-09-09", "hasta": "2026-10-12" },
  "cliente": { "razon_social": "Avolar Aerolíneas S.A. de C.V.", "rfc": "GAV0507224A8", "domicilio": [ /* líneas */ ] },
  "despacho": { "nombre": "Despacho de prueba (sandbox)", "datos_bancarios": [ /* solo los de la moneda */ ] },
  "totales": {
    "honorarios_horas": 4000, "honorarios_fijos": 0, "descuento": 0, "ajuste": 0,
    "gastos": 0, "reembolsos": 0, "subtotal": 4000,
    "impuestos": [ { "nombre": "IVA", "porcentaje": 16, "base": 4000, "importe": 640 } ],
    "total": 4640, "total_con_letra": "CUATRO MIL SEISCIENTOS CUARENTA PESOS 00/100 M.N.", "horas": 7.25
  },
  "resumen_proyectos": [ ], "resumen_abogados": [ ], "resumen_cargos": [ ],
  "tiempos": [ ], "honorarios_fijos": [ ], "gastos": [ ], "avisos": [ ]
}
```

`totales.subtotal` es el total de la Prebill (`GET /prebills/:id`). El IVA sigue la misma regla que la factura (proyecto, si no cliente) sobre honorarios con su parte del descuento/ajuste más gastos; los reembolsos no llevan IVA. En una Prebill **ya facturada** el IVA se calcula con la configuración actual, que puede no ser la que quedó en Books; `avisos` lo dice y para lo facturado está el formato de factura.

<a id="formato-factura"></a>

### Factura

#### `GET /formatos/factura/:prebill_id` — la invoice de Books de una Prebill facturada

Lee la factura de Books tal como está: líneas, descuento, impuestos, ajuste, total, pagado, saldo e importe con letra, más el CFDI registrado (según el [proveedor](#cfdi): serie y folio, UUID). Lleva la leyenda de que **no es la representación impresa de un CFDI**. [409] si la Prebill no está facturada.

#### `GET /formatos/factura` — ?invoice_id= — cualquier factura de la organización

Mismo formato para una factura que no salió de una Prebill. Si sí salió de una, `prebill_id` viene lleno en el JSON.

<a id="formato-estado-cuenta"></a>

### Estado de cuenta

#### `GET /formatos/estado-cuenta` — ?cliente_id= &estado= &desde= &hasta=

**Query**

| Campo | Notas |
|---|---|
| cliente_id | requerido — contact_id de Books |
| estado | `pendientes` (omisión: enviadas, vencidas y con pago parcial) \| `todas`. Nunca entran borradores ni anuladas. |
| desde / hasta | YYYY-MM-DD; `hasta` es la fecha de corte para los días vencidos (omisión: hoy) |

*Respuesta 200 con salida=json (resumida)*

```json
{
  "tipo": "estado_cuenta", "fecha_corte": "2026-11-04", "estado": "pendientes",
  "facturas": [{
    "numero": "INV-000779", "fecha": "2024-05-08", "vence": "2024-05-08", "status": "overdue",
    "moneda": "MXN", "total": 174, "pagos": 0, "saldo": 174, "dias_vencidos": 910,
    "folio_cfdi": "", "prebill_id": null
  }],
  "totales_por_moneda": [{
    "moneda": "MXN", "facturas": 2, "total": 754, "pagos": 0, "saldo": 754,
    "antiguedad": { "por_vencer": 0, "d1_30": 0, "d31_60": 0, "d61_90": 0, "mas_90": 754 }
  }],
  "responsable_cobranza": ""
}
```

Incluye los créditos sin aplicar del cliente y el responsable de cobranza (ver [Responsables](#responsables)). Verificado: el saldo de Avolar en el sandbox ($754) es igual al saldo por cobrar del contacto en Books.

<a id="formato-ledes"></a>

### LEDES 1998B

#### `GET /formatos/ledes/:prebill_id` — salida=txt | json · client_id · client_matter_id · law_firm_id

Una línea por tiempo (`F`, horas × tarifa), honorario fijo (`F`) y gasto o reembolso (`E`). `LINE_ITEM_TASK_CODE` y `LINE_ITEM_EXPENSE_CODE` salen del código UTBMS de la [tarea estándar](#tareas-estandar) y de la [categoría de gasto](#categorias-gasto). El descuento y el ajuste de la Prebill se reparten entre las líneas `F` en `LINE_ITEM_ADJUSTMENT_AMOUNT`, así `INVOICE_TOTAL` = suma de líneas = subtotal de la Prebill (LEDES 1998B no lleva impuestos). `client_id` por omisión: el contact_id; `law_firm_id`: el RFC o el nombre del despacho.

*Respuesta 200 (text/plain), Prebill #3*

```
LEDES1998B[]
INVOICE_DATE|INVOICE_NUMBER|CLIENT_ID|LAW_FIRM_MATTER_ID|INVOICE_TOTAL|…|CLIENT_MATTER_ID[]
20260909|INV-000861|446794000018976759|P5|4520.00|…|F|6.00|-1080.00|4320.00|…|Ruiz QA, Ana|Junior QA|[]
20260909|INV-000861|446794000018976759|P5|4520.00|…|E|1.00|0.00|200.00|…|||[]
```

Con `salida=json`: `filas` (cada campo por nombre), `invoice_total`, `avisos` (tiempos o gastos sin código UTBMS) y `texto`.

<a id="formato-membrete"></a>

### Membrete y datos de pago

Sección `formatos` de [`PATCH /config-despacho`](#config-despacho); también se edita en la pantalla Formatos. Cada formato imprime solo las cuentas de su moneda (o las que no tienen moneda).

| Campo | Notas |
|---|---|
| despacho.nombre | requerido |
| despacho.razon_social / rfc / telefono / correo / sitio_web | opcionales |
| despacho.direccion | lista de hasta 4 líneas |
| despacho.logo_url / color | imagen `https://` pública · color `#rrggbb` |
| datos_bancarios | hasta 6: `{moneda, banco, beneficiario, cuenta, clabe, swift, sucursal, banco_corresponsal, notas}`; cada una con banco, cuenta o clabe |
| ciudad_emision / firma / nota_pie | opcionales |
| prebill_formato | `carta` (omisión) \| `detallado` |
| campo_razon_social / campo_rfc | api_name del campo del contacto en Books (sandbox: `cf_raz_n_social`, `cf_rfc_nit_tax_id`); vacío = `company_name` / `tax_reg_no` |

*curl*

```bash
curl -X PATCH ".../api/config-despacho?token=<token>" -H "Content-Type: application/json" \
  -d '{"formatos":{"despacho":{"nombre":"Despacho","rfc":"AAA010101AAA","direccion":["Av. Reforma 1","CDMX"]},
       "datos_bancarios":[{"moneda":"MXN","banco":"Banco","beneficiario":"Despacho","clabe":"012345678901234567"}]}}'
```

<a id="reglas-eliminar"></a>

## Reglas de eliminar

No todo se borra igual, a propósito:

| Recurso | DELETE hace | Se bloquea cuando… |
|---|---|---|
| tipos-abogado | borra la fila y sus tarifas | algún abogado sigue usando ese nivel |
| abogados | **soft-delete** (activo=0) | nunca se bloquea — siempre desactiva |
| proyectos | **soft-delete** (activo=0) | nunca se bloquea — siempre desactiva |
| tareas-estandar / categorias-gasto | **soft-delete** (activo=0) | nunca — tiempos/gastos los referencian |
| tarifas | borra la fila | nunca — la tarifa ya usada quedó congelada en el tiempo |
| tiempos / gastos / cargos-fijos | borra la fila (también desde la web, en "Ver, editar y borrar lo capturado"); un tiempo respaldado se borra primero en Books | ya `facturado`, o ya asignado a una Prebill; un tiempo, también si Books no deja borrarlo ([502]) |
| prebills | borra la fila, libera sus líneas | el estado no es `borrador` |
| responsables | borra la asignación (quitarle la marca al abogado **no** la borra) | nunca |
| cfdi | borra el registro interno (no toca ningún CFDI real) | nunca |

El porqué del soft-delete en Abogados/Proyectos: `tiempos`/`gastos`/`tarifas` los referencian con una columna obligatoria — borrar la fila de verdad dejaría huérfano ese historial.

<a id="jerarquia"></a>

## Jerarquía de tarifas

Al capturar un tiempo se busca, **solo en la moneda del proyecto**, la primera tarifa que exista en este orden, de más a menos específica. Primero manda el ámbito (proyecto, luego cliente, luego ninguno) y dentro de cada ámbito el quién (el abogado, luego su nivel, luego todos).

1. **Proyecto + abogado** — `proyecto_abogado`
2. **Proyecto + nivel del abogado** — `proyecto_tipo`
3. **Proyecto (todos los abogados)** — `proyecto`
4. **Cliente + abogado** — `cliente_abogado`
5. **Cliente + nivel del abogado** — `cliente_tipo`
6. **Cliente (todos los abogados)** — `cliente`
7. **Tarifa propia del abogado** — `abogado`
8. **Nivel del abogado** — `tipo`
9. **General del despacho** — `general`

> **No se inventa ninguna tarifa.** Si no hay tarifa en la moneda del proyecto en ninguno de los 9 niveles, `POST /tiempos` responde [422] y el tiempo no se guarda. Nunca se usa una tarifa de otra moneda.

Ejemplo real del sandbox: Sofía (nivel Pasante) tiene 900 MXN con el "Cliente de Prueba" (nivel 4), y los pasantes tienen 1000 MXN en el proyecto de litigio de ese cliente (nivel 2). En el litigio cobra **1000**, porque el proyecto le gana al cliente; en otro proyecto del mismo cliente cobra **900**. Para ver la cadena completa de cualquier caso usa [`GET /tarifas/resolver`](#tarifas).

El resultado se guarda en `tiempos.tarifa_aplicada` (con `tarifa_nivel` y `tarifa_id`) al crear el tiempo y **nunca se recalcula**.

<a id="maquina-estados"></a>

## Máquina de estados de una Prebill

`borrador` → `en_revision` → `autorizada` → `facturada`

| Estado | Editable | Efecto en Books |
|---|---|---|
| borrador | líneas, descuento, ajuste, estado, se puede eliminar | ninguno |
| en_revision | líneas y estado | ninguno |
| autorizada | líneas, tipo de cambio y estado | ninguno |
| facturada | líneas, mientras la factura siga en borrador en Books (y "Deshacer factura"); con la factura enviada o pagada, nada | **crea la Invoice real**; editar líneas la actualiza |

<a id="demo"></a>

## Datos de prueba

Para recorrer el flujo completo sin capturar a mano. Todo lo que crea lleva el prefijo `[DEMO]` y usa el cliente de Books "Cliente de Prueba", para no mezclarse con otras Prebills. Lo que siembra nace sin respaldo en Books (`no_aplica`), porque sus proyectos nuevos no existen allá. Los demo sembrados antes del 2026-10-12 sí están en Books (sus 4 proyectos se crearon allá).

#### `GET /demo` — estado: cuántos registros demo hay

#### `POST /demo/sembrar` — crea el despacho de ejemplo

4 niveles y 4 abogados con tarifas en MXN y USD (uno, a propósito, sin USD para ver el aviso), un asunto por hora, uno de cuota fija con anticipo, una iguala con los cargos del mes pasado y del actual, uno en USD, tiempos con tareas estándar y gastos por categoría. [409] si ya están sembrados.

#### `POST /demo/limpiar` — borra lo demo que no esté facturado

Todo o nada (transacción). Lo ya facturado se conserva como historial, desactivado. Los tiempos demo respaldados se borran primero en Books; si Books no deja borrar alguno, no se limpia nada.

<a id="tarifas-compat"></a>

## Rutas de tarifas anteriores

Siguen funcionando para no romper integraciones existentes, ahora sobre el recurso [`/tarifas`](#tarifas). Para algo nuevo usa `/tarifas`.

| Ruta | Equivale a | Diferencias |
|---|---|---|
| /tarifas-cliente | nivel `cliente_abogado` | Cada fila trae `moneda`. El POST acepta `moneda`; si no la mandas, MXN. |
| /tarifas-proyecto | nivel `proyecto_abogado` | Cada fila trae `moneda`. Si no la mandas, la del proyecto. |

> **Los `id` cambiaron.** Ahora son los ids de `/tarifas`. Si guardaste ids de estas rutas antes del 2026-10-02, vuelve a leerlos con `GET`.

<a id="flujo"></a>

## Flujo de ejemplo completo

Capturar con tarea, generar igualas, liberar, armar la Prebill, ajustar y facturar.

*bash*

```
# 0. (Opcional) Ver qué tarifa le tocaría y las tareas disponibles
curl ".../api/tarifas/resolver?abogado_id=14&proyecto_id=18&token=<token>"
curl ".../api/tareas-estandar?token=<token>"

# 1. Capturar un tiempo con su tarea (la tarifa se resuelve sola y se respalda en Books;
#    el proyecto y el abogado deben estar enlazados a Books)
curl -X POST ".../api/tiempos?token=<token>" -H "Content-Type: application/json" \
  -d '{"abogado_id":14,"proyecto_id":18,"fecha":"2026-10-02","horas":2,"tarea_estandar_id":9}'

# 2. Generar la iguala del mes
curl -X POST ".../api/igualas/generar?token=<token>" -d 'periodo=2026-10'

# 3. Liberar lo capturado en un rango de fechas
curl -X POST ".../api/liberaciones?token=<token>" -H "Content-Type: application/json" \
  -d '{"desde":"2026-09-01","hasta":"2026-10-02","cliente_id":"446794000015629019"}'

# 4. Ver lo disponible y armar la Prebill
curl ".../api/liberado-disponible?cliente_id=446794000015629019&moneda=MXN&token=<token>"
curl -X POST ".../api/prebills?token=<token>" -H "Content-Type: application/json" \
  -d '{"cliente_id":"446794000015629019","moneda":"MXN","tiempo_id":[40,41],"gasto_id":[15],"cargo_fijo_id":[9,10]}'

# 5. Aplicar 10% de descuento (horas + fijos, nunca gastos)
curl -X PATCH ".../api/prebills/6/descuento-ajuste?token=<token>" -H "Content-Type: application/json" \
  -d '{"descuento_tipo":"porcentaje","descuento_valor":10}'

# 6. Avanzar los 3 estados hasta Facturada (el último crea la Invoice en Books)
curl -X POST ".../api/prebills/6/estado?token=<token>" -d 'nuevo_estado=en_revision'
curl -X POST ".../api/prebills/6/estado?token=<token>" -d 'nuevo_estado=autorizada'
curl -X POST ".../api/prebills/6/estado?token=<token>" -d 'nuevo_estado=facturada'
```

---

Prototipo del Escenario 3 de PLAN_MULTI_CLIENTE.md · ReportesSandbox, no es un servicio de producción · código en `apiRoutes.js` / `prebillLogic.js` / `facturacion.js` / `tarifas.js` / `catalogos.js` / `configDespacho.js` / `responsables.js` / `cfdi.js` / `respaldoBooks.js` / `formatos.js` / `pantallasFormatos.js` · actualizado 2026-11-13
