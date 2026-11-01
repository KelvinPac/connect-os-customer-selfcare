<script setup>
defineProps({ icon: Object, title: String, text: String })
</script>

<template>
  <div class="flex flex-col items-center px-6 py-12 text-center">
    <div v-if="icon" class="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand"><component :is="icon" class="size-6" /></div>
    <h3 class="text-sm font-semibold text-ink">{{ title }}</h3>
    <p v-if="text" class="mt-1 max-w-sm text-sm text-ink-2">{{ text }}</p>
    <div class="mt-4"><slot /></div>
  </div>
</template>
