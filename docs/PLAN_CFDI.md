# Plan: CFDI en los widgets de Aptus (con y sin Creator)

> 2026-11-24 · Basado en `cfdiDocs/SISTEMA_DETALLADO.md` (servicio `facturacion`), `docs/prebill-api.md`
> (ReportesSandbox) y lo que ya está publicado en Catalyst. **Nada de esto está construido todavía:** es la
> propuesta para decidir.
>
> **Actualización 2026-11-24 (usuario):** `facturacion` y ReportesSandbox están en **servidores distintos**
> (no hay `127.0.0.1` entre ellos: todo va por HTTPS con autenticación). **Orden decidido:** primero que
> `facturacion` funcione sin Creator (API v2, prompt en `docs/PROMPT_FACTURACION_V2.md`); después la
> integración en ReportesSandbox y los widgets.
>
> **2026-11-24:** API v2 de `facturacion` terminada (contrato en `docs/API_V2_CONTRATO.md`; 25 pruebas; prueba
> de punta a punta en modo prueba con el emisor `pruebas-eku`). Siguiente: `docs/PROMPT_REPORTES_SANDBOX_CFDI.md`. Timbrar y cancelar crean documentos reales ante el SAT; ningún paso de este
> plan timbra en producción sin la aprobación expresa del usuario, despacho por despacho.

## 1. Qué hay hoy

| Sistema | Qué hace con el CFDI |
|---|---|
| **`facturacion`** (`/home/ubuntu/html/facturacion`, pm2 `facturacion`, `127.0.0.1:3001`) | Arma, sella y timbra CFDI 4.0 y Complemento de Pago 2.0 (EDICOM o Solución Factible), cancela, consulta el SAT, genera el PDF (PHP `aptusCFDIRF`) y **sube todo a Zoho Creator** (y adjunta en Books). Lo llama **Deluge** desde la app Creator de cada despacho. |
| **ReportesSandbox** | **No timbra.** `config_despacho.cfdi.proveedor`: `creator` (lee la app Creator del despacho, solo GET), `interno` (registro manual en `cfdi_interno`) o `ninguno`. Valida factura ↔ CFDI (`/facturas-cfdi`) y concilia ingresos. |
| **Widgets** | Cobranza → "Facturas y CFDI" (consulta). Ingresos → conciliación CFDI. Prebills → "Facturar en Books" crea la factura en Books (sin CFDI). |

Hallazgos de la revisión de `facturacion` que afectan la integración:

1. **Acoplado a Creator:** sin `appOwner/appLinkName/recordId/orgId` el timbrado igual ocurre, pero la
   subida falla, el CFDI se queda en `src/recovery/` para siempre y **el XML/PDF no se devuelven** en
   la respuesta (§21.1, §22.4).
2. **Sin autenticación propia** y con usuario/contraseña del PAC y del PFX **en la URL** (§20).
3. **El CFDI de ingreso no lleva retenciones** (§9.1, §22.7). En Books existe el grupo de impuestos
   "HONORARIOS" (5.3333 %, con retenciones): una factura así no se podría timbrar tal cual.
4. Idempotencia por `rfc|serie|folio`; un reintento devuelve **409** (no el timbre).
5. Respuestas de error distintas entre `/procesar` (500) y `/procesarPago` (200 `success:false`).
6. Una sola instancia con estado en disco; timbrado de "varios segundos" (Catalyst corta a 30 s).
7. Cancelar con EDICOM exige `.pfx` (solo RVA lo tiene).

## 2. Dos modos por despacho

El modo se elige en `config_despacho.cfdi.proveedor`.

| | **Con Creator** (`creator`, ya existe) | **Sin Creator** (`aptus`, nuevo) |
|---|---|---|
| Quién timbra | La app Creator del despacho (Deluge → `facturacion`), **igual que hoy** | ReportesSandbox → `facturacion` por **HTTPS** (servidores distintos), con token de servicio |
| Dónde viven XML/PDF | Creator (+ adjuntos en Books) | ReportesSandbox (disco + tabla `cfdi`) y adjuntos en Books |
| Qué hacen los widgets | **Consultar** estado, UUID, totales, cancelaciones; enlace "Abrir en Creator"; avisos de conciliación | Todo: vista previa, timbrar, descargar, cancelar, estatus SAT, complementos de pago |
| Cambios en `facturacion` | Ninguno obligatorio | Los de la §3 |

**Recomendación:** con Creator **no** se duplica la lógica de Deluge (crear registros en Creator y
llamar a `facturacion` desde Aptus sería mantener dos caminos que timbran lo mismo → riesgo de CFDI
duplicado). Los widgets solo leen y llevan al registro de Creator. Si más adelante se quiere timbrar
desde los widgets para un despacho con Creator, se cambia ese despacho a `aptus` y Creator queda solo
como histórico.

## 3. Cambios en el servicio `facturacion`

Todos **aditivos**: lo que hoy llama Deluge no cambia (mismas rutas, parámetros y respuestas).

| # | Cambio | Por qué | Prioridad |
|---|---|---|---|
| F1 | **Destino `api`** (`?destino=api` o rutas nuevas `/v2/...`): no toca Creator; responde con el timbre **y** el XML (y PDF si se pidió) en base64; el recovery guarda `destino` y no deja huérfanos | Hoy sin Creator el XML no regresa y el recovery se queda para siempre | Alta |
| F2 | **(Obligatorio: servidores distintos)** **Autenticación por token de servicio** (header `Authorization`) para el destino `api`, y **credenciales del PAC guardadas en el servidor** por emisor (`src/data/emisores.json` o similar, fuera de la URL): el cliente manda `emisor` y no contraseñas | Las contraseñas del PAC/PFX no deben viajar desde Aptus ni quedar en logs de nginx | Alta |
| F3 | **Idempotencia explícita**: `idempotencyKey` (p. ej. `org|invoice_id`); si ya se timbró con esa llave, responde **200 con el mismo timbre** (no 409) | Un reintento del widget (red, corte de 30 s) debe recuperar el CFDI, no fallar ni duplicar | Alta |
| F4 | **Retenciones en CFDI de ingreso** (ISR 10 %, IVA 2/3) por concepto y a nivel comprobante | Honorarios a personas morales; grupo "HONORARIOS" de Books | Alta si algún despacho lo usa (confirmar) |
| F5 | **Consultas por UUID**: `GET /v2/cfdi/:uuid` (estado guardado), `/xml`, `/pdf`, `/acuse`; y **callback opcional** (`callbackUrl`) cuando una cancelación 202 se resuelve en el barrido | Hoy el resultado final de la cancelación solo se escribe en Creator | Media |
| F6 | **Errores uniformes** para el destino `api`: HTTP real + `{code, message, detalle}`; los endpoints de Deluge siguen igual | Hoy `/procesar` y `/procesarPago` responden distinto | Media |
| F7 | **Emisor de pruebas**: CSD de pruebas del SAT (p. ej. `EKU9003173C9`) en `src/Key/`, solo en modo prueba con Solución Factible de pruebas | Probar todo el ciclo con la org sandbox sin tocar al SAT real | Alta (antes de todo) |
| F8 | **Plantilla de PDF** para despachos sin Creator (`serviceName` genérico en `aptusCFDIRF`) con el membrete de `config_despacho.formatos` | Cada despacho Creator tiene su plantilla PHP | Media |
| F9 | Deuda que conviene cerrar antes: `axios`/`form-data` en `package.json`, poner el repo en git, no loguear el XML completo | Riesgos §22.1, §22.12 | Media |

**Lo que no cambia:** reglas de "una vez timbrado siempre 200", duplicadoGuard, estatus siempre del SAT,
`tt=0` en CP, excepciones por RFC, barridos.

## 4. Cambios en ReportesSandbox (back de AptusWidgets)

| # | Cambio |
|---|---|
| R1 | **Proveedor `aptus`** en `config_despacho.cfdi`: `emisor` (RFC, razón social, régimen, lugar de expedición, clave del emisor en `facturacion`), `series` (I, E, P), `pac` (EDICOM/SF), `modo_prueba` (siempre `true` en sandbox), `momento` (`al_facturar` = PPD con complementos, o `al_pagar` = PUE, como hoy valida `solo_pagadas`), forma/método/uso por omisión, `ocultar_descuento`, `adjuntar_en_books`, `serviceName` del PDF. Sin contraseñas. |
| R2 | **Datos fiscales del receptor** desde el contacto de Books (campos `cf_rfc_nit_tax_id`, `cf_raz_n_social`, `cf_r_gimen_fiscal`, CP y uso CFDI; los nombres de campo ya se configuran en `formatos`). Validación "lista para timbrar" con mensajes claros (RFC, régimen, CP, extranjero `XEXX010101000`). |
| R3 | **Claves SAT**: en `conceptos_factura` (honorarios, gastos, fijos, reembolsos) `clave_prod_serv`, `clave_unidad`, `objeto_imp`; mapeo de impuestos de Books → traslados/retenciones. |
| R4 | **Tabla `cfdi`** (reemplaza/absorbe `cfdi_interno`): `tipo` I/E/P, `invoice_id`/`payment_id`, `prebill_id`, serie, folio, UUID, totales, moneda/TC, `estado` (`timbrando`, `timbrado`, `cancelacion_pendiente`, `cancelado`, `rechazado`, `error`), rutas de XML/PDF/acuse, `idempotency_key`, fechas, motivo y sustituto de cancelación, intentos. |
| R5 | **Rutas nuevas** (JSON, mismo formato de error): `GET /cfdi/preparar/:invoice_id` (arma el payload y valida **sin timbrar**), `POST /cfdi/timbrar` `{invoice_id, confirmar:true}` → **trabajo asíncrono** (responde `202` + id; `GET /cfdi/:id` para seguirlo), `GET /cfdi/:id/xml|pdf|acuse`, `POST /cfdi/:id/cancelar` `{motivo, sustituto?, confirmar:true}`, `GET /cfdi/:id/estatus` (SAT en vivo), `GET /pagos-por-complementar`, `POST /cfdi/complemento` `{payment_id, confirmar:true}`. |
| R6 | **Barrido** de cancelaciones 202 (o callback de F5) y de trabajos interrumpidos; adjuntar en Books y `cf_uuid` (lo hace `facturacion` con `books.enviar`). |
| R7 | `/facturas-cfdi`, `/ingresos` y `/formatos/factura` leen también del proveedor `aptus`. |

Por qué asíncrono: timbrar + PDF + Books puede pasar de 30 s, que es el corte de Catalyst. El widget
pide, recibe un id y consulta cada pocos segundos (el mismo patrón que ya usan WIP e Ingresos).

## 5. Widgets (Catalyst)

**Proyecto nuevo `CfdiForAptusFinancials`** (carpeta `08-cfdi`), función `aptus_cfdi_services`. Los
proyectos de Prebills y Reportes ya no tienen lugar para 3 pantallas nuevas.

| Slate | Con Creator | Sin Creator |
|---|---|---|
| **Por timbrar** | Facturas de Books sin CFDI, con el motivo (no pagada, falta RFC…) y "Abrir en Creator" | Lo mismo + **vista previa** del CFDI (receptor, conceptos, impuestos, totales) y **Timbrar** con confirmación |
| **CFDI emitidos** | Lista desde Creator (UUID, estado, cancelación) | Lista propia: descargar XML/PDF, estatus SAT, **Cancelar** (motivo 01–04, sustituto) con confirmación |
| **Complementos de pago** | Consulta | Pagos de Books a facturas PPD sin complemento → vista previa y **Timbrar complemento** |

Además:
- **Detalle de Prebill:** al estar facturada, una ficha "CFDI" con el estado y un botón que abre "Por
  timbrar" o "CFDI emitidos" en esa factura.
- **Menú principal:** sección nueva "CFDI" entre Facturar y Cobrar.
- **Cobranza e Ingresos:** sin cambios de pantalla; toman los datos del proveedor que tenga el despacho.

La función de Catalyst **nunca** recibe ni guarda credenciales del PAC: solo pasa `invoice_id`,
`confirmar` y motivo a ReportesSandbox.

## 6. Fases

| Fase | Qué | ¿Escribe ante el SAT? |
|---|---|---|
| 0 | `facturacion` API v2 sin Creator: F1–F3, F5–F7, F9 (y F4 si aplica), probada solo en modo prueba | Solo pruebas |
| 1 | R1–R3 + `GET /cfdi/preparar` + Slate "Por timbrar" en **solo vista previa**; widgets en modo Creator (consulta + enlace) | No |
| 2 | F1–F3 (+F6) en `facturacion`; R4–R5 timbrado; botón Timbrar **solo en modo prueba** con la org sandbox | Solo pruebas (SF test) |
| 3 | Cancelación y estatus (F5, R6); Slate "CFDI emitidos" | Solo pruebas |
| 4 | Complementos de pago (R5, Slate 3); F4 retenciones si aplica | Solo pruebas |
| 5 | Producción **por despacho**, con aprobación expresa: credenciales del PAC en el servidor, CSD real, serie, y una primera factura acompañada | Sí, con aprobación |

## 7. Lo que necesito que decidas o me confirmes

1. **¿Qué despachos irían sin Creator?** ¿Alguno real o, por ahora, solo la org sandbox?
2. **¿Cuándo se timbra?** ¿Al facturar (PPD, con complementos de pago) o al cobrar (PUE)? Hoy
   ReportesSandbox asume "el CFDI solo cuenta con la factura pagada".
3. **Retenciones:** ¿algún despacho factura honorarios con retención de ISR/IVA? (Define si F4 es
   indispensable.)
4. **PAC** para el modo sin Creator: ¿EDICOM, Solución Factible o el que tenga cada despacho? (EDICOM
   necesita `.pfx` para cancelar.)
5. **PDF:** ¿una plantilla PHP nueva genérica con el membrete de Configuración del despacho, o reusar
   la de algún despacho?
6. **Orden de trabajo:** ¿empiezo con los prompts de la Fase 0–1 (`facturacion`: emisor de pruebas y
   deuda; ReportesSandbox: datos fiscales, claves SAT y vista previa), que no timbran nada?

## 8. Riesgos

- **Doble timbrado** si Creator y los widgets timbran el mismo despacho → un despacho, un modo.
- **Corte de 30 s** de Catalyst → todo timbrado es asíncrono e idempotente (F3).
- **Una sola instancia** de `facturacion` con locks en memoria → no escalar; ReportesSandbox encola.
- **Credenciales y CSD** en el servidor → fuera de la URL, de los logs y de Catalyst (F2).
- **Datos fiscales incompletos** en Books (RFC, régimen, CP) → se validan antes, nunca en el PAC.
