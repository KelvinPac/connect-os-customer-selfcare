<script setup>
import { AlertTriangle } from 'lucide-vue-next'
defineProps({ message: String })
defineEmits(['retry'])
</script>

<template>
  <div class="card flex flex-col items-center gap-3 px-6 py-10 text-center">
    <div class="grid size-12 place-items-center rounded-2xl bg-bad-soft text-bad"><AlertTriangle class="size-6" /></div>
    <p class="text-sm font-semibold text-ink">Something went wrong</p>
    <p class="max-w-md text-sm text-ink-2">{{ message }}</p>
    <button class="btn-secondary btn-sm" @click="$emit('retry')">Try again</button>
  </div>
</template>
