# Proyecto Catalyst: Configuración

Configuración del despacho que no es de un área ni de un proyecto. Hoy: **configuración de
abogados** (nivel, activo, tarifa propia por moneda, enlace con su usuario de Books y si puede ser
responsable de facturación, cobranza o general). Decisión del usuario (2026-11-13): sacar
"Abogados responsables" de Configuración del proyecto y hacer una pantalla de abogados en un
proyecto propio, con las 4 cosas.

| | |
|---|---|
| Proyecto de Catalyst | `SettingsForAptusFinancials` (**por crear**) |
| URL de la función | `https://settingsforaptusfinancials-730085095.development.catalystserverless.com/server/aptus_settings_services` (confirmar al crear el proyecto) |
| Función | `aptus_settings_services` → `functions/aptus_settings_services` |
| Slates (1 de 3) | Configuración de abogados. Quedan 2 lugares para niveles, tarifas generales, etc. |
| Tema | Esmeralda |

## Piezas

| Pieza | Carpeta | Repositorio | Slate / Deployment Name |
|---|---|---|---|
| Función | `functions/aptus_settings_services` | `AptusSettingsServices` (por crear) | — |
| Configuración de abogados | `UniversalAptusLawyerSettings` | `UniversalAptusLawyerSettings` (por crear) | `universal-aptus-lawyersettings` |

Configuración del proyecto (Consolidado) enlaza aquí desde "Asignar responsable", y sigue leyendo la
marca con su propia función (`GET /abogados-responsables`, solo lectura).

## Rutas de `aptus_settings_services`

**No escribe en Books ni crea Usuarios de Books.** No crea ni borra abogados (eso sigue en Aptus).

| Método | Ruta | Reglas |
|---|---|---|
| GET | `/:org/abogados`, `/:org/tipos-abogado`, `/:org/responsables` | listas |
| GET | `/:org/abogados/:id` | un abogado |
| PATCH | `/:org/abogados/:id` | solo `tipo_id`, `activo` (bool), `tarifas_propias` `{MXN, USD, EUR}` (≥ 0, 2 decimales; `null` la quita), `zoho_user_id` (dígitos; `''` desenlaza; debe existir en Books → si no 422), `responsable` (`facturacion` / `cobranza` / `general` / `null`). Nombre, correo y foto no se editan |
| POST | `/:org/abogados/:id/sincronizar-books` | → `POST /abogados/:id/sincronizar-zoho`: trae foto, nombre, status y correo del usuario de Books (lectura en Books) |
| GET | `/:org/usuarios-books` | → `GET /zoho/usuarios` (lectura) |

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
6. Slate `universal-aptus-lawyersettings` ligada a `UniversalAptusLawyerSettings` (rama `main`;
   `npm install`, `npm run build`, salida `dist`).
7. Dominios autorizados (CORS): `https://universal-aptus-lawyersettings.onslate.com`.

## Pruebas

```bash
cd functions/aptus_settings_services && npm test   # 6
cd UniversalAptusLawyerSettings && npm test        # 3
```

## Pendientes

1. Crear el proyecto, los 2 repositorios, la Slate y el dominio en CORS → desplegar y verificar.
2. Al quedar publicada: desplegar `aptus_overview_services` y subir Configuración del proyecto sin la
   pestaña (ya hecho en local).
3. Prueba del usuario: cambiar nivel, tarifa propia y enlace de un abogado de prueba; marcar y quitar
   responsable; desactivar y reactivar.
