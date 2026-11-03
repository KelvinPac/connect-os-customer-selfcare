<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowRight, CheckCircle2, Info, Smartphone, Landmark, Wallet } from 'lucide-vue-next'
import Modal from './Modal.vue'
import Spinner from './Spinner.vue'
import { subscriptionApi } from '@/api'
import { useAccount } from '@/stores/account'
import { useUi } from '@/stores/ui'
import { CYCLE_LABEL, fmtDate, money } from '@/utils/format'

const props = defineProps({ open: Boolean, subscription: Object, plan: Object })
const emit = defineEmits(['close', 'topup', 'done'])

const account = useAccount()
const ui = useUi()

const raw = ref(null)
const loading = ref(false)
const busy = ref(false)
const error = ref('')

async function load() {
  if (!props.open || !props.subscription?.id || !props.plan?.id) return
  loading.value = true
  error.value = ''
  try { raw.value = await subscriptionApi.changePlanPreview(props.subscription.id, props.plan.id) } catch (e) { raw.value = null; error.value = e.message } finally { loading.value = false }
}
watch(() => [props.open, props.subscription?.id, props.plan?.id], ([open]) => { if (open) { raw.value = null; load() } }, { immediate: true })
// A top-up (STK or Paybill) refreshes the wallet; re-quote so "short by" updates itself.
watch(() => account.balance, () => { if (props.open && !busy.value) load() })

// The API documents the preview's contents but not its field names, so read each value
// from the likeliest keys (top level, or nested under charge/proration/wallet/prospective).
const pick = (...paths) => {
  for (const path of paths) {
    const v = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), raw.value)
    if (v !== undefined && v !== null && v !== '') return v
  }
}
const num = (...paths) => { const v = pick(...paths); return v === undefined ? undefined : Number(v) }

const q = computed(() => {
  if (!raw.value) return null
  const currency = pick('currency', 'charge.currency', 'newPlan.currency') ?? props.plan.currency ?? 'KES'
  const newPrice = num('newPlan.price', 'newPrice', 'charge.planPrice', 'proration.newPrice') ?? Number(props.plan.price)
  const credit = num('credit', 'unusedCredit', 'unusedTimeCredit', 'proration.credit', 'proration.unusedCredit', 'creditAmount') ?? 0
  const refund = num('refund', 'refundAmount', 'walletRefund', 'proration.refund')
  let net = num('netCharge', 'net', 'netAmount', 'amountDue', 'charge.total', 'proration.net', 'proration.netCharge')
  if (net === undefined) net = refund !== undefined && refund > 0 ? -refund : newPrice - credit
  const balance = num('wallet.balance', 'walletBalance') ?? account.balance
  const charge = Math.max(net, 0)
  const covers = pick('wallet.sufficientFunds', 'walletCovers', 'sufficientFunds', 'canAfford')
  const sufficient = net <= 0 || (covers !== undefined ? Boolean(covers) : balance >= charge)
  const shortfall = Math.ceil(num('wallet.shortfall', 'shortfall') ?? Math.max(charge - balance, 0))
  if (import.meta.env.DEV && credit === 0 && num('netCharge', 'net', 'netAmount', 'amountDue', 'charge.total', 'proration.net') === undefined) {
    console.warn('[change-plan preview] unrecognised shape, check field names:', raw.value)
  }
  return {
    currency, newPrice, credit, net, charge, refund: net < 0 ? -net : 0, balance, sufficient, shortfall,
    days: num('daysRemaining', 'unusedDays', 'proration.daysRemaining'),
    periodStart: pick('newPeriodStart', 'periodStart', 'newPeriod.start', 'prospective.periodStart', 'prospective.currentPeriodStart'),
    periodEnd: pick('newPeriodEnd', 'periodEnd', 'newPeriod.end', 'prospective.nextBillingDate', 'prospective.currentPeriodEnd', 'nextBillingDate', 'newBillingDate'),
  }
})

const cur = computed(() => props.subscription?.plan)
const cycle = (p) => CYCLE_LABEL[p?.billingCycle] ?? 'cycle'

async function confirm() {
  busy.value = true
  error.value = ''
  try {
    await subscriptionApi.changePlan(props.subscription.id, props.plan.id)
    await account.refresh()
    ui.success(`You're now on ${props.plan.name}.`)
    emit('done')
    emit('close')
  } catch (e) {
    error.value = e.status === 402 ? 'Your wallet balance is too low for this change. Top up and try again.' : e.message
    if (e.status === 402) { await account.refresh(); load() }
  } finally { busy.value = false }
}
</script>

<template>
  <Modal :open="open" title="Switch plan" subtitle="Here's exactly what you'll pay — no surprises." @close="!busy && emit('close')" :persistent="busy">
    <div v-if="loading && !q" class="space-y-3"><div class="skeleton h-20" /><div class="skeleton h-32" /></div>

    <p v-else-if="error && !q" class="rounded-xl bg-bad-soft px-3.5 py-3 text-sm text-bad">{{ error }}</p>

    <div v-else-if="q" class="space-y-5">
      <p v-if="error" class="rounded-xl bg-bad-soft px-3.5 py-3 text-sm text-bad">{{ error }}</p>

      <!-- from → to -->
      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
        <div class="rounded-xl border border-line px-3 py-2.5">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Current</p>
          <p class="font-semibold">{{ cur?.name }}</p>
          <p class="text-xs text-ink-2">{{ cur?.downloadSpeed }}/{{ cur?.uploadSpeed }} Mbps</p>
        </div>
        <ArrowRight class="size-4 text-ink-3" />
        <div class="rounded-xl border-2 border-brand bg-brand-soft/40 px-3 py-2.5">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-brand-ink">New</p>
          <p class="font-semibold">{{ plan.name }}</p>
          <p class="text-xs text-ink-2">{{ plan.downloadSpeed }}/{{ plan.uploadSpeed }} Mbps</p>
        </div>
      </div>

      <!-- proration -->
      <dl class="divide-y divide-line rounded-xl border border-line text-sm">
        <div class="flex justify-between px-4 py-3"><dt class="text-ink-2">{{ plan.name }} · per {{ cycle(plan) }}</dt><dd class="font-medium">{{ money(q.newPrice, q.currency) }}</dd></div>
        <div class="flex justify-between px-4 py-3">
          <dt class="text-ink-2">Credit for unused time on {{ cur?.name }}<template v-if="q.days != null"> <span class="text-ink-3">({{ Math.round(q.days) }} day{{ Math.round(q.days) === 1 ? '' : 's' }} left)</span></template></dt>
          <dd class="font-medium text-ok">− {{ money(q.credit, q.currency) }}</dd>
        </div>
        <div v-if="q.net >= 0" class="flex justify-between bg-surface-2 px-4 py-3 text-base font-bold"><dt>To pay now</dt><dd>{{ money(q.charge, q.currency) }}</dd></div>
        <div v-else class="flex justify-between bg-ok-soft px-4 py-3 text-base font-bold text-ok"><dt>Refunded to your wallet</dt><dd>{{ money(q.refund, q.currency) }}</dd></div>
      </dl>

      <div v-if="q.periodEnd" class="rounded-xl border border-line px-4 py-3 text-sm">
        <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">New billing period</p>
        <p class="font-medium"><template v-if="q.periodStart">{{ fmtDate(q.periodStart) }} <ArrowRight class="mx-1 inline size-3.5 text-ink-3" /></template>{{ fmtDate(q.periodEnd) }}</p>
        <p class="mt-1 text-xs text-ink-3">Your new plan starts straight away and the billing cycle restarts today.</p>
      </div>

      <!-- wallet -->
      <div v-if="q.sufficient" class="flex items-center gap-2 rounded-xl bg-ok-soft px-4 py-3 text-sm text-ok">
        <CheckCircle2 class="size-4" />Wallet {{ money(q.balance, q.currency) }}<template v-if="q.net > 0"> — covers this change</template>
      </div>
      <div v-else class="space-y-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
        <p class="flex items-center gap-2"><Wallet class="size-4 shrink-0" />Wallet {{ money(q.balance, q.currency) }} · short by <b>{{ money(q.shortfall, q.currency) }}</b></p>
        <p class="text-xs opacity-90">Add the difference to switch now. Choose how you'd like to pay:</p>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" class="btn btn-sm rounded-lg bg-warn text-white" style="color:#fff" @click="emit('topup', q.shortfall, 'stk')"><Smartphone class="size-4" />M-Pesa prompt</button>
          <button type="button" class="btn btn-sm rounded-lg bg-surface text-ink shadow-sm" @click="emit('topup', q.shortfall, 'paybill')"><Landmark class="size-4" />Paybill</button>
        </div>
      </div>

      <p class="flex gap-2 text-xs text-ink-3"><Info class="mt-0.5 size-3.5 shrink-0" />Credit = what you paid for the current plan × time left ÷ cycle length. Any surplus is returned to your wallet.</p>
    </div>

    <template #footer>
      <button class="btn-secondary" :disabled="busy" @click="emit('close')">Cancel</button>
      <button class="btn-primary" :disabled="!q || !q.sufficient || busy || loading" @click="confirm">
        <Spinner v-if="busy" />{{ q?.net > 0 ? `Pay ${money(q.charge, q.currency)} & switch` : 'Switch plan' }}
      </button>
    </template>
  </Modal>
</template>
