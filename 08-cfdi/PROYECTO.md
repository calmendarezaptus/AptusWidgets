# Proyecto Catalyst: CFDI

Timbrar, consultar y cancelar CFDI y complementos de pago desde los widgets, con el proveedor `aptus` de
ReportesSandbox, que llama a la API v2 de facturación (otro servidor). Plan: `docs/PLAN_CFDI.md`;
contrato de la API v2: `docs/API_V2_CONTRATO.md`. **Solo modo prueba** (emisor `pruebas-eku`): los UUID no
existen en el SAT. Producción, por despacho y con aprobación expresa del usuario.

| | |
|---|---|
| Proyecto de Catalyst | `CfdiForAptusFinancials` (por crear) |
| Función | `aptus_cfdi_services` → `functions/aptus_cfdi_services` |
| Slates (0 de 3) | Por timbrar · CFDI emitidos · Complementos de pago |

| Pieza | Carpeta | Repositorio | Slate |
|---|---|---|---|
| Función | `functions/aptus_cfdi_services` | `AptusCfdiServices` (por crear) | — |
| Por timbrar | `UniversalAptusCfdiPorTimbrar` | (por crear) | `universal-aptus-cfdi-portimbrar` |
| CFDI emitidos | `UniversalAptusCfdiEmitidos` | (por crear) | `universal-aptus-cfdi-emitidos` |
| Complementos de pago | `UniversalAptusCfdiPagos` | (por crear) | `universal-aptus-cfdi-pagos` |

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

## Pendientes

1. El usuario crea `CfdiForAptusFinancials`, la función (Advanced I/O, Node 24, `AUTH_TOKEN`, caché
   `APTUS_MIRROR_CONN_DATA`) y los repos → despliego y pruebo en vivo (solo lectura).
2. Las 3 Slates; botón en el detalle de Prebill; sección "CFDI" en el menú.
