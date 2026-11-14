# Proyecto Catalyst: Reportes

Reportes de ReportesSandbox en pestañas web de Books. Pedido del usuario (2026-11-14): empezar por
los reportes (WIP, Reporte 03 y los demás de ReportesAptus). **Todo es de solo lectura.**

| | |
|---|---|
| Proyecto de Catalyst | `ReportsForAptusFinancials` (`247000003819490`) |
| URL de la función | `https://reportsforaptusfinancials-730085095.development.catalystserverless.com/server/aptus_report_services` |
| Función | `aptus_report_services` → `functions/aptus_report_services` |
| Slates (3 de 3) | WIP (publicada); Ingresos (Reporte 03, publicada); Cobranza (estado de cuenta, facturas con CFDI, LEDES; falta su Slate) |

## Piezas

| Pieza | Carpeta | Repositorio | Slate / Deployment Name |
|---|---|---|---|
| Función | `functions/aptus_report_services` | `AptusReportServices` ✓ | — |
| Cobranza | `UniversalAptusCobranza` | `UniversalAptusCobranza` ✓ | `universal-aptus-cobranza` |
| WIP | `UniversalAptusWip` | `UniversalAptusWip` ✓ | `universal-aptus-wip` |
| Ingresos | `UniversalAptusIngresos` | `UniversalAptusIngresos` ✓ | `universal-aptus-ingresos` |

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

1. ~~Proyecto, función y repo~~ Hecho (2026-11-14): desplegada y subida. En vivo (solo lectura):
   clientes, catálogo de reportes, WIP pendiente (185 renglones, 749,029.98 MXN y 1,451 USD; 1 s),
   WIP completo (414), ingresos 2020-2022 (4,738,750.84 MXN, cuadre 0; 6 s), facturas con CFDI;
   filtro inválido → 400 y POST → 404.
2. ~~Rutas de WIP e ingresos~~ Hecho (2026-11-14): en ReportesSandbox y en la función.
3. WIP (2026-11-14): pantalla hecha y en GitHub. Tema Navy. Pendiente / Facturado / Todo, tipos,
   fechas, moneda, origen, búsqueda y responsable; árbol con totales por moneda; aviso de clientes sin
   responsable con enlace a Configuración del proyecto; CSV; reintento ante `{ listo: false }`.
   Probada en Chrome con datos reales sin escribir: los totales cuadran con la API (pendiente
   749,029.98 MXN / 1,451 USD; todo 974,755.96 MXN / 1,513.57 USD / 261.96 EUR). 6 pruebas.
   Slate y CORS verificados: la Slate publicada da los mismos totales, sin escrituras ni errores.
4. Ingresos (2026-11-14): pantalla hecha y en GitHub. Periodo (mes anterior por omisión, este mes,
   este año, año anterior u otro); responsable, abogado, moneda, concepto y desglose; pestañas
   Resumen, Detalle por factura (búsqueda y CSV) y Conciliación CFDI (inconsistencias por tipo, CSV).
   Con filtros el servidor no da cuadre (trae `nota`) y la pantalla lo dice. Probada en Chrome con
   datos reales sin escribir: 2020-2022 = 4,738,750.84 MXN, 66 pagos, 62 facturas, cuadre 0; Laura
   Romero M. = 10,030.43 (3 de 62 facturas). 6 pruebas. Slate y CORS verificados: la Slate publicada
   da las mismas cifras, sin escrituras ni errores.
5. Cobranza (2026-11-14): pantalla hecha y en GitHub. Estado de cuenta (buscador de clientes, con saldo
   o todas, fecha de corte, antigüedad, CSV), Facturas y CFDI (con botón a su LEDES) y LEDES (vista previa,
   avisos UTBMS, descarga .txt). Probada en Chrome con datos reales sin escribir: Avolar saldo 1,154.00 MXN
   (igual al de Books; 3 facturas con saldo, 5 en total), 5 Prebills facturadas, LEDES de la #3 =
   4,520.00 con 2 líneas, Prebill 9999 → "no existe". 5 pruebas. **Faltan la Slate
   `universal-aptus-cobranza` y su dominio en CORS.**
