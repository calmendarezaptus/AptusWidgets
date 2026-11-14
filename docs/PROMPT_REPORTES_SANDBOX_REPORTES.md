# Prompt para Claude Code en el server: reportes de ReportesAptus en la API de ReportesSandbox

En este server están dos proyectos:

- **ReportesAptus** (`/var/www/html/NodeProyects/ReportesAptus`): los reportes originales (WIP, Reporte 03 y
  otros). Trabaja con clientes reales. **Aquí solo se lee código. No se modifica, no se reinicia su proceso
  pm2 y no se llama a Books con sus credenciales.**
- **ReportesSandbox** (`/var/www/html/NodeProyects/ReportesSandbox`, pm2 `sandbox-wip`, org de Books
  `636939444`): el prototipo con la API JSON (`apiRoutes.js`, documentada en `prebill-api.md`). **Aquí se
  hacen los cambios.**

Quiero los reportes de ReportesAptus en la API JSON de ReportesSandbox, para hacer pantallas en Zoho Catalyst
(Slates en pestañas web de Books). Las pantallas no leen HTML: necesitan rutas JSON.

## 1. Inventario (primero, solo lectura)

Recorre ReportesAptus y arma la lista de **todos** sus reportes. Para cada uno, anota:

- nombre y número (ej. "Reporte 03"), ruta o script y para qué sirve;
- filtros que recibe (fechas, cliente, proyecto, abogado, moneda, estado…);
- qué muestra: columnas, agrupaciones, subtotales y totales;
- de dónde salen los datos: qué llamadas a Books hace (y cuántas, para cuidar la cuota), si usa Creator o
  CFDI, y si tiene caché;
- si ya existe algo equivalente en ReportesSandbox: `/wip`, `/formatos/estado-cuenta`, `/facturas-cfdi`,
  o el `/ingresos` de ReportesSandboxECLegal.

Guarda el inventario en `ReportesSandbox/REPORTES_INVENTARIO.md`.

## 2. Rutas JSON que quiero ya

### `GET /api/reportes`

Catálogo de los reportes disponibles en la API: clave, nombre, ruta, filtros con su tipo y si son
obligatorios, y en qué monedas responde. Las pantallas arman sus filtros con esto.

### `GET /api/wip`: trabajo en proceso

Hoy `/wip` solo existe como página HTML. La ruta JSON debe dar lo mismo que esa página y además:

- Agrupar por el responsable del rol `responsables.rol_wip` (como hoy), luego por cliente y por proyecto, con
  subtotales por moneda en cada nivel.
- Incluir lo capturado en ReportesSandbox que **no** se ha facturado: tiempos, gastos y honorarios fijos.
  Cada renglón dice en qué está: sin liberar, liberado sin Prebill, o en Prebill (con su número y estado).
- Incluir los time entries históricos de Books que no salieron de ReportesSandbox, **sin duplicar** los que
  ya están respaldados desde aquí (`books_estado`, id del time entry de Books). Marca cuáles usan la tarifa
  plana del proyecto como valor de referencia, como hoy.
- Filtros: `desde`, `hasta`, `cliente_id`, `proyecto_id`, `abogado_id`, `responsable`, `moneda`, `estado`.
- En cada renglón: fecha, abogado, horas, tarifa, importe, moneda, tipo (tiempo, gasto, fijo), origen
  (Aptus o Books) y estado.
- Totales generales por moneda, más `generado_en` y la antigüedad de la caché.

### `GET /api/ingresos`: Reporte 03

Pasa al sandbox el Reporte 03 de ReportesAptus, tomando como base lo que ya está en el `/ingresos` de
ReportesSandboxECLegal (ingresos más conciliación Books↔CFDI). Debe funcionar contra la org sandbox y
**tomar el CFDI según `config_despacho.cfdi.proveedor`** (`ninguno`, `interno` o `creator`), igual que
`/facturas-cfdi`.

- Copia la lógica a ReportesSandbox. **No toques ReportesSandboxECLegal**: es de solo lectura y es de un
  cliente real.
- Filtros: los del Reporte 03 original, como mínimo `desde`, `hasta` y `cliente_id`.
- Que muestre las mismas columnas y totales que el Reporte 03, más las diferencias de la conciliación
  (facturas sin CFDI, CFDI sin factura, importes que no cuadran).

### Los demás reportes del inventario

**No los implementes todavía.** En el inventario propón para cada uno su ruta JSON y si conviene. Yo decido
cuáles siguen.

## 3. Reglas

- **Solo lectura.** Ninguna de estas rutas escribe en Books, en Creator ni en la base. Solo responden GET; con
  otro método responden 405.
- **Tiempo de respuesta.** Las llama una función de Catalyst que corta a los 30 s, así que deben responder en
  **menos de 20 s**. Usa las cachés de `cacheVivo.js` (el WIP ya tiene caché de 4 horas). Si la caché está
  vieja, responde con lo guardado, refresca en segundo plano y avisa con `actualizando: true`. `?forzar=1`
  no debe dejar la respuesta esperando más de 20 s.
- **Cuota de Books.** Nada de una llamada por renglón. Reporta cuántas llamadas hace cada reporte sin caché.
- **Formato de error** igual que el resto de la API (`prebill-api.md`, "Formato de error"): 400 si un
  filtro es inválido (fechas `YYYY-MM-DD`, ids numéricos), 404 si el cliente o proyecto no existe, 502 si
  Books no respondió.
- Importes con dos decimales y moneda en cada total. No mezcles monedas en un mismo total.
- Las respuestas JSON salen con gzip, como el resto de `/reportes/`.
- No copies a ReportesSandbox datos de clientes reales de ReportesAptus o de EC Legal. Solo código.
- Antes de cambiar la base, `node respaldo.js`.

## 4. Al terminar

- Pruebas en `tests/` para cada ruta: filtros inválidos (400), cliente inexistente (404), totales por moneda,
  que en el WIP no se dupliquen los tiempos respaldados, y que no haya escrituras (con
  `BOOKS_SOLO_LECTURA=1`).
- `pm2 restart sandbox-wip` y prueba en vivo cada ruta: tiempo de respuesta con caché y sin caché, y número
  de renglones.
- Cuadra el WIP contra la página `/wip` y el Reporte 03 contra el original. Dime en qué difieren y por qué.
- Documenta las rutas en `prebill-api.md` (sección "Reportes", una fila en "Cambios del …" y la consola de
  la API) y en `README.md`.
- Dame un resumen con la forma exacta de cada respuesta (campos, tipos y un ejemplo corto), el tiempo de
  respuesta medido y la propuesta para los demás reportes. Con eso armo la función de Catalyst y las Slates.
