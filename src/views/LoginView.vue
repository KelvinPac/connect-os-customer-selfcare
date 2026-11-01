<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Eye, EyeOff, Mail, ShieldCheck, Smartphone } from 'lucide-vue-next'
import AuthShell from '@/components/AuthShell.vue'
import Field from '@/components/Field.vue'
import Spinner from '@/components/Spinner.vue'
import { authApi } from '@/api'
import { useAuth } from '@/stores/auth'
import { normalizeKePhone } from '@/utils/format'

const auth = useAuth()
const route = useRoute()
const router = useRouter()

const read = () => { try { return localStorage.getItem('cos.loginMethod') } catch { return null } }
const method = ref(read() === 'email' ? 'email' : 'phone')
function setMethod(m) {
  method.value = m
  error.value = ''
  fieldErrors.value = {}
  try { localStorage.setItem('cos.loginMethod', m) } catch { /* ignore */ }
}

const email = ref('')
const password = ref('')
const totp = ref('')
const show = ref(false)
const needsTotp = ref(false)
const busy = ref(false)
const error = ref('')
const fieldErrors = ref({})

// Phone + OTP: step 1 asks for the number (and channel), step 2 for the 6-digit code sent to it.
const phone = ref('')
const otp = ref('')
const otpSent = ref(false)
const channel = ref('SMS')
const channels = [{ id: 'SMS', label: 'SMS' }, { id: 'WHATSAPP', label: 'WhatsApp' }, { id: 'EMAIL', label: 'Email' }]
const otpTotp = ref('')
const otpNeedsTotp = ref(false)
const cooldown = ref(0)
let timer = null
const normalizedPhone = computed(() => normalizeKePhone(phone.value))
onUnmounted(() => clearInterval(timer))

function startCooldown(sec = 60) {
  cooldown.value = sec
  clearInterval(timer)
  timer = setInterval(() => { if (--cooldown.value <= 0) clearInterval(timer) }, 1000)
}
const goNext = () => {
  const next = typeof route.query.next === 'string' && route.query.next.startsWith('/') ? route.query.next : '/'
  router.replace(next)
}

async function sendOtp() {
  error.value = ''
  fieldErrors.value = {}
  if (!normalizedPhone.value) { fieldErrors.value = { phone: 'Enter a valid Safaricom, Airtel or Telkom number, e.g. 0712 345 678.' }; return }
  busy.value = true
  try {
    await authApi.requestOtp(normalizedPhone.value, channel.value)
    otpSent.value = true
    otp.value = ''
    startCooldown()
  } catch (e) {
    error.value = e.message
    fieldErrors.value = e.fieldErrors ?? {}
  } finally { busy.value = false }
}

async function verifyOtp() {
  error.value = ''
  busy.value = true
  try {
    await auth.loginWithOtp(normalizedPhone.value, otp.value.trim(), otpNeedsTotp.value ? otpTotp.value.trim() : undefined)
    goNext()
  } catch (e) {
    if (e.message === '2FA code required.') { otpNeedsTotp.value = true; error.value = '' } else error.value = e.message
  } finally { busy.value = false }
}

const notice = computed(() => (route.query.expired ? 'Your session expired. Please sign in again.' : route.query.reset ? 'Password updated. Sign in with your new password.' : ''))

async function submit() {
  error.value = ''
  fieldErrors.value = {}
  busy.value = true
  try {
    await auth.login(email.value.trim(), password.value, needsTotp.value ? totp.value.trim() : undefined)
    goNext()
  } catch (e) {
    if (e.message === '2FA code required.') { needsTotp.value = true; error.value = '' }
    else { error.value = e.message; fieldErrors.value = e.fieldErrors ?? {} }
  } finally { busy.value = false }
}
</script>

<template>
  <AuthShell title="Welcome back" subtitle="Sign in to manage your internet service.">
    <div class="mb-6 grid grid-cols-2 rounded-xl bg-surface-2 p-1 text-sm font-medium" role="tablist">
      <button type="button" role="tab" :aria-selected="method === 'phone'" :class="['flex items-center justify-center gap-2 rounded-lg py-2 transition', method === 'phone' ? 'bg-surface text-ink shadow-sm' : 'text-ink-3']" @click="setMethod('phone')"><Smartphone class="size-4" />Phone</button>
      <button type="button" role="tab" :aria-selected="method === 'email'" :class="['flex items-center justify-center gap-2 rounded-lg py-2 transition', method === 'email' ? 'bg-surface text-ink shadow-sm' : 'text-ink-3']" @click="setMethod('email')"><Mail class="size-4" />Email</button>
    </div>

    <p v-if="notice && !error" class="mb-5 rounded-xl bg-info-soft px-3.5 py-3 text-sm text-info">{{ notice }}</p>
    <p v-if="error" class="mb-5 rounded-xl bg-bad-soft px-3.5 py-3 text-sm text-bad" role="alert">{{ error }}</p>

    <!-- Phone + OTP -->
    <form v-if="method === 'phone'" class="space-y-5" @submit.prevent="otpSent ? verifyOtp() : sendOtp()">
      <Field label="Phone number" for="phone" :error="fieldErrors.phone" :hint="otpSent ? '' : 'Use the number on your account. We\'ll send you a 6-digit code.'">
        <div class="flex items-center gap-2">
          <input id="phone" v-model="phone" type="tel" class="input flex-1" inputmode="tel" autocomplete="tel" placeholder="0712 345 678" :disabled="otpSent" required autofocus />
          <button v-if="otpSent" type="button" class="btn-secondary btn-sm shrink-0" @click="otpSent = false; error = ''">Change</button>
        </div>
      </Field>

      <div v-if="!otpSent" class="grid grid-cols-3 rounded-xl bg-surface-2 p-1 text-sm font-medium" role="radiogroup" aria-label="Send code via">
        <button v-for="c in channels" :key="c.id" type="button" role="radio" :aria-checked="channel === c.id" :class="['rounded-lg py-1.5 transition', channel === c.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-3']" @click="channel = c.id">{{ c.label }}</button>
      </div>

      <Field v-if="otpSent" label="Verification code" for="otp" :hint="`Sent to +${normalizedPhone}${channel === 'EMAIL' ? ' (via the email on file)' : ''}.`">
        <input id="otp" v-model="otp" class="input font-mono tracking-[0.35em]" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" required autofocus />
      </Field>

      <Field v-if="otpNeedsTotp" label="Authenticator code" for="otp-totp" hint="Your account has 2FA. Enter the code from your authenticator app.">
        <input id="otp-totp" v-model="otpTotp" class="input font-mono tracking-[0.35em]" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" required autofocus />
      </Field>

      <button class="btn-primary w-full" :disabled="busy || (otpSent && otp.trim().length < 6) || (otpNeedsTotp && otpTotp.trim().length < 6)"><Spinner v-if="busy" />{{ otpSent ? (busy ? 'Verifying…' : 'Verify & sign in') : (busy ? 'Sending…' : 'Send code') }}</button>
      <p v-if="otpSent" class="text-center text-sm text-ink-2">
        Didn't get it?
        <button type="button" class="font-medium text-brand hover:underline disabled:text-ink-3 disabled:no-underline" :disabled="cooldown > 0 || busy" @click="sendOtp">{{ cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code' }}</button>
      </p>
    </form>

    <!-- Email + password -->
    <form v-else class="space-y-5" @submit.prevent="submit">

      <Field label="Email" for="email" :error="fieldErrors.email">
        <input id="email" v-model="email" type="email" class="input" autocomplete="username" placeholder="you@example.com" required autofocus />
      </Field>

      <Field label="Password" for="password" :error="fieldErrors.password">
        <div class="relative">
          <input id="password" v-model="password" :type="show ? 'text' : 'password'" class="input pr-11" autocomplete="current-password" placeholder="••••••••" required />
          <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-3 hover:text-ink" :aria-label="show ? 'Hide password' : 'Show password'" @click="show = !show">
            <component :is="show ? EyeOff : Eye" class="size-4" />
          </button>
        </div>
      </Field>

      <Field v-if="needsTotp" label="Authenticator code" for="totp" hint="Open your authenticator app and enter the 6-digit code.">
        <div class="relative">
          <ShieldCheck class="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand" />
          <input id="totp" v-model="totp" class="input pl-10 font-mono tracking-[0.35em]" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" required autofocus />
        </div>
      </Field>

      <div class="text-right"><RouterLink to="/forgot-password" class="text-sm font-medium text-brand hover:underline">Forgot password?</RouterLink></div>

      <button class="btn-primary w-full" :disabled="busy"><Spinner v-if="busy" />{{ busy ? 'Signing in…' : needsTotp ? 'Verify & sign in' : 'Sign in' }}</button>
    </form>
    <template #footer>New customer? Contact us to get connected.</template>
  </AuthShell>
</template>
