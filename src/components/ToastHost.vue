<script setup>
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-vue-next'
import { useUi } from '@/stores/ui'
const ui = useUi()
const icon = { success: CheckCircle2, error: AlertCircle, info: Info }
const tone = { success: 'text-ok', error: 'text-bad', info: 'text-info' }
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
    <TransitionGroup name="fade">
      <div
        v-for="t in ui.toasts" :key="t.id"
        class="card pointer-events-auto flex w-full max-w-sm items-start gap-3 px-4 py-3"
        role="status"
      >
        <component :is="icon[t.type]" :class="['mt-0.5 size-5 shrink-0', tone[t.type]]" />
        <p class="flex-1 text-sm text-ink">{{ t.message }}</p>
        <button class="text-ink-3 hover:text-ink" aria-label="Dismiss" @click="ui.dismiss(t.id)"><X class="size-4" /></button>
      </div>
    </TransitionGroup>
  </div>
</template>
