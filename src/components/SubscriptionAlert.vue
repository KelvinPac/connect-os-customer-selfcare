<script setup>
import { computed } from 'vue'
import { AlertTriangle, Ban, Clock, Hourglass, PiggyBank } from 'lucide-vue-next'
import { daysUntil, fmtDate, money } from '@/utils/format'

// Subscription status can change without any user action (cron moves it to/from GRACE_PERIOD and
// EXPIRED based on wallet balance), so the banner is derived from live state, never cached.
const props = defineProps({ subscription: Object, balance: Number })
const emit = defineEmits(['topup', 'renew'])

const price = computed(() => Number(props.subscription?.currentPrice ?? props.subscription?.plan?.price ?? 0))
const shortfall = computed(() => Math.max(Math.ceil(price.value - (props.balance ?? 0)), 0))

const alert = computed(() => {
  const s = props.subscription
  if (!s) return null
  switch (s.status) {
    case 'GRACE_PERIOD':
      return { tone: 'warn', icon: AlertTriangle, title: 'Your renewal payment failed',
        text: `Your wallet didn't have enough to renew. Top up ${money(shortfall.value)} ${s.graceEndsAt ? `before ${fmtDate(s.graceEndsAt)}` : 'soon'} to stay connected.`, cta: 'topup' }
    case 'EXPIRED':
      return { tone: 'bad', icon: Ban, title: 'Your service has expired',
        text: shortfall.value > 0 ? `Top up at least ${money(shortfall.value)} — your service switches back on automatically once the payment lands.` : 'Your wallet can cover it — renew now to get back online.',
        cta: shortfall.value > 0 ? 'topup' : 'renew' }
    case 'SUSPENDED':
      return { tone: 'bad', icon: Ban, title: 'Your service is suspended',
        text: 'Auto-renew is off, so a top-up alone won\'t restart it. Renew to get back online.', cta: 'renew' }
    case 'PENDING':
      return { tone: 'info', icon: Hourglass, title: 'Waiting for activation',
        text: 'Your plan is assigned but not switched on yet. Keep enough in your wallet and our team will activate it.', cta: null }
    case 'ACTIVE': {
      const d = daysUntil(s.nextBillingDate)
      if (d !== null && d <= 3 && d >= 0 && (props.balance ?? 0) < price.value) {
        return { tone: 'warn', icon: PiggyBank, title: 'Low balance for your next renewal',
          text: `Renews ${d === 0 ? 'today' : `in ${d} day${d > 1 ? 's' : ''}`} for ${money(price.value)}. Add ${money(shortfall.value)} so it renews without interruption.`, cta: 'topup' }
      }
      return null
    }
    default: return null
  }
})
const CLS = { warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad', info: 'bg-info-soft text-info' }
</script>

<template>
  <div v-if="alert" :class="['flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5', CLS[alert.tone]]" role="alert">
    <component :is="alert.icon" class="size-6 shrink-0" />
    <div class="flex-1">
      <p class="text-sm font-bold">{{ alert.title }}</p>
      <p class="mt-0.5 text-sm opacity-90">{{ alert.text }}</p>
    </div>
    <button v-if="alert.cta === 'topup'" class="btn btn-sm bg-surface text-ink shadow-sm hover:brightness-95" @click="emit('topup', shortfall)">Top up wallet</button>
    <button v-else-if="alert.cta === 'renew'" class="btn btn-sm bg-surface text-ink shadow-sm hover:brightness-95" @click="emit('renew')">Renew now</button>
  </div>
</template>
