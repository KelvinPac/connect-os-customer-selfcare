<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowRight, Wallet, CheckCircle2, Info } from 'lucide-vue-next'
import Modal from './Modal.vue'
import Spinner from './Spinner.vue'
import { subscriptionApi } from '@/api'
import { useAccount } from '@/stores/account'
import { useUi } from '@/stores/ui'
import { fmtDate, money } from '@/utils/format'

const props = defineProps({ open: Boolean, subscription: Object })
const emit = defineEmits(['close', 'topup', 'done'])

const account = useAccount()
const ui = useUi()

const preview = ref(null)
const loading = ref(false)
const busy = ref(false)
const error = ref('')

watch(() => [props.open, props.subscription?.id], async ([open, id]) => {
  if (!open || !id) return
  preview.value = null
  error.value = ''
  loading.value = true
  try { preview.value = await subscriptionApi.preview(id) } catch (e) { error.value = e.message } finally { loading.value = false }
}, { immediate: true })

const p = computed(() => preview.value)
const isActivation = computed(() => p.value?.action === 'activate')
const canConfirm = computed(() => p.value?.chargeable && !isActivation.value && p.value?.wallet?.sufficientFunds)
const shortfall = computed(() => Math.ceil(p.value?.wallet?.shortfall ?? 0))

async function confirm() {
  busy.value = true
  try {
    await subscriptionApi.renew(props.subscription.id)
    await account.refresh()
    ui.success('Subscription renewed — you\'re all set.')
    emit('done')
    emit('close')
  } catch (e) {
    if (e.status === 402) { error.value = 'Your wallet balance is too low for this renewal.'; await account.refresh() }
    else ui.error(e.message)
  } finally { busy.value = false }
}
</script>

<template>
  <Modal :open="open" title="Renew subscription" :subtitle="subscription?.plan?.name" @close="emit('close')">
    <div v-if="loading" class="space-y-3"><div class="skeleton h-20" /><div class="skeleton h-28" /></div>

    <p v-else-if="error && !p" class="rounded-xl bg-bad-soft px-3.5 py-3 text-sm text-bad">{{ error }}</p>

    <div v-else-if="p" class="space-y-5">
      <p v-if="error" class="rounded-xl bg-bad-soft px-3.5 py-3 text-sm text-bad">{{ error }}</p>

      <div v-if="!p.chargeable" class="flex gap-3 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
        <Info class="mt-0.5 size-4 shrink-0" /><span>{{ p.reason || 'This subscription cannot be renewed.' }} Please contact support.</span>
      </div>

      <div v-else-if="isActivation" class="flex gap-3 rounded-xl bg-info-soft px-4 py-3 text-sm text-info">
        <Info class="mt-0.5 size-4 shrink-0" />
        <span>This plan hasn't been switched on yet. Activation is done by our team — make sure your wallet has at least <b>{{ money(p.charge.total, p.charge.currency) }}</b> and we'll take care of the rest.</span>
      </div>

      <template v-if="p.chargeable">
        <dl class="divide-y divide-line rounded-xl border border-line text-sm">
          <div class="flex justify-between px-4 py-3"><dt class="text-ink-2">{{ p.plan.name }}</dt><dd class="font-medium">{{ money(p.charge.planPrice, p.charge.currency) }}</dd></div>
          <div v-if="p.charge.setupFee > 0" class="flex justify-between px-4 py-3"><dt class="text-ink-2">Setup fee (once)</dt><dd class="font-medium">{{ money(p.charge.setupFee, p.charge.currency) }}</dd></div>
          <div v-if="p.charge.taxAmount > 0" class="flex justify-between px-4 py-3"><dt class="text-ink-2">Tax</dt><dd class="font-medium">{{ money(p.charge.taxAmount, p.charge.currency) }}</dd></div>
          <div class="flex justify-between bg-surface-2 px-4 py-3 text-base font-bold"><dt>Total</dt><dd>{{ money(p.charge.total, p.charge.currency) }}</dd></div>
        </dl>

        <div class="rounded-xl border border-line px-4 py-3 text-sm">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Next billing date</p>
          <div class="flex items-center gap-2 font-medium">
            <span class="text-ink-2">{{ fmtDate(p.nextBillingDate) }}</span><ArrowRight class="size-4 text-ink-3" />
            <span class="text-brand-ink">{{ fmtDate(p.prospective.nextBillingDate) }}</span>
          </div>
        </div>

        <div :class="['flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm', p.wallet.sufficientFunds ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn']">
          <span class="flex items-center gap-2"><component :is="p.wallet.sufficientFunds ? CheckCircle2 : Wallet" class="size-4" />
            Wallet {{ money(p.wallet.balance) }} <template v-if="!p.wallet.sufficientFunds">· short by <b>{{ money(shortfall) }}</b></template>
          </span>
          <button v-if="!p.wallet.sufficientFunds" class="btn-sm btn rounded-lg bg-warn text-white" style="color:#fff" @click="emit('topup', shortfall)">Top up</button>
        </div>
      </template>
    </div>

    <template #footer>
      <button class="btn-secondary" @click="emit('close')">Cancel</button>
      <button class="btn-primary" :disabled="!canConfirm || busy" @click="confirm">
        <Spinner v-if="busy" />Pay {{ p?.charge ? money(p.charge.total, p.charge.currency) : '' }} &amp; renew
      </button>
    </template>
  </Modal>
</template>
