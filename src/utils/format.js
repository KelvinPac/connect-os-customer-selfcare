// The API renders every Date as "DD-MM-YYYY HH:mm:ss" in the company timezone (ISO strings
// can still appear in older payloads). Parse both; treat the wall-clock as local for display.

const DMY = /^(\d{2})-(\d{2})-(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/

export function parseDate(v) {
  if (!v) return null
  if (v instanceof Date) return v
  const m = DMY.exec(String(v))
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0))
  const d = new Date(v)
  return isNaN(d) ? null : d
}

const dateFmt = new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false })

export const fmtDate = (v) => { const d = parseDate(v); return d ? dateFmt.format(d) : '—' }
export const fmtDateTime = (v) => { const d = parseDate(v); return d ? `${dateFmt.format(d)} · ${timeFmt.format(d)}` : '—' }

export function relative(v) {
  const d = parseDate(v)
  if (!d) return '—'
  const diff = (d.getTime() - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const steps = [['day', 86400], ['hour', 3600], ['minute', 60]]
  for (const [unit, secs] of steps) if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit)
  return 'just now'
}

export function daysUntil(v) {
  const d = parseDate(v)
  if (!d) return null
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
}

/** Money arrives as decimal strings ("1500.00"). */
export function money(v, currency = 'KES') {
  const n = Number(v)
  if (!isFinite(n)) return '—'
  return `${currency} ${n.toLocaleString('en-KE', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
}

export function bytes(n) {
  n = Number(n) || 0
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${u[i]}`
}

/** Octets are split across a 32-bit counter and a gigawords counter. */
export const octets = (lo, giga) => (Number(lo) || 0) + (Number(giga) || 0) * 4294967296

export function duration(secs) {
  secs = Number(secs) || 0
  const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), m = Math.floor((secs % 3600) / 60)
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  return `${m}m`
}

export const titleCase = (s) => String(s || '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const METHODS = { MPESA: 'M-Pesa', CASH: 'Cash', BANK_TRANSFER: 'Bank transfer', STRIPE: 'Card', CARD: 'Card', OTHER: 'Other' }
export const methodLabel = (m) => METHODS[m] ?? titleCase(m)

const PLAN_TYPES = { PPPOE: 'PPPoE', HOTSPOT: 'Hotspot', STATIC: 'Static IP', DHCP: 'DHCP' }
export const planTypeLabel = (t) => PLAN_TYPES[t] ?? titleCase(t)

/** Safaricom wants 2547XXXXXXXX. Accepts 07…, 01…, +254…, 254…, 7… */
export function normalizeKePhone(input) {
  const d = String(input || '').replace(/[^\d]/g, '')
  if (/^254[17]\d{8}$/.test(d)) return d
  if (/^0[17]\d{8}$/.test(d)) return `254${d.slice(1)}`
  if (/^[17]\d{8}$/.test(d)) return `254${d}`
  return null
}

export const CYCLE_LABEL = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', QUARTERLY: 'quarter', ANNUALLY: 'year', CUSTOM: 'cycle' }
