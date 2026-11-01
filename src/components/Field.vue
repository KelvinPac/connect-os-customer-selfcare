<script setup>
defineProps({ label: String, error: String, hint: String, for: String })
</script>

<template>
  <div>
    <label v-if="label" class="label" :for="$props.for">{{ label }}</label>
    <slot />
    <p v-if="error" class="mt-1.5 text-xs font-medium text-bad">{{ error }}</p>
    <p v-else-if="hint" class="mt-1.5 text-xs text-ink-3">{{ hint }}</p>
  </div>
</template>
