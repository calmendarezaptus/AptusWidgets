# Aptus Widgets

Widgets de Aptus en Zoho Catalyst sobre ReportesSandbox. **Un proyecto de Catalyst por área**
(máximo 3 Slates por proyecto), cada uno con su función y sus Slates. Cada función y cada Slate
es su propio repositorio de GitHub; este repositorio de trabajo (`AptusWidgets`) guarda la
documentación, el código compartido y el documento de cada proyecto.

```
Aptus Widgets/
├─ docs/                       contexto general
│  ├─ CONTEXTO.md              ReportesSandbox (servidor, reglas)
│  ├─ prebill-api.md           referencia de la API
│  ├─ CONTEXTO_CATALYST.md     qué se construye y por qué (§1.1 organización)
│  ├─ DISENO_CATALYST.md       patrón de código e interfaz
│  └─ CONFIGURACION_DESPLIEGUE.md  nombres de repos, proyectos, Slates y pasos
├─ shared/catalyst-core/       código común de las funciones (se copia a core/)
├─ 01-tiempos/                 PROYECTO.md · functions/time_entry_services · 2 Slates
├─ 02-gastos/                  PROYECTO.md · functions/expense_services · 2 Slates
├─ 03-honorarios-fijos/        PROYECTO.md · functions/fixed_fee_services · (2 Slates por crear)
├─ 04-consolidado/             PROYECTO.md · functions/aptus_overview_services · (3 Slates por crear)
└─ _archivo/                   ZIP y bundles originales (no se versiona)
```

| Proyecto | Estado |
|---|---|
| Tiempos | En uso; pendiente etapa de correcciones |
| Gastos | En producción (2026-11-11): proyecto, función y Slates propias |
| Honorarios fijos | Siguiente |
| Consolidado | Al final |

Las carpetas de funciones y Slates son repositorios independientes y este repositorio las ignora
(`.gitignore`).
