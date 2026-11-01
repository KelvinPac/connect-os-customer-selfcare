<script setup>
// Slowly rotating dotted globe with glowing fiber arcs and light pulses travelling between cities.
import { onMounted, onBeforeUnmount, ref } from 'vue'

const props = defineProps({ compact: Boolean })
const canvas = ref(null)
let raf = 0
let ro = null

// [lat, lon] — Nairobi first (the hub); the rest are well-known landing/peering points.
const cities = [[-1.29, 36.82], [30.04, 31.24], [-33.92, 18.42], [6.52, 3.38], [25.2, 55.27], [51.5, -0.12], [19.08, 72.88], [1.35, 103.82], [-23.55, -46.63], [40.71, -74.0], [-4.04, 39.67], [0.35, 32.58]]
const links = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11], [4, 6], [5, 9], [1, 5], [7, 6]]

// 180x90 (2°) land mask, row-major from 90°N / 180°W, 1 bit per cell (Natural Earth 110m).
const LAND = Uint8Array.from(atob('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAfAP8DAAAAAAAAAAAAAAAAAAAAAADo//z//wcAAAAAAAACAAAAAAAAAAAAhvvw//8PAPABAAAAwAMAAAAAAAAAwADkw////wEABAAAAABgAAAAAAAAAADAUT8A/v8PAAAAAAwA/j8AuAEAAAAAcBHtDcD/fwAAAAAwAPz/fwMAABCAAQD5w/wD8P8FAAAMAIL7DwCAAOx/AH8ggLFFDv8A4P//B/D/SAAAAAAAQIAPAAAAAODBB+D//x8AKAAEAAAAAAAAcwAAAABAB/7Af/j/YCgAAAAAAAAAAADw/////wEs4AEAAHz+////////////gL////8HeAAcAADg5///////////9ADgAf7/f4AnAAAAAH78////////H0QAAAiA//8f8AcAAIBB4////////38ADwAQAOD//5//AQAAHAT/////////A3AAAAAA/v//+T8AAGDz//////////8DAQAAAMD/////AwAAsP//////////LwAAAAAA6P///2IAAAD+//////////8CAAAAAAD///8/CAAA4P//////////JwAAAAAA8P///wYAAAD+/unz/////z8AAAAAAAD///8HAAAA/pgPPP//////MQAAAAAA8P//PwAAAMBD9v7n/////wcBAAAAAAD///8AAAAAPkD7f/7///8hEAAAAAAA4P//DwAAAIDhAv/n////f8YAAAAAAAD8//8AAAAA+AdE//////8jDwAAAAAAgP//AwAAAMD/APD/////PxgAAAAAAADw/x8AAAAA/n/v//////8HAAAAAAAAAPwDAgAAAOD////7////fwAAAAAAAACgHyAAAACA//9/f/7///8DAAAAAAAAAPQBAAAAAPj//+cv+P//PwAAAAAAAAAAHjAAAADA/////g/+//8EAAAAAAAAAOBhCAAAAP7//99/4D//AAAAAAAAAAAAPAMEAADA////+Qf84BcAAAAAAAAAAAA/AAAAAPz//58fgAf+QAAAAAAAAAAAAA8AAADg////ewA4gA8EAAAAAAAAAADAAAAAAPz//38BgAP4QQAAAAAAAAAAAAgPAADA////zwAwgAwQAAAAAAAAAAAA9Q8AAPj///8HAAVIAAAAAAAAAAAAAID/AQAA////fwBAAAAQAAAAAAAAAAAA+P8AAGDh//8DAAA0GAAAAAAAAAAAAID/HwAAAPj/HwAAgMIBAAAAAAAAAAAA/P8BAACA//8AAAAYXgAAAAAAAAAAAMD/fwAAAPz/BwAAAOOBAQAAAAAAAAAA/P8/AACA/z8AAABgbtQBAAAAAAAAAOD//w8AAPD/AwAAAAQIeAAAAAAAAAAA/P//AQAA/z8AAACAA4APAQAAAAAAAID//w8AAPD/AwAAAAARsEAAAAAAAAAA+P9/AAAA/j8AAAAAAAAAAAAAAAAAAAD//wcAAPD/QwAAAACAIwAAAAAAAAAA8P9/AAAA/z8EAAAAAD8GIAAAAAAAAAD8/wMAAPD/cQAAAAD4ZwAAAAAAAAAAgP8/AAAA/w8HAAAAgP8HAAAAAAAAAAD4/wMAAOD/MAAAAAD//wEBAAAAAAAAgP8PAAAA/g8DAAAA+P8fAAAAAAAAAAD4PwAAAOB/EAAAAID//wMAAAAAAAAAgP8DAAAA/AMAAAAA+P9/AAAAAAAAAAD8HwAAAMA/AAAAAID//wcAAAAAAAAAwP8BAAAA+AEAAAAA8P9/AAAAAAAAAAD8DwAAAIAPAAAAAAAP/gMAAAAAAAAAwB8AAAAAAAAAAAAAEIAfAAEAAAAAAAD+AwAAAAAAAAAAAAAA8AEgAAAAAAAA4AcAAAAAAAAAAAAAAAAAAAYAAAAAAABeAAAAAAAAAAAAAAAAwAAwAAAAAAAAwAMAAAAAAAAAAAAAAAAIgAEAAAAAAAAeAAAAAAAAAAAAAAAAAAAMAAAAAAAA4AEAAAAAAAAAAAAAAAAAAAAAAAAAAAAPAAAAAAAAAAABAAAAAAAAAAAAAAAAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAB4AEDwn/8HAAAAAAAAAAAwAAAAAACA/P/h/////w8AAAAAAAAAwAcAAAD4////z///////PwAAAAAAHALwAACA//////////////8HAADw/y///wMAAP7/////////////HwAA+P///38AAID///////////////8AAPL/////BwAO////////////////DwAA8P////8HEPD//////////////z8AAOD/////////////////////////HwDgPwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='), (c) => c.charCodeAt(0))
const isLand = (v) => {
  const lat = (Math.asin(v[1]) * 180) / Math.PI
  const lon = (Math.atan2(v[0], v[2]) * 180) / Math.PI
  const k = Math.min(89, Math.floor((90 - lat) / 2)) * 180 + Math.min(179, Math.floor((lon + 180) / 2))
  return (LAND[k >> 3] >> (k & 7)) & 1
}

const rad = (d) => (d * Math.PI) / 180
const toVec = (lat, lon) => [Math.cos(rad(lat)) * Math.sin(rad(lon)), Math.sin(rad(lat)), Math.cos(rad(lat)) * Math.cos(rad(lon))]
const slerp = (a, b, t) => {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
  const w = Math.acos(dot)
  if (w < 1e-4) return a
  const s = Math.sin(w)
  const k1 = Math.sin((1 - t) * w) / s
  const k2 = Math.sin(t * w) / s
  return [k1 * a[0] + k2 * b[0], k1 * a[1] + k2 * b[1], k1 * a[2] + k2 * b[2]]
}

onMounted(() => {
  const el = canvas.value
  const ctx = el.getContext('2d')
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const nodes = cities.map(([la, lo]) => toVec(la, lo))
  // Fibonacci sphere of dots.
  const dots = Array.from({ length: props.compact ? 1300 : 2600 }, (_, i) => {
    const y = 1 - (i / ((props.compact ? 1300 : 2600) - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const th = i * 2.399963
    const v = [Math.cos(th) * r, y, Math.sin(th) * r]
    v.land = isLand(v)
    return v
  })
  const pulses = links.map((l, i) => ({ l, t: (i * 0.37) % 1, speed: 0.0022 + (i % 4) * 0.0007 }))
  let w = 0, h = 0, R = 0, cx = 0, cy = 0
  let rot = 0.45 // longitude facing the viewer (~26°E): Africa
  const tilt = 0.32

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = el.clientWidth; h = el.clientHeight
    el.width = w * dpr; el.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (props.compact) { R = Math.max(h * 0.95, 90); cx = w * 0.82; cy = h * 1.05 }
    else { R = Math.min(w * 0.4, h * 0.36); cx = w * 0.66; cy = h * 0.9 }
  }
  ro = new ResizeObserver(resize)
  ro.observe(el)
  resize()

  // Rotate around Y by `rot`, then tilt around X; returns [x, y, z] (z>0 faces the viewer).
  const project = (v) => {
    const cr = Math.cos(rot), sr = Math.sin(rot)
    const x1 = v[0] * cr - v[2] * sr
    const z1 = v[0] * sr + v[2] * cr
    const ct = Math.cos(tilt), st = Math.sin(tilt)
    const y2 = v[1] * ct - z1 * st
    const z2 = v[1] * st + z1 * ct
    return [cx + x1 * R, cy - y2 * R, z2]
  }

  function frame() {
    // Skip drawing while hidden (breakpoint swap or background tab).
    if (!w || document.hidden) { raf = requestAnimationFrame(frame); return }
    ctx.clearRect(0, 0, w, h)
    // Atmosphere glow
    const g = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.25)
    g.addColorStop(0, 'rgba(167,139,250,0.22)'); g.addColorStop(1, 'rgba(167,139,250,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.25, 0, 6.2832); ctx.fill()

    const body = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R)
    body.addColorStop(0, 'rgba(76,29,149,0.55)'); body.addColorStop(1, 'rgba(30,27,75,0.75)')
    ctx.fillStyle = body
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill()

    for (const d of dots) {
      const [x, y, z] = project(d)
      if (z < 0) continue
      if (d.land) { ctx.fillStyle = `rgba(245,232,255,${0.35 + z * 0.65})`; ctx.fillRect(x, y, 2.4, 2.4) }
      else { ctx.fillStyle = `rgba(167,139,250,${0.05 + z * 0.14})`; ctx.fillRect(x, y, 1.4, 1.4) }
    }

    // Fiber arcs (lifted off the surface) with a travelling light pulse.
    for (const p of pulses) {
      const a = nodes[p.l[0]], b = nodes[p.l[1]]
      const pts = []
      for (let i = 0; i <= 28; i++) {
        const t = i / 28
        const v = slerp(a, b, t)
        const lift = 1 + 0.16 * Math.sin(Math.PI * t)
        pts.push(project([v[0] * lift, v[1] * lift, v[2] * lift]))
      }
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(221,214,254,0.5)'
      ctx.beginPath()
      let pen = false
      for (const q of pts) {
        if (q[2] < 0) { pen = false; continue }
        pen ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])
        pen = true
      }
      ctx.stroke()
      p.t = (p.t + p.speed * (reduce ? 0 : 1)) % 1
      const idx = Math.floor(p.t * 28)
      const q = pts[idx]
      if (q && q[2] > 0) {
        const glow = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], 9)
        glow.addColorStop(0, 'rgba(255,255,255,0.95)'); glow.addColorStop(0.3, 'rgba(244,114,182,0.6)'); glow.addColorStop(1, 'rgba(244,114,182,0)')
        ctx.fillStyle = glow
        ctx.beginPath(); ctx.arc(q[0], q[1], 9, 0, 6.2832); ctx.fill()
      }
    }

    // City nodes with a breathing ring; Nairobi (hub) is larger.
    const now = performance.now() / 1000
    nodes.forEach((n, i) => {
      const [x, y, z] = project(n)
      if (z < 0) return
      const hub = i === 0
      ctx.fillStyle = hub ? '#fff' : 'rgba(255,255,255,0.9)'
      ctx.beginPath(); ctx.arc(x, y, hub ? 3.5 : 2.2, 0, 6.2832); ctx.fill()
      const ph = (now * 0.6 + i * 0.3) % 1
      ctx.strokeStyle = `rgba(244,114,182,${(1 - ph) * 0.7})`
      ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.arc(x, y, (hub ? 5 : 3) + ph * (hub ? 16 : 10), 0, 6.2832); ctx.stroke()
    })

    if (!reduce) rot += 0.0018
    raf = requestAnimationFrame(frame)
  }
  frame()
  if (reduce) { cancelAnimationFrame(raf) }
})

onBeforeUnmount(() => { cancelAnimationFrame(raf); ro?.disconnect() })
</script>

<template>
  <div class="pointer-events-none absolute inset-0" aria-hidden="true">
    <!-- Flowing fiber strands -->
    <svg class="absolute inset-0 size-full" preserveAspectRatio="none" viewBox="0 0 800 800">
      <defs>
        <linearGradient id="fiber" x1="0" x2="1">
          <stop offset="0" stop-color="#f0abfc" stop-opacity="0" />
          <stop offset="0.5" stop-color="#e9d5ff" stop-opacity="0.9" />
          <stop offset="1" stop-color="#818cf8" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path v-for="(d, i) in ['M-50 640 C 200 520, 420 760, 850 560', 'M-50 700 C 260 600, 480 820, 850 660', 'M-50 580 C 180 470, 380 700, 850 470']" :key="i" :d="d" fill="none" stroke="url(#fiber)" stroke-width="1.2" stroke-dasharray="90 710" class="fiber-flow" :style="{ animationDelay: `${i * -3}s`, animationDuration: `${9 + i * 2}s` }" />
    </svg>
    <canvas ref="canvas" class="absolute inset-0 size-full" />
  </div>
</template>

<style scoped>
.fiber-flow { animation: fiber-run linear infinite; }
@keyframes fiber-run { from { stroke-dashoffset: 800; } to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .fiber-flow { animation: none; } }
</style>
