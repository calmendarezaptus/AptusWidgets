# Proyecto Catalyst: Honorarios fijos

Captura y calendario de **cargos fijos e igualas** sobre ReportesSandbox. Contexto en
`docs/CONTEXTO_CATALYST.md` §5.2 y patrón en `docs/DISENO_CATALYST.md`. Se construye igual que
Gastos (`02-gastos/`), que es la referencia.

| | |
|---|---|
| Proyecto de Catalyst | `FixedFeesForAptusFinancials` (`247000003819167`) |
| URL de la función | `https://fixedfeesforaptusfinancials-730085095.development.catalystserverless.com/server/fixed_fee_services` |
| Función | `fixed_fee_services` → `functions/fixed_fee_services` |
| Slates (2 de 3) | Captura de honorarios fijos · Calendario de honorarios fijos |
| Estado | **En producción** (2026-11-11): función, captura y calendario verificados; prueba completa del usuario OK |

## Piezas

| Pieza | Carpeta | Repositorio | Slate / Deployment Name |
|---|---|---|---|
| Función | `functions/fixed_fee_services` | `AptusFixedFeeServices` ✓ | — |
| Captura | `UniversalAptusFixedFeeEntry` | `UniversalAptusFixedFeeEntry` ✓ | `universal-aptus-fixedfeeentry` |
| Calendario | `UniversalFixedFeesCalendar` | `UniversalFixedFeesCalendar` ✓ | `universal-fixedfeeentry-calendar` |

## Rutas de `fixed_fee_services`

| Método | Ruta | API / reglas |
|---|---|---|
| POST | `/:org/cargos-fijos` | `proyecto_id` requerido; `monto`, `concepto` (≤200) y `fecha` opcionales: la API pone el `honorario_fijo` del proyecto, "Honorarios (cuota fija)" y hoy. Antes de escribir se lee el proyecto: si es por hora → 422; sin monto y sin honorario configurado → 422 |
| GET / PATCH / DELETE | `/:org/cargos-fijos/:id` | PATCH: `fecha`, `concepto`, `monto` (al menos uno). 409 de la API si está facturado o en Prebill |
| POST | `/:org/igualas/generar` | `{ periodo: "YYYY-MM" }` **obligatorio** (la API usaría el mes actual). Idempotente: `creados` / `ya_existian` |
| GET | `/:org/cargos-fijos` | filtros: `proyecto_id, liberado, facturado, prebill_id` |
| GET | `/:org/clientes`, `/:org/proyectos`, `/:org/abogados` | listas |

Código: `services/CargoFijoService.js` (mismo patrón que `GastoService`). Datos reales al
2026-11-11: proyectos 24 (`fijo`, 45,000 MXN) y 25 (`iguala`, 25,000 MXN); 3 cargos, todos
facturados.

## Despliegue de la función con el CLI

```bash
cd 03-honorarios-fijos
catalyst project:use 247000003819167      # solo la primera vez en esta máquina
cd functions/fixed_fee_services && npm install && npm test && cd ../..
catalyst deploy --only functions:fixed_fee_services
```

Verificado en vivo (2026-11-11): lecturas 200, `cargos-fijos/999999` → 404 JSON de la API, `gastos`
→ 404 (no es de este proyecto), alta inválida → 400 y alta en proyecto por hora → 422, sin escribir.

## Configuración en Catalyst

1. Función `fixed_fee_services` (Node 24, Advanced I/O).
2. Variable `AUTH_TOKEN`: viaja en `.env` (local, no se versiona), igual que en Tiempos y Gastos.
3. Caché: funciona con el segmento `Default`.
4. Dominios autorizados: `https://universal-aptus-fixedfeeentry.onslate.com`,
   `https://universal-fixedfeeentry-calendar.onslate.com`.
5. Slates: build `npm run build`, salida `dist/`, variable `VITE_API_BASE_URL`.

## Pruebas

```bash
cd functions/fixed_fee_services && npm test      # 10: servicio, rutas, core
cd UniversalAptusFixedFeeEntry && npm test        # 7
cd UniversalFixedFeesCalendar && npm test         # 6
```

## Pendientes

1. ~~`CargoFijoService` + rutas de escritura + pruebas.~~ Hecho.
2. ~~Captura~~ Hecha (2026-11-11): tema Ámbar; cargo manual + igualas del mes con vista previa;
   probada con datos reales sin escribir (listas filtradas, honorario propuesto, vista previa de
   noviembre, edición bloqueada del cargo #11 facturado). Slate y CORS verificados.
3. ~~Calendario~~ Hecho (2026-11-11): tema Ámbar; lista, mes, semana y día; cliente completado con el
   catálogo de proyectos (la API no lo trae); probado con los 3 cargos reales. Slate y CORS verificados: la Slate
   desplegada carga los cargos en Chrome sin errores.
4. ~~Prueba completa del usuario~~ Hecha (2026-11-11): alta, edición, borrado e igualas funcionan. Los
   registros de prueba se borraron; quedan los 3 cargos originales (#11, #12, #13).
