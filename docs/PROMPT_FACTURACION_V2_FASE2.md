# Prompt para Claude Code en el servidor de `facturacion`: API v2, fase 2

En `/home/ubuntu/html/facturacion` (guía en `CLAUDE.md` y `SISTEMA_DETALLADO.md` §23) quiero ampliar la **API
v2** con tres cosas: datos más completos de la cancelación, **leyenda de cancelación en el PDF** y **moneda y
tipo de cambio**. El cliente es ReportesSandbox (contrato en `docs/API_V2_CONTRATO.md`).

## Reglas (las mismas de la fase 1)

- **Nada de lo que llama Deluge cambia.** Si tocas código o plantillas compartidas, compara antes y después
  (como en la fase 1: misma respuesta y XML idéntico byte por byte en una llamada borrador de `/procesar`).
- **Solo modo prueba**, emisor `pruebas-eku`. Nada en producción.
- Todo cambio de la API es **compatible hacia atrás**: campos nuevos opcionales; lo que hoy responde, sigue igual.
- Sin secretos ni XML completo en logs. Commit en git al terminar cada parte.

## 1. Cancelación: estado completo

- En `GET /v2/cfdi/{uuid}`, en `/estatus` y en los callbacks, agrega `cancelacion.resultado` con un valor
  claro: `en_proceso` (202), `aceptada` (203), `sin_aceptacion` (201), `plazo_vencido` (204) o
  `rechazada` (205), más `fecha_solicitud`, `fecha_resultado`, `motivo` y `sustituto`. Hoy un 205 se ve
  solo como `estado:"vigente"`; tiene que quedar claro que **el receptor rechazó la cancelación** (y que se
  puede volver a solicitar).
- Revisa el barrido de las 202: que siga hasta que haya resultado. En el SAT el receptor tiene 72 h hábiles
  y después aplica el plazo vencido (204); no lo abandones antes de eso (si hay un límite, que sea amplio y
  se informe en el registro).
- El acuse en XML ya existe (`/acuse?formato=xml`): confirma que sirve para CFDI y complementos, y
  documenta qué contiene en modo prueba.

## 2. Leyenda en el PDF

Cuando un CFDI (ingreso, egreso **y complemento de pago**) entra en `cancelacion_en_proceso` o queda
`cancelado`, su PDF debe decirlo:

- **En proceso:** "EN PROCESO DE CANCELACIÓN", con la fecha de la solicitud y el motivo.
- **Cancelado:** "CANCELADO", con la fecha de cancelación, el motivo y, si es 01, el UUID que lo sustituye.
- **Rechazada (205):** vuelve al PDF original (sin leyenda).

Propón y aplica la forma menos invasiva: idealmente una **marca de agua/sello sobre el PDF ya generado**
(sin tocar las plantillas PHP de los despachos). Si la única opción razonable es un parámetro nuevo en las
plantillas, dímelo antes y no las cambies.

- `GET /v2/cfdi/{uuid}/pdf` entrega el PDF **con la leyenda vigente**; `?original=1` entrega el PDF sin
  leyenda. Regénéralo cuando cambie el estado (al cancelar, en el barrido y en `/estatus`).
- El XML no cambia (el timbrado es inmutable).

## 3. Moneda y tipo de cambio

ReportesSandbox va a permitir timbrar **en la moneda de la factura o en MXN** (convirtiendo los importes) y
elegir el **tipo de cambio**: el de Books, el **FIX de Banxico del día hábil anterior** o uno **manual**.

- **`GET /v2/tipo-cambio?moneda=USD&fecha=AAAA-MM-DD`** (con token): FIX de Banxico del día hábil anterior a
  `fecha` (usa la lógica de `excepcionesAvafirm.js`, generalizada, sin tocar el comportamiento de
  Avafirm), con caché. Responde `{ moneda, fecha_solicitada, fecha_fix, tipo_cambio, fuente:"banxico_fix" }`.
  Monedas: USD y EUR (las que ya maneja).
- **Rango permitido por el SAT:** investiga en el código, en el PAC (Solución Factible y EDICOM) y en la
  documentación del Anexo 20 qué variación del `TipoCambio` acepta el SAT respecto al de Banxico, y qué pasa
  si se sale (¿rechazo? ¿requiere `Confirmacion`?). Implementa en `POST /v2/cfdi` y `/v2/pagos` una
  validación previa con un error claro (`422 TIPO_CAMBIO_FUERA_DE_RANGO`, con el rango aceptado y el FIX en
  `detalle`) para que nunca llegue al PAC un tipo de cambio que se va a rechazar. Dime qué encontraste y qué
  límite usaste.
- **PDF:** que imprima el tipo de cambio que lleva el CFDI (hoy hay `pdf.tipoCambio`; revisa que con
  `moneda: MXN` y una factura convertida no imprima un TC que confunda).
- **Complementos de pago:** confirma que `TipoCambioP` y `EquivalenciaDR` funcionan con pagos en USD a
  facturas en USD, pagos en MXN a facturas en USD y al revés, con una prueba manual de cada caso en modo prueba.

## Al terminar

- Pruebas automatizadas nuevas (PAC, SAT y Banxico simulados): resultados 201/202/203/204/205, PDF con
  leyenda y `?original=1`, regeneración al cambiar de estado, tipo de cambio dentro y fuera de rango,
  endpoint de tipo de cambio con caché, complementos multimoneda.
- Prueba manual en modo prueba: cancelar un CFDI y un complemento y bajar el PDF con leyenda; timbrar una
  factura en USD con TC de Banxico y otra convertida a MXN.
- Comparación de Deluge antes y después (byte por byte, como en la fase 1).
- Actualiza `SISTEMA_DETALLADO.md`, `CLAUDE.md` y **`API_V2_CONTRATO.md`** (campos nuevos, errores nuevos y
  ejemplos), y dame el resumen para ReportesSandbox.
