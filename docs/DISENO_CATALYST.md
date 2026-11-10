# Aptus Widgets en Catalyst — patrón de diseño

> Contexto de diseño (2026-11-09). Describe el patrón que ya sigue la función
> `01-tiempos/functions/time_entry_services` (tiempos, plantillas, tareas) para repetirlo en las pantallas que
> faltan: gastos, honorarios fijos, liberaciones, configuración del proyecto y después Prebills.
> El *qué* construir está en `CONTEXTO_CATALYST.md`; aquí está el *cómo*.

Referencia principal: `services/TimeEntryService.js` y `services/TemplateService.js` (los más
nuevos y probados). `CatalogService` y `DbConfigService` son anteriores y tienen detalles que **no**
se repiten (sección 9).


> **Actualización 2026-11-10 — funciones por proyecto.** Cada proyecto de Catalyst tiene su
> función (`CONTEXTO_CATALYST.md` §1.1). En las funciones nuevas:
> - `PrebillApiClient`, `DbConfigService`, `AuthService`, `sendError` y `registerCatalogRoutes` se
>   importan de `./core/` (copia de `shared/catalyst-core/src`). Nunca se editan en `core/`.
> - Las lecturas simples usan `registerCatalogRoutes(app, { recurso: [filtros permitidos] })`: lista
>   blanca de recursos y de filtros, organización numérica, errores con el contrato común. Reemplaza
>   la ruta genérica `/:organizationId/:catalog` del time entry, que reenviaba cualquier ruta.
> - Se registra **después** de las rutas propias y al final va un 404 JSON **sin** `stage` (un 404
>   con `stage` significa "el registro ya no existe" para las interfaces).
> - Referencia completa: `02-gastos/functions/expense_services`.

---

## 1. Capas

```
index.js                 rutas Express: parsea params, instancia el servicio, mapea errores a HTTP
services/<X>Service.js   validación + llamadas al proveedor; lanza <X>Error con status
auth/AuthService...      token de Books por organización (Donatello)
services/<Conn>Service   endpoint/token de un sistema externo desde cm_global_vars + Catalyst Cache
tests/<X>.test.js        node:test con http/auth falsos inyectados
<RECURSO>_ENDPOINT.md    contrato del endpoint (cuerpo, respuestas, errores, flujo, pendientes)
```

- **La ruta no tiene lógica**: `new Servicio(organizationId).accion(req.body)` y traducir el error.
- **El servicio no conoce Express**: recibe datos planos, devuelve objetos planos, lanza errores con
  `status`.
- Un servicio por recurso (`GastoService`, `CargoFijoService`, `LiberacionService`,
  `ProyectoConfigService`), todos sobre un cliente HTTP común hacia ReportesSandbox
  (`PrebillApiClient`, sección 4).

---

## 2. Rutas

Convención existente: `/:organizationId/<recurso en español, plural, kebab-case>`.

| Método | Ruta | Respuesta OK |
|---|---|---|
| GET | `/:organizationId/gastos` | 200 lista |
| POST | `/:organizationId/gastos` | **201** objeto creado |
| GET | `/:organizationId/gastos/:id` | 200 `{ gasto }` o el objeto |
| PATCH | `/:organizationId/gastos/:id` | 200 objeto (la API usa PATCH; el time entry usa PUT porque Books reemplaza) |
| DELETE | `/:organizationId/gastos/:id` | 200 respuesta de la API |

Propuesta de rutas nuevas (todas antes de la genérica):

```
/:org/gastos, /:org/gastos/:id, /:org/gastos/:id/reembolso, /:org/reembolsos, /:org/categorias-gasto
/:org/cargos-fijos, /:org/cargos-fijos/:id, /:org/igualas/generar
/:org/liberaciones, /:org/liberado-disponible
/:org/proyectos, /:org/proyectos/:id, /:org/proyectos/:id/tareas,
/:org/proyectos/:id/sincronizar-tareas, /:org/proyectos/:id/crear-en-books
/:org/tarifas, /:org/tarifas/:id, /:org/tarifas/resolver, /:org/impuestos
```

> **Orden obligatorio**: `app.get('/:organizationId/:catalog', …)` atrapa cualquier
> `GET /:org/<algo>` de un segmento. Toda ruta nueva de un segmento (`/gastos`, `/cargos-fijos`,
> `/categorias-gasto`, `/reembolsos`, `/liberado-disponible`, `/proyectos`, `/impuestos`) va
> **arriba** de ella, como ya se hizo con `/tareas`. Dejar el comentario que lo explica.

Plantilla de ruta (igual a la de tiempos):

```js
app.post('/:organizationId/gastos', async (req, res) => {
    try {
        return res.status(201).json(await new GastoService(req.params.organizationId, { req }).create(req.body));
    } catch (error) {
        return sendError(res, error, 'Error interno guardando el gasto.');
    }
});
```

Conviene extraer el mapeo repetido a un helper:

```js
function sendError(res, error, internalMessage) {
    const status = error.status || 500;
    const details = { stage: error.stage ?? 'validation', outcome_unknown: error.outcome_unknown ?? false };
    if (status >= 500) console.error(internalMessage, { ...details, provider_status: error.provider_status ?? null });
    return res.status(status).json({ error: status === 500 ? internalMessage : error.message, ...details });
}
```

---

## 3. Servicio

Forma que comparten `TimeEntryService` y `TemplateService`:

```js
import PrebillApiClient from './PrebillApiClient.js';

export class GastoError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}

const id = value => typeof value === 'string' && /^\d+$/.test(value);   // IDs de Books: string de dígitos
const localId = value => Number.isInteger(value) && value > 0;           // IDs de ReportesSandbox: enteros

// Exportada por separado para probarla sin red.
export function validateGasto(organizationId, body) {
    if (!id(organizationId)) throw new GastoError('Organización inválida.');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new GastoError('Se requiere un objeto JSON.');
    // ... reglas (sección 3.1)
    return payload;   // solo los campos permitidos; nada de lo demás viaja
}

export default class GastoService {
    constructor(organizationId, { api = new PrebillApiClient(organizationId) } = {}) {
        this.organizationId = organizationId; this.api = api;
    }
    async create(body) {
        const payload = validateGasto(this.organizationId, body);   // 1. validar antes de autenticar
        return this.api.request('post', '/gastos', { data: payload, stage: 'create_gasto' });
    }
}
```

### 3.1 Validación

- **Validar antes de autenticar o escribir.** Las pruebas lo verifican (cero llamadas si falla).
- Construir un `payload` nuevo con **lista blanca** de campos; lo que mande la UI de más no se
  reenvía (el time entry ignora `cliente`, `plantilla`, etc.).
- Tipos estrictos: string de dígitos para IDs de Books, entero para IDs locales, booleanos de
  verdad (`typeof === 'boolean'`), fechas `YYYY-MM-DD` que existan:

```js
const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
    && new Date(v).toISOString().slice(0, 10) === v;
```

- Replicar las reglas de la API para dar el error temprano y en español (monto > 0, horas 0–24,
  `desde ≤ hasta`, `pagado_por=abogado` ⇒ `abogado_id`, `tipo_cobro=iguala` ⇒ `honorario_fijo`,
  `YYYY-MM` en `periodo`). **La API sigue siendo la autoridad**: no se omite un 400/409/422 de ella.
- No truncar silenciosamente: texto demasiado largo → 400.
- Mensajes cortos, en español, que digan el campo: `'monto debe ser mayor que 0.'`.

### 3.2 Errores

- Una clase `<Recurso>Error extends Error` con `status` (400 por omisión).
- Durante el flujo se lleva `stage` (`'authentication'`, `'resolve_ids'`, `'create_gasto'`…) y se
  adjunta al error, junto con `outcome_unknown`.
- `outcome_unknown = true` **solo** si la etapa era una escritura y no hubo respuesta
  (`!cause.response`). Un rechazo con respuesta es reintentable (`false`).
- Errores del proveedor se envuelven: se conserva `status`/`message` si vienen de la API con
  400/404/409/422; cualquier otra cosa → 502 con mensaje genérico.

---

## 4. Cliente hacia ReportesSandbox (`PrebillApiClient`)

Un solo lugar para endpoint, token, timeout, mapeo de errores y saneamiento.

```js
import axios from 'axios';
import PrebillConfigService from './PrebillConfigService.js';   // cm_global_vars + Catalyst Cache

export class PrebillApiError extends Error {
    constructor(message, status = 502) { super(message); this.status = status; }
}
const PASS_THROUGH = new Set([400, 404, 409, 422]);
const WRITES = new Set(['post', 'patch', 'put', 'delete']);

export default class PrebillApiClient {
    constructor(organizationId, { http = axios, config = null, req = null } = {}) {
        this.organizationId = organizationId; this.http = http;
        this.config = config ?? new PrebillConfigService(organizationId, req);
    }
    async request(method, path, { params = {}, data, stage = method + ' ' + path } = {}) {
        const { endpoint, token } = await this.config.get();          // 503 si faltan
        const url = endpoint.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');   // sin doble slash
        try {
            const res = await this.http.request({ method, url, data, params: { ...params, token }, timeout: 30000 });
            if (typeof res.data !== 'object' || res.data === null) throw new Error('Respuesta no JSON.');
            return res.data;
        } catch (cause) {
            const status = cause.response?.status;
            const apiMessage = typeof cause.response?.data?.error === 'string' ? cause.response.data.error : null;
            const error = PASS_THROUGH.has(status) && apiMessage
                ? new PrebillApiError(apiMessage, status)
                : new PrebillApiError('No se pudo completar la operación en ReportesSandbox.', 502);
            error.stage = stage;
            error.provider_status = status ?? null;
            error.outcome_unknown = WRITES.has(method) && !cause.response;
            throw error;   // nunca `cause`: trae config.url y params con el token
        }
    }
}
```

Puntos clave:
- **Token en `params`** (query string), nunca en header: Apache solo revisa `?token=`.
- Un 401 o una página HTML (404 nativo de Apache) → 502 genérico; registrar solo
  `provider_status`.
- Listas: la API devuelve arreglos completos (no pagina). Las de Books sí paginan: usar el ciclo de
  `TemplateService.list` (`page`, `per_page: 200`, `has_more_page`, tope de 1000 páginas, error si
  una página "con más" viene vacía).

---

## 5. Seguridad y registro

- `console.error` solo con objetos armados a mano: `{ organizationId, stage, status, code,
  books_code }`. **Nunca** el error de axios, `error.config`, headers, URL completa ni cuerpo del
  proveedor (comentario existente: "Do not log Axios errors: they can contain authorization
  headers").
- No devolver al widget el cuerpo crudo del proveedor; solo `error` de la API en los status de paso.
- `console.log` de depuración solo con IDs no sensibles (como `'Enviando tiempo a Books', {
  project_id, task_id }`). Quitar `console.log(req.body)` antes de producción.
- El secreto de Donatello solo en `.env` (`AUTH_TOKEN`); tokens de servicios externos solo en
  `cm_global_vars` + caché.

---

## 6. Escrituras

- **Sin reintentos automáticos.** Si la escritura expira sin respuesta: `outcome_unknown: true`; la
  UI consulta antes de reenviar.
- Secuencias de varios pasos no son transacciones: reportar qué pasos sí ocurrieron (como
  `task_created` + `task_id` en tiempos).
- Acciones que escriben en Books (`crear-en-books`, `sincronizar-tareas`, facturar, deshacer
  factura) se exponen en **dos llamadas**: vista previa (sin `confirmar`) y confirmación
  (`{ confirmar: 1 }`). Catalyst solo manda `confirmar: 1` si la UI lo pide explícitamente
  (`body.confirmar === true`).
- Acciones masivas (`POST /liberaciones` sin `cliente_id`, `POST /igualas/generar`) piden
  confirmación en la UI.

---

## 7. Pruebas

`node:test` + `node:assert/strict`, sin red. Dependencias inyectadas por constructor
(`{ http, auth }` hoy; `{ api }` o `{ http, config }` para ReportesSandbox).

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import GastoService, { validateGasto } from '../services/GastoService.js';

const input = { proyecto_id: 18, fecha: '2026-11-09', monto: 640, tipo: 'gasto', pagado_por: 'despacho' };
function fixture(response = { id: 22 }) {
    const calls = [];
    const api = { async request(method, path, opts) { calls.push({ method, path, opts }); return response; } };
    return { service: new GastoService('636939444', { api }), calls };
}
test('valida antes de llamar a la API', async () => {
    for (const patch of [{ monto: 0 }, { fecha: '2026-02-30' }, { pagado_por: 'abogado' }]) {
        const { service, calls } = fixture();
        await assert.rejects(service.create({ ...input, ...patch }), e => e.status === 400);
        assert.equal(calls.length, 0);
    }
});
test('solo reenvía campos permitidos', async () => {
    const { service, calls } = fixture();
    await service.create({ ...input, extra: 'x' });
    assert.equal(calls[0].opts.data.extra, undefined);
});
```

Casos que cada servicio debe cubrir (copiados de las pruebas de tiempos/plantillas):
1. Validación sin llamadas al proveedor.
2. Solo campos permitidos en el payload.
3. 400/409/422 de la API conservan su mensaje y status.
4. Pérdida de red en escritura → `outcome_unknown: true`, **una sola** llamada.
5. Rechazo con respuesta → `outcome_unknown: false` y el mensaje no contiene secretos
   (`'secret'`, token).
6. Respuesta con forma inesperada → 502 (no tratarla como lista vacía).
7. Una prueba de ruta (`app.router.stack`) por recurso: 400 antes del proveedor y status OK.

---

## 8. Interfaz del widget

> Sale del código fuente de las dos Slates: `01-tiempos/UniversalAptusTimeEntry` (captura) y
> `01-tiempos/UniversalTimesCalendar` (calendario/listado). Rutas de archivos en
> `CONTEXTO_CATALYST.md` §3.1.

### 8.1 Stack de cada app

| Pieza | Captura (`widget-ui`) | Calendario (`advancedtimescalendar`) |
|---|---|---|
| Base | React 19.2, Vite 8, TypeScript 6 | React 19.3, Vite 8, TypeScript 6 |
| Tailwind | **v4** con `@tailwindcss/vite` y `@theme` en `src/index.css` (el `tailwind.config.js` no se usa) | **v3** con PostCSS y `tailwind.config.js` (`brand-*`, `font-heading`) |
| shadcn/ui | estilo `new-york`, base `slate`, sobre **Radix** | estilo `base-nova`, base `neutral`, sobre **Base UI** |
| Componentes en `src/components/ui` | button, calendar (react-day-picker), card, checkbox, command (cmdk), dialog, input, label, popover, radio-group, select, switch, textarea | button, card, checkbox, command, dialog, input, input-group, label, popover, select, textarea + lookups propios (`ClientLookup`, `ProjectLookup`, `LawyerLookup`) y `Modal` |
| Avisos | `StatusModal` (dialog con icono por tipo) + `sonner` (toasts) | `Modal` propio + `window.confirm` para borrar |
| Animación | animate.css, Lottie (`clock-lottie.json`), manchas de fondo con `animate-blob` | tw-animate-css (`animate-in fade-in zoom-in-95`) |
| Tipografía | Inter (declarada; no se carga fuente web) | Geist Variable (`@fontsource-variable/geist`); Outfit de Google Fonts para títulos |
| Extra | revisión ortográfica con `typo-js` (diccionarios en `public/dict`) | exportar CSV y PDF (jsPDF + autoTable) |
| Pruebas / lint | `tests/*.test.mjs` (node:test sobre `lib/`), oxlint | ninguna |
| Alias | `@/` → `src/` | `@/` → `src/` |

**Recomendación para pantallas nuevas:** partir de la base de la captura (Tailwind v4, shadcn
`new-york` con Radix, lógica pura y probada en `src/lib/`, `StatusModal` + `sonner`). Del
calendario se reutilizan el patrón de **lista con filtros, agrupación y exportación**
(`TimeList.tsx`) y los **hooks de catálogo con caché** (`hooks/use*.ts`), portados a esa base.

### 8.2 Sistema visual de la captura (el que se sigue)

Tokens en `src/index.css`:
- Base shadcn en HSL (`--background`, `--foreground`, `--primary` azul `221.2 83.2% 53.3%`,
  `--border`, `--ring`…), `--radius: 0.5rem`.
- **Tema de marca** con 5 variables: `--theme-from`, `--theme-to`, `--theme-light`,
  `--theme-border`, `--theme-text`, expuestas como colores Tailwind `theme-from`, `theme-to`,
  `theme-light`, `theme-border`, `theme-text`.
- Temas: `default` (Navy `#1e3a8a → #3b82f6`), `theme-coral`, `theme-emerald`, `theme-purple`,
  `theme-amber`, `theme-orange`. Se guarda en `localStorage.app_theme` y se aplica como **clase**
  en `<html>`. La lista está en `THEMES` de `App.tsx`.

Clases compartidas (constantes en `App.tsx`; en pantallas nuevas conviene moverlas a
`src/lib/ui.ts`):

```ts
const labelCls        = 'text-theme-text font-semibold text-xs'
const sectionIconCls  = 'w-4 h-4 text-theme-text'
const sectionTitleCls = 'text-sm font-semibold text-slate-700'
const cardCls         = 'border border-slate-200 rounded-xl p-4 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]'
```

Estructura de la pantalla:

```
<div min-h-screen bg-slate-50/50 p-2 sm:p-4 lg:p-8>                         fondo
  <Card rounded-[20px] bg-gradient-to-b from-[#FFFAFA] to-white p-3 sm:p-5 lg:p-8 animate__fadeIn>
    manchas decorativas (bg-theme-from/5, blur, animate-blob) + franja superior from-theme-light
    ENCABEZADO: icono 14×14 rounded-2xl en degradado theme-from→theme-to · h1 text-2xl font-bold
                · engrane (Popover "Apariencia") · subtítulo text-slate-500 text-sm
                · a la derecha: Cancelar (outline, h-11 sm:h-12) y Guardar (degradado, icono Save)
    avisos de estado (cargando / error / pendiente) con role="status" o role="alert"
    <div inert={ocupado} className="space-y-4">
      grid lg:grid-cols-2 de tarjetas cardCls: icono + título de sección → campos en grid sm:grid-cols-2
      bloque resumen: franja en degradado con 3 métricas en blanco
        (icono en círculo bg-white/15, número text-2xl bold, unidad "hrs")
      descripción / referencia / opciones
```

Controles:
- **Selector con búsqueda** (cliente, proyecto, abogado): `Popover` + `Command`
  (`shouldFilter={false}`, filtro propio, máximo 100 resultados), botón `role="combobox"` `h-9
  rounded-lg border-slate-200`, y a la derecha un botón circular `w-9 h-9` para **refrescar el
  catálogo** (`RefreshCw`, gira mientras carga). El selector dependiente se deshabilita con el texto
  "Selecciona un cliente primero".
- **Fecha**: `Popover` + `Calendar` (react-day-picker); muestra `yyyy-MM-dd`.
- **Segmentado** (Registrar como): contenedor `bg-slate-50 p-1 rounded-lg border`, opción activa
  `bg-gradient-to-r from-theme-from to-theme-to text-white`.
- **Botón principal**: `bg-gradient-to-r from-theme-from to-theme-to hover:from-theme-to
  hover:to-theme-from text-white`; el texto cambia con el estado: "Guardando…", "Reintentar
  pendientes", "Verificar en Books", "Guardar cambios", "Guardar Registro".
- **Avisos informativos**: `bg-theme-light/80 border-theme-border text-theme-to rounded-lg p-3`
  con icono `Info`.
- Etiquetas obligatorias con `*`; errores de campo `text-xs text-red-700` con botón "Reintentar".
- Iconos lucide `w-4 h-4` (sección) y `w-3.5 h-3.5 text-slate-400` (etiqueta).

### 8.3 Sistema visual del calendario (referencia para listas)

- Marca `--brand-50 … --brand-950` en RGB (índigo por omisión), temas
  `[data-theme=emerald|rose|amber]`, guardado en `localStorage.aptus_theme`; base shadcn en `oklch`
  con variante `.dark`.
- Contenedor `h-screen bg-slate-200/60` → tarjeta `max-w-[1900px] bg-white rounded-2xl shadow-2xl`.
- Barra superior `bg-gradient-to-r from-slate-900 via-brand-900 to-fuchsia-900 text-white`, con
  segmentados `bg-white/10 rounded-md p-0.5` (activo `bg-white text-brand-900`), navegación
  anterior / hoy / siguiente, botón "Agregar" con contorno esmeralda y engrane de configuración.
- Tabla: `thead sticky bg-slate-50/95 backdrop-blur text-xs uppercase tracking-wider
  text-slate-500`, filas `hover:bg-slate-50`, menú contextual por fila y botón de tres puntos,
  agrupación y orden por columna, exportar CSV/PDF.
- Chips de filtro `bg-brand-50 text-brand-700 border-brand-100 rounded-full text-xs`.
- Filtros (clientes, proyectos, abogados, vista, fecha, modo lista/calendario) guardados en
  `localStorage` por organización (`aptus_selected_*_{org}`).

**Inconsistencias a resolver al unificar**: dos sistemas de tema (`theme-*` por clase con 6 temas
vs. `brand-*` por `data-theme` con 4), claves distintas (`app_theme` vs. `aptus_theme`) y nombres
distintos para el mismo color (`theme-emerald` vs. `emerald`). Al pasar de una Slate a la otra el
usuario puede ver otro color.

### 8.4 Comportamientos que las pantallas nuevas repiten
- Selección por catálogos (cliente → proyecto → abogado); los selectores dependen del anterior.
  Un registro histórico fuera del catálogo se conserva como opción al editar.
- Edición por URL: `?organization_id=...&<recurso>_id=...`; carga el registro y exige que sus
  catálogos existan.
- **Bloquear doble envío**: deshabilitar Guardar mientras hay una petición.
- Con `outcome_unknown: true` no permitir reenviar hasta revisar; mostrar el mensaje.
- Errores: mostrar `error` tal cual (viene en español); `stage` sirve para soporte.
- Varias operaciones en una pantalla (p. ej. varios tiempos + plantilla): guardar en orden,
  conservar los IDs ya guardados y reintentar solo lo que falló, sin transacción.
- Montos y horas: número plano en la moneda del proyecto (sin símbolo ni separadores al enviar).
- Acciones que escriben en Books: botón de vista previa → resumen → confirmar.

Por pantalla (mínimo):

| Pantalla | Elementos |
|---|---|
| Gastos | Lista filtrable (proyecto, estado, pagado por) · formulario (proyecto, fecha, monto, categoría → tipo por omisión, facturable, pagado por, abogado si aplica, descripción) · editar/borrar solo si `status` es `capturado` o `liberado` · marcar reembolso. |
| Honorarios fijos | Lista por proyecto (solo `fijo`/`iguala`) · cargo manual (monto sugerido = `honorario_fijo`) · "Generar igualas del mes" con periodo y resultado `creados`/`ya_existian`. |
| Liberaciones | Rango de fechas + cliente (opcional, con confirmación si va vacío) · resultado por tipo · vista de lo disponible por cliente + moneda. |
| Configuración del proyecto | Datos (tipo de cobro, honorario fijo, IVA, moneda solo si no hay capturas) · enlace a Books · tareas (vista previa/sincronizar) · tarifas del proyecto con "probar qué tarifa aplica" · responsables. |

Estados que la UI muestra con la misma etiqueta que la API (`status`): `capturado`, `liberado`,
`en_prebill`, `facturado`, `no_facturable`; Prebill: `borrador`, `en_revision`, `autorizada`,
`facturada`.

---

## 9. Lo que no se repite del código actual

| Dónde | Qué | En código nuevo |
|---|---|---|
| `index.js` | `import TemplateService` antes de `"use strict"` (en ESM no hace falta) y bloques de CORS comentados | Imports juntos arriba; sin código comentado. |
| `index.js` | `console.log(req.body)` en POST de tiempos | No loguear cuerpos. |
| Ruta genérica `/:org/:catalog` | `console.error(error)` y 500 con `error.message` | Registro saneado y mensaje genérico. |
| `CatalogService` | Token concatenado en la URL y `error.message` de axios en la respuesta | `params: { token }` y error saneado. |
| `DbConfigService` | Lee `cm_global_vars` sin paginar y depende de `req` | Paginar si crece; aceptar `config` inyectado para pruebas. |
| `express-validator` | Instalada sin uso | Validación manual exportable, como `validateTimeEntry`. |

---

## 10. Checklist para un recurso nuevo

1. Contrato en `<RECURSO>_ENDPOINT.md` (cuerpo, respuestas, errores, flujo, pendientes).
2. `services/<X>Service.js` con `<X>Error`, `validate<X>` exportada y DI.
3. Rutas en `index.js` **antes** de `/:organizationId/:catalog`, con `sendError`.
4. `tests/<X>Service.test.js` y prueba de ruta con los 7 casos de §7.
5. `npm test` en verde.
6. Si escribe en Books: vista previa + confirmación y aprobación del usuario antes de activarlo.
7. Actualizar `CONTEXTO_CATALYST.md` (sección 3) con la ruta nueva.
