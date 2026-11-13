# Proyecto Catalyst: Prebills

Armar y revisar Prebills sobre lo liberado: crear una Prebill de un cliente y una moneda, agregar y
quitar líneas, descuento y ajuste, idioma, tipo de cambio, vista previa de la factura y avanzar el
estado. Contexto: `docs/CONTEXTO_CATALYST.md` §5.5 y `docs/prebill-api.md` (Prebills).

**Fase 2 (aprobada por el usuario, 2026-11-13, opción "todo"). Estas acciones ESCRIBEN EN BOOKS:**
- **Facturar** (`autorizada` → `facturada`): crea la factura en Books como **borrador**, con las líneas de
  la vista previa, y marca facturados sus tiempos en Books. Solo desde `autorizada`; si la vista previa
  tiene bloqueos, ReportesSandbox responde 409 antes de tocar Books (la pantalla deshabilita el botón).
  ReportesSandbox evita doble factura (UPDATE atómico).
- **Deshacer factura**: borra la factura en Books y regresa la Prebill a `autorizada`. Solo con la
  factura en borrador (`/edicion` → `factura_borrador`); si no, 409 sin escribir.
- **Editar una facturada** con la factura en borrador: quitar/agregar líneas e idioma **actualizan la
  factura en Books** (ReportesSandbox revierte si algo falla y reporta si el subtotal cuadra). Enviada,
  con pagos, vencida o anulada → 409 sin escribir. Descuento, tipo de cambio, avanzar y eliminar no
  aplican a una facturada.
- **Tiempo:** Catalyst corta las funciones Advanced I/O a los 30 s. Las llamadas que esperan a Books
  esperan hasta 27 s; si Books tarda más, la respuesta es "resultado por verificar" y la pantalla pide
  actualizar (ReportesSandbox termina la operación).
- Enviar, cobrar o anular la factura se hace en Books.

| | |
|---|---|
| Proyecto de Catalyst | `PrebillsForAptusFinancials` (`247000003819406`) |
| URL de la función | `https://prebillsforaptusfinancials-730085095.development.catalystserverless.com/server/prebill_services` |
| Función | `prebill_services` → `functions/prebill_services` |
| Slates (2 de 3) | Prebills (lista y crear) · Detalle de la Prebill. Queda 1 lugar (formatos imprimibles) |
| Tema | Coral |

## Piezas

| Pieza | Carpeta | Repositorio | Slate / Deployment Name |
|---|---|---|---|
| Función | `functions/prebill_services` | `AptusPrebillServices` ✓ | — |
| Prebills (lista y crear) | `UniversalAptusPrebills` | `UniversalAptusPrebills` ✓ | `universal-aptus-prebills` |
| Detalle de la Prebill | `UniversalAptusPrebillDetail` | `UniversalAptusPrebillDetail` ✓ | `universal-aptus-prebilldetail` |

## Rutas de `prebill_services`

| Método | Ruta | Reglas |
|---|---|---|
| GET | `/:org/prebills`, `clientes`, `proyectos`, `abogados`, `liberado-disponible` (`cliente_id, moneda`) | listas |
| GET | `/:org/tiempos`, `gastos`, `cargos-fijos` (`liberado, facturado`) | para saber qué clientes tienen algo listo para Prebill |
| GET | `/:org/prebills/:id` y `/:id/disponible`, `/movimientos`, `/vista-factura`, `/edicion` | lectura (vista-factura y edicion consultan Books sin escribir) |
| POST | `/:org/prebills` | `{cliente_id, moneda, tiempo_id[], gasto_id[], cargo_fijo_id[]}`; al menos una línea; responde `ids_ignorados` |
| PATCH | `/:org/prebills/:id/lineas` | `agregar_*` / `quitar_*` (tiempo, gasto, cargo_fijo); facturada solo con la factura en borrador (**actualiza Books**) |
| PATCH | `/:org/prebills/:id/descuento-ajuste` | `monto` / `porcentaje` (≤ 100) / vacío; solo en `borrador` |
| PATCH | `/:org/prebills/:id/idioma` | `es` / `en` / vacío; facturada solo con la factura en borrador (**actualiza Books**) |
| PATCH | `/:org/prebills/:id/tipo-cambio` | número > 0 (6 decimales) o `null` = FIX de Banxico; solo si no está facturada |
| POST | `/:org/prebills/:id/estado` | `en_revision`, `autorizada` o `facturada` (**crea la factura en Books**; solo desde `autorizada`) |
| POST | `/:org/prebills/:id/deshacer-factura` | **borra la factura en Books**; solo con la factura en borrador |
| DELETE | `/:org/prebills/:id` | solo en `borrador`; libera sus líneas |

## Pruebas

```bash
cd functions/prebill_services && npm test   # 9
cd UniversalAptusPrebills && npm test        # 5 (lógica compartida)
cd UniversalAptusPrebillDetail && npm test   # 5
```

## Lógica compartida

`shared/prebills.ts` (tipos, líneas, llamadas a la API) y `shared/prebills.test.mjs` se copian igual a
`src/lib/prebills.ts` y `tests/` de las dos Slates. Cambiarlos aquí y volver a copiarlos.

## Pendientes

1. ~~Proyecto, repositorios y función~~ Hecho (2026-11-13): función desplegada; en vivo responden la lista
   (8 Prebills), el detalle, lo disponible, la vista previa (con bloqueos y avisos), movimientos y edición.
2. ~~Pantallas~~ Hechas y en GitHub. Probadas en Chrome con datos reales sin escribir: lista con filtros,
   Nueva Prebill (Avolar: 3 registros, 15,100 MXN; Go Sharp: 2), detalle de #9 (autorizada) y #7
   (facturada, solo consulta). **Faltan sus Slates** y los dominios en CORS.
3. Prueba del usuario: crear una Prebill de prueba, quitar y agregar una línea, descuento, enviar a
   revisión, autorizar; crear otra y eliminarla.
4. ~~Fase 2~~ Hecha (2026-11-13): función desplegada; en vivo, facturar una facturada, deshacer una no
   facturada y editar o deshacer la #7 (factura vencida en Books) se rechazan sin escribir. Pantalla con
   "Facturar en Books" y "Deshacer factura". Prueba del usuario terminada (2026-11-13).
5. ~~Liberación = aprobación de horas~~ Decidido por el usuario (2026-11-13): los proyectos de Books se
   declaran sin aprobación de horas y el usuario irá quitándosela a los que la tienen. La vista previa
   de factura sigue bloqueando si queda alguno sin aprobar.
