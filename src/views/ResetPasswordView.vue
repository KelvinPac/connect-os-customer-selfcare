<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthShell from '@/components/AuthShell.vue'
import Field from '@/components/Field.vue'
import Spinner from '@/components/Spinner.vue'
import { authApi } from '@/api'

const route = useRoute()
const router = useRouter()
const token = computed(() => String(route.query.token || ''))
const password = ref('')
const confirm = ref('')
const busy = ref(false)
const error = ref('')

const mismatch = computed(() => confirm.value && password.value !== confirm.value)

async function submit() {
  if (password.value.length < 8) { error.value = 'Use at least 8 characters.'; return }
  if (mismatch.value) { error.value = "Passwords don't match."; return }
  busy.value = true
  error.value = ''
  try {
    await authApi.resetPassword(token.value, password.value)
    router.replace({ name: 'login', query: { reset: '1' } })
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
</script>

<template>
  <AuthShell title="Choose a new password" subtitle="Pick something you haven't used elsewhere.">
    <p v-if="!token" class="rounded-xl bg-bad-soft px-3.5 py-3 text-sm text-bad">This reset link is missing its token. Request a new one.</p>
    <form v-else class="space-y-5" @submit.prevent="submit">
      <p v-if="error" class="rounded-xl bg-bad-soft px-3.5 py-3 text-sm text-bad" role="alert">{{ error }}</p>
      <Field label="New password" for="np" hint="At least 8 characters."><input id="np" v-model="password" type="password" class="input" autocomplete="new-password" required autofocus /></Field>
      <Field label="Confirm password" for="cp" :error="mismatch ? 'Passwords don\'t match.' : ''"><input id="cp" v-model="confirm" type="password" class="input" autocomplete="new-password" required /></Field>
      <button class="btn-primary w-full" :disabled="busy"><Spinner v-if="busy" />Update password</button>
    </form>
    <template #footer><RouterLink :to="token ? '/login' : '/forgot-password'" class="font-medium text-brand hover:underline">{{ token ? '← Back to sign in' : 'Request a new link' }}</RouterLink></template>
  </AuthShell>
</template>
