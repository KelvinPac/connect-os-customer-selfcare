<script setup>
import { Gauge, TriangleAlert } from 'lucide-vue-next'
import UsageBar from './UsageBar.vue'
import { fmtDate, relative } from '@/utils/format'

// Renders the `fup` block the API attaches to subscriptions whose plan has a data cap.
defineProps({ fup: Object })
</script>

<template>
  <div v-if="fup">
    <div class="mb-3 flex items-center justify-between">
      <span class="flex items-center gap-2 text-sm font-semibold text-ink"><Gauge class="size-4 text-brand" />Data allowance</span>
      <span
        :class="['rounded-full px-2.5 py-1 text-xs font-semibold', fup.throttled ? 'bg-bad-soft text-bad' : fup.percentUsed >= 80 ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok']"
      >{{ fup.throttled ? 'Speed reduced' : fup.percentUsed >= 80 ? 'Running low' : 'On track' }}</span>
    </div>
    <UsageBar :percent="fup.percentUsed" :throttled="fup.throttled" />
    <div class="mt-3 flex items-baseline justify-between gap-3">
      <p class="text-2xl font-bold tracking-tight text-ink">{{ fup.usedGB }} <span class="text-sm font-medium text-ink-2">of {{ fup.capGB }} GB used</span></p>
      <p class="text-sm text-ink-2">{{ fup.remainingGB }} GB left</p>
    </div>
    <p v-if="fup.throttled && fup.throttledSpeed" class="mt-3 flex gap-2 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
      <TriangleAlert class="mt-0.5 size-4 shrink-0" />
      <span>You've used your full allowance, so speed is limited to {{ fup.throttledSpeed.download }}/{{ fup.throttledSpeed.upload }} Mbps until your next renewal.</span>
    </p>
    <div class="mt-3 flex flex-wrap justify-between gap-x-4 border-t border-line pt-3 text-xs text-ink-3">
      <span>Resets {{ fmtDate(fup.resetsAt) }}</span>
      <span v-if="fup.updatedAt">Updated {{ relative(fup.updatedAt) }}</span>
    </div>
  </div>
</template>
