# Proyecto Catalyst: CFDI

Timbrar, consultar y cancelar CFDI y complementos de pago desde los widgets, con el proveedor `aptus` de
ReportesSandbox, que llama a la API v2 de facturación (otro servidor). Plan: `docs/PLAN_CFDI.md`;
contrato de la API v2: `docs/API_V2_CONTRATO.md`. **Solo modo prueba** (emisor `pruebas-eku`): los UUID no
existen en el SAT. Producción, por despacho y con aprobación expresa del usuario.

| | |
|---|---|
| Proyecto de Catalyst | `CfdiForAptusFinancials` (`247000003915007`) |
| URL de la función | `https://cfdiforaptusfinancials-730085095.development.catalystserverless.com/server/aptus_cfdi_services` |
| Función | `aptus_cfdi_services` → `functions/aptus_cfdi_services` |
| Slates (3 de 3) | Por timbrar · CFDI emitidos · Complementos de pago |

| Pieza | Carpeta | Repositorio | Slate |
|---|---|---|---|
| Función | `functions/aptus_cfdi_services` | `AptusCfdiServices` ✓ | — |
| Por timbrar | `UniversalAptusCfdiPorTimbrar` | `UniversalAptusCfdiPorTimbrar` ✓ | `universal-aptus-cfdi-portimbrar` |
| CFDI emitidos | `UniversalAptusCfdiEmitidos` | `UniversalAptusCfdiEmitidos` ✓ | `universal-aptus-cfdi-emitidos` |
| Complementos de pago | `UniversalAptusCfdiPagos` | `UniversalAptusCfdiPagos` ✓ | `universal-aptus-cfdi-pagos` |

## Rutas de `aptus_cfdi_services`

| Método | Ruta | ReportesSandbox | Reglas |
|---|---|---|---|
| GET | `/:org/cfdi/proveedor` | `GET /cfdi/proveedor` | estado del proveedor (sin valores secretos) |
| GET | `/:org/cfdi/pendientes` | `GET /cfdi/pendientes` | `?todas=1` |
| GET | `/:org/cfdi/preparar/:invoice_id` | `GET /cfdi/preparar/:id` | sin timbrar: receptor, conceptos, bloqueantes |
| GET | `/:org/cfdi/preparar/:invoice_id/borrador` | `…?borrador=1` | PDF (o `?formato=xml`) de vista previa; no consume la llave |
| POST | `/:org/cfdi/timbrar` | `POST /cfdi/timbrar` | `{invoice_id, confirmar:true}` → 202 `{cfdi_id}` |
| GET | `/:org/cfdi` | `GET /cfdi` | filtros `origen, tipo, estado, invoice_id, payment_id, invoice_number` |
| GET | `/:org/cfdi/:id` | `GET /cfdi/:id` | `?solicitud=1` |
| GET | `/:org/cfdi/:id/estatus` | `GET /cfdi/:id/estatus` | |
| GET | `/:org/cfdi/:id/{xml,pdf,acuse}` | idem | binario; `?descargar=1` |
| POST | `/:org/cfdi/:id/cancelar` | `POST /cfdi/:id/cancelar` | `{motivo 01–04, sustituto (solo con 01), confirmar:true}` |
| GET | `/:org/pagos-por-complementar` | idem | |
| GET | `/:org/cfdi/complemento/preparar/:payment_id` | idem | |
| POST | `/:org/cfdi/complemento` | `POST /cfdi/complemento` | `{payment_id, confirmar:true}` → 202 |
| GET | `/:org/clientes` | `GET /clientes` | |

Archivos binarios: `services/ArchivoService.js` (misma conexión que `core`, sin pasar por `PrebillApiClient`).

## Decisiones pendientes (de la respuesta de ReportesSandbox, 2026-11-25)

- Claves SAT propuestas: honorarios, fijos y gastos `80121600` / `E48` "Servicio" / objeto `02`;
  reembolsos fuera del CFDI (se registra el monto excluido).
- `al_facturar` siempre es PPD; el sandbox quedó en `al_pagar`.
- Callbacks: propuesta de ruta `/cfdi-callback` fuera del token, solo POST desde la IP de la API y con HMAC.
- Escribir en Books (adjuntos y UUID): no implementado.
- Ninguna factura de Prebill se puede timbrar hoy sin corregir datos en Books (cliente sin RFC, línea
  sin IVA, factura en borrador).

## Pantallas (2026-11-25)

Tema Cielo (`theme-sky`). Las tres comparten `src/lib/cfdi.ts` y `src/components/Comun.tsx` (encabezado,
pestañas entre las tres Slates, aviso de modo prueba / proveedor, estado, archivos).

- **Por timbrar:** facturas sin CFDI (de Prebills o todas las de Books), motivo; al elegir una, vista
  previa (receptor con el origen de cada dato, conceptos con clave SAT, totales vs Books, bloqueantes y
  avisos), "Vista previa PDF" (borrador) y "Timbrar CFDI" con confirmación; sigue el trabajo cada 3 s hasta
  2 min y muestra UUID y archivos. `?invoice_id=` abre directo esa factura (botón CFDI del detalle de Prebill).
- **CFDI emitidos:** filtros (tipo, estado, origen) y búsqueda; detalle con datos, impuestos, documentos
  (complementos), XML/PDF/acuse, "Consultar estatus SAT" y "Cancelar CFDI" (motivo 01–04, UUID sustituto
  con 01, casilla "entiendo"). `?cfdi_id=` abre directo.
- **Complementos de pago:** pagos por complementar, vista previa (parcialidades y saldos) y timbrar; lista
  de complementos timbrados.
- Con otro proveedor (Creator, interno) las pantallas solo consultan y lo dicen.
- Detalle de Prebill: botón **CFDI** cuando la Prebill tiene factura. Menú principal: sección **CFDI**.

Probadas en Chrome con datos reales sin escribir: 113 facturas pagadas sin CFDI (todas las de Books; ninguna
de Prebill), INV-000851 bloqueada (sin RFC, concepto no reconocido) con Timbrar deshabilitado; 3 CFDI de
prueba en emitidos; diálogo de cancelar abierto y cerrado sin confirmar; PDF descargado; sin desbordes en
celular. Función 7 pruebas; cada pantalla 5.

## Pendientes

1. ~~Proyecto, función y repos~~ Hecho (2026-11-25): desplegada; en vivo responden proveedor (aptus,
   modo prueba, `al_pagar`), pendientes, preparar, lista, detalle, PDF y acuse.
2. El usuario crea las 3 Slates y agrega sus dominios a CORS → verifico publicadas.
3. Prueba del usuario (modo prueba): completar en Books los datos fiscales de un cliente de prueba,
   timbrar una factura, ver XML/PDF, cancelar con motivo 02 y timbrar un complemento de una factura PPD.
