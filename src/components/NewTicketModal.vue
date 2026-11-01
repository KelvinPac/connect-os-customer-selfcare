<script setup>
import { computed, ref, watch } from 'vue'
import Modal from './Modal.vue'
import Field from './Field.vue'
import Spinner from './Spinner.vue'
import { ticketApi } from '@/api'
import { useUi } from '@/stores/ui'

// All four of type / priority / category / source are compulsory on POST /tickets.
// `type` is derived from the category; `source` is always PORTAL; customerId is forced server-side.
const CATEGORIES = [
  { v: 'CONNECTIVITY', label: 'No / unstable connection', type: 'SUPPORT' },
  { v: 'SPEED', label: 'Slow speeds', type: 'SUPPORT' },
  { v: 'OUTAGE', label: 'Outage in my area', type: 'SUPPORT' },
  { v: 'ROUTER_CONFIGURATION', label: 'Router / Wi-Fi settings', type: 'SUPPORT' },
  { v: 'HARDWARE', label: 'Faulty equipment', type: 'SUPPORT' },
  { v: 'EQUIPMENT_SWAP', label: 'Replace my equipment', type: 'SUPPORT' },
  { v: 'BILLING', label: 'Billing or payment', type: 'SUPPORT' },
  { v: 'ACCOUNT', label: 'My account', type: 'SUPPORT' },
  { v: 'UPGRADE_DOWNGRADE', label: 'Change my plan', type: 'SALES' },
  { v: 'RELOCATION', label: 'Moving house', type: 'INSTALLATION' },
  { v: 'INSTALLATION', label: 'New installation', type: 'INSTALLATION' },
  { v: 'COMPLAINT', label: 'Complaint', type: 'SUPPORT' },
  { v: 'GENERAL_INQUIRY', label: 'General question', type: 'SUPPORT' },
]
const PRIORITIES = [
  { v: 'LOW', label: 'Low — not urgent' },
  { v: 'MEDIUM', label: 'Medium' },
  { v: 'HIGH', label: 'High — affecting me now' },
]

const props = defineProps({ open: Boolean, preset: Object })
const emit = defineEmits(['close', 'created'])
const ui = useUi()

const form = ref({ title: '', description: '', category: 'CONNECTIVITY', priority: 'MEDIUM' })
const errors = ref({})
const busy = ref(false)
const category = computed(() => CATEGORIES.find((c) => c.v === form.value.category))

watch(() => props.open, (o) => {
  if (!o) return
  errors.value = {}
  form.value = { title: '', description: '', category: 'CONNECTIVITY', priority: 'MEDIUM', ...(props.preset ?? {}) }
})

async function submit() {
  const e = {}
  if (!form.value.title.trim()) e.title = 'Give your request a short title.'
  if (!form.value.description.trim()) e.description = 'Tell us a bit about what is happening.'
  errors.value = e
  if (Object.keys(e).length) return
  busy.value = true
  try {
    const t = await ticketApi.create({
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      category: form.value.category,
      priority: form.value.priority,
      type: category.value.type,
      source: 'PORTAL',
    })
    ui.success(`Request ${t.ticketNumber} created. We'll be in touch.`)
    emit('created', t)
    emit('close')
  } catch (err) {
    errors.value = err.fieldErrors ?? {}
    ui.error(err.message)
  } finally { busy.value = false }
}
</script>

<template>
  <Modal :open="open" title="New support request" subtitle="Tell us what's going on and we'll get back to you." @close="emit('close')">
    <form class="space-y-4" @submit.prevent="submit">
      <Field label="What's it about?" for="nt-cat" :error="errors.category">
        <select id="nt-cat" v-model="form.category" class="input">
          <option v-for="c in CATEGORIES" :key="c.v" :value="c.v">{{ c.label }}</option>
        </select>
      </Field>
      <Field label="Title" for="nt-title" :error="errors.title">
        <input id="nt-title" v-model="form.title" class="input" maxlength="200" placeholder="e.g. Internet drops every evening" />
      </Field>
      <Field label="Details" for="nt-desc" :error="errors.description">
        <textarea id="nt-desc" v-model="form.description" class="input min-h-28 resize-y" placeholder="When did it start? What have you tried?" />
      </Field>
      <Field label="Priority" for="nt-pri" :error="errors.priority">
        <select id="nt-pri" v-model="form.priority" class="input"><option v-for="p in PRIORITIES" :key="p.v" :value="p.v">{{ p.label }}</option></select>
      </Field>
    </form>
    <template #footer>
      <button class="btn-secondary" @click="emit('close')">Cancel</button>
      <button class="btn-primary" :disabled="busy" @click="submit"><Spinner v-if="busy" />Submit request</button>
    </template>
  </Modal>
</template>
