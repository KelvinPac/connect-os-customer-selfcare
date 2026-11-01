<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps({ open: Boolean, title: String, subtitle: String, wide: Boolean, persistent: Boolean })
const emit = defineEmits(['close'])

const onKey = (e) => { if (e.key === 'Escape' && props.open && !props.persistent) emit('close') }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' })
watch(() => props.open, (o) => { document.body.style.overflow = o ? 'hidden' : '' })
</script>

<template>
  <Teleport to="body">
    <Transition name="pop">
      <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" :aria-label="title">
        <div class="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" @click="!persistent && emit('close')" />
        <div :class="['sheet card relative flex max-h-[92dvh] w-full flex-col rounded-b-none sm:rounded-b-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md']">
          <header class="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 class="text-base font-semibold text-ink">{{ title }}</h2>
              <p v-if="subtitle" class="mt-0.5 text-sm text-ink-2">{{ subtitle }}</p>
            </div>
            <button class="btn-ghost btn-sm -mr-2 -mt-1 !p-2" aria-label="Close" @click="emit('close')"><X class="size-4" /></button>
          </header>
          <div class="flex-1 overflow-y-auto px-5 py-5"><slot /></div>
          <footer v-if="$slots.footer" class="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end"><slot name="footer" /></footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
