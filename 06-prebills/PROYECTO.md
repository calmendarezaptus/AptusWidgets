# Proyecto Catalyst: Prebills

Armar y revisar Prebills sobre lo liberado: crear una Prebill de un cliente y una moneda, agregar y
quitar líneas, descuento y ajuste, idioma, tipo de cambio, vista previa de la factura y avanzar el
estado. Contexto: `docs/CONTEXTO_CATALYST.md` §5.5 y `docs/prebill-api.md` (Prebills).

**Fase 1 (decisión del usuario, 2026-11-13): hasta "autorizada", sin escribir en Books.**
- Pasar a `facturada` crea la Invoice real en Books → bloqueado (403).
- `deshacer-factura` borra la Invoice → sin ruta (404).
- Una Prebill `facturada` (o `facturando`) **no se edita**: con la factura en borrador, cambiar líneas o
  idioma también modifica la factura en Books. La función lee el estado antes de cada edición (409).
- La fase 2 (facturar y deshacer) requiere aprobación explícita del usuario.

| | |
|---|---|
| Proyecto de Catalyst | `PrebillsForAptusFinancials` (**por crear**) |
| URL de la función | `https://prebillsforaptusfinancials-730085095.development.catalystserverless.com/server/prebill_services` (confirmar al crear) |
| Función | `prebill_services` → `functions/prebill_services` |
| Slates (2 de 3) | Prebills (lista y crear) · Detalle de la Prebill. Queda 1 lugar (formatos imprimibles) |
| Tema | Coral |

## Piezas

| Pieza | Carpeta | Repositorio | Slate / Deployment Name |
|---|---|---|---|
| Función | `functions/prebill_services` | `AptusPrebillServices` (por crear) | — |
| Prebills (lista y crear) | `UniversalAptusPrebills` | `UniversalAptusPrebills` (por crear) | `universal-aptus-prebills` |
| Detalle de la Prebill | `UniversalAptusPrebillDetail` | `UniversalAptusPrebillDetail` (por crear) | `universal-aptus-prebilldetail` |

## Rutas de `prebill_services`

| Método | Ruta | Reglas |
|---|---|---|
| GET | `/:org/prebills`, `clientes`, `proyectos`, `abogados`, `liberado-disponible` (`cliente_id, moneda`) | listas |
| GET | `/:org/prebills/:id` y `/:id/disponible`, `/movimientos`, `/vista-factura`, `/edicion` | lectura (vista-factura y edicion consultan Books sin escribir) |
| POST | `/:org/prebills` | `{cliente_id, moneda, tiempo_id[], gasto_id[], cargo_fijo_id[]}`; al menos una línea; responde `ids_ignorados` |
| PATCH | `/:org/prebills/:id/lineas` | `agregar_*` / `quitar_*` (tiempo, gasto, cargo_fijo); solo si no está facturada |
| PATCH | `/:org/prebills/:id/descuento-ajuste` | `monto` / `porcentaje` (≤ 100) / vacío; solo en `borrador` |
| PATCH | `/:org/prebills/:id/idioma` | `es` / `en` / vacío; solo si no está facturada |
| PATCH | `/:org/prebills/:id/tipo-cambio` | número > 0 (6 decimales) o `null` = FIX de Banxico; solo si no está facturada |
| POST | `/:org/prebills/:id/estado` | solo `en_revision` y `autorizada`; `facturada` → 403 |
| DELETE | `/:org/prebills/:id` | solo en `borrador`; libera sus líneas |

## Pruebas

```bash
cd functions/prebill_services && npm test   # 8
```

## Pendientes

1. Crear el proyecto y los 3 repositorios → desplegar la función y revisar en vivo la forma de las
   respuestas (lista, detalle, vista previa) antes de terminar las pantallas.
2. Pantallas: lista y crear · detalle.
3. Fase 2 (con aprobación): facturar y deshacer factura.
