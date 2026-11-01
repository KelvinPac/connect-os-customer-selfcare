<script setup>
import { computed, onMounted, ref } from 'vue'
import { Eye, EyeOff, RefreshCw, Router, Wifi } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import WifiChangeModal from '@/components/WifiChangeModal.vue'
import { useRoute } from 'vue-router'
import { useOnu } from '@/stores/onu'
import { fmtDateTime, titleCase } from '@/utils/format'

const store = useOnu()
const route = useRoute()
const wifiOpen = ref(false)
const showWifiPass = ref(false)
const onu = computed(() => store.data)
const onuLoading = computed(() => store.loading)
const onuError = computed(() => store.error)
const onuState = computed(() => store.state)
const loadOnu = () => store.load()

// ?wifi=1 (from the dashboard's quick action) opens the Wi-Fi form once the ONU has loaded.
onMounted(async () => { await loadOnu(); if (route.query.wifi && store.data) wifiOpen.value = true })

const TONE_CLS = { ok: 'bg-ok-soft text-ok', bad: 'bg-bad-soft text-bad', warn: 'bg-warn-soft text-warn', muted: 'bg-surface-2 text-ink-2' }
// GPON optical window: above -27 dBm is healthy, -27 to -30 marginal, below that the link is failing.
const dbmTone = (n) => (typeof n !== 'number' ? null : n >= -27 ? 'ok' : n >= -30 ? 'warn' : 'bad')
const dbm = (n) => (typeof n === 'number' ? `${n} dBm` : null)
const signalRows = computed(() => {
  const sg = onu.value?.signal
  if (!sg) return []
  return [
    ['Signal quality', sg.quality, sg.quality ? ({ 'very good': 'ok', good: 'ok', warning: 'warn', critical: 'bad' }[String(sg.quality).toLowerCase()] ?? null) : null],
    ['Receive power (1490 nm)', dbm(sg.rx1490Dbm), dbmTone(sg.rx1490Dbm)],
    ['Upstream power (1310 nm)', dbm(sg.rx1310Dbm), dbmTone(sg.rx1310Dbm)],
    ['Last status change', onu.value.status?.lastChange ? fmtDateTime(onu.value.status.lastChange) : null, null],
  ].filter((r) => r[1])
})
const portSummary = (ports) => (ports?.length ? `${ports.filter((p) => p.adminState === 'Enabled').length} of ${ports.length} enabled` : null)
const onuRows = computed(() => {
  const o = onu.value
  if (!o) return []
  const d = o.device ?? {}
  return [
    ['Model', o.model ?? d.model, false],
    ['Serial number', o.sn, true],
    ['Mode', d.mode, false],
    ['Admin status', d.administrativeStatus, false],
    ['Speed (down / up)', d.downloadSpeed && d.uploadSpeed ? `${d.downloadSpeed} / ${d.uploadSpeed}` : null, false],
    ['LAN ports', portSummary(d.ethernetPorts), false],
    ['Wi-Fi radios', portSummary(d.wifiPorts), false],
  ].filter((r) => r[1])
})
const wifiSsid = computed(() => onu.value?.wifi?.ssid ?? '')
const wifiPassword = computed(() => onu.value?.wifi?.password ?? '')
</script>

<template>
  <PageHeader title="Router &amp; Wi-Fi" subtitle="Your ONU's live status and your Wi-Fi details." />

  <div v-if="onuLoading && !onu" class="skeleton h-64" />
  <ErrorState v-else-if="onuError" :message="onuError" @retry="loadOnu" />
  <EmptyState v-else-if="!onu" class="card" :icon="Router" title="No router found" text="We couldn't find an ONU linked to your account yet. Contact support if you think this is a mistake." />
  <div v-else class="space-y-10">
    <section v-if="onu || onuLoading">
      <div class="card divide-y divide-line">
        <div v-if="onuRows.length || onuState" class="p-5">
          <div class="mb-4 flex flex-wrap items-center gap-4">
            <div class="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Router class="size-5" /></div>
            <p class="flex-1 text-sm font-semibold">ONU details</p>
            <span v-if="onuState" :class="['inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', TONE_CLS[onuState.tone]]"><span class="size-1.5 rounded-full bg-current" />{{ onuState.label }}</span>
            <button class="btn-ghost btn-sm !p-2" aria-label="Refresh ONU status" :disabled="onuLoading" @click="loadOnu"><RefreshCw :class="['size-4', onuLoading && 'animate-spin']" /></button>
          </div>
          <p v-if="onuState?.hint" :class="['mb-4 rounded-xl px-3 py-2 text-sm', TONE_CLS[onuState.tone]]">{{ onuState.hint }}</p>
          <dl v-if="signalRows.length" class="mb-4 grid grid-cols-2 gap-4 rounded-2xl bg-surface-2 p-4 text-sm sm:grid-cols-3">
            <div v-for="[k, v, tone] in signalRows" :key="k"><dt class="label !mb-1">{{ k }}</dt><dd :class="['font-semibold', tone === 'ok' && 'text-ok', tone === 'warn' && 'text-warn', tone === 'bad' && 'text-bad']">{{ v }}</dd></div>
          </dl>
          <dl class="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div v-for="[k, v, mono] in onuRows" :key="k"><dt class="label !mb-1">{{ k }}</dt><dd :class="['font-semibold', mono && 'font-mono']">{{ v }}</dd></div>
          </dl>
        </div>
        <div v-if="onuLoading" class="p-5"><div class="skeleton h-16" /></div>
        <p v-else-if="onuError" class="p-5 text-sm text-bad">{{ onuError }}</p>
        <div v-else class="flex flex-wrap items-center justify-between gap-4 p-5">
          <div class="flex min-w-0 items-center gap-4">
            <div class="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Wifi class="size-5" /></div>
            <div class="min-w-0">
              <p class="text-sm font-semibold">Wi-Fi</p>
              <p class="truncate text-xs text-ink-3">{{ wifiSsid ? `Network name: ${wifiSsid}` : 'Change your Wi-Fi name or password.' }}</p>
              <p v-if="wifiPassword" class="flex items-center gap-1 text-xs text-ink-3">Password: <code class="font-mono">{{ showWifiPass ? wifiPassword : '••••••••' }}</code>
                <button class="p-0.5" :aria-label="showWifiPass ? 'Hide Wi-Fi password' : 'Show Wi-Fi password'" @click="showWifiPass = !showWifiPass"><component :is="showWifiPass ? EyeOff : Eye" class="size-3.5" /></button></p>
            </div>
          </div>
          <button class="btn-secondary btn-sm" @click="wifiOpen = true">Change Wi-Fi details</button>
        </div>
      </div>
    </section>
  </div>

  <WifiChangeModal :open="wifiOpen" :current-ssid="wifiSsid" @close="wifiOpen = false" @saved="loadOnu" />
</template>
