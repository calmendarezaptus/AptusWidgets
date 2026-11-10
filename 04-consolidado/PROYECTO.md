# Proyecto Catalyst: Consolidado

Pantallas que cruzan las tres áreas: **calendario unificado** (tiempos + gastos + honorarios fijos
con filtros), **liberaciones** y **configuración del proyecto**. Contexto en
`docs/CONTEXTO_CATALYST.md` §5.3 y §5.4.

| | |
|---|---|
| Proyecto de Catalyst | `OverviewForAptusFinancials` (por crear) |
| Función | `aptus_overview_services` → `functions/aptus_overview_services` |
| Slates (3 de 3) | Calendario unificado · Liberaciones · Configuración del proyecto |
| Estado | Función en esqueleto (lecturas del calendario unificado); apps por construir — al final del orden |

## Piezas

| Pieza | Carpeta | Repositorio | Slate / Deployment Name |
|---|---|---|---|
| Función | `functions/aptus_overview_services` | `AptusOverviewServices` (por crear) | — |
| Calendario unificado | `UniversalAptusCalendar` (por crear) | `UniversalAptusCalendar` | `universal-aptus-calendar` |
| Liberaciones | `UniversalAptusLiberaciones` (por crear) | `UniversalAptusLiberaciones` | `universal-aptus-liberaciones` |
| Configuración del proyecto | `UniversalAptusProjectConfig` (por crear) | `UniversalAptusProjectConfig` | `universal-aptus-projectconfig` |

El calendario unificado **no llama a las otras funciones**: lee todo de ReportesSandbox con su
propia función. Editar un registro abre la captura de su área (tiempos, gastos u honorarios fijos)
con `origin` para regresar.

## Rutas de `aptus_overview_services`

Hoy (esqueleto):

| Método | Ruta | Filtros reenviados |
|---|---|---|
| GET | `/:org/clientes`, `/:org/proyectos`, `/:org/abogados` | — |
| GET | `/:org/tiempos` | `proyecto_id, abogado_id, liberado, facturado, prebill_id, facturable, tarea_estandar_id, books_estado` |
| GET | `/:org/gastos` | `proyecto_id, liberado, facturado, prebill_id, categoria_id, facturable, abogado_id, pagado_por, reembolso_estado` |
| GET | `/:org/cargos-fijos` | `proyecto_id, liberado, facturado, prebill_id` |

Por construir:

| Pantalla | Rutas | Reglas |
|---|---|---|
| Liberaciones | `POST /:org/liberaciones {desde, hasta, cliente_id?}`, `GET /:org/liberado-disponible` | Sin `cliente_id` libera **todos los clientes**: confirmación explícita. No hay "deshacer". |
| Configuración | `GET/PATCH /:org/proyectos/:id`, tarifas, responsables, `GET /:org/impuestos` | `sincronizar-tareas` y `crear-en-books` **escriben en Books**: solo con aprobación y con vista previa primero. |

## Configuración en Catalyst

1. Función `aptus_overview_services` (Node 24, Advanced I/O).
2. Variable `AUTH_TOKEN` (`.env` local ya creado, no se versiona; mejor como variable de la consola).
3. Caché: segmento `APTUS_MIRROR_CONN_DATA`.
4. Dominios autorizados: las 3 Slates de este proyecto (`universal-aptus-calendar`,
   `universal-aptus-liberaciones`, `universal-aptus-projectconfig` `.onslate.com`).

## Pruebas

```bash
cd functions/aptus_overview_services && npm test # rutas + core
```

## Pendientes

1. Calendario unificado (base: calendario de gastos; un color por tipo de registro y filtro de tipo).
2. Liberaciones y su servicio.
3. Configuración del proyecto y su servicio.
