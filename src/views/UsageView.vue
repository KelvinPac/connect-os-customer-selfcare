<script setup>
import { computed, onMounted, ref } from 'vue'
import { ArrowDownToLine, ArrowUpFromLine, Clock, Radio, Router } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import FupCard from '@/components/FupCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import { customerApi } from '@/api'
import { useAuth } from '@/stores/auth'
import { useAccount } from '@/stores/account'
import { bytes, duration, fmtDateTime, octets, parseDate, titleCase } from '@/utils/format'

const auth = useAuth()
const account = useAccount()
const sessions = ref([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try { sessions.value = await customerApi.usage(auth.customerId) } catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(() => { load(); account.load() })

// RADIUS accounting is from the NAS's point of view: "input" is what the router received from
// the customer (their upload); "output" is what it sent to them (their download).
const rows = computed(() => sessions.value.map((s) => ({
  ...s,
  down: octets(s.outputOctets, s.outputGigawords),
  up: octets(s.inputOctets, s.inputGigawords),
})))
const totals = computed(() => ({ down: rows.value.reduce((a, r) => a + r.down, 0), up: rows.value.reduce((a, r) => a + r.up, 0) }))
const online = computed(() => rows.value.find((r) => r.status === 'ACTIVE'))
const sub = computed(() => account.subscriptions.find((s) => s.fup) ?? null)

// Download per day, last 14 days that have data.
const daily = computed(() => {
  const map = new Map()
  for (const r of rows.value) {
    const d = parseDate(r.startTime)
    if (!d) continue
    const key = d.toISOString().slice(0, 10)
    map.set(key, (map.get(key) ?? 0) + r.down)
  }
  const list = [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14)
  const max = Math.max(...list.map(([, v]) => v), 1)
  return list.map(([k, v]) => ({ key: k, label: new Date(k).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }), value: v, pct: Math.max((v / max) * 100, 3) }))
})
const sessionDuration = (r) => (r.status === 'ACTIVE' ? duration((Date.now() - (parseDate(r.startTime)?.getTime() ?? Date.now())) / 1000) : duration(r.sessionDuration))
</script>

<template>
  <PageHeader title="Usage" subtitle="Your recent connections and how much data they used." />

  <ErrorState v-if="error" :message="error" @retry="load" />
  <div v-else-if="loading" class="grid gap-4 sm:grid-cols-3"><div v-for="i in 3" :key="i" class="skeleton h-28" /></div>

  <div v-else class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="card p-5">
        <p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-3"><Radio class="size-4" />Status</p>
        <p class="mt-3 flex items-center gap-2 text-2xl font-bold"><span :class="['size-2.5 rounded-full', online ? 'animate-pulse bg-ok' : 'bg-ink-3']" />{{ online ? 'Online' : 'Offline' }}</p>
        <p class="mt-1 text-sm text-ink-2">{{ online ? `Connected for ${sessionDuration(online)}${online.framedIpAddress ? ` · ${online.framedIpAddress}` : ''}` : 'No active session' }}</p>
      </div>
      <div class="card p-5">
        <p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-3"><ArrowDownToLine class="size-4" />Downloaded</p>
        <p class="mt-3 text-2xl font-bold tabular-nums">{{ bytes(totals.down) }}</p>
        <p class="mt-1 text-sm text-ink-2">across last {{ rows.length }} sessions</p>
      </div>
      <div class="card p-5">
        <p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-3"><ArrowUpFromLine class="size-4" />Uploaded</p>
        <p class="mt-3 text-2xl font-bold tabular-nums">{{ bytes(totals.up) }}</p>
        <p class="mt-1 text-sm text-ink-2">across last {{ rows.length }} sessions</p>
      </div>
    </div>

    <section v-if="sub?.fup" class="card p-5"><FupCard :fup="sub.fup" /></section>

    <section v-if="daily.length > 1" class="card p-5">
      <h2 class="font-semibold">Downloads by day</h2>
      <div class="mt-5 flex h-40 items-end gap-1.5 sm:gap-2" role="img" :aria-label="`Daily download volume for ${daily.length} days`">
        <div v-for="d in daily" :key="d.key" class="group relative flex h-full flex-1 flex-col justify-end">
          <div class="rounded-t-lg bg-gradient-to-t from-brand to-brand-2 opacity-80 transition group-hover:opacity-100" :style="{ height: d.pct + '%' }" />
          <div class="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs font-medium text-bg group-hover:block">{{ bytes(d.value) }}</div>
        </div>
      </div>
      <div class="mt-2 flex gap-1.5 sm:gap-2"><span v-for="d in daily" :key="d.key" class="flex-1 truncate text-center text-[10px] text-ink-3">{{ d.label }}</span></div>
    </section>

    <section class="card overflow-hidden">
      <header class="border-b border-line px-5 py-4"><h2 class="font-semibold">Connection history</h2></header>
      <EmptyState v-if="!rows.length" :icon="Router" title="No sessions yet" text="Once your router connects, your sessions are listed here." />
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[680px]">
          <thead class="border-b border-line bg-surface-2/60"><tr><th class="th">Started</th><th class="th"><Clock class="inline size-3.5" /> Duration</th><th class="th">IP address</th><th class="th text-right">Down</th><th class="th text-right">Up</th><th class="th">Ended</th></tr></thead>
          <tbody class="divide-y divide-line">
            <tr v-for="r in rows" :key="r.id">
              <td class="td">{{ fmtDateTime(r.startTime) }}</td>
              <td class="td text-ink-2">{{ sessionDuration(r) }}</td>
              <td class="td font-mono text-xs text-ink-2">{{ r.framedIpAddress || '—' }}</td>
              <td class="td text-right tabular-nums">{{ bytes(r.down) }}</td>
              <td class="td text-right tabular-nums">{{ bytes(r.up) }}</td>
              <td class="td"><span v-if="r.status === 'ACTIVE'" class="rounded-full bg-ok-soft px-2.5 py-1 text-xs font-semibold text-ok">Connected</span><span v-else class="text-ink-2">{{ r.terminateCause ? titleCase(r.terminateCause) : 'Disconnected' }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
