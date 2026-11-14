# Proyecto Catalyst: Reportes

Reportes de ReportesSandbox en pestañas web de Books. Pedido del usuario (2026-11-14): empezar por
los reportes (WIP, Reporte 03 y los demás de ReportesAptus). **Todo es de solo lectura.**

| | |
|---|---|
| Proyecto de Catalyst | `ReportsForAptusFinancials` (por crear) |
| Función | `aptus_report_services` → `functions/aptus_report_services` |
| Slates (0 de 3) | WIP; Ingresos (Reporte 03); Cobranza (estado de cuenta, facturas con CFDI, LEDES) |

## Piezas

| Pieza | Carpeta | Repositorio | Slate / Deployment Name |
|---|---|---|---|
| Función | `functions/aptus_report_services` | `AptusReportServices` (por crear) | — |
| Cobranza | `UniversalAptusCobranza` (por hacer) | `UniversalAptusCobranza` | `universal-aptus-cobranza` |
| WIP | `UniversalAptusWip` (por hacer) | `UniversalAptusWip` | `universal-aptus-wip` |
| Ingresos | `UniversalAptusIngresos` (por hacer) | `UniversalAptusIngresos` | `universal-aptus-ingresos` |

## Rutas de ReportesSandbox (2026-11-14)

Pedidas con `docs/PROMPT_REPORTES_SANDBOX_REPORTES.md`; ya existen `GET /reportes`, `GET /wip` y
`GET /ingresos` (detalle en `prebill-api.md`, sección Reportes). Lo que importa para las pantallas:

- Sin copia (tras reiniciar el servicio) responden **202 `{ listo: false }`** a los 15 s: la pantalla
  vuelve a consultar. La función lo reenvía como 200 con el mismo cuerpo.
- **WIP**: por omisión trae también lo facturado (igual que la página `/wip`); la pantalla manda
  `estado=pendiente` para ver solo lo pendiente. ~414 renglones, 551 KB; con copia 4–11 ms.
- **Ingresos** (Reporte 03): todo en MXN; árbol moneda → responsable → cliente → factura → abogado,
  resumen por abogado, conciliación con CFDI y cuadre. No se pudo cuadrar contra el original (otra
  org); en el sandbox lo repartido cuadra a 0 con lo cobrado. El primer cálculo de un periodo largo
  tarda ~70 s (varias respuestas 202).
- ReportesSandboxECLegal tiene el mismo descuadre que se corrigió en el sandbox (no resta pagos
  reembolsados); no se tocó por ser de solo lectura.

## Rutas de `aptus_report_services`

Solo GET. Cualquier POST, PATCH o DELETE responde 404.

| Ruta | Va a | Reglas |
|---|---|---|
| `/:org/reportes` | `GET /reportes` | catálogo de reportes y sus filtros |
| `/:org/wip` | `GET /wip` | `desde`, `hasta`, `cliente_id`, `proyecto_id`, `abogado_id`, `responsable` (texto), `moneda`, `estado` (`sin_liberar`, `liberado`, `en_prebill`, `sin_facturar`, `facturado`, `pendiente`), `tipo` (`tiempo`, `gasto`, `fijo`), `origen` (`aptus`, `books`), `forzar=1`; listas separadas por coma; 25 s de espera |
| `/:org/ingresos` | `GET /ingresos` | `desde`, `hasta`, `cliente_id`, `abogado_id`, `responsable`, `abogado`, `moneda`, `sin_desglose` (`solo`, `excluir`), `concepto` (`honorarios`, `todos`), `forzar=1`; 25 s de espera |
| `/:org/clientes` | `GET /clientes` | selector de cliente |
| `/:org/facturas-cfdi` | `GET /facturas-cfdi` | `?forzar` |
| `/:org/estado-cuenta` | `GET /formatos/estado-cuenta?salida=json` | `cliente_id` obligatorio (dígitos); `estado` `pendientes`/`todas`; `desde`/`hasta` fechas reales, desde ≤ hasta |
| `/:org/ledes/:prebillId` | `GET /formatos/ledes/:id?salida=json` | `client_id`, `client_matter_id`, `law_firm_id` opcionales (≤ 40 caracteres) |

Pruebas: `cd functions/aptus_report_services && npm test` (8). Filtros desconocidos no se reenvían.

## Pendientes

1. El usuario crea el proyecto `ReportsForAptusFinancials`, la función `aptus_report_services`
   (Advanced I/O, Node 24), la variable `AUTH_TOKEN`, el segmento de caché `APTUS_MIRROR_CONN_DATA`
   y el repo `AptusReportServices` → despliego, subo y pruebo en vivo.
2. ~~Rutas de WIP e ingresos~~ Hecho (2026-11-14): en ReportesSandbox y en la función.
3. Slates: Cobranza primero (ya tiene API), luego WIP e Ingresos.
