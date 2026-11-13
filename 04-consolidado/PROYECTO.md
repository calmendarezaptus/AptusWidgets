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
| Estado | Función desplegada con liberaciones y configuración (2026-11-13); calendario publicado; **Liberaciones y Configuración listas, faltan sus Slates** |

## Piezas

| Pieza | Carpeta | Repositorio | Slate / Deployment Name |
|---|---|---|---|
| Función | `functions/aptus_overview_services` | `AptusOverviewServices` ✓ | — |
| Calendario unificado | `UniversalAptusCalendar` | `UniversalAptusCalendar` ✓ | `universal-aptus-calendar` |
| Liberaciones | `UniversalAptusLiberaciones` | `UniversalAptusLiberaciones` ✓ | `universal-aptus-liberaciones` |
| Configuración del proyecto | `UniversalAptusProjectConfig` | `UniversalAptusProjectConfig` ✓ | `universal-aptus-projectconfig` |

El calendario unificado **no llama a las otras funciones**: lee todo de ReportesSandbox con su
propia función. Editar un registro abre la captura de su área (tiempos, gastos u honorarios fijos)
con `origin` para regresar.

## Rutas de `aptus_overview_services`

**No escribe en Books.** Decisiones del usuario (2026-11-13): liberar por cliente **y** para todos
los clientes (con `todos: true` y, en la pantalla, escribir LIBERAR); Configuración sin las acciones
que escriben en Books; alcance: datos, tarifas y responsables.

| Método | Ruta | Reglas |
|---|---|---|
| POST | `/:org/liberaciones` | `{desde, hasta, cliente_id}` o `{desde, hasta, todos: true}`; sin cliente ni `todos` → 400. Rango ≤ 366 días. No hay deshacer |
| GET / PATCH | `/:org/proyectos/:id` | PATCH: `nombre, moneda, activo, tipo_cobro, honorario_fijo, zoho_tax_id` (iguala exige honorario). Sin `cliente_id` ni `zoho_project_id` |
| POST | `/:org/tarifas` | siempre con `proyecto_id`; abogado **o** nivel o ninguno |
| PATCH / DELETE | `/:org/tarifas/:id` | solo si la tarifa es de un proyecto (si no → 403); PATCH solo `tarifa` |
| GET | `/:org/tarifas/resolver` | `abogado_id, proyecto_id` |
| POST | `/:org/responsables` | `{rol, abogado_id, proyecto_id}`; `rol` = `facturacion`, `cobranza` o `ambos`. Se reenvía a ReportesSandbox con `abogado_id`; antes se revisa la marca del abogado (sin marca o rol que no le toca → 403, inactivo → 422). Responde `{id, asignados}` |
| GET | `/:org/abogados-responsables` | `[{abogado_id, tipo}]`, del campo `responsable` de `GET /abogados` |
| PATCH | `/:org/abogados/:id/responsable` | `{tipo}`: `facturacion`, `cobranza`, `general` o `null` (quitar). → `PATCH /abogados/:id {responsable}` en ReportesSandbox |
| DELETE | `/:org/responsables/:id` | solo asignaciones de proyecto (las de cliente → 403) |
| GET | `/:org/responsables/resolver` | `proyecto_id` |
| GET | `/:org/impuestos`, `/:org/clientes/:cliente/config` | IVA de Books y del cliente (lectura) |
| GET | `/:org/clientes`, `proyectos`, `abogados`, `tipos-abogado`, `responsables` | listas |
| GET | `/:org/tiempos`, `gastos`, `cargos-fijos` | filtros de cada listado (incluye `liberado`) |
| GET | `/:org/liberado-disponible`, `/:org/tarifas` | `cliente_id, moneda` / `proyecto_id, moneda, abogado_id, tipo_id, nivel` |

Rutas que escriben en Books (`crear-en-books`, `sincronizar-tareas`) → 404 a propósito.

## Despliegue de la función con el CLI

```bash
cd 04-consolidado
catalyst project:use 247000003819226      # solo la primera vez en esta máquina
cd functions/aptus_overview_services && npm install && npm test && cd ../..
catalyst deploy --only functions:aptus_overview_services
```

Verificado en vivo (2026-11-13): lecturas de proyecto, tarifas, resolver, responsables, impuestos (12),
config del cliente, niveles y disponible para Prebill responden 200; liberar sin cliente ni `todos` → 400
sin escribir.

## Configuración en Catalyst

1. Función `aptus_overview_services` (Node 24, Advanced I/O).
2. Variable `AUTH_TOKEN`: viaja en `.env` (local, no se versiona), igual que en las otras áreas.
3. Caché: funciona con el segmento `Default`.
4. Dominios autorizados: las 3 Slates de este proyecto (`universal-aptus-calendar`,
   `universal-aptus-liberaciones`, `universal-aptus-projectconfig` `.onslate.com`).

## Pruebas

```bash
cd functions/aptus_overview_services && npm test  # 15
cd UniversalAptusCalendar && npm test              # 5
cd UniversalAptusLiberaciones && npm test          # 4
cd UniversalAptusProjectConfig && npm test         # 5
```

## Pendientes

1. ~~Calendario unificado~~ Hecho (2026-11-11): tema Violeta; tiempos índigo, gastos turquesa, honorarios
   ámbar; filtro por tipo + cliente/proyecto/abogado; totales por tipo y moneda; editar abre la captura
   del área; solo lectura. Probado con los 44 registros reales. Slate y CORS verificados:
   la Slate publicada carga los 44 registros en Chrome sin errores.
2. ~~Liberaciones~~ Hecha (2026-11-13): vista previa con las reglas de la API, por cliente o todos
   (escribir LIBERAR), disponible para Prebill. Probada con datos reales sin liberar (Avolar: gasto #31
   y tiempo #80). Slate y CORS verificados.
3. ~~Configuración del proyecto~~ Hecha (2026-11-13): datos (solo cambios), tarifas del proyecto,
   qué tarifa aplicaría y responsables. Probada con el proyecto 23 sin escribir. Slate y CORS
   verificados.
4. Abogados responsables (2026-11-13, pedido del usuario): los responsables son abogados registrados y
   en cada abogado se indica si puede ser de facturación, de cobranza o general (ambos). Pestaña
   "Abogados responsables" en Configuración; al asignar solo aparecen los marcados para ese rol, y un
   general se puede asignar a ambos roles a la vez. La marca vive en ReportesSandbox (campo
   `abogados.responsable`, mismo día); la tabla del Data Store que se planteó antes ya no hace falta.
5. Prueba completa del usuario: liberar un periodo de un cliente; cambiar un dato, agregar/editar/borrar
   una tarifa y un responsable de prueba.
