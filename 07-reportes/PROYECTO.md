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
| WIP | `UniversalAptusWip` (espera la API) | `UniversalAptusWip` | `universal-aptus-wip` |
| Ingresos | `UniversalAptusIngresos` (espera la API) | `UniversalAptusIngresos` | `universal-aptus-ingresos` |

## Lo que falta en ReportesSandbox

El WIP solo existe como página HTML (`/wip`) y el Reporte 03 solo en la copia de EC Legal
(`/ingresos`, solo lectura, cliente real). Se pidió a ReportesSandbox, revisando ReportesAptus, el
inventario de reportes y las rutas JSON `GET /reportes`, `GET /wip` y `GET /ingresos`:
`docs/PROMPT_REPORTES_SANDBOX_REPORTES.md`. Cuando lleguen, se agregan a `CATALOGS` con sus filtros.

## Rutas de `aptus_report_services`

Solo GET. Cualquier POST, PATCH o DELETE responde 404.

| Ruta | Va a | Reglas |
|---|---|---|
| `/:org/clientes` | `GET /clientes` | selector de cliente |
| `/:org/facturas-cfdi` | `GET /facturas-cfdi` | `?forzar` |
| `/:org/estado-cuenta` | `GET /formatos/estado-cuenta?salida=json` | `cliente_id` obligatorio (dígitos); `estado` `pendientes`/`todas`; `desde`/`hasta` fechas reales, desde ≤ hasta |
| `/:org/ledes/:prebillId` | `GET /formatos/ledes/:id?salida=json` | `client_id`, `client_matter_id`, `law_firm_id` opcionales (≤ 40 caracteres) |

Pruebas: `cd functions/aptus_report_services && npm test` (6).

## Pendientes

1. El usuario crea el proyecto `ReportsForAptusFinancials`, la función `aptus_report_services`
   (Advanced I/O, Node 24), la variable `AUTH_TOKEN`, el segmento de caché `APTUS_MIRROR_CONN_DATA`
   y el repo `AptusReportServices` → despliego, subo y pruebo en vivo.
2. Prompt de reportes en el server (`docs/PROMPT_REPORTES_SANDBOX_REPORTES.md`) → con su resumen,
   rutas de WIP e ingresos en la función.
3. Slates: Cobranza primero (ya tiene API), luego WIP e Ingresos.
