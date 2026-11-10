# catalyst-core

Código común de las funciones de Catalyst de Aptus. **Se edita solo aquí** y se copia a `core/` de
cada función.

| Archivo | Qué hace |
|---|---|
| `src/AuthService.js` | Token de Zoho por organización desde el broker Donatello (`AUTH_TOKEN`) |
| `src/DbConfigService.js` | Endpoint y token de ReportesSandbox desde `cm_global_vars` de Books, en caché 6 h (segmento `APTUS_MIRROR_CONN_DATA`) |
| `src/PrebillApiClient.js` | Cliente único de ReportesSandbox: token en query, 30 s, errores mapeados, nunca propaga el error de axios (trae el token) |
| `src/http.js` | `sendError` (contrato `{ error, stage, outcome_unknown }`) e `isValidOrganizationId` |
| `src/catalogs.js` | `registerCatalogRoutes(app, { recurso: [filtros] })`: lecturas con lista blanca |
| `sync.mjs` | Copia `src/` a las funciones de `targets.json` y escribe `core/MANIFEST.json` |
| `templates/core.test.js` | Prueba que se copia a cada función: falla si su `core/` se edita a mano |

## Flujo para cambiar algo

```bash
cd shared/catalyst-core
npm install            # una vez
# editar src/…
npm test               # pruebas del núcleo
npm run sync           # copia a las 4 funciones
npm run check          # ✓ en todas
```

Después: correr `npm test` en cada función, hacer commit en cada repositorio de función y volver a
desplegar las funciones afectadas.
