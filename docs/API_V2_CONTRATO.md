# API v2 de facturación CFDI 4.0 — Contrato para integradores

> **Copia de la versión 2026-11-24 (fase 1).** La vigente (2026-11-25, fase 2: resultado de cancelación, PDF con leyenda, tipo de cambio) está en el servidor de facturación, en `docs/API_V2_CONTRATO.md`; reemplaza esta copia con ella.
>
> Versión 2026-11-24. Para el equipo que integra **ReportesSandbox** (u otro sistema propio) con el servidor de facturación.

## 1. Conexión

| | |
|---|---|
| URL base | `https://nodefact.aptuslegal.app/facturacion/v2` |
| Formato | JSON UTF-8 (`Content-Type: application/json`) |
| Autenticación | `Authorization: Bearer <token>` en **todas** las rutas excepto `GET /salud` |
| Origen permitido | Solo la(s) IP(s) del servidor de ReportesSandbox registradas en nginx |
| Tamaño máximo del cuerpo | 5 MB |
| Tiempo máximo | Timbrar o cancelar puede tardar hasta ~2 min si el PAC está lento: usa un timeout de cliente ≥ 150 s |

- El token es por cliente. Guárdalo como secreto (variable de entorno / gestor de secretos), nunca en el código ni en logs.
- **Nunca** mandes contraseñas del PAC, del CSD ni el token en la URL: las rutas con parámetros como `password`, `token`, `usuario`… responden `400 CREDENCIALES_EN_QUERY`.
- Cada respuesta trae `X-Request-Id`; inclúyelo al reportar un problema.

## 2. Emisores y modo prueba

El servidor guarda por emisor el CSD y las credenciales del PAC. El cliente solo manda el **id del emisor** (`"emisor": "pruebas-eku"`) y `"prueba": true|false`.

| Emisor | RFC | Uso |
|---|---|---|
| `pruebas-eku` | EKU9003173C9 (CSD de pruebas del SAT) | Solo `prueba:true`. Timbra contra el ambiente de pruebas de Solución Factible: los UUID **no existen en el SAT**. |

`prueba:false` se rechaza con `403 PRODUCCION_NO_HABILITADA` hasta que el administrador habilite producción para un emisor real.

## 3. Errores

Siempre JSON con el código HTTP real:

```json
{ "code": "VALIDACION", "message": "La solicitud no es válida", "detalle": ["prueba: requerido, booleano"] }
```

| HTTP | `code` | Qué hacer |
|---|---|---|
| 400 | `JSON_INVALIDO`, `CUERPO_INVALIDO`, `UUID_INVALIDO`, `CREDENCIALES_EN_QUERY` | Corregir la petición |
| 401 | `NO_AUTORIZADO` | Token ausente, inválido o cliente desactivado |
| 403 | `EMISOR_NO_PERMITIDO`, `EMISOR_INACTIVO`, `PRODUCCION_NO_HABILITADA`, `PRUEBA_NO_HABILITADA`, `IP_NO_PERMITIDA`, `ACCESO_NO_PERMITIDO` | Permisos; no reintentar |
| 404 | `NO_ENCONTRADO`, `EMISOR_NO_ENCONTRADO`, `PDF_NO_DISPONIBLE`, `ACUSE_NO_DISPONIBLE`, `XML_NO_DISPONIBLE`, `RUTA_NO_ENCONTRADA` | Ver `detalle` (p. ej. PDF pendiente) |
| 409 | `IDEMPOTENCY_CONFLICT` | Misma `idempotencyKey` con otro comprobante: es un error del cliente |
| 409 | `EN_PROCESO` | Otra solicitud igual está en curso: **reintentar** en unos segundos con la misma llave |
| 409 | `DUPLICADO` | Esa serie/folio (o factura/parcialidad) ya se timbró con otra llave; `detalle.uuid_existente` |
| 413 | `CUERPO_DEMASIADO_GRANDE` | |
| 422 | `VALIDACION`, `COMPROBANTE_INVALIDO`, `EMISOR_NO_COINCIDE`, `CERTIFICADO_NO_COINCIDE`, `TIPO_INVALIDO`, `NO_CANCELABLE`, `CANCELACION_NO_CONFIGURADA` | Datos; `message`/`detalle` dicen qué |
| 500 | `ERROR_INTERNO`, `ERROR_CADENA_ORIGINAL`, `EMISOR_MAL_CONFIGURADO` | Reintentar con la misma llave; si persiste, reportar `request_id` |
| 501 | `NO_SOPORTADO` | El PAC no ofrece esa consulta |
| 502 | `PAC_ERROR`, `PAC_RESPUESTA_INVALIDA`, `SAT_NO_DISPONIBLE`, `TIPO_CAMBIO_NO_DISPONIBLE` | El PAC rechazó (ver `message`, suele traer el código del PAC/SAT) o un servicio externo falló. **No se timbró**: se puede corregir y reintentar con la misma llave |

Errores de red/timeout del lado del cliente: **reintenta con la misma `idempotencyKey`**. Si el CFDI se alcanzó a timbrar recibirás `200` con `repetido:true` y el mismo UUID; nunca se timbra dos veces.

## 4. Idempotencia

- `idempotencyKey` es **obligatoria** en `POST /cfdi` y `POST /pagos`: 1–200 caracteres ASCII visibles, sin espacios. Recomendado: `"{orgId}:{tipo}:{idRegistro}"`, p. ej. `"636939444:inv:446794000049762016"`.
- Es única por cliente. Misma llave + mismo contenido → `200` con el CFDI original y `"repetido": true`. Misma llave + contenido distinto (`emisor`, `prueba`, `comprobante` u `ocultarDescuento`) → `409 IDEMPOTENCY_CONFLICT`.
- Una llave cuyo timbrado falló (4xx/5xx) queda libre: se puede reintentar.
- `modo:"borrador"` no consume la llave.

## 5. Rutas

### `GET /salud`
Sin token. `{"status":"ok","api":"v2","ts":"…"}`.

### `POST /cfdi` — timbrar CFDI de ingreso (I) o egreso (E)

```json
{
  "emisor": "pruebas-eku",
  "idempotencyKey": "636939444:inv:446794000049762016",
  "prueba": true,
  "modo": "timbrado",
  "ocultarDescuento": false,
  "comprobante": {
    "fact_tipcompr": "I",
    "invoiceNumber": 1234,
    "fecha": "2026-11-24T10:00:00",
    "formaDePago": "03",
    "metodoDePago": "PUE",
    "moneda": "MXN",
    "fact_exportacion": "01",
    "ImpuestoTasa": 0.16,
    "subTotal": 1000,
    "total": 1160,
    "clientCode": "2999-07404",
    "receptor_rfc": "URE180429TM6",
    "receptor_rs": "UNIVERSIDAD ROBOTICA ESPAÑOLA",
    "receptor_cp": "86991",
    "receptor_regfis": "601",
    "receptor_uso": "G03",
    "articulos": [{
      "claveProd": "80121600", "cantidad": 1, "unidad": "E48", "descUnidad": "Servicio",
      "descripcion": "Honorarios profesionales", "descripcionPDF": "Texto largo opcional para el PDF",
      "valorUnitario": 1000, "importe": 1000, "descuento": 0, "ObjetoImp": "02"
    }]
  },
  "pdf": { "generar": true },
  "callbackUrl": "https://reportes.ejemplo.com/api/cfdi/callback"
}
```

| Campo | Req. | Notas |
|---|---|---|
| `emisor` | sí | id asignado a tu cliente |
| `idempotencyKey` | sí | ver §4 |
| `prueba` | sí | booleano |
| `modo` | no | `timbrado` (omisión) o `borrador` (XML sellado sin timbrar + PDF; no se guarda) |
| `ocultarDescuento` | no | `true` integra el descuento al valor unitario y omite `Descuento` |
| `pdf.generar` | no | omisión `true` |
| `pdf.serviceName` | no | plantilla PHP alternativa (letras, números, `_`) |
| `pdf.tipoCambio` | no | tipo de cambio a imprimir en el PDF |
| `books` | no | `{ "enviar": true, "orgIdBooks": "...", "entityId": "..." }`: adjunta XML/PDF en Zoho Books (solo producción) |
| `callbackUrl` | no | `https`, se notifica cada cambio de estado (§6) |

**`comprobante`** usa los mismos nombres de campo que el sistema actual:

| Campo | Req. | Notas |
|---|---|---|
| `fact_tipcompr` | no | `I` (omisión) o `E`. Complementos de pago van en `/pagos` |
| `invoiceNumber` | sí | → `Folio`. Junto con la serie es único por emisor en producción |
| `fact_serie` | no | omisión: la serie del emisor para ese tipo (pruebas: `PRB` / `PRBE` / `PRBP`) |
| `fecha` | sí | `AAAA-MM-DDThh:mm:ss`, hora del centro de México, no futura y de máximo 72 h atrás |
| `formaDePago` | sí | catálogo SAT (`03`, `99`, …) |
| `metodoDePago` | sí | `PUE` / `PPD` (ojo: `metodoDePago`, no `metodoPago`) |
| `moneda` | sí | `MXN`, `USD`, … |
| `TipoCambio` | si moneda ≠ MXN | |
| `fact_exportacion` | sí | normalmente `01` |
| `ImpuestoTasa` | si los artículos no traen `impuestos` | tasa de IVA (`0.16`). **Si falta, el IVA se calcula a tasa 0** |
| `subTotal`, `total` | sí | deben venir (≠ 0) pero el servidor **recalcula** ambos desde los artículos; el valor real es el de la respuesta |
| `receptor_rfc`, `receptor_rs`, `receptor_cp`, `receptor_regfis`, `receptor_uso` | sí | nombre y CP exactamente como en la constancia fiscal |
| `receptor_direccion`, `ResidenciaFiscal`, `NumRegIdTrib` | extranjeros | RFC `XEXX010101000` |
| `fact_periodicidad`, `fact_meses`, `fact_anio` | factura global | receptor `XAXX010101000` + "PUBLICO EN GENERAL" |
| `tipoRelacion`, `cfdiRelacionados` | no | `cfdiRelacionados: [{"UUID":"…"}]` |
| `articulos[]` | sí | `claveProd`, `cantidad`, `unidad` (ClaveUnidad), `descUnidad`, `descripcion`, `valorUnitario`, `importe`, `descuento`, `ObjetoImp`; opcional `impuestos: [{base, impuesto:"002", tipoFactor:"Tasa", tasaOCuota:0.16, importe}]` y `descripcionPDF` |
| `clientCode`, `folioPDF` | no | solo para el PDF |
| `emisor_rfc`, `emisor_rs`, `emisor_regfis`, `LugarExpedicion`, `noCertificado` | no | salen de la configuración del emisor; si mandas `emisor_rfc` o `noCertificado` distintos → 422 |

Retenciones (ISR/IVA retenido) **no** están soportadas todavía en CFDI de ingreso.

**Respuesta 200:**

```json
{
  "uuid": "DEFE2332-FBED-4473-8259-F5B40B3CBA5E",
  "tipo": "I", "serie": "PRB", "folio": "668786",
  "fecha_timbrado": "2026-11-24T10:44:29",
  "total": "1160.00", "moneda": "MXN",
  "prueba": true, "estado": "vigente",
  "timbre": {
    "version_timbre": "1.1", "cert_SAT": "30001000000500003442", "tim_fecha": "2026-11-24T10:44:29",
    "tim_uuid": "DEFE2332-FBED-4473-8259-F5B40B3CBA5E", "sello_SAT": "…", "sello_CFD": "…", "tim_RfcPac": "SFE0807172W7"
  },
  "xml": "<base64 del XML timbrado>",
  "pdf": "<base64 del PDF> | null",
  "repetido": false
}
```

Si el PDF falla después de timbrar, la respuesta sigue siendo **200** con `"pdf": null`, `"pdf_error": "…"` y `"pdf_pendiente": true`: el servidor lo reintenta solo y luego se obtiene con `GET /cfdi/{uuid}/pdf`. **Un 200 significa que el CFDI existe**; guarda el `uuid` aunque falte el PDF.

`modo:"borrador"` responde `{ "borrador": true, "prueba": true, "xml": "<base64>", "pdf": "<base64>|null", "pdf_error"?: "…" }`.

### `POST /pagos` — Complemento de Pago 2.0

Mismo sobre que `/cfdi`; `comprobante`:

```json
{
  "invoiceNumber": 55, "fecha": "2026-11-24T10:00:00", "clientCode": "2999-07404",
  "receptor_rfc": "URE180429TM6", "receptor_rs": "UNIVERSIDAD ROBOTICA ESPAÑOLA", "receptor_cp": "86991", "receptor_regfis": "601",
  "pagos": [{
    "FechaPago": "2026-11-20T12:00:00", "FormaDePagoP": "03", "MonedaP": "MXN", "Monto": 1160,
    "DoctosRelacionados": [{
      "IdDocumento": "307F3E87-064B-4958-9FD5-B9E1A71736D9", "Serie": "PRB", "Folio": "668787",
      "MonedaDR": "MXN", "EquivalenciaDR": 1, "NumParcialidad": 1,
      "ImpSaldoAnt": 1160, "ImpPagado": 1160, "ImpSaldoInsoluto": 0, "ObjetoImpDR": "02",
      "ImpuestosDR": { "TrasladosDR": [{ "BaseDR": 1000, "ImpuestoDR": "002", "TipoFactorDR": "Tasa", "TasaOCuotaDR": 0.16, "ImporteDR": 160 }] }
    }]
  }]
}
```

- `TipoCambioP` obligatorio si `MonedaP` ≠ MXN. `EquivalenciaDR` = unidades de `MonedaP` por 1 de `MonedaDR` (p. ej. 17.25 MXN por USD); el servidor la convierte al formato SAT.
- `Σ ImpPagado × EquivalenciaDR` debe cuadrar con `Monto` (tolerancia 0.5 %) o responde 422.
- En producción cada `(IdDocumento, NumParcialidad)` solo puede pagarse una vez (`409 DUPLICADO`).
- Respuesta igual a `/cfdi` con `tipo:"P"`, `total:"0"`, `moneda:"XXX"`.

### `GET /cfdi/{uuid}` — registro

```json
{
  "uuid": "…", "tipo": "I", "emisor": "pruebas-eku", "rfcEmisor": "EKU9003173C9", "rfcReceptor": "URE180429TM6",
  "nombreReceptor": "…", "serie": "PRB", "folio": "668786", "fecha": "2026-11-24T10:39:28",
  "fecha_timbrado": "2026-11-24T10:44:29", "subtotal": "1000.00", "total": "1160.00", "moneda": "MXN",
  "prueba": true, "estado": "vigente", "timbre": { "…": "…" },
  "cancelacion": null,
  "ultima_consulta_sat": null,
  "pdf": { "disponible": true, "error": null, "pendiente": false },
  "acuse_disponible": false,
  "idempotencyKey": "…", "creado_en": "…", "actualizado_en": "…",
  "enlaces": { "xml": "/v2/cfdi/…/xml", "pdf": "/v2/cfdi/…/pdf", "acuse": "/v2/cfdi/…/acuse", "estatus": "/v2/cfdi/…/estatus", "cancelar": "/v2/cfdi/…/cancelar" }
}
```

Solo existen aquí los CFDI timbrados **por la API v2**.

### `GET /cfdi/{uuid}/xml` · `/pdf` · `/acuse[?formato=xml]`
Archivo binario (`application/xml` o `application/pdf`, con `Content-Disposition`). El acuse se entrega en PDF por omisión.

### `POST /cfdi/{uuid}/cancelar`

```json
{ "motivo": "02" }
{ "motivo": "01", "sustituto": "UUID-DEL-CFDI-QUE-LO-SUSTITUYE" }
```

Motivos: `01` con relación (requiere `sustituto`), `02` sin relación, `03` no se llevó a cabo, `04` operación nominativa en factura global.

Respuesta 200:

```json
{
  "uuid": "…", "estado": "cancelacion_en_proceso", "statusSAT": "202",
  "mensajeSAT": "En proceso - pendiente de aprobación del receptor",
  "canceladoDefinitivo": false, "requiereAprobacion": true,
  "fuente_estatus": "SAT", "motivo": "02", "sustituto": null,
  "acuse_disponible": true, "prueba": false, "repetido": false
}
```

- Si ya estaba cancelado o en proceso, responde el estado actual con `repetido:true` sin volver a solicitar.
- `422 NO_CANCELABLE` si el SAT no la aceptó (`detalle.statusSAT`, `detalle.sat`).
- **Modo prueba:** el SAT no conoce los CFDI de pruebas; el estado sale del PAC de pruebas (`fuente_estatus` lo indica) y nunca se resuelve un 202 de prueba.

### `GET /cfdi/{uuid}/estatus`
Consulta el SAT en ese momento y actualiza el registro:

```json
{ "uuid": "…", "estado": "cancelado", "statusSAT": "201", "prueba": false,
  "sat": { "estado": "Cancelado", "esCancelable": "…", "estatusCancelacion": "Cancelado sin aceptación", "codigoEstatus": "S - …", "descripcion": "…" } }
```
`502 SAT_NO_DISPONIBLE` si el SAT no responde. En modo prueba el SAT responde "No Encontrado" y el estado no cambia (trae `nota`).

### `GET /emisores/{id}/timbres[?prueba=false]`
`{ "emisor", "pac", "prueba", "contratados", "usados", "disponibles", "status", "mensaje" }` (solo Solución Factible; EDICOM → 501).

## 6. Estados y callbacks

| `estado` | `statusSAT` | Significado |
|---|---|---|
| `vigente` | `''` o `205` | Válido. `205` = el receptor rechazó la cancelación |
| `cancelacion_en_proceso` | `202` | Esperando que el receptor acepte (hasta 72 h hábiles) |
| `cancelado` | `201` / `203` / `204` | Sin aceptación / aceptada / plazo vencido |

El servidor revisa las cancelaciones `202` cada 30 min contra el SAT. Si el CFDI se timbró con `callbackUrl`, cada cambio de `estado` se notifica con:

```http
POST <callbackUrl>
Content-Type: application/json; charset=utf-8
X-CFDI-Timestamp: 1795540000
X-CFDI-Firma: sha256=<hex>

{"evento":"cambio_estado","uuid":"…","emisor":"pruebas-eku","idempotencyKey":"…","estado":"cancelado","statusSAT":"203","prueba":false,"ts":"2026-11-25T18:00:00.000Z"}
```

- Firma: `HMAC-SHA256(secretoCallback, "{X-CFDI-Timestamp}.{cuerpo crudo}")` en hexadecimal. Verifica con comparación de tiempo constante y rechaza timestamps con más de 5 min de diferencia.
- Responde cualquier `2xx` para confirmar. Si no, se reintenta con espera 1, 2, 4, 8… min (máx. 60 min entre intentos, 12 intentos). Sin redirecciones.
- Puede llegar más de una vez: usa `uuid` + `estado` para deduplicar. Si no usas callback, consulta `GET /cfdi/{uuid}/estatus`.

```js
// Node.js — verificar un callback (usar el cuerpo CRUDO, no el JSON re-serializado)
const crypto = require('crypto');
function callbackValido(cuerpoCrudo, headers, secreto) {
  const ts = headers['x-cfdi-timestamp'];
  if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const esperado = 'sha256=' + crypto.createHmac('sha256', secreto).update(`${ts}.${cuerpoCrudo}`).digest('hex');
  const recibido = String(headers['x-cfdi-firma'] || '');
  return recibido.length === esperado.length && crypto.timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado));
}
```

## 7. Ejemplo completo (curl)

```bash
API=https://nodefact.aptuslegal.app/facturacion/v2
AUTH="Authorization: Bearer $CFDI_V2_TOKEN"

curl -sS -X POST "$API/cfdi" -H "$AUTH" -H 'Content-Type: application/json' --max-time 150 -d @factura.json > r.json
UUID=$(jq -r .uuid r.json); jq -r .xml r.json | base64 -d > "$UUID.xml"; jq -r '.pdf // empty' r.json | base64 -d > "$UUID.pdf"

curl -sS "$API/cfdi/$UUID" -H "$AUTH"
curl -sS "$API/cfdi/$UUID/pdf" -H "$AUTH" -o "$UUID.pdf"
curl -sS -X POST "$API/cfdi/$UUID/cancelar" -H "$AUTH" -H 'Content-Type: application/json' -d '{"motivo":"02"}'
curl -sS "$API/cfdi/$UUID/estatus" -H "$AUTH"
curl -sS "$API/cfdi/$UUID/acuse" -H "$AUTH" -o "Acuse_$UUID.pdf"
```
