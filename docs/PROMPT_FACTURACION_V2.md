# Prompt para Claude Code en el servidor de `facturacion`: API v2 sin Creator

En `/home/ubuntu/html/facturacion` (pm2 `facturacion`; guía en `CLAUDE.md` y `SISTEMA_DETALLADO.md`) quiero
una **API v2** que timbre, consulte y cancele CFDI **sin Zoho Creator**, para que la llame otro sistema
propio (ReportesSandbox) que vive **en otro servidor**, por HTTPS.

## Reglas que no se negocian

- **Lo que hoy llama Deluge no cambia:** mismas rutas, parámetros, respuestas y efectos en Creator/Books.
  Todo lo nuevo va bajo `/v2/` y en módulos nuevos; si tocas código compartido, que el camino de Deluge
  quede idéntico.
- **No timbres ni canceles en producción.** Todas las pruebas, en modo prueba (Solución Factible de
  pruebas) con el CSD de pruebas del SAT. Si en algún momento algo pediría producción, detente y pregúntame.
- Se mantienen las reglas críticas: una vez timbrado **siempre** se responde éxito con el timbre;
  duplicadoGuard; estatus de cancelación siempre del SAT (`tt=0` en complementos); excepciones por RFC.
- Nunca registres en logs tokens, contraseñas, PFX ni el XML completo en las rutas v2.
- Antes de cambiar nada: pon el proyecto en **git** (commit inicial del estado actual, con un
  `.gitignore` que excluya `src/Key/`, `src/data/`, `src/temporal/`, `src/out/`, `src/recovery/`,
  `src/pdfs_generados/`, `node_modules/`, logs y cualquier archivo con credenciales) y agrega `axios` y
  `form-data` a `package.json` con la versión que ya está instalada.

## 1. Seguridad (obligatorio: la llamada viene de otro servidor)

- **Token por cliente** en `Authorization: Bearer <token>`. Guárdalos con hash (sha256) en
  `src/data/clientes-api.json` (fuera de git): `{ cliente, hash, emisores: [...] , activo }`. Un cliente
  solo puede usar los emisores que tenga asignados. Sin token válido → 401; emisor no permitido → 403.
- **Credenciales del PAC en el servidor**, por emisor, en `src/data/emisores.json` (permisos 600, fuera de
  git): `{ id, rfc, pac: "solucionFactible"|"EDICOM", usuario, password, pfxPassword, prueba: {…},
  produccion_habilitada: false, serviceNamePDF, series: {I, E, P} }`. El cliente manda solo `emisor`
  (id), **nunca** contraseñas. `produccion_habilitada` solo lo cambio yo a mano.
- Las rutas v2 **no aceptan credenciales por query string**.
- Dime qué hay que configurar en nginx para exponer solo `/v2/` a ese cliente (HTTPS; si se puede,
  lista de IP permitidas) sin cambiar lo que hoy usa Deluge.

## 2. Emisor de pruebas

- Da de alta un emisor de pruebas con el **CSD de pruebas del SAT** (p. ej. `EKU9003173C9`, el que
  acepte Solución Factible de pruebas) en `src/Key/` y en `emisores.json` con `prueba` habilitado y
  `produccion_habilitada:false`. Cuida la regla de `resolveKeyPaths` (prefijo de 3 letras: que no choque
  con otro emisor).

## 3. Rutas v2 (JSON; errores con HTTP real y `{ code, message, detalle }`)

| Ruta | Qué hace |
|---|---|
| `POST /v2/cfdi` | Timbra (o borrador) un CFDI I/E |
| `POST /v2/pagos` | Timbra un Complemento de Pago 2.0 |
| `GET /v2/cfdi/:uuid` | Registro guardado: estado, timbre, totales, serie/folio, fechas, cancelación |
| `GET /v2/cfdi/:uuid/xml` · `/pdf` · `/acuse` | Archivos |
| `POST /v2/cfdi/:uuid/cancelar` | Cancela (`motivo` 01–04, `sustituto` si 01) |
| `GET /v2/cfdi/:uuid/estatus` | Consulta el SAT en vivo y actualiza el registro |
| `GET /v2/emisores/:id/timbres` | Timbres disponibles (si el PAC lo permite) |
| `GET /v2/salud` | Sin token; para monitoreo |

**Cuerpo de `POST /v2/cfdi`:**

```jsonc
{
  "emisor": "pruebas-eku",              // id en emisores.json
  "idempotencyKey": "636939444:inv:446794000049762016",
  "prueba": true,                       // false solo si el emisor tiene produccion_habilitada
  "modo": "timbrado" | "borrador",
  "comprobante": { /* los mismos campos que hoy lee /procesar (§7.2): fact_serie, invoiceNumber, fecha,
                     formaDePago, metodoDePago, moneda, TipoCambio, receptor_*, articulos[], cfdiRelacionados…
                     Emisor (rfc, razón social, régimen, noCertificado, LugarExpedicion) sale de emisores.json
                     si no viene */ },
  "pdf": { "generar": true, "serviceName": "opcional; por omisión el del emisor" },
  "books": { "enviar": false },         // igual que hoy, opcional
  "callbackUrl": "opcional, https"      // ver §5
}
```

**Respuesta 200:** `{ uuid, serie, folio, fecha_timbrado, total, moneda, timbre:{…como hoy…}, xml (base64),
pdf (base64 | null), pdf_error (si el PDF falló), repetido: false }`.

## 4. Idempotencia y archivos

- `idempotencyKey` obligatorio. Si ya existe un CFDI timbrado con esa llave → **200 con el mismo
  resultado y `repetido:true`** (no 409, no vuelve a timbrar). Misma llave con un comprobante distinto →
  409 `IDEMPOTENCY_CONFLICT`. En proceso → 409 `EN_PROCESO` (el cliente reintenta).
- Mantén además duplicadoGuard por serie/folio como hoy.
- **Guarda cada documento v2** en `src/v2/{emisor}/{uuid}/` (xml, pdf, acuse, `meta.json` con la llave,
  estado y fechas) con escritura atómica. Es la fuente para `GET /v2/cfdi/...`: no debe borrarlo la
  limpieza horaria **ni `cleanup_disk.sh`** (dime qué ajustar en ese script).
- Si el PDF falla después de timbrar: responde 200 con `pdf:null` y `pdf_error`; un barrido lo reintenta
  y `GET .../pdf` lo entrega cuando exista. Nada de v2 va a `src/recovery/` de Creator.

## 5. Cancelación y seguimiento

- `POST /v2/cfdi/:uuid/cancelar` usa las credenciales del emisor, guarda el acuse junto al CFDI y responde
  como hoy (`statusSAT`, `canceladoDefinitivo`, `requiereAprobacion`). Idempotente: si ya está cancelado,
  responde el estado actual.
- Los 202 entran al barrido existente; cuando se resuelvan, actualiza `meta.json` y, si el CFDI trae
  `callbackUrl`, haz `POST` ahí con `{uuid, estado, statusSAT}` firmado con HMAC (secreto por cliente en
  `clientes-api.json`), con reintentos. Si no hay callback, el cliente consulta `GET .../estatus`.

## 6. Retenciones (solo diseño por ahora)

El CFDI de ingreso hoy no genera retenciones. **No lo implementes todavía:** dime qué haría falta para
soportar ISR 10 % e IVA 2/3 por concepto y a nivel comprobante (incluido el PDF) y cuánto afecta al
camino de Deluge. Lo decido después.

## 7. Al terminar

- Pruebas automatizadas (`node --test`) para v2 con el PAC simulado: token (401/403), emisor sin
  producción (403 si `prueba:false`), idempotencia (mismo resultado / conflicto), PDF fallido, archivos
  guardados, cancelación y callback. **Ninguna prueba llama al SAT ni a un PAC real.**
- Una prueba **manual** en modo prueba de punta a punta con el emisor de pruebas: timbrar, consultar,
  bajar XML/PDF, cancelar y consultar estatus. Reporta los UUID de prueba.
- Comprueba que una llamada de Deluge de prueba (borrador, sin timbrar) sigue funcionando igual.
- Actualiza `SISTEMA_DETALLADO.md` (sección v2) y `CLAUDE.md`.
- Dame: la URL pública de v2, cómo crear el token del cliente "ReportesSandbox" (sin escribírmelo en el
  chat si ya lo generaste: dime dónde quedó), los pasos de nginx, y el contrato final (campos y
  ejemplos) para integrarlo en ReportesSandbox.
