# Configuración recomendada: repositorios, proyectos de Catalyst y despliegues

Guía para dar de alta los 4 proyectos. Los nombres siguen el patrón de lo que ya existe
(`TimeEntryForAptusFinancials`, `universal-aptus-timeentry`, `UniversalAptusExpenseEntry`).
Detalle de cada proyecto en su `PROYECTO.md`.

## 1. Resumen

| Proyecto | Proyecto de Catalyst | Función | Slate (Deployment Name) | Repositorio de GitHub |
|---|---|---|---|---|
| **Tiempos** | `TimeEntryForAptusFinancials` ✓ existe | `time_entry_services` ✓ | `universal-aptus-timeentry` ✓ | `UniversalAptusTimeEntryV2` |
| | | | `universal-timeentry-calendar` ✓ | `UniversalTimesCalendarV2` |
| | | | | Función: `AptusTimeEntryServices` |
| **Gastos** | `ExpensesForAptusFinancials` | `expense_services` | `universal-aptus-expenseentry` | `UniversalAptusExpenseEntry` ✓ existe |
| | | | `universal-expenseentry-calendar` | `UniversalExpensesCalendar` ✓ existe |
| | | | | Función: `AptusExpenseServices` |
| **Honorarios fijos** | `FixedFeesForAptusFinancials` | `fixed_fee_services` | `universal-aptus-fixedfeeentry` | `UniversalAptusFixedFeeEntry` |
| | | | `universal-fixedfeeentry-calendar` | `UniversalFixedFeesCalendar` |
| | | | | Función: `AptusFixedFeeServices` |
| **Consolidado** | `OverviewForAptusFinancials` | `aptus_overview_services` | `universal-aptus-calendar` | `UniversalAptusCalendar` |
| | | | `universal-aptus-liberaciones` | `UniversalAptusLiberaciones` |
| | | | `universal-aptus-projectconfig` | `UniversalAptusProjectConfig` |
| | | | | Función: `AptusOverviewServices` |
| (todos) | — | — | — | `AptusWidgets`: docs, `shared/` y los `PROYECTO.md` |

El dominio de cada Slate es `https://<Deployment Name>.onslate.com`.

**Tiempos V2:** se propone `…V2` para no chocar con los repositorios actuales de tiempos. Si esos
no están en la cuenta `calmendarezaptus`, se pueden usar los nombres sin `V2`.

**Gastos:** la Slate `universal-aptus-expenseentry` hoy está en el proyecto de Tiempos. Hay que
borrarla allá y crearla en `ExpensesForAptusFinancials`. Si Catalyst no deja reutilizar el nombre,
usa `universal-aptus-expensesentry` y avísame para ajustar las URLs.

## 2. Repositorios por crear (en `calmendarezaptus`, privados, vacíos, sin README)

| Ahora (ya hay código y commit local) | Después (cuando se construyan) |
|---|---|
| `AptusWidgets` | `UniversalAptusFixedFeeEntry` |
| `AptusTimeEntryServices` | `UniversalFixedFeesCalendar` |
| `UniversalAptusTimeEntryV2` | `UniversalAptusCalendar` |
| `UniversalTimesCalendarV2` | `UniversalAptusLiberaciones` |
| `AptusExpenseServices` | `UniversalAptusProjectConfig` |
| `AptusFixedFeeServices` | |
| `AptusOverviewServices` | |

Cuando estén creados, avísame y subo todo. También hay commits sin subir en
`UniversalAptusExpenseEntry` (`bd2a88f`) y `UniversalExpensesCalendar` (`bfd8a77`). Solo cambian
la configuración de la URL y no cambian el comportamiento.

## 3. Alta de cada proyecto de Catalyst

Para cada proyecto nuevo (Gastos, Honorarios fijos, Consolidado):

1. **Crear el proyecto** con el nombre de la tabla.
2. **Función**: Advanced I/O, Node 24, nombre de la tabla. Se despliega igual que hoy
   `time_entry_services`, desde su carpeta `functions/<nombre>`. Antes de desplegar, corre
   `npm install` y `npm test` en esa carpeta.
3. **Variable `AUTH_TOKEN`** (token de Donatello): cada carpeta de función ya tiene su `.env` local,
   que no se versiona. Lo recomendable es definirla en la consola como variable de entorno de la
   función, para que el secreto no viaje en el paquete.
4. **Caché**: crear el segmento `APTUS_MIRROR_CONN_DATA`. Ahí se guardan 6 h el endpoint y el token
   de ReportesSandbox que la función lee de `cm_global_vars`.
5. **Probar la función**: `GET <url de la función>/636939444/clientes` debe responder la lista de
   clientes. Si responde 503 "Faltan parámetros de conexión", revisa los pasos 3 y 4.
6. **Slates**: una por pantalla, cada una ligada a su repositorio (rama `main`).
   - Instalación: `npm install`; build: `npm run build`; carpeta de salida: `dist`.
   - Variable de entorno: `VITE_API_BASE_URL` = URL de la función del mismo proyecto.
7. **Dominios autorizados (CORS)**: agrega solo los dominios `.onslate.com` de las Slates de **ese**
   proyecto. Sin esto las Slates no cargan datos.

En el proyecto de **Tiempos** solo hay que volver a desplegar `time_entry_services`, que ahora
incluye `core/` y la lista blanca de lecturas. Cuando gastos ya esté migrado, también hay que quitar
de ese proyecto la Slate y el dominio de gastos.

## 4. Orden sugerido

1. Crear los 7 repositorios de la columna "Ahora" → subo todo.
2. Volver a desplegar `time_entry_services` (Tiempos) y probar captura y calendario de tiempos.
3. Dar de alta **Gastos** (sección 3) → pásame la URL de `expense_services` → la dejo como respaldo
   en las 2 apps y las subo → mover las 2 Slates de gastos → probar → quito las rutas de gastos de
   `time_entry_services`.
4. Dar de alta **Honorarios fijos** y **Consolidado** cuando lleguemos a ellos. Las funciones ya
   están listas para desplegarse como esqueleto.

## 5. Reglas de nombres (para lo que venga)

| Qué | Regla | Ejemplo |
|---|---|---|
| Proyecto de Catalyst | `<Área en inglés>ForAptusFinancials` | `ExpensesForAptusFinancials` |
| Función | `snake_case`, termina en `_services` | `expense_services` |
| Repositorio de función | `Aptus<Área>Services` | `AptusExpenseServices` |
| Slate de captura | `universal-aptus-<área>entry` | `universal-aptus-expenseentry` |
| Slate de calendario | `universal-<área>entry-calendar` | `universal-expenseentry-calendar` |
| Repositorio de Slate | `UniversalAptus<Pantalla>` / `Universal<Área>Calendar` | `UniversalExpensesCalendar` |
| Carpeta local | `NN-<área>/` con `functions/<función>` y una carpeta por Slate | `02-gastos/` |
