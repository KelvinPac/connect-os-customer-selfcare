<script setup>
import { computed } from 'vue'
// Data-cap meter. Marker at 80% matches the API's "80% used" notification threshold.
const props = defineProps({ percent: { type: Number, default: 0 }, throttled: Boolean })
const tone = computed(() => (props.throttled || props.percent >= 100 ? 'bad' : props.percent >= 80 ? 'warn' : 'ok'))
const fill = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' }
</script>

<template>
  <div class="relative h-2.5 rounded-full bg-surface-2" role="progressbar" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100">
    <div :class="['h-full rounded-full transition-all duration-700', fill[tone]]" :style="{ width: `${Math.max(percent, percent > 0 ? 2 : 0)}%` }" />
    <span class="absolute -bottom-0.5 -top-0.5 left-[80%] w-px bg-ink-3/50" />
  </div>
</template>
