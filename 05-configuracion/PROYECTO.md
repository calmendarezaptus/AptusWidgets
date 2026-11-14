# Proyecto Catalyst: Configuración

Configuración del despacho que no es de un área ni de un proyecto. Hoy: **configuración de
abogados** (nivel, activo, tarifa propia por moneda, enlace con su usuario de Books y si puede ser
responsable de facturación, cobranza o general). Decisión del usuario (2026-11-13): sacar
"Abogados responsables" de Configuración del proyecto y hacer una pantalla de abogados en un
proyecto propio, con las 4 cosas. Después (mismo día): **configuración del despacho** (formato de
factura, captura sin usuario de Books, fuentes de responsables, CFDI, membrete y datos de pago,
conceptos de factura y catálogos: niveles, tareas estándar y categorías de gasto).

| | |
|---|---|
| Proyecto de Catalyst | `SettingsForAptusFinancials` (`247000003819350`) |
| URL de la función | `https://settingsforaptusfinancials-730085095.development.catalystserverless.com/server/aptus_settings_services` |
| Función | `aptus_settings_services` → `functions/aptus_settings_services` |
| Slates (2 de 3) | Configuración de abogados; Configuración del despacho. Queda 1 lugar (tarifas generales y de cliente, IVA e idioma por cliente). |
| Tema | Esmeralda |

## Piezas

| Pieza | Carpeta | Repositorio | Slate / Deployment Name |
|---|---|---|---|
| Función | `functions/aptus_settings_services` | `AptusSettingsServices` ✓ | — |
| Configuración de abogados | `UniversalAptusLawyerSettings` | `UniversalAptusLawyerSettings` ✓ | `universal-aptus-lawyersettings` |
| Configuración del despacho | `UniversalAptusFirmSettings` | `UniversalAptusFirmSettings` | `universal-aptus-firmsettings` |

Configuración del proyecto (Consolidado) enlaza aquí desde "Asignar responsable", y sigue leyendo la
marca con su propia función (`GET /abogados-responsables`, solo lectura).

## Rutas de `aptus_settings_services`

**No escribe en Books ni crea Usuarios de Books ni artículos.** No crea ni borra abogados (eso sigue en Aptus).

| Método | Ruta | Reglas |
|---|---|---|
| GET | `/:org/abogados`, `/:org/tipos-abogado`, `/:org/responsables` | listas |
| GET | `/:org/abogados/:id` | un abogado |
| PATCH | `/:org/abogados/:id` | solo `tipo_id`, `activo` (bool), `tarifas_propias` `{MXN, USD, EUR}` (≥ 0, 2 decimales; `null` la quita), `zoho_user_id` (dígitos; `''` desenlaza; debe existir en Books → si no 422), `responsable` (`facturacion` / `cobranza` / `general` / `null`). Nombre, correo y foto no se editan |
| POST | `/:org/abogados/:id/sincronizar-books` | → `POST /abogados/:id/sincronizar-zoho`: trae foto, nombre, status y correo del usuario de Books (lectura en Books) |
| GET | `/:org/usuarios-books` | → `GET /zoho/usuarios` (lectura) |
| GET / PATCH | `/:org/config-despacho` | solo secciones `factura`, `respaldo`, `responsables`, `cfdi`, `formatos` y sus campos conocidos (400 si no); fuentes de responsables validadas (1 a 5; `campo_cliente` con `cf_…`, `rol_proyecto` con rol); `respaldo.usuario_books_omision` debe existir en Books (422). Aptus valida los valores |
| POST | `/:org/config-despacho/restablecer` | `{seccion}` opcional (una de las 5); sin ella, todo |
| GET | `/:org/conceptos-factura` | con el artículo de Books de cada idioma |
| PATCH | `/:org/conceptos-factura/:clave` | `item_id_es` / `item_id_en`; el artículo debe existir en Books (422). Nunca crea artículos |
| GET | `/:org/conceptos-factura/faltantes` | → `POST /conceptos-factura/crear-en-books` **sin** `confirmar`: solo lista lo que falta. Crear en Books no está expuesto |
| GET | `/:org/articulos-books` | → `GET /zoho/articulos` (lectura) |
| GET | `/:org/tareas-estandar`, `/:org/categorias-gasto` | `?todos` incluye inactivas |
| POST / PATCH | `/:org/tipos-abogado[/:id]` | nombre, `tarifa_mxn/usd/eur` (≥ 0, 2 decimales; `null` la quita); al crear, al menos una tarifa |
| DELETE | `/:org/tipos-abogado/:id` | borra el nivel y sus tarifas (Aptus 409 si un abogado lo usa) |
| POST / PATCH | `/:org/tareas-estandar[/:id]` | nombre, `codigo_utbms`, `facturable` 0/1; al editar también `activo` (bool) y `orden`. No se borran: se desactivan |
| POST / PATCH | `/:org/categorias-gasto[/:id]` | nombre, `codigo_utbms`, `tipo` gasto/reembolso; al editar `activo` y `orden` |

Quitar la marca de responsable no borra las asignaciones (regla de ReportesSandbox). Desactivar no
borra tiempos ni asignaciones; la pantalla pide confirmación.

## Alta en Catalyst

1. Crear el proyecto `SettingsForAptusFinancials`.
2. En esta carpeta: `catalyst project:use <id>` (crea `.catalystrc`, no se versiona).
3. Desplegar la función (Node 24, Advanced I/O):
   ```bash
   cd 05-configuracion
   cd functions/aptus_settings_services && npm install && npm test && cd ../..
   catalyst deploy --only functions:aptus_settings_services
   ```
4. Variable `AUTH_TOKEN`: viaja en `.env` local (no se versiona), igual que en las otras áreas.
5. Caché: funciona con el segmento `Default`.
6. Slates `universal-aptus-lawyersettings` y `universal-aptus-firmsettings` ligadas a sus repos (rama
   `main`; `npm install`, `npm run build`, salida `dist`).
7. Dominios autorizados (CORS): `https://universal-aptus-lawyersettings.onslate.com`,
   `https://universal-aptus-firmsettings.onslate.com`.

## Pruebas

```bash
cd functions/aptus_settings_services && npm test   # 10
cd UniversalAptusLawyerSettings && npm test        # 3
cd UniversalAptusFirmSettings && npm test          # 4
```

## Pendientes

1. ~~Proyecto, repositorios y función~~ Hecho (2026-11-13): función desplegada; en vivo responden abogados,
   niveles, responsables y los usuarios de Books (200); un campo no permitido → 400 y un usuario de Books
   inexistente → 422, sin escribir. Slate y CORS verificados: la Slate publicada carga
   los 13 abogados y los usuarios de Books en Chrome, sin errores ni escrituras.
2. ~~Consolidado sin la pestaña~~ Hecho: `aptus_overview_services` desplegada (la marca solo se lee ahí) y
   Configuración del proyecto subida con el enlace a esta pantalla.
3. Prueba del usuario: cambiar nivel, tarifa propia y enlace de un abogado de prueba; marcar y quitar
   responsable; desactivar y reactivar.
4. Configuración del despacho (2026-11-13): función desplegada; en vivo responden la configuración, los 4
   conceptos (todos con artículo), los 64 artículos de Books, faltantes (ninguno), 7 niveles, 14 tareas y
   11 categorías. Repo, Slate y CORS listos; la Slate publicada se probó en Chrome sin
   escribir (sin errores, sin desbordes en celular).
5. Prueba del usuario del despacho: cambiar el formato de factura y regresarlo; agregar una cuenta
   bancaria; crear, editar y borrar un nivel de prueba; desactivar y reactivar una tarea.
