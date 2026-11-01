<script setup>
import { ref, watch } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import Modal from './Modal.vue'
import Field from './Field.vue'
import Spinner from './Spinner.vue'
import { onuApi } from '@/api'
import { useUi } from '@/stores/ui'

// PUT /onus/me/wifi — applied live through SmartOLT; limited to 5 changes per minute.
const props = defineProps({ open: Boolean, currentSsid: String })
const emit = defineEmits(['close', 'saved'])
const ui = useUi()

const form = ref({ ssid: '', password: '' })
const errors = ref({})
const busy = ref(false)
const show = ref(false)

watch(() => props.open, (o) => {
  if (!o) return
  errors.value = {}
  show.value = false
  form.value = { ssid: '', password: '' }
})

async function submit() {
  const e = {}
  const ssid = form.value.ssid.trim()
  const password = form.value.password
  if (!ssid && !password) e.ssid = 'Enter a new Wi-Fi name, a new password, or both.'
  if (ssid && !/^[A-Za-z0-9 _.\-@#]{1,32}$/.test(ssid)) e.ssid = 'Up to 32 characters: letters, numbers, spaces and _ . - @ #'
  if (password && !/^[A-Za-z0-9_.\-@#!]{8,63}$/.test(password)) e.password = '8–63 characters: letters, numbers and _ . - @ # !'
  errors.value = e
  if (Object.keys(e).length) return
  busy.value = true
  try {
    await onuApi.changeWifi({ ...(ssid ? { ssid } : {}), ...(password ? { password } : {}) })
    ui.success('Wi-Fi updated. Reconnect your devices with the new details.')
    emit('saved')
    emit('close')
  } catch (err) {
    errors.value = err.fieldErrors ?? {}
    ui.error(err.message)
  } finally { busy.value = false }
}
</script>

<template>
  <Modal :open="open" title="Change Wi-Fi details" subtitle="Applied straight to your router. Devices will need to reconnect." @close="emit('close')">
    <form class="space-y-4" @submit.prevent="submit">
      <Field v-if="currentSsid" label="Current Wi-Fi name"><code class="block rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm">{{ currentSsid }}</code></Field>
      <Field label="New Wi-Fi name (SSID)" for="wf-ssid" :error="errors.ssid" hint="Leave blank to keep the current name.">
        <input id="wf-ssid" v-model="form.ssid" class="input" maxlength="32" autocomplete="off" />
      </Field>
      <Field label="New Wi-Fi password" for="wf-pass" :error="errors.password" hint="8–63 characters. Leave blank to keep the current password.">
        <div class="flex items-center gap-2">
          <input id="wf-pass" v-model="form.password" :type="show ? 'text' : 'password'" class="input flex-1" maxlength="63" autocomplete="new-password" />
          <button type="button" class="btn-secondary btn-sm !p-2" :aria-label="show ? 'Hide password' : 'Show password'" @click="show = !show"><component :is="show ? EyeOff : Eye" class="size-4" /></button>
        </div>
      </Field>
    </form>
    <template #footer>
      <button class="btn-secondary" @click="emit('close')">Cancel</button>
      <button class="btn-primary" :disabled="busy" @click="submit"><Spinner v-if="busy" />Save changes</button>
    </template>
  </Modal>
</template>
