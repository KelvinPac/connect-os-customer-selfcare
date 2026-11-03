<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowDownToLine, ArrowUpFromLine, Check, Copy, Eye, EyeOff, KeyRound, RefreshCw, Repeat } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import FupCard from '@/components/FupCard.vue'
import RenewModal from '@/components/RenewModal.vue'
import ChangePlanModal from '@/components/ChangePlanModal.vue'
import NewTicketModal from '@/components/NewTicketModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import SubscriptionAlert from '@/components/SubscriptionAlert.vue'
import { planApi } from '@/api'
import { useAccount } from '@/stores/account'
import { useUi } from '@/stores/ui'
import { CYCLE_LABEL, fmtDate, money, planTypeLabel, titleCase } from '@/utils/format'

const emit = defineEmits(['topup'])
const account = useAccount()
const ui = useUi()
const router = useRouter()

const plans = ref([])
const plansLoading = ref(true)
const plansError = ref('')
const segment = ref('')
const renewSub = ref(null)
const ticketPreset = ref(null)
const changeTarget = ref(null)
const showPass = ref(false)
const copied = ref('')
onMounted(async () => {
  account.refresh()
  try {
    const res = await planApi.list()
    plans.value = res.filter((p) => p.isPublic !== false)
  } catch (e) { plansError.value = e.message } finally { plansLoading.value = false }
})

const subs = computed(() => account.subscriptions.filter((s) => s.status !== 'CANCELLED'))
const pastSubs = computed(() => account.subscriptions.filter((s) => s.status === 'CANCELLED'))
const currentPlanIds = computed(() => new Set(subs.value.filter((s) => ['ACTIVE', 'GRACE_PERIOD', 'PENDING'].includes(s.status)).map((s) => s.planId)))
const segments = computed(() => [...new Set(plans.value.map((p) => p.segment))])
const visiblePlans = computed(() => plans.value.filter((p) => !segment.value || p.segment === segment.value))
const renewable = (s) => ['ACTIVE', 'GRACE_PERIOD', 'EXPIRED', 'SUSPENDED'].includes(s.status)

const customer = computed(() => account.customer)
const pppoe = computed(() => (customer.value?.radiusPassword ? { user: customer.value.customerNumber, pass: customer.value.radiusPassword } : null))

async function copy(text, key) {
  try { await navigator.clipboard.writeText(text); copied.value = key; setTimeout(() => (copied.value = ''), 1500) } catch { ui.error('Could not copy to clipboard.') }
}

// An ACTIVE subscription can switch instantly (prorated, paid from the wallet). Anything else
// (grace period, expired, nothing yet) the API rejects with 409, so fall back to a support ticket.
const activeSub = computed(() => subs.value.find((s) => s.status === 'ACTIVE'))
const changeSub = ref(null)
function requestPlan(p) {
  if (activeSub.value) { changeSub.value = activeSub.value; changeTarget.value = p; return }
  const cur = subs.value.find((s) => ['ACTIVE', 'GRACE_PERIOD'].includes(s.status))
  ticketPreset.value = {
    category: 'UPGRADE_DOWNGRADE',
    title: `Switch to ${p.name}`,
    description: `I'd like to change ${cur ? `from ${cur.plan?.name} ` : ''}to the ${p.name} plan (${p.downloadSpeed}/${p.uploadSpeed} Mbps, ${money(p.price, p.currency)} per ${CYCLE_LABEL[p.billingCycle] ?? 'cycle'}).`,
  }
}
</script>

<template>
  <PageHeader title="My internet" subtitle="Your plans, connection details and what else is available." />

  <ErrorState v-if="account.error && !account.customer" :message="account.error" @retry="account.refresh()" />
  <div v-else-if="account.loading && !account.customer" class="space-y-4"><div class="skeleton h-64" /></div>

  <div v-else class="space-y-10">
    <!-- Subscriptions -->
    <section class="space-y-4">
      <EmptyState v-if="!subs.length" class="card" :icon="Repeat" title="No active subscription" text="Pick a plan below and ask our team to switch it on." />

      <article v-for="s in subs" :key="s.id" class="card overflow-hidden">
        <div class="space-y-5 p-5 sm:p-6">
          <SubscriptionAlert :subscription="s" :balance="account.balance" @topup="(n) => emit('topup', n)" @renew="renewSub = s" />

          <header class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="font-mono text-xs text-ink-3">{{ s.subscriptionNo }}</p>
              <h2 class="mt-1 text-xl font-bold tracking-tight">{{ s.plan?.name }}</h2>
              <p class="text-sm text-ink-2">{{ s.plan?.description || `${planTypeLabel(s.plan?.type)} · ${titleCase(s.plan?.segment)}` }}</p>
            </div>
            <StatusBadge :status="s.status" />
          </header>

          <dl class="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><dt class="label !mb-1">Speed</dt><dd class="flex items-center gap-1 font-semibold"><ArrowDownToLine class="size-3.5 text-brand" />{{ s.plan?.downloadSpeed }} <ArrowUpFromLine class="ml-1 size-3.5 text-brand" />{{ s.plan?.uploadSpeed }} <span class="text-xs font-normal text-ink-3">Mbps</span></dd></div>
            <div><dt class="label !mb-1">Price</dt><dd class="font-semibold">{{ money(s.currentPrice ?? s.plan?.price, s.plan?.currency) }}<span class="text-xs font-normal text-ink-3"> / {{ CYCLE_LABEL[s.plan?.billingCycle] }}</span></dd></div>
            <div><dt class="label !mb-1">Next billing</dt><dd class="font-semibold">{{ fmtDate(s.nextBillingDate) }}</dd></div>
            <div><dt class="label !mb-1">Auto-renew</dt><dd class="font-semibold">{{ s.autoRenew ? 'On' : 'Off' }}</dd></div>
            <div v-if="s.staticIp"><dt class="label !mb-1">Static IP</dt><dd class="font-mono font-semibold">{{ s.staticIp }}</dd></div>
            <div v-if="s.activatedAt"><dt class="label !mb-1">Since</dt><dd class="font-semibold">{{ fmtDate(s.activatedAt) }}</dd></div>
            <div v-if="s.compensatedDays"><dt class="label !mb-1">Bonus days</dt><dd class="font-semibold text-ok">+{{ s.compensatedDays }} days</dd></div>
          </dl>

          <div v-if="s.fup" class="rounded-2xl bg-surface-2 p-4"><FupCard :fup="s.fup" /></div>
        </div>
        <footer v-if="renewable(s)" class="flex justify-end border-t border-line bg-surface-2/50 px-5 py-3 sm:px-6">
          <button class="btn-primary btn-sm" @click="renewSub = s"><RefreshCw class="size-4" />Renew</button>
        </footer>
      </article>
    </section>

    <!-- Connection details -->
    <section v-if="pppoe">
      <h2 class="mb-3 text-lg font-semibold">Connection details</h2>
      <div class="card divide-y divide-line">
        <div class="flex items-center gap-4 p-5">
          <div class="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><KeyRound class="size-5" /></div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold">Internet login (PPPoE)</p>
            <p class="text-xs text-ink-3">Enter these in your router's WAN settings if it asks.</p>
          </div>
        </div>
        <div class="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <p class="label">Username</p>
            <div class="flex items-center gap-2"><code class="flex-1 truncate rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm">{{ pppoe.user }}</code>
              <button class="btn-secondary btn-sm !p-2" aria-label="Copy username" @click="copy(pppoe.user, 'u')"><component :is="copied === 'u' ? Check : Copy" class="size-4" /></button></div>
          </div>
          <div>
            <p class="label">Password</p>
            <div class="flex items-center gap-2"><code class="flex-1 truncate rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm">{{ showPass ? pppoe.pass : '•'.repeat(12) }}</code>
              <button class="btn-secondary btn-sm !p-2" :aria-label="showPass ? 'Hide password' : 'Show password'" @click="showPass = !showPass"><component :is="showPass ? EyeOff : Eye" class="size-4" /></button>
              <button class="btn-secondary btn-sm !p-2" aria-label="Copy password" @click="copy(pppoe.pass, 'p')"><component :is="copied === 'p' ? Check : Copy" class="size-4" /></button></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Plans -->
    <section>
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 class="text-lg font-semibold">Available plans</h2><p class="text-sm text-ink-2">Want something faster or cheaper? Switch any time — we credit the unused time on your current plan.</p></div>
        <div v-if="segments.length > 1" class="flex rounded-xl bg-surface-2 p-1 text-sm">
          <button :class="['rounded-lg px-3 py-1.5 font-medium', !segment ? 'bg-surface shadow-sm' : 'text-ink-3']" @click="segment = ''">All</button>
          <button v-for="g in segments" :key="g" :class="['rounded-lg px-3 py-1.5 font-medium', segment === g ? 'bg-surface shadow-sm' : 'text-ink-3']" @click="segment = g">{{ titleCase(g) }}</button>
        </div>
      </div>

      <div v-if="plansLoading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><div v-for="i in 3" :key="i" class="skeleton h-56" /></div>
      <ErrorState v-else-if="plansError" :message="plansError" @retry="$router.go(0)" />
      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article v-for="p in visiblePlans" :key="p.id" :class="['card flex flex-col p-5', currentPlanIds.has(p.id) && 'ring-2 ring-brand']">
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold">{{ p.name }}</h3>
            <span v-if="currentPlanIds.has(p.id)" class="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-ink">Your plan</span>
          </div>
          <p class="mt-3 text-3xl font-bold tracking-tight">{{ money(p.price, p.currency) }}<span class="text-sm font-medium text-ink-3"> / {{ CYCLE_LABEL[p.billingCycle] }}</span></p>
          <ul class="mt-4 flex-1 space-y-2 text-sm text-ink-2">
            <li class="flex items-center gap-2"><Check class="size-4 text-ok" />{{ p.downloadSpeed }} / {{ p.uploadSpeed }} Mbps</li>
            <li class="flex items-center gap-2"><Check class="size-4 text-ok" />{{ p.dataCapGB ? `${p.dataCapGB} GB fair-use allowance` : 'Unlimited data' }}</li>
            <li class="flex items-center gap-2"><Check class="size-4 text-ok" />{{ planTypeLabel(p.type) }} connection</li>
            <li v-if="Number(p.setupFee) > 0" class="flex items-center gap-2"><Check class="size-4 text-ok" />{{ money(p.setupFee, p.currency) }} one-time setup</li>
          </ul>
          <button class="btn-secondary mt-5 w-full" :disabled="currentPlanIds.has(p.id)" @click="requestPlan(p)">{{ currentPlanIds.has(p.id) ? 'Current plan' : activeSub ? 'Switch to this plan' : 'Request this plan' }}</button>
        </article>
      </div>
    </section>

    <section v-if="pastSubs.length">
      <h2 class="mb-3 text-lg font-semibold">Past subscriptions</h2>
      <ul class="card divide-y divide-line">
        <li v-for="s in pastSubs" :key="s.id" class="flex items-center justify-between px-5 py-3.5 text-sm">
          <span><b>{{ s.plan?.name }}</b> <span class="text-ink-3">· {{ s.subscriptionNo }}</span></span><StatusBadge :status="s.status" />
        </li>
      </ul>
    </section>
  </div>

  <RenewModal :open="!!renewSub" :subscription="renewSub" @close="renewSub = null" @topup="(n) => { renewSub = null; emit('topup', n) }" />
  <ChangePlanModal :open="!!changeTarget" :subscription="changeSub" :plan="changeTarget" @close="changeTarget = null" @topup="(n, m) => emit('topup', n, m)" />
  <NewTicketModal :open="!!ticketPreset" :preset="ticketPreset" @close="ticketPreset = null" @created="(t) => router.push(`/support/${t.id}`)" />
</template>
