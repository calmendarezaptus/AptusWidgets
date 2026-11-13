# Prompt para Claude Code en ReportesSandbox: responsables solo abogados marcados

En ReportesSandbox (/var/www/html/NodeProyects/ReportesSandbox, pm2 `sandbox-wip`) quiero esta regla:
**los responsables de facturación y cobranza capturados aquí (fuente `local`) solo pueden ser abogados
registrados, y solo si en el abogado se marcó que puede serlo.**

## Qué marcar en cada abogado

Un campo nuevo en `abogados`, `responsable`, con estos valores:

- `null` (por omisión): no puede ser responsable.
- `facturacion`: solo responsable de facturación.
- `cobranza`: solo responsable de cobranza.
- `general`: cubre los dos roles.

## Cambios en la API (apiRoutes.js / responsables.js / catalogos.js)

1. `GET /abogados` y `GET /abogados/:id` devuelven `responsable`.
2. `POST /abogados` y `PATCH /abogados/:id` aceptan `responsable` (uno de los valores de arriba; vacío o `null`
   lo quita). Otro valor → 400.
3. `POST /responsables` acepta `abogado_id` (entero) en lugar de `nombre`:
   - el abogado debe existir y estar activo (404 / 422);
   - su `responsable` debe cubrir el `rol` (`general` cubre ambos); si no → 403 con un mensaje en español;
   - el nombre que se guarda sale del abogado (el mismo que muestra `GET /abogados`: `zoho_user_nombre` o `nombre`);
   - se guarda también `abogado_id` en la asignación, y `GET /responsables` lo devuelve.
   - Sin `abogado_id` → 400. Ya no se aceptan nombres libres.
4. Opcional: `rol: "ambos"` crea facturación y cobranza en una sola llamada (solo si el abogado es
   `general`). Si una de las dos ya existía, no es error.
5. Quitarle la marca a un abogado **no borra** sus asignaciones existentes. Seguirán contando en
   `/responsables/resolver` hasta que se quiten a mano.

## Datos existentes

- Migración en `data/sandbox.sqlite`: agregar la columna `abogados.responsable` (TEXT, NULL) y
  `responsables.abogado_id` (INTEGER, NULL). Antes, respaldo con `node respaldo.js`.
- Las asignaciones locales que ya existen, guardadas con nombre libre, se quedan como están. Repórtame
  cuáles coinciden por nombre con un abogado y cuáles no; **no las borres ni las marques sin preguntarme**.

## Qué no cambia

- Las fuentes `campo_cliente` y `rol_proyecto` vienen de Books y siguen igual. La regla aplica solo a lo
  que se captura aquí (`local`). Si crees que también deberían filtrarse, pregúntame antes.
- No se escribe nada en Books y no se crean Usuarios de Books.
- No toques ReportesSandboxECLegal (es de solo lectura, cliente real).

## Pantallas HTML

- En el catálogo de Abogados: un selector "Puede ser responsable" con No / Facturación / Cobranza /
  General (ambos).
- Donde se asignan responsables (cliente o proyecto): en lugar del campo de nombre libre, un selector de
  abogados filtrado por el rol elegido.

## Al terminar

- Pruebas de la regla: abogado no marcado → 403, rol que no le toca → 403, general en ambos roles → OK,
  inactivo → 422, nombre libre → 400.
- `pm2 restart sandbox-wip` y comprueba en vivo con un abogado de prueba. Después deja todo como estaba:
  quítale la marca y borra las asignaciones de prueba.
- Actualiza `prebill-api.md` (secciones Abogados y Responsables, más una fila en "Qué cambió") y `README.md`.
- Dame un resumen con los cambios de la API (campos y respuestas), para adaptar la función de Catalyst
  `aptus_overview_services`, que hoy guarda esta marca en su propio Data Store.
