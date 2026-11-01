<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowDownLeft, ArrowUpRight, Plus, RotateCcw, SlidersHorizontal, Wallet } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import Pagination from '@/components/Pagination.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import { customerApi } from '@/api'
import { useAuth } from '@/stores/auth'
import { useAccount } from '@/stores/account'
import { fmtDateTime, methodLabel, money, titleCase } from '@/utils/format'

const emit = defineEmits(['topup'])
const auth = useAuth()
const account = useAccount()

const rows = ref([])
const meta = ref(null)
const page = ref(1)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { wallet, meta: m } = await customerApi.wallet(auth.customerId, page.value, 15)
    rows.value = wallet.transactions
    meta.value = m
    account.wallet = { ...account.wallet, balance: wallet.balance, currency: wallet.currency }
  } catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(load)
watch(page, load)
// A completed top-up refreshes the account store; reload the ledger so the new credit shows.
watch(() => account.loadedAt, () => { if (page.value === 1) load() })

const kind = {
  TOPUP: { icon: ArrowDownLeft, cls: 'bg-ok-soft text-ok', sign: '+' },
  PAYMENT: { icon: ArrowUpRight, cls: 'bg-surface-2 text-ink-2', sign: '−' },
  REFUND: { icon: RotateCcw, cls: 'bg-info-soft text-info', sign: '+' },
  ADJUSTMENT: { icon: SlidersHorizontal, cls: 'bg-info-soft text-info', sign: '' },
}
const describe = (t) => t.description || (t.payment ? `${methodLabel(t.payment.method)} top-up` : titleCase(t.type))
const reference = (t) => t.payment?.mpesaReceiptNo || t.payment?.paymentNumber || t.payment?.bankReference || ''
const lifetimeIn = computed(() => rows.value.filter((r) => r.type === 'TOPUP').reduce((a, r) => a + Number(r.amount), 0))
</script>

<template>
  <PageHeader title="Wallet" subtitle="Your balance pays for renewals automatically.">
    <button class="btn-primary" @click="emit('topup', 0)"><Plus class="size-4" />Top up</button>
  </PageHeader>

  <section class="relative mb-6 overflow-hidden rounded-3xl p-6 text-white shadow-card sm:p-8" style="background: linear-gradient(135deg, #0f172a 0%, #312e81 100%)">
    <div class="pointer-events-none absolute -right-10 -top-10 size-56 rounded-full bg-violet-500/30 blur-3xl" />
    <p class="relative flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/60"><Wallet class="size-4" />Available balance</p>
    <p class="relative mt-3 text-5xl font-bold tracking-tight tabular-nums">{{ money(account.balance, account.currency) }}</p>
    <p class="relative mt-2 text-sm text-white/60">Account no. <span class="font-mono text-white/90">{{ account.customer?.customerNumber }}</span> — use it as the account number when paying via Paybill.</p>
  </section>

  <ErrorState v-if="error" :message="error" @retry="load" />

  <section v-else class="card overflow-hidden">
    <header class="flex items-center justify-between border-b border-line px-5 py-4"><h2 class="font-semibold">Transactions</h2><span v-if="meta" class="text-xs text-ink-3">{{ meta.total }} total</span></header>

    <div v-if="loading" class="space-y-px p-2"><div v-for="i in 6" :key="i" class="skeleton m-3 h-12" /></div>
    <EmptyState v-else-if="!rows.length" :icon="Wallet" title="No transactions yet" text="Top up your wallet and your history will show up here." />
    <ul v-else class="divide-y divide-line">
      <li v-for="t in rows" :key="t.id" class="flex items-center gap-4 px-5 py-4">
        <div :class="['grid size-10 shrink-0 place-items-center rounded-xl', (kind[t.type] ?? kind.ADJUSTMENT).cls]"><component :is="(kind[t.type] ?? kind.ADJUSTMENT).icon" class="size-5" /></div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ describe(t) }}</p>
          <p class="text-xs text-ink-3">{{ fmtDateTime(t.createdAt) }}<template v-if="reference(t)"> · <span class="font-mono">{{ reference(t) }}</span></template></p>
        </div>
        <div class="text-right">
          <p :class="['text-sm font-semibold tabular-nums', t.type === 'TOPUP' || t.type === 'REFUND' ? 'text-ok' : 'text-ink']">{{ (kind[t.type] ?? kind.ADJUSTMENT).sign }}{{ money(t.amount, account.currency) }}</p>
          <p class="text-xs text-ink-3 tabular-nums">Bal. {{ money(t.balanceAfter, account.currency) }}</p>
        </div>
      </li>
    </ul>
    <Pagination :meta="meta" @page="(p) => (page = p)" />
  </section>
</template>
