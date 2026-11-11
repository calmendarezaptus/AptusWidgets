# Proyecto Catalyst: Consolidado

Pantallas que cruzan las tres áreas: **calendario unificado** (tiempos + gastos + honorarios fijos
con filtros), **liberaciones** y **configuración del proyecto**. Contexto en
`docs/CONTEXTO_CATALYST.md` §5.3 y §5.4.

| | |
|---|---|
| Proyecto de Catalyst | `OverviewForAptusFinancials` (`247000003819226`) |
| URL de la función | `https://overviewforaptusfinancials-730085095.development.catalystserverless.com/server/aptus_overview_services` |
| Función | `aptus_overview_services` → `functions/aptus_overview_services` |
| Slates (3 de 3) | Calendario unificado · Liberaciones · Configuración del proyecto |
| Estado | Función desplegada (solo lecturas); calendario unificado listo (2026-11-11), falta su Slate; liberaciones y configuración por construir |

## Piezas

| Pieza | Carpeta | Repositorio | Slate / Deployment Name |
|---|---|---|---|
| Función | `functions/aptus_overview_services` | `AptusOverviewServices` ✓ | — |
| Calendario unificado | `UniversalAptusCalendar` | `UniversalAptusCalendar` ✓ | `universal-aptus-calendar` |
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

## Despliegue de la función con el CLI

```bash
cd 04-consolidado
catalyst project:use 247000003819226      # solo la primera vez en esta máquina
cd functions/aptus_overview_services && npm install && npm test && cd ../..
catalyst deploy --only functions:aptus_overview_services
```

Verificado en vivo (2026-11-11): `tiempos` (29), `gastos` (12), `cargos-fijos` (3), catálogos 200;
`prebills` → 404.

## Configuración en Catalyst

1. Función `aptus_overview_services` (Node 24, Advanced I/O).
2. Variable `AUTH_TOKEN`: viaja en `.env` (local, no se versiona), igual que en las otras áreas.
3. Caché: funciona con el segmento `Default`.
4. Dominios autorizados: las 3 Slates de este proyecto (`universal-aptus-calendar`,
   `universal-aptus-liberaciones`, `universal-aptus-projectconfig` `.onslate.com`).

## Pruebas

```bash
cd functions/aptus_overview_services && npm test # rutas + core
```

## Pendientes

1. ~~Calendario unificado~~ Hecho (2026-11-11): tema Violeta; tiempos índigo, gastos turquesa, honorarios
   ámbar; filtro por tipo + cliente/proyecto/abogado; totales por tipo y moneda; editar abre la captura
   del área; solo lectura. Probado con los 44 registros reales. **Falta su Slate**
   `universal-aptus-calendar` y el dominio en CORS.
2. Liberaciones y su servicio.
3. Configuración del proyecto y su servicio.
