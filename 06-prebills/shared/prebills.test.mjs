import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const toModule = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText).toString('base64')
const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8')
const api = read('../src/lib/api.ts').replace('import.meta.env.DEV', 'true').replace(/import\.meta\.env\.VITE_\w+/g, 'undefined')
const lib = await import(toModule(read('../src/lib/prebills.ts').replace("from './api'", `from '${toModule(api)}'`)))

const tiempo = { id: 9, proyecto_id: 6, fecha: '2026-09-09', horas: 3, tarifa_aplicada: 200, importe: 600, moneda: 'MXN', tarea: 'Asesoría', abogado_nombre: 'Jenny', facturable: 1, prebill_id: null, cliente_id: '446794000018976759', proyecto_nombre: 'QA', proyecto_zoho_nombre: '00001.006 QA' }
const gasto = { id: 31, proyecto_id: 1, fecha: '2026-11-10', monto: 2500, moneda: 'MXN', categoria_nombre: 'Mensajería', facturable: 1, prebill_id: null, proyecto_nombre: 'Asunto de prueba' }

test('líneas en una sola forma, ordenadas por tipo y fecha', () => {
  const l = lib.lineasDe({ gastos: [gasto], tiempos: [tiempo], cargos_fijos: [{ id: 4, proyecto_id: 2, fecha: '2026-11-01', monto: 25000, concepto: 'Iguala noviembre', periodo: '2026-11', moneda: 'MXN' }] })
  assert.deepEqual(l.map(x => x.key), ['tiempo-9', 'gasto-31', 'cargo-4'])
  assert.equal(l[0].monto, 600); assert.equal(l[0].proyecto, '00001.006 QA'); assert.equal(l[0].horas, 3)
  assert.equal(l[2].titulo, 'Iguala noviembre'); assert.equal(l[2].detalle, 'Periodo 2026-11')
})

test('cuerpo de crear / agregar / quitar por tipo', () => {
  const l = lib.lineasDe({ tiempos: [tiempo, { ...tiempo, id: 10 }], gastos: [gasto], cargos_fijos: [{ id: 4, monto: 1, proyecto_id: 2 }] })
  assert.deepEqual(lib.idsPorTipo(l), { tiempo_id: [9, 10], gasto_id: [31], cargo_fijo_id: [4] })
  assert.deepEqual(lib.idsPorTipo([l[2]], 'quitar_'), { quitar_gasto_id: [31] })
})

test('clientes con algo listo: sin Prebill, facturable; el cliente del gasto sale del proyecto', () => {
  const l = lib.lineasDe({ tiempos: [tiempo, { ...tiempo, id: 11, prebill_id: 9 }, { ...tiempo, id: 12, facturable: 0 }, { ...tiempo, id: 13, moneda: 'USD', importe: 50 }], gastos: [gasto, { ...gasto, id: 32, proyecto_id: 99 }] })
  const listos = lib.listosPorCliente(l, id => id === 1 ? '446794000018976759' : null)
  assert.deepEqual(listos, [
    { cliente_id: '446794000018976759', moneda: 'MXN', count: 2, total: 3100 },
    { cliente_id: '446794000018976759', moneda: 'USD', count: 1, total: 50 },
  ])
})

test('fase 1: solo se avanza hasta autorizada; facturada no es editable', () => {
  assert.equal(lib.AVANZAR.borrador.a, 'en_revision')
  assert.equal(lib.AVANZAR.en_revision.a, 'autorizada')
  assert.equal(lib.AVANZAR.autorizada, undefined)
  assert.equal(lib.editable('autorizada'), true)
  assert.equal(lib.editable('facturada'), false)
  assert.equal(lib.editable('facturando'), false)
})

test('descuento y ajuste del formulario', () => {
  assert.deepEqual(lib.parseAjuste('', 'x', 'descuento'), { tipo: '', valor: '' })
  assert.deepEqual(lib.parseAjuste('monto', '1,000.50', 'descuento'), { tipo: 'monto', valor: 1000.5 })
  assert.throws(() => lib.parseAjuste('porcentaje', '120', 'descuento'), /100/)
  assert.throws(() => lib.parseAjuste('monto', '0', 'ajuste'), /mayor que cero/)
  assert.equal(lib.contarIgnorados({ tiempo_id: [1, 2], gasto_id: [] }), 2)
})
