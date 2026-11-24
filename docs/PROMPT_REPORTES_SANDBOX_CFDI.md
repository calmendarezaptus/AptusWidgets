# Prompt para Claude Code en ReportesSandbox: timbrar CFDI sin Creator (API v2 de facturación)

En ReportesSandbox (`/var/www/html/NodeProyects/ReportesSandbox`, pm2 `sandbox-wip`, org de Books
`636939444`) quiero un proveedor de CFDI nuevo, **`aptus`**, que timbre, cancele y haga complementos de
pago llamando a la **API v2 de facturación**, que vive en **otro servidor**. El contrato completo está en
`API_V2_CONTRATO.md` (te lo paso junto con este prompt); el plan general, en `PLAN_CFDI.md`.

## Reglas que no se negocian

- **Solo modo prueba.** Toda llamada a la API v2 va con `"prueba": true` y el emisor `pruebas-eku`. Si la
  configuración pidiera `prueba:false`, el código lo rechaza (no existe una opción para producción en
  esta fase).
- Los proveedores actuales (`creator`, `interno`, `ninguno`) siguen funcionando igual.
- **El token de la API y el secreto de callbacks no van en la base, ni en el código, ni en logs, ni en
  respuestas.** Léelos de variables de entorno (`CFDI_V2_URL`, `CFDI_V2_TOKEN`, `CFDI_V2_CALLBACK_SECRET`)
  que yo pongo en el servidor. Si faltan, el proveedor `aptus` responde 503 con un mensaje claro.
- **No escribas en Books** (adjuntos, `cf_uuid`, campos) en esta fase: deja la opción
  `adjuntar_en_books` en `false` y sin implementar la escritura; dime qué haría falta.
- No toques ReportesSandboxECLegal.
- Antes de cambiar la base, `node respaldo.js`.

## 1. Configuración (`config_despacho.cfdi`)

Proveedor `aptus` con una sección `aptus`:

| Campo | Notas |
|---|---|
| `emisor` | id del emisor en la API v2 (`pruebas-eku`) |
| `momento` | `al_pagar` (PUE al cobrar, como valida hoy `solo_pagadas`) o `al_facturar` (PPD + complementos). Los dos deben funcionar; por omisión `al_pagar` |
| `forma_pago_omision` | catálogo SAT (`03`); en PPD siempre `99` |
| `uso_cfdi_omision` | `G03` si el contacto no trae uno |
| `ocultar_descuento` | booleano |
| `serie_pdf` / `service_name` | opcionales (la API ya tiene plantilla por emisor) |
| `campos_receptor` | API names de Books para RFC, razón social, régimen fiscal, CP y uso CFDI (los de `formatos` ya existen: `cf_rfc_nit_tax_id`, `cf_raz_n_social`; agrega régimen, CP y uso) |

Validación en `PATCH /config-despacho` y en la pantalla HTML de configuración.

## 2. Datos del CFDI

- **Receptor** desde el contacto de Books (con la caché que ya hay). Antes de timbrar valida: RFC con
  formato SAT, razón social, régimen, CP de 5 dígitos, uso; extranjeros (`XEXX010101000`: residencia
  fiscal y NumRegIdTrib); público en general (`XAXX010101000`).
- **Claves SAT** por concepto en `conceptos_factura`: `clave_prod_serv`, `clave_unidad`, `objeto_imp`
  (honorarios, honorarios fijos, gastos, reembolsos). Propón los valores por omisión y dime cuáles: en
  particular, cómo deben ir los **reembolsos** (hoy sin IVA y sin CFDI). Con `objeto_imp` 01 no llevan
  impuestos.
- **Conceptos e impuestos** a partir de la **factura de Books** (la que generó la Prebill; usa la misma
  lógica de `vistaFactura`/la invoice real para que coincida con Books). IVA por la tasa del impuesto de
  la línea. Si una línea usa un impuesto con **retenciones** (p. ej. el grupo "HONORARIOS"), **no se
  puede timbrar**: bloquea con un mensaje claro (la API aún no soporta retenciones en ingresos).
- **Fecha** = ahora (hora del centro de México): la API acepta máximo 72 h atrás. **Folio**
  (`invoiceNumber`) = el número de la factura de Books sin prefijo; la serie la pone la API.
- **`idempotencyKey`**: `636939444:inv:{invoice_id}:{n}` (`n` = 1, y aumenta solo si un CFDI previo de esa
  factura quedó cancelado y se timbra otro). Complementos: `636939444:pay:{payment_id}:{n}`.

## 3. Tabla `cfdi` (absorbe `cfdi_interno`)

`id, tipo (I/E/P), invoice_id, invoice_number, payment_id, prebill_id, cliente_id, serie, folio, uuid,
total, moneda, tipo_cambio, estado, status_sat, motivo_cancelacion, sustituto, idempotency_key,
emisor, prueba, xml_path, pdf_path, acuse_path, error, intentos, creado_en, actualizado_en, origen
('aptus' | 'interno')`. Estados: `timbrando`, `vigente`, `cancelacion_en_proceso`, `cancelado`,
`error`. Migra lo de `cfdi_interno` con `origen:'interno'` sin perder nada. Guarda XML/PDF/acuse en disco
(`data/cfdi/{uuid}/`) e inclúyelo en el respaldo diario.

## 4. Rutas nuevas (`/api/...`, mismo formato de error que el resto)

| Ruta | Qué hace |
|---|---|
| `GET /cfdi/preparar/:invoice_id` | Arma el comprobante y valida **sin timbrar**: receptor, conceptos, impuestos, totales y bloqueos. Con `?borrador=1` llama a la API en `modo:"borrador"` y devuelve el PDF de vista previa (no consume la llave) |
| `POST /cfdi/timbrar` | `{invoice_id, confirmar:true}` → **202** `{cfdi_id}` y timbra en segundo plano (la API puede tardar hasta 2 min: timeout 150 s; ante red/timeout/`EN_PROCESO` reintenta con la **misma llave**; un 200 con `repetido:true` cuenta como éxito) |
| `GET /cfdi/:id` | Estado del trabajo y del CFDI |
| `GET /cfdi/:id/xml` · `/pdf` · `/acuse` | Archivos guardados (si el PDF quedó pendiente, lo pide a la API y lo guarda) |
| `POST /cfdi/:id/cancelar` | `{motivo, sustituto?, confirmar:true}` |
| `GET /cfdi/:id/estatus` | `GET /cfdi/{uuid}/estatus` de la API y actualiza el registro |
| `GET /cfdi/pendientes` | Facturas de Books que deberían tener CFDI y no lo tienen, con el motivo (según `momento`: pagadas, o todas las facturadas) |
| `GET /pagos-por-complementar` | Pagos de Books aplicados a facturas **PPD** con CFDI vigente y sin complemento |
| `POST /cfdi/complemento` | `{payment_id, confirmar:true}` → 202; arma `DoctosRelacionados` (UUID, serie/folio, parcialidad, saldo anterior/pagado/insoluto, `ImpuestosDR` proporcionales, `EquivalenciaDR` si las monedas difieren) |

Sin `confirmar:true` las rutas que timbran o cancelan responden 400 y no llaman a la API.

## 5. Seguimiento

- Barrido cada 30 min: trabajos `timbrando` interrumpidos (reintenta con la misma llave) y CFDI en
  `cancelacion_en_proceso` (`GET .../estatus`). En modo prueba los 202 nunca se resuelven: que no
  insista indefinidamente (deja de consultar después de 7 días).
- **Callbacks: no en esta fase.** La API de ReportesSandbox está protegida por el token de Apache en la
  URL, y no quiero ese token guardado en el otro servidor. Dime qué propondrías (p. ej. una ruta fuera
  de la protección por token, validada solo con la firma HMAC) y lo decido después.

## 6. Lo que ya existe

`/facturas-cfdi`, la conciliación de `/ingresos`, `/formatos/factura` y la validación de "factura con
CFDI" deben leer también del proveedor `aptus` (tabla `cfdi`).

## 7. Al terminar

- Pruebas en `tests/` con la API v2 **simulada** (ninguna prueba llama al otro servidor): validaciones
  del receptor, bloqueo por retenciones, llave idempotente (reintento = mismo UUID), timeout seguido de
  reintento, 409 `IDEMPOTENCY_CONFLICT`/`DUPLICADO`, `confirmar` obligatorio, `prueba:false` imposible,
  token ausente → 503, que el token nunca salga en logs ni respuestas.
- `pm2 restart sandbox-wip` y prueba **manual en modo prueba** con una Prebill facturada del sandbox:
  vista previa (borrador), timbrar, descargar XML/PDF, cancelar y estatus; y un PPD con su complemento.
  Repórtame los UUID de prueba.
- Documenta en `prebill-api.md` (sección CFDI, una fila en "Cambios del …" y la consola) y `README.md`.
- Dame el resumen de las rutas con la forma exacta de las respuestas, para armar la función de Catalyst y
  las pantallas.
