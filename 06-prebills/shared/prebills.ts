import { API_BASE } from './api'

// Prebills en Aptus (ReportesSandbox) vía prebill_services. FASE 1: hasta "autorizada", sin
// escribir en Books (facturar y deshacer factura no están aquí). Este archivo es igual en las dos
// Slates del proyecto (copia de 06-prebills/shared/prebills.ts).
export type Estado = 'borrador' | 'en_revision' | 'autorizada' | 'facturando' | 'facturada'
export const ESTADOS: Estado[] = ['borrador', 'en_revision', 'autorizada', 'facturada']
export const ESTADO_LABEL: Record<Estado, string> = { borrador: 'Borrador', en_revision: 'En revisión', autorizada: 'Autorizada', facturando: 'Facturando', facturada: 'Facturada' }
export const ESTADO_CLS: Record<Estado, string> = {
  borrador: 'bg-slate-100 text-slate-700 border-slate-200', en_revision: 'bg-sky-50 text-sky-800 border-sky-200',
  autorizada: 'bg-emerald-50 text-emerald-800 border-emerald-200', facturando: 'bg-amber-50 text-amber-800 border-amber-200',
  facturada: 'bg-violet-50 text-violet-800 border-violet-200',
}
// Lo que se puede hacer desde aquí en cada estado (fase 1).
export const AVANZAR: Partial<Record<Estado, { a: Estado; accion: string }>> = {
  borrador: { a: 'en_revision', accion: 'Enviar a revisión' },
  en_revision: { a: 'autorizada', accion: 'Autorizar' },
}
export const editable = (e: Estado) => e === 'borrador' || e === 'en_revision' || e === 'autorizada'

export interface Totales {
  subtotalHonorariosHoras: number; subtotalHonorariosFijos: number; subtotalHonorarios: number; subtotalGastos: number
  descuento: number; ajuste: number; honorariosFinal: number; total: number
}
export interface Prebill {
  id: number; cliente_id: string; cliente_nombre: string; moneda: string; status: Estado
  descuento_tipo: 'monto' | 'porcentaje' | null; descuento_valor: number; ajuste_tipo: 'monto' | 'porcentaje' | null; ajuste_valor: number
  invoice_id: string | null; invoice_number: string | null; creado_en: string; actualizado_en: string
  tipo_cambio: number | null; tipo_cambio_fuente: string | null; idioma: 'es' | 'en' | null; totales: Totales
}
type Row = Record<string, any>
export interface PrebillDetalle extends Prebill {
  responsables?: Record<'facturacion' | 'cobranza', { texto: string; fuente: string | null }>
  tiempos: Row[]; gastos: Row[]; cargos_fijos: Row[]
}
export interface LineaFactura {
  concepto: string; nombre: string; iva: string; description: string; subtotal: number; descuento: number; ajuste?: number; importe: number
  cantidad?: number; precio?: number
}
export interface VistaFactura {
  moneda: string; moneda_cliente_books?: string; tipo_cambio: number | null; idioma: string; idioma_origen?: string; modo_factura: string
  lineas: LineaFactura[]; total_antes_de_impuestos: number; avisos: string[]; bloqueantes: string[]
}
export interface Edicion { editable: boolean; etapa: string; motivo: string; factura: { numero: string; status: string } | null }
export interface Movimiento { id: number; fecha: string; accion: 'agregar' | 'quitar'; tipo: 'tiempo' | 'gasto' | 'cargo_fijo'; registro_id: number; importe: number; moneda: string; origen: string }

// ── Líneas (tiempo, gasto u honorario fijo) en una sola forma ─────────────
export type Kind = 'tiempo' | 'gasto' | 'cargo'
export const KINDS: Kind[] = ['tiempo', 'gasto', 'cargo']
export const KIND_PLURAL: Record<Kind, string> = { tiempo: 'Tiempos', gasto: 'Gastos', cargo: 'Honorarios fijos' }
export const KIND_API: Record<Kind, 'tiempo' | 'gasto' | 'cargo_fijo'> = { tiempo: 'tiempo', gasto: 'gasto', cargo: 'cargo_fijo' }
export interface Linea {
  key: string; kind: Kind; id: number; fecha: string; titulo: string; detalle: string; proyecto: string; monto: number; moneda: string
  horas: number | null; facturable: boolean; prebill_id: number | null; cliente_id: string | null; proyecto_id: number
}
export const toLinea = (kind: Kind, r: Row): Linea => ({
  key: `${kind}-${r.id}`, kind, id: Number(r.id), fecha: String(r.fecha || ''), moneda: r.moneda || 'MXN',
  proyecto: r.proyecto_zoho_nombre || r.proyecto_nombre || '', proyecto_id: Number(r.proyecto_id),
  prebill_id: r.prebill_id ?? null, cliente_id: r.cliente_id == null ? null : String(r.cliente_id),
  ...(kind === 'tiempo'
    ? { titulo: r.tarea || 'Tiempo', detalle: [r.abogado_nombre, r.descripcion].filter(Boolean).join(' · '), horas: Number(r.horas || 0),
        monto: Number(r.importe ?? Number(r.horas || 0) * Number(r.tarifa_aplicada || 0)), facturable: Number(r.facturable) === 1 }
    : kind === 'gasto'
      ? { titulo: r.categoria_nombre || (r.tipo === 'reembolso' ? 'Reembolso' : 'Gasto'), detalle: r.descripcion || '', horas: null, monto: Number(r.monto || 0), facturable: Number(r.facturable) === 1 }
      : { titulo: r.concepto || 'Honorario fijo', detalle: r.periodo ? `Periodo ${r.periodo}` : '', horas: null, monto: Number(r.monto || 0), facturable: true }),
})
export const lineasDe = (d: { tiempos?: Row[]; gastos?: Row[]; cargos_fijos?: Row[] }): Linea[] => [
  ...(d.tiempos || []).map(r => toLinea('tiempo', r)), ...(d.gastos || []).map(r => toLinea('gasto', r)), ...(d.cargos_fijos || []).map(r => toLinea('cargo', r)),
].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.fecha.localeCompare(b.fecha) || a.id - b.id)

// Cuerpo de POST /prebills o de PATCH /lineas a partir de las claves elegidas.
export function idsPorTipo(lineas: Linea[], prefix: '' | 'agregar_' | 'quitar_' = '') {
  const body: Record<string, number[]> = {}
  for (const l of lineas) (body[`${prefix}${KIND_API[l.kind]}_id`] ??= []).push(l.id)
  return body
}

// ¿Qué clientes tienen algo listo para Prebill? Liberado, sin facturar, sin Prebill y facturable;
// agrupado por cliente y moneda. El cliente de gastos y cargos sale del proyecto.
export interface Listo { cliente_id: string; moneda: string; count: number; total: number }
export function listosPorCliente(lineas: Linea[], clientOfProject: (id: number) => string | null): Listo[] {
  const map = new Map<string, Listo>()
  for (const l of lineas) {
    if (l.prebill_id != null || !l.facturable) continue
    const cliente = l.cliente_id ?? clientOfProject(l.proyecto_id)
    if (!cliente) continue
    const key = `${cliente}|${l.moneda}`
    const item = map.get(key) ?? { cliente_id: cliente, moneda: l.moneda, count: 0, total: 0 }
    item.count++; item.total += l.monto
    map.set(key, item)
  }
  return [...map.values()]
}

export const sumByMoneda = (lineas: Linea[]) => lineas.reduce<Record<string, number>>((acc, l) => { acc[l.moneda] = (acc[l.moneda] || 0) + l.monto; return acc }, {})

// ── API ────────────────────────────────────────────────────────────────
type Uncertain = Error & { uncertain?: boolean }
const fail = (message: string, uncertain: boolean) => Object.assign(new Error(message), { uncertain }) as Uncertain
const url = (org: string, path: string) => `${API_BASE}/${encodeURIComponent(org)}/${path}`

async function read<T>(org: string, path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url(org, path), { signal })
  const data = await response.json().catch(() => null)
  if (!response.ok || data === null) throw Object.assign(new Error(data?.error || `No se pudo cargar ${path.split('?')[0]}.`), { status: response.status, stage: data?.stage })
  return data as T
}

// Red caída o respuesta sin id = resultado incierto (como en las capturas).
async function write<T>(org: string, method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown, expectId = true): Promise<T> {
  let response: Response
  try {
    response = await fetch(url(org, path), { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(90000) })
  } catch {
    throw fail('Se perdió la respuesta. Actualiza para comprobar si el cambio se guardó.', true)
  }
  const data = await response.json().catch(() => null)
  if (!response.ok && !data && response.status >= 400 && response.status < 500) {
    throw fail(response.status === 404 ? 'La función de Catalyst no tiene esta ruta (HTTP 404). Despliega la versión actual de prebill_services.' : `El servidor rechazó la petición (HTTP ${response.status}).`, false)
  }
  if (!response.ok) {
    const uncertain = data?.outcome_unknown === true || !data?.stage
    throw fail(`${data?.error || 'No se pudo confirmar el cambio.'}${uncertain ? ' Actualiza para comprobar si se guardó.' : ''}`, uncertain)
  }
  if (expectId && !Number.isInteger(data?.id)) throw fail('No se pudo confirmar el cambio. Actualiza para comprobar si se guardó.', true)
  return data as T
}

export const getPrebills = (org: string, signal?: AbortSignal) => read<Prebill[]>(org, 'prebills', signal)
export const getPrebill = (org: string, id: string, signal?: AbortSignal) => read<PrebillDetalle>(org, `prebills/${encodeURIComponent(id)}`, signal)
export const getDisponible = (org: string, id: string, signal?: AbortSignal) => read<{ tiempos: Row[]; gastos: Row[]; cargos_fijos: Row[] }>(org, `prebills/${encodeURIComponent(id)}/disponible`, signal)
export const getVistaFactura = (org: string, id: string, signal?: AbortSignal) => read<VistaFactura>(org, `prebills/${encodeURIComponent(id)}/vista-factura`, signal)
export const getEdicion = (org: string, id: string, signal?: AbortSignal) => read<Edicion>(org, `prebills/${encodeURIComponent(id)}/edicion`, signal)
export const getMovimientos = (org: string, id: string, signal?: AbortSignal) => read<Movimiento[]>(org, `prebills/${encodeURIComponent(id)}/movimientos`, signal)
export const getLiberadoDisponible = (org: string, clienteId: string, moneda: string, signal?: AbortSignal) =>
  read<{ tiempos: Row[]; gastos: Row[]; cargos_fijos: Row[] }>(org, `liberado-disponible?cliente_id=${encodeURIComponent(clienteId)}&moneda=${encodeURIComponent(moneda)}`, signal)
export async function getListos(org: string, signal?: AbortSignal): Promise<Linea[]> {
  const q = 'liberado=1&facturado=0'
  const [t, g, c] = await Promise.all([read<Row[]>(org, `tiempos?${q}`, signal), read<Row[]>(org, `gastos?${q}`, signal), read<Row[]>(org, `cargos-fijos?${q}`, signal)])
  return [...t.map(r => toLinea('tiempo', r)), ...g.map(r => toLinea('gasto', r)), ...c.map(r => toLinea('cargo', r))]
}

export interface CreadaResult extends Prebill { ids_ignorados?: Record<string, number[]> }
export const crearPrebill = (org: string, body: { cliente_id: string; moneda: string } & Record<string, unknown>) => write<CreadaResult>(org, 'POST', 'prebills', body)
export const cambiarLineas = (org: string, id: number, body: Record<string, number[]>) => write<Prebill & { ids_ignorados?: Record<string, number[]> }>(org, 'PATCH', `prebills/${id}/lineas`, body)
export const setDescuentoAjuste = (org: string, id: number, body: Record<string, unknown>) => write<Prebill>(org, 'PATCH', `prebills/${id}/descuento-ajuste`, body, false)
export const setIdioma = (org: string, id: number, idioma: '' | 'es' | 'en') => write<Prebill>(org, 'PATCH', `prebills/${id}/idioma`, { idioma }, false)
export const setTipoCambio = (org: string, id: number, tipo_cambio: number | null) => write<Prebill>(org, 'PATCH', `prebills/${id}/tipo-cambio`, { tipo_cambio }, false)
export const avanzarEstado = (org: string, id: number, nuevo_estado: Estado) => write<Prebill>(org, 'POST', `prebills/${id}/estado`, { nuevo_estado })
export const eliminarPrebill = (org: string, id: number) => write<unknown>(org, 'DELETE', `prebills/${id}`, undefined, false)

// Suma de ids ignorados por la API (para avisar que algo no entró).
export const contarIgnorados = (ids?: Record<string, number[]>) => Object.values(ids || {}).reduce((s, l) => s + (l?.length || 0), 0)

export const formatMoney = (value: number, moneda = '') => new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + (moneda ? ' ' + moneda : '')
export const formatFecha = (iso: string) => {
  const d = iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Valor de descuento/ajuste del formulario → cuerpo de la API.
export function parseAjuste(tipo: '' | 'monto' | 'porcentaje', valor: string, label: string): { tipo: '' | 'monto' | 'porcentaje'; valor: number | '' } {
  if (tipo === '') return { tipo: '', valor: '' }
  const clean = valor.trim().replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(clean) || Number(clean) <= 0) throw new Error(`El ${label} debe ser mayor que cero, con máximo 2 decimales.`)
  if (tipo === 'porcentaje' && Number(clean) > 100) throw new Error(`El ${label} en porcentaje no puede pasar de 100.`)
  return { tipo, valor: Number(clean) }
}
