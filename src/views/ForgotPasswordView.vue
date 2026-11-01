<script setup>
import { ref } from 'vue'
import { MailCheck } from 'lucide-vue-next'
import AuthShell from '@/components/AuthShell.vue'
import Field from '@/components/Field.vue'
import Spinner from '@/components/Spinner.vue'
import { authApi } from '@/api'

const email = ref('')
const busy = ref(false)
const sent = ref(false)
const error = ref('')

async function submit() {
  busy.value = true
  error.value = ''
  try { await authApi.forgotPassword(email.value.trim()); sent.value = true } catch (e) { error.value = e.message } finally { busy.value = false }
}
</script>

<template>
  <AuthShell title="Reset your password" subtitle="We'll send a reset link to your email.">
    <div v-if="sent" class="flex flex-col items-center rounded-2xl bg-ok-soft px-5 py-8 text-center">
      <MailCheck class="mb-3 size-10 text-ok" />
      <p class="font-semibold text-ink">Check your inbox</p>
      <p class="mt-1 text-sm text-ink-2">If an account exists for <b>{{ email }}</b>, a reset link is on its way. It expires in 1 hour.</p>
    </div>
    <form v-else class="space-y-5" @submit.prevent="submit">
      <p v-if="error" class="rounded-xl bg-bad-soft px-3.5 py-3 text-sm text-bad">{{ error }}</p>
      <Field label="Email" for="fp-email"><input id="fp-email" v-model="email" type="email" class="input" placeholder="you@example.com" required autofocus /></Field>
      <button class="btn-primary w-full" :disabled="busy"><Spinner v-if="busy" />Send reset link</button>
    </form>
    <template #footer><RouterLink to="/login" class="font-medium text-brand hover:underline">← Back to sign in</RouterLink></template>
  </AuthShell>
</template>
