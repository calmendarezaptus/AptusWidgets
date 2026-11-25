# Prompt para Claude Code en ReportesSandbox: agrupación por proyecto y generación masiva de Prebills

En ReportesSandbox (`/var/www/html/NodeProyects/ReportesSandbox`, pm2 `sandbox-wip`) quiero dos cosas:
que **cada proyecto diga cómo se agrupa en Prebills** y poder **generar todas las Prebills pendientes de una
vez**, con vista previa y confirmación.

## Reglas

- **No escribe en Books** (las Prebills nacen en borrador y son locales). No toques ReportesSandboxECLegal.
- `node respaldo.js` antes de cambiar la base.
- Las Prebills que ya existen no cambian. Las rutas actuales siguen respondiendo igual; lo nuevo son campos
  opcionales y rutas nuevas. Mismo formato de error que el resto de la API.
- La lógica vive en `prebillLogic.js` (única fuente de reglas de Prebill), para que la web y la API se
  comporten igual.

## 1. Agrupación por proyecto

Campo nuevo en `proyectos`: **`prebill_agrupacion`**: `cliente` (por omisión, como hoy) o `proyecto`.

- **`cliente`:** todo lo liberado de los proyectos del cliente con esta opción va en **una sola Prebill por
  cliente y moneda**, dividida por proyecto (como ya se presenta hoy en el detalle, la vista de factura y los
  formatos: líneas y subtotales por proyecto).
- **`proyecto`:** **una Prebill por proyecto** (y moneda): ese proyecto nunca se mezcla con otros.
- Un cliente puede tener proyectos de los dos tipos: los de `proyecto` llevan cada uno su Prebill, y los de
  `cliente` se juntan en una.

Cambios:
- `GET /proyectos`, `GET /proyectos/:id` devuelven `prebill_agrupacion`; `POST /proyectos` y
  `PATCH /proyectos/:id` lo aceptan (otro valor → 400). Pantalla HTML de proyectos: un selector.
- Tabla `prebills`: columna `proyecto_id` (nula = Prebill a nivel cliente). `GET /prebills` y
  `GET /prebills/:id` la devuelven con el nombre del proyecto.
- **La regla también aplica a la creación manual y a la edición:** `POST /prebills` acepta `proyecto_id`;
  `PATCH /prebills/:id/lineas` y `GET /prebills/:id/disponible` la respetan:
  - Una Prebill con `proyecto_id` solo acepta líneas de ese proyecto.
  - Una Prebill a nivel cliente no acepta líneas de proyectos con agrupación `proyecto`.
  - Lo que no cumpla se ignora y se reporta en `ids_ignorados` con el motivo (como hoy con otro cliente o
    moneda), salvo que **todas** las líneas pedidas sean de un solo proyecto con agrupación `proyecto`: en
    ese caso, crea la Prebill de ese proyecto aunque no venga `proyecto_id`.
- Cambiar la agrupación de un proyecto no modifica Prebills existentes; aplica a las siguientes.

## 2. Generación masiva

Por omisión, **todo lo pendiente de generar**: lo liberado, sin facturar y sin Prebill. Opcionalmente se
filtra por **rango de fechas** del trabajo (fecha de cada tiempo, gasto u honorario fijo).

### `GET /prebills/generar/vista-previa`

Query opcional: `desde`, `hasta` (YYYY-MM-DD; los dos o ninguno; `desde ≤ hasta`), `cliente_id`, `moneda`.
**No crea nada.** Responde:

```jsonc
{
  "filtros": { "desde": null, "hasta": null, "cliente_id": null, "moneda": null },
  "grupos": [{
    "clave": "c:446794000018976759:MXN",          // o "p:23:MXN" para nivel proyecto; estable y única
    "agrupacion": "cliente" | "proyecto",
    "cliente_id": "…", "cliente_nombre": "…", "moneda": "MXN",
    "proyecto_id": null | 23, "proyecto_nombre": null | "…",
    "proyectos": [{ "proyecto_id": 3, "proyecto_nombre": "…", "tiempos": 4, "horas": 7.25, "gastos": 1, "cargos_fijos": 0,
                    "honorarios": 4000, "gastos_monto": 200, "fijos": 0, "total": 4200 }],
    "lineas": { "tiempos": 4, "gastos": 1, "cargos_fijos": 0 },
    "totales": { "honorarios": 4000, "gastos": 200, "fijos": 0, "total": 4200 },
    "fechas": { "desde": "2026-10-01", "hasta": "2026-10-31" },     // rango real de las líneas
    "responsable_facturacion": "…" | null,
    "avisos": ["…"], "bloqueantes": ["…"]           // p. ej. tiempos sin tarifa, proyecto sin enlace a Books
  }],
  "totales_por_moneda": [{ "moneda": "MXN", "grupos": 5, "total": 123456.78 }],
  "excluido": { "tiempos": 0, "gastos": 0, "cargos_fijos": 0, "motivos": ["…"] }   // liberado que no entra y por qué
}
```

Usa el mismo cálculo de totales que una Prebill real (`prebillLogic.js`), para que la vista previa coincida
con lo que se va a crear. Un grupo con `bloqueantes` no se puede generar.

### `POST /prebills/generar`

```json
{ "confirmar": true, "solicitud_id": "uuid-generado-por-el-cliente",
  "desde": null, "hasta": null, "cliente_id": null, "moneda": null,
  "grupos": ["c:446794000018976759:MXN", "p:23:MXN"] }
```

- Sin `confirmar:true` → 400 sin crear nada. `grupos` es la lista de claves elegidas en la vista previa
  (vacía o ausente = todas las que se pueden generar).
- **Recalcula en el servidor** con los mismos filtros (no confíes en IDs del cliente) y crea **una Prebill en
  borrador por grupo**, dentro de **una transacción**: o se crean todas las elegidas o ninguna.
- **Idempotente por `solicitud_id`** (obligatorio): si llega otra vez el mismo, responde el mismo resultado
  sin crear nada nuevo (guárdalo con su resultado).
- Un grupo elegido que ya no tiene líneas (otro usuario las tomó) o que ahora tiene bloqueantes no se crea y
  se reporta en `omitidos` con el motivo; el resto sí.
- Respuesta: `{ creadas: [{ prebill_id, clave, cliente_nombre, proyecto_nombre, moneda, total, lineas }],
  omitidos: [{ clave, motivo }], totales_por_moneda }`.
- Debe responder en **menos de 20 s** con cientos de líneas (la llama una función de Catalyst que corta a
  los 30 s); mide y dime el tiempo.

### Fechas

En la pantalla habrá atajos "Este mes" y "Mes pasado"; la API solo recibe `desde`/`hasta`. Sin fechas = todo
lo pendiente.

## 3. Al terminar

- Pruebas: agrupación `cliente` (varios proyectos → 1 Prebill dividida por proyecto), `proyecto` (1 por
  proyecto), cliente mixto, varias monedas, filtro de fechas, grupos elegidos, `omitidos`, transacción (si
  una falla no queda ninguna), `solicitud_id` repetido, `confirmar` obligatorio, la regla en la creación
  manual y al agregar líneas, y que las Prebills existentes no cambian.
- `pm2 restart sandbox-wip` y prueba en vivo **solo la vista previa** con los datos reales (sin generar);
  luego genera en una **copia de prueba** de la base (como hiciste con CFDI) y compara contra la vista previa.
  No generes Prebills en `sandbox-wip`: eso lo hago yo desde la pantalla.
- Documenta en la consola, el README y el manual de la API; dame el resumen con la forma exacta de las
  respuestas y el tiempo medido, para hacer la pantalla en Catalyst y el campo en Configuración del proyecto.
