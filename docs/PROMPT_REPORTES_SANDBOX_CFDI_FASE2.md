# Prompt para Claude Code en ReportesSandbox: CFDI, fase 2

En ReportesSandbox (`/var/www/html/NodeProyects/ReportesSandbox`, pm2 `sandbox-wip`) quiero ampliar el
proveedor `aptus` de CFDI (archivos `cfdiAptus.js`, `cfdiApiV2.js`, `cfdiRutas.js`) con: cancelación más
clara, PDF con leyenda de cancelación y **moneda y tipo de cambio**. La API v2 de facturación ya tiene lo que
necesitas; te paso su contrato actualizado (`API_V2_CONTRATO.md`) junto con este prompt.

## Reglas (las mismas de la fase 1)

- **Solo modo prueba** (`prueba:true`, emisor `pruebas-eku`). No escribas en Books. No toques
  ReportesSandboxECLegal. `node respaldo.js` antes de cambiar la base.
- Las rutas actuales siguen respondiendo igual; lo nuevo son campos opcionales o rutas nuevas.
- Mismo formato de error (`{error, bloqueantes?, avisos?, detalle?}`).

## 1. Cancelación

- **Resultado claro:** guarda y devuelve en `GET /cfdi/:id` el `cancelacion.resultado` de la API
  (`en_proceso`, `aceptada`, `sin_aceptacion`, `plazo_vencido`, `rechazada`), con fechas, motivo y sustituto.
  Un **205** debe quedar como `vigente` **con** `cancelacion.resultado:"rechazada"` y un texto que lo diga, y
  permitir volver a cancelar.
- **¿Se puede cancelar?** Nueva `GET /cfdi/:id/cancelable` → `{ puede, bloqueantes[], avisos[],
  complementos_vigentes[{cfdi_id, uuid, serie, folio}] }`. Caso principal: una factura PPD con complementos
  vigentes **no se cancela hasta cancelar sus complementos** (regla del SAT): dilo antes de intentarlo y
  lista cuáles. Que `POST /cfdi/:id/cancelar` use la misma validación.
- **Seguimiento:** el barrido deja de consultar a los 7 días. Cámbialo para que siga hasta que haya
  resultado (en producción, 72 h hábiles y luego plazo vencido), con una frecuencia que baje con el tiempo
  (cada 30 min las primeras 72 h, luego cada 6 h) y un límite amplio que quede registrado. En modo prueba,
  que no consulte indefinidamente (el 202 nunca se resuelve).
- **Acuse en XML:** `GET /cfdi/:id/acuse?formato=xml` (hoy solo PDF), para CFDI y complementos.

## 2. PDF con leyenda

- `GET /cfdi/:id/pdf` entrega el PDF **con la leyenda vigente** ("EN PROCESO DE CANCELACIÓN" o
  "CANCELADO") que ahora genera la API; `?original=1` el original. Cuando cambie el estado (al cancelar, en
  el barrido y en `/estatus`), vuelve a bajar el PDF de la API y reemplaza el guardado (conserva el original).
- `GET /cfdi/:id` indica `pdf.leyenda` (`null`, `en_proceso`, `cancelado`).

## 3. Moneda y tipo de cambio

**Configuración** (`config_despacho.cfdi.aptus`):

| Campo | Valores |
|---|---|
| `moneda_cfdi` | `factura` (omisión, como hoy) o `mxn` (timbra en MXN las facturas en otra moneda) |
| `tipo_cambio_fuente` | `books` (omisión, como hoy), `banxico` (FIX del día hábil anterior, de la API v2) o `manual` |

**Por factura:** `GET /cfdi/preparar/:invoice_id` acepta `?moneda=factura|mxn`, `?tc_fuente=books|banxico|manual`
y `?tipo_cambio=` (solo con `manual`), y devuelve `moneda_cfdi`, `tipo_cambio` con su `fuente`, el TC de Books
y el FIX de Banxico para comparar, y los totales en la moneda del CFDI. `POST /cfdi/timbrar` acepta los mismos
campos y los guarda en el registro (no se pueden cambiar después de timbrar).

**Reglas:**
- `moneda=mxn` con factura en MXN no hace nada. Con factura en USD/EUR: convierte cada importe con el TC y
  redondea como lo hace la API (conceptos a 2 decimales; el total lo recalcula la API). Muestra la
  diferencia contra Books × TC.
- `manual`: TC > 0, hasta 6 decimales; valida el rango con la regla de la API (`TIPO_CAMBIO_FUERA_DE_RANGO`)
  y muéstralo como bloqueante en la vista previa, antes de timbrar.
- El PDF imprime el TC usado.
- La conciliación (`/facturas-cfdi`, `/ingresos`) debe entender un CFDI en MXN de una factura en USD (ya
  existe el aviso `CFDI_EN_MXN`).
- **Complementos:** `TipoCambioP` y `EquivalenciaDR` con la misma lógica cuando el pago y la factura están en
  monedas distintas. `GET /cfdi/complemento/preparar/:payment_id` acepta `tc_fuente`/`tipo_cambio` para el
  pago y muestra la equivalencia.

## Al terminar

- Pruebas con la API v2 simulada: resultados 201–205 (incluido rechazo y volver a cancelar), `cancelable`
  con complementos vigentes, barrido escalonado, acuse XML, PDF con leyenda y original, las combinaciones de
  moneda y fuente de TC, TC fuera de rango como bloqueante, complementos multimoneda.
- Prueba manual en modo prueba: una factura en USD timbrada en USD con TC de Banxico y otra en MXN con TC
  manual; cancelar una y bajar el PDF con leyenda y el acuse XML; intentar cancelar una PPD con complemento
  (debe bloquearse) y cancelar primero el complemento.
- Documenta en la consola, el README y el manual de la API; dame el resumen de rutas y campos nuevos con su
  forma exacta, para ajustar la función de Catalyst y las pantallas.
