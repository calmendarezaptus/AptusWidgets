# Proyecto Catalyst: Inicio (menú principal)

Pedido del usuario (2026-11-18): un menú con todas las pantallas, separadas por secciones, y en cada
pantalla un botón para volver a él. Decisión: proyecto propio, para no ocupar lugares de las áreas.

| | |
|---|---|
| Proyecto de Catalyst | `HomeForAptusFinancials` |
| Función | ninguna (solo enlaces; no necesita CORS) |
| Slates (1 de 3) | Menú principal |

| Pieza | Carpeta | Repositorio | Slate / Deployment Name |
|---|---|---|---|
| Menú principal | `UniversalAptusHome` | `UniversalAptusHome` ✓ | `universal-aptus-home` |

## Navegación

- Secciones: Capturar (tiempo, gasto, honorario fijo) → Revisar (4 calendarios) → Facturar
  (Liberaciones, Prebills) → Cobrar y pagar (Cobranza, Reembolsos) → Reportes (WIP, Ingresos) →
  Configuración (proyecto, abogados, tarifas y clientes, despacho). 17 pantallas; el detalle de una
  Prebill se abre desde la lista.
- Cada enlace lleva `organization_id`; todas menos las capturas llevan `origin` = menú, así su
  "Regresar" vuelve al menú.
- Botón **Menú** en las 18 pantallas (`src/components/MenuButton.tsx`, copia idéntica en cada repo; en
  los encabezados oscuros de los calendarios, solo el ícono). Subido el 2026-11-18.
- Al publicar una pantalla nueva: agregarla a `src/lib/pantallas.ts` y copiar `MenuButton.tsx`.

## Pendientes

1. Proyecto y repo creados; código subido (2026-11-18). Falta la Slate → la pruebo publicada.
2. Volver a desplegar las 18 Slates para que tomen el botón Menú (si no se despliegan solas al subir).
