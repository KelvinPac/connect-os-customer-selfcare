<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { CheckCircle2, Copy, Smartphone, XCircle, Landmark } from 'lucide-vue-next'
import Modal from './Modal.vue'
import Field from './Field.vue'
import Spinner from './Spinner.vue'
import { paymentApi } from '@/api'
import { useAuth } from '@/stores/auth'
import { useAccount } from '@/stores/account'
import { money, normalizeKePhone } from '@/utils/format'

const props = defineProps({ open: Boolean, suggested: { type: Number, default: 0 }, mode: { type: String, default: 'stk' } })
const emit = defineEmits(['close', 'done'])

const auth = useAuth()
const account = useAccount()

const phone = ref('')
const amount = ref('')
const tab = ref('stk') // stk | paybill
const startBalance = ref(0)
const checking = ref(false)
const copied = ref('')
const step = ref('form') // form | sending | waiting | success | failed | timeout
const error = ref('')
const payment = ref(null)
const fieldErrors = ref({})
const paybill = import.meta.env.VITE_MPESA_PAYBILL

const POLL_MS = 3000
const POLL_MAX_MS = 90_000
let timer = null
let stopped = false

const quick = [500, 1000, 2000, 5000]
const normalizedPhone = computed(() => normalizeKePhone(phone.value))
const amountNum = computed(() => Number(amount.value))

watch(() => props.open, (o) => {
  if (!o) return stopPolling()
  step.value = 'form'
  tab.value = props.mode === 'paybill' ? 'paybill' : 'stk'
  startBalance.value = account.balance
  error.value = ''
  fieldErrors.value = {}
  payment.value = null
  phone.value = auth.user?.phone ?? ''
  amount.value = props.suggested > 0 ? String(Math.ceil(props.suggested)) : ''
})
onUnmounted(stopPolling)

async function copy(text, key) {
  try { await navigator.clipboard.writeText(String(text)); copied.value = key; setTimeout(() => (copied.value = ''), 1500) } catch { /* ignore */ }
}

// Paybill payments land via Safaricom's C2B webhook with no payment row to poll, so re-read the wallet.
async function checkPaybill() {
  checking.value = true
  error.value = ''
  try {
    await account.refresh()
    if (account.balance > startBalance.value) { step.value = 'success'; emit('done') }
    else error.value = 'We haven\'t received your payment yet. It can take a minute — try again shortly.'
  } catch (e) { error.value = e.message } finally { checking.value = false }
}

function stopPolling() { stopped = true; clearTimeout(timer) }

function validate() {
  const e = {}
  if (!normalizedPhone.value) e.phone = 'Enter a valid Safaricom number, e.g. 0712 345 678.'
  if (!(amountNum.value >= 1)) e.amount = 'Enter an amount of at least KES 1.'
  else if (amountNum.value > 250000) e.amount = 'M-Pesa limits a single payment to KES 250,000.'
  fieldErrors.value = e
  return !Object.keys(e).length
}

async function submit() {
  if (!validate()) return
  step.value = 'sending'
  error.value = ''
  try {
    payment.value = await paymentApi.stkPush(normalizedPhone.value, Math.round(amountNum.value))
    step.value = 'waiting'
    poll(Date.now())
  } catch (e) {
    step.value = 'form'
    // The API surfaces a 500 until Daraja credentials are configured (see API guide §7B).
    error.value = e.status >= 500 ? 'M-Pesa is temporarily unavailable. Please try again shortly, or pay via Paybill.' : e.message
    fieldErrors.value = e.fieldErrors ?? {}
  }
}

// The STK response only means "prompt sent". Completion arrives via Safaricom's webhook,
// so poll the payment record until it settles.
function poll(startedAt) {
  stopped = false
  const tick = async () => {
    if (stopped) return
    try {
      const p = await paymentApi.get(payment.value.id)
      if (p.status === 'COMPLETED') return finish('success')
      if (['FAILED', 'REVERSED'].includes(p.status)) return finish('failed')
    } catch { /* transient: keep polling */ }
    if (Date.now() - startedAt > POLL_MAX_MS) return finish('timeout')
    timer = setTimeout(tick, POLL_MS)
  }
  timer = setTimeout(tick, POLL_MS)
}

async function finish(result) {
  stopPolling()
  step.value = result
  if (result === 'success') {
    // A top-up also instantly retries any EXPIRED / GRACE_PERIOD subscription server-side.
    await account.refresh()
    emit('done')
  }
}

const closeable = computed(() => step.value !== 'sending')
</script>

<template>
  <Modal :open="open" title="Top up wallet" :subtitle="step === 'form' ? (tab === 'stk' ? 'Pay with M-Pesa — you\'ll get a prompt on your phone.' : 'Pay from your M-Pesa menu using our Paybill.') : ''" :persistent="step === 'sending'" @close="closeable && emit('close')">
    <!-- form -->
    <form v-if="step === 'form' || step === 'sending'" class="space-y-5" @submit.prevent="tab === 'stk' ? submit() : checkPaybill()">
      <div class="grid grid-cols-2 rounded-xl bg-surface-2 p-1 text-sm font-medium" role="tablist">
        <button type="button" role="tab" :aria-selected="tab === 'stk'" :class="['flex items-center justify-center gap-2 rounded-lg py-2 transition', tab === 'stk' ? 'bg-surface text-ink shadow-sm' : 'text-ink-3']" @click="tab = 'stk'; error = ''"><Smartphone class="size-4" />M-Pesa prompt</button>
        <button type="button" role="tab" :aria-selected="tab === 'paybill'" :class="['flex items-center justify-center gap-2 rounded-lg py-2 transition', tab === 'paybill' ? 'bg-surface text-ink shadow-sm' : 'text-ink-3']" @click="tab = 'paybill'; error = ''"><Landmark class="size-4" />Paybill</button>
      </div>

      <p v-if="error" class="rounded-xl bg-bad-soft px-3.5 py-3 text-sm text-bad">{{ error }}</p>

      <Field v-if="tab === 'stk'" label="M-Pesa number" for="tu-phone" :error="fieldErrors.phone">
        <input id="tu-phone" v-model="phone" class="input" inputmode="tel" autocomplete="tel" placeholder="0712 345 678" />
      </Field>

      <Field v-if="tab === 'stk'" label="Amount (KES)" for="tu-amount" :error="fieldErrors.amount" :hint="suggested > 0 ? `Covers the ${money(suggested)} you need for renewal.` : ''">
        <input id="tu-amount" v-model="amount" class="input text-lg font-semibold" inputmode="numeric" placeholder="1000" />
        <div class="mt-2.5 flex flex-wrap gap-2">
          <button v-for="q in quick" :key="q" type="button" class="btn-secondary btn-sm" @click="amount = String(q)">{{ q.toLocaleString() }}</button>
        </div>
      </Field>

      <div v-else class="space-y-4">
        <ol class="space-y-1 text-sm text-ink-2">
          <li>1. Open <b class="text-ink">M-Pesa → Lipa na M-Pesa → Pay Bill</b>.</li>
          <li>2. Enter the business and account numbers below.</li>
          <li>3. Enter <b class="text-ink">{{ suggested > 0 ? money(Math.ceil(suggested)) : 'any amount' }}</b><template v-if="suggested > 0"> (or more)</template> and your PIN.</li>
        </ol>
        <dl class="divide-y divide-line rounded-xl border border-line text-sm">
          <div class="flex items-center justify-between gap-3 px-4 py-3">
            <div><dt class="text-xs text-ink-3">Business number</dt><dd class="font-mono text-base font-semibold">{{ paybill || '—' }}</dd></div>
            <button v-if="paybill" type="button" class="btn-ghost btn-sm" @click="copy(paybill, 'pb')"><Copy class="size-4" />{{ copied === 'pb' ? 'Copied' : 'Copy' }}</button>
          </div>
          <div class="flex items-center justify-between gap-3 px-4 py-3">
            <div><dt class="text-xs text-ink-3">Account number</dt><dd class="font-mono text-base font-semibold">{{ account.customer?.customerNumber || '—' }}</dd></div>
            <button v-if="account.customer?.customerNumber" type="button" class="btn-ghost btn-sm" @click="copy(account.customer.customerNumber, 'ac')"><Copy class="size-4" />{{ copied === 'ac' ? 'Copied' : 'Copy' }}</button>
          </div>
        </dl>
        <p class="text-xs text-ink-3">Your wallet is credited automatically once Safaricom confirms the payment. Then tap “I've paid” to check.</p>
      </div>
    </form>

    <!-- waiting -->
    <div v-else-if="step === 'waiting'" class="flex flex-col items-center py-6 text-center">
      <div class="relative mb-5 grid size-16 place-items-center rounded-full bg-brand-soft text-brand">
        <span class="absolute inset-0 animate-ping rounded-full bg-brand/20" />
        <Smartphone class="relative size-7" />
      </div>
      <h3 class="text-lg font-semibold text-ink">Check your phone</h3>
      <p class="mt-1.5 max-w-xs text-sm text-ink-2">Enter your M-Pesa PIN on <b class="text-ink">{{ phone }}</b> to pay <b class="text-ink">{{ money(amountNum) }}</b>.</p>
      <p class="mt-4 flex items-center gap-2 text-xs text-ink-3"><Spinner />Waiting for confirmation…</p>
    </div>

    <!-- success -->
    <div v-else-if="step === 'success'" class="flex flex-col items-center py-6 text-center">
      <div class="mb-4 grid size-16 place-items-center rounded-full bg-ok-soft text-ok"><CheckCircle2 class="size-8" /></div>
      <h3 class="text-lg font-semibold text-ink">Payment received</h3>
      <p class="mt-1.5 text-sm text-ink-2">Your new balance is <b class="text-ink">{{ money(account.balance, account.currency) }}</b>.</p>
    </div>

    <!-- failed / timeout -->
    <div v-else class="flex flex-col items-center py-6 text-center">
      <div class="mb-4 grid size-16 place-items-center rounded-full bg-bad-soft text-bad"><XCircle class="size-8" /></div>
      <h3 class="text-lg font-semibold text-ink">{{ step === 'timeout' ? "We didn't get a confirmation" : "Payment didn't go through" }}</h3>
      <p class="mt-1.5 max-w-xs text-sm text-ink-2">
        {{ step === 'timeout'
          ? 'If you entered your PIN, the money may still arrive — your balance will update automatically. Otherwise, try again.'
          : 'The payment was cancelled or failed. You have not been charged.' }}
      </p>
    </div>

    <template #footer>
      <template v-if="step === 'form' || step === 'sending'">
        <button class="btn-secondary" :disabled="step === 'sending'" @click="emit('close')">Cancel</button>
        <button v-if="tab === 'paybill'" class="btn-primary" :disabled="checking" @click="checkPaybill"><Spinner v-if="checking" />{{ checking ? 'Checking…' : 'I\'ve paid — check balance' }}</button>
        <button v-else class="btn-primary" :disabled="step === 'sending'" @click="submit">
          <Spinner v-if="step === 'sending'" />{{ step === 'sending' ? 'Sending prompt…' : 'Send M-Pesa prompt' }}
        </button>
      </template>
      <template v-else-if="step === 'waiting'">
        <button class="btn-ghost" @click="finish('timeout'); emit('close')">Close — I'll check later</button>
      </template>
      <template v-else-if="step === 'success'">
        <button class="btn-primary" @click="emit('close')">Done</button>
      </template>
      <template v-else>
        <button class="btn-secondary" @click="emit('close')">Close</button>
        <button class="btn-primary" @click="step = 'form'">Try again</button>
      </template>
    </template>
  </Modal>
</template>
