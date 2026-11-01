<script setup>
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
defineProps({ meta: Object })
defineEmits(['page'])
</script>

<template>
  <div v-if="meta && meta.totalPages > 1" class="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-ink-2">
    <span>Page {{ meta.page }} of {{ meta.totalPages }} · {{ meta.total }} total</span>
    <div class="flex gap-2">
      <button class="btn-secondary btn-sm" :disabled="!meta.hasPrev" @click="$emit('page', meta.page - 1)"><ChevronLeft class="size-4" />Prev</button>
      <button class="btn-secondary btn-sm" :disabled="!meta.hasNext" @click="$emit('page', meta.page + 1)">Next<ChevronRight class="size-4" /></button>
    </div>
  </div>
</template>
