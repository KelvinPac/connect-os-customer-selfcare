<script setup>
import { computed, onMounted, ref } from 'vue'
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, CalendarClock, ChevronRight, Download, FileText, Receipt, Infinity as InfinityIcon, LifeBuoy, Plus, RefreshCw, Router, UserCheck, Wifi } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import SubscriptionAlert from '@/components/SubscriptionAlert.vue'
import FupCard from '@/components/FupCard.vue'
import RenewModal from '@/components/RenewModal.vue'
import NewTicketModal from '@/components/NewTicketModal.vue'
import Spinner from '@/components/Spinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import { useRouter } from 'vue-router'
import { customerApi, invoiceApi } from '@/api'
import { useAuth } from '@/stores/auth'
import { useAccount } from '@/stores/account'
import { useOnu } from '@/stores/onu'
import { useUi } from '@/stores/ui'
import { CYCLE_LABEL, daysUntil, fmtDate, fmtDateTime, methodLabel, money, titleCase } from '@/utils/format'

const emit = defineEmits(['topup'])
const auth = useAuth()
const account = useAccount()
const onu = useOnu()
const ui = useUi()
const router = useRouter()

const tickets = ref([])
const payments = ref([])
const invoices = ref([])
const ticketPreset = ref(null)
const pdfBusy = ref(false)
const sideLoading = ref(true)
const renewing = ref(false)

const sub = computed(() => account.primary)
const plan = computed(() => sub.value?.plan)
const days = computed(() => daysUntil(sub.value?.nextBillingDate))
const openTickets = computed(() => tickets.value.filter((t) => !['CLOSED', 'RESOLVED', 'CANCELLED'].includes(t.status)))

async function loadSide() {
  sideLoading.value = true
  try {
    const [t, p, i] = await Promise.all([customerApi.tickets(auth.customerId), customerApi.payments(auth.customerId), customerApi.invoices(auth.customerId)])
    tickets.value = t
    payments.value = p
    invoices.value = i
  } catch { /* secondary panels degrade silently; main error state covers account */ } finally { sideLoading.value = false }
}
onMounted(() => { account.refresh(); onu.load(); loadSide() })

// Status strip: account (subscription) / internet session (RADIUS) / router (ONU).
const TONE = { ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad', info: 'bg-info-soft text-info', muted: 'bg-surface-2 text-ink-2' }
const ACCOUNT_TONE = { ACTIVE: 'ok', GRACE_PERIOD: 'warn', PENDING: 'info', EXPIRED: 'bad', SUSPENDED: 'bad', CANCELLED: 'muted' }
const accountTile = computed(() => {
  const st = sub.value?.status
  return st ? { label: titleCase(st === 'GRACE_PERIOD' ? 'Grace period' : st), tone: ACCOUNT_TONE[st] ?? 'muted', note: sub.value.plan?.name }
    : { label: 'No plan', tone: 'muted', note: 'No subscription yet' }
})
const internetTile = computed(() => {
  const c = account.customer
  if (!c || c.isOnline == null) return { label: '—', tone: 'muted', note: '' }
  return c.isOnline
    ? { label: 'Online', tone: 'ok', note: c.liveSession?.startTime ? `Since ${fmtDateTime(c.liveSession.startTime)}` : 'Connected' }
    : { label: 'Offline', tone: 'bad', note: c.lastLogoff ? `Last seen ${fmtDateTime(c.lastLogoff)}` : 'Not connected' }
})
const routerTile = computed(() => {
  if (onu.loading && !onu.loaded) return null
  if (!onu.state) return { label: onu.error ? 'Unavailable' : 'Not linked', tone: 'muted', note: onu.error ? 'Could not read router status' : 'No router on this account' }
  const rx = onu.data?.signal?.rx1490Dbm
  return { label: onu.state.label, tone: onu.state.tone, note: [onu.data?.model, typeof rx === 'number' ? `${rx} dBm` : null].filter(Boolean).join(' · ') }
})

const renewable = computed(() => ['ACTIVE', 'GRACE_PERIOD', 'EXPIRED', 'SUSPENDED'].includes(sub.value?.status))

// Personal greeting by local time of day, with a subtitle that reflects how things actually are right now.
const greeting = computed(() => {
  const h = new Date().getHours()
  const part = h < 5 ? 'Hello' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Hello'
  return `${part}, ${auth.firstName}`
})
const today = new Intl.DateTimeFormat('en-KE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
const subtitle = computed(() => {
  if (!account.customer) return today
  const status = sub.value?.status
  if (fault.value) return `${today} · We've spotted a problem with your connection — details below.`
  if (['EXPIRED', 'SUSPENDED'].includes(status)) return `${today} · Your service needs attention to get you back online.`
  if (amountDue.value > 0) return `${today} · You have an invoice waiting for you.`
  if (status === 'GRACE_PERIOD') return `${today} · Top up soon to stay connected.`
  if (status === 'ACTIVE' && onu.state?.tone === 'ok' && account.customer.isOnline !== false) {
    return days.value !== null && days.value >= 0 && days.value <= 3
      ? `${today} · All good — your plan renews ${days.value === 0 ? 'today' : `in ${days.value} day${days.value > 1 ? 's' : ''}`}.`
      : `${today} · Everything is running smoothly.`
  }
  return `${today} · Here's how your connection and account are doing.`
})

// Unpaid invoices: anything with a balance that isn't void/draft/cancelled.
const dueInvoices = computed(() => invoices.value.filter((i) => Number(i.amountDue ?? 0) > 0 && !['VOID', 'DRAFT', 'CANCELLED'].includes(i.status)))
const amountDue = computed(() => dueInvoices.value.reduce((n, i) => n + Number(i.amountDue), 0))
const dueShortfall = computed(() => Math.max(Math.ceil(amountDue.value - account.balance), 0))
const latestInvoice = computed(() => [...invoices.value].sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate))[0] ?? null)

// Fault banner: router in a bad state (LOS / power / offline), or router fine but no internet session.
const fault = computed(() => {
  if (onu.state?.tone === 'bad') return { title: `Router problem: ${onu.state.label}`, text: onu.state.hint, why: `ONU state: ${onu.state.label}` }
  if (onu.state?.tone === 'ok' && account.customer?.isOnline === false && ['ACTIVE', 'GRACE_PERIOD'].includes(sub.value?.status)) {
    return { title: 'Router is online but you have no internet', text: 'Try restarting your router (unplug for 30 seconds). If it stays offline, report it and we\'ll look into it.', why: 'ONU online but no internet session' }
  }
  return null
})
function reportProblem(why) {
  const d = onu.data
  const lines = [
    why && `Detected: ${why}`,
    d?.model && `ONU: ${d.model}${d.sn ? ` (${d.sn})` : ''}`,
    d?.status?.state && `ONU status: ${d.status.state}${d.status.lastChange ? ` since ${d.status.lastChange}` : ''}`,
    d?.signal && `Signal: ${d.signal.quality ?? '—'}, rx ${d.signal.rx1490Dbm ?? '—'} dBm / upstream ${d.signal.rx1310Dbm ?? '—'} dBm`,
    account.customer?.isOnline != null && `Internet session: ${account.customer.isOnline ? 'online' : 'offline'}`,
  ].filter(Boolean)
  ticketPreset.value = why
    ? { category: onu.state?.key === 'power fail' || /power/i.test(why) ? 'HARDWARE' : 'CONNECTIVITY', title: why.replace('ONU state: ', 'Router: '), description: lines.join('\n'), priority: 'HIGH' }
    : { category: 'CONNECTIVITY', title: '', description: lines.join('\n') }
}

async function downloadLatest() {
  const inv = latestInvoice.value
  if (!inv) return
  pdfBusy.value = true
  try {
    const blob = await invoiceApi.pdf(inv.id)
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: `${inv.invoiceNumber}.pdf` })
    document.body.append(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  } catch (e) { ui.error(e.message) } finally { pdfBusy.value = false }
}
</script>

<template>
  <PageHeader :title="greeting" :subtitle="subtitle" />

  <ErrorState v-if="account.error && !account.customer" :message="account.error" @retry="account.refresh()" />

  <div v-else-if="account.loading && !account.customer" class="space-y-4">
    <div class="skeleton h-40" />
    <div class="grid gap-4 md:grid-cols-2"><div class="skeleton h-48" /><div class="skeleton h-48" /></div>
  </div>

  <div v-else class="space-y-6">
    <SubscriptionAlert :subscription="sub" :balance="account.balance" @topup="(n) => emit('topup', n)" @renew="renewing = true" />

    <!-- Fault -->
    <div v-if="fault" class="flex flex-col gap-3 rounded-2xl bg-bad-soft p-4 text-bad sm:flex-row sm:items-center sm:gap-4 sm:p-5" role="alert">
      <AlertTriangle class="size-6 shrink-0" />
      <div class="flex-1"><p class="text-sm font-bold">{{ fault.title }}</p><p class="mt-0.5 text-sm opacity-90">{{ fault.text }}</p></div>
      <button class="btn-primary btn-sm shrink-0" @click="reportProblem(fault.why)">Report a fault</button>
    </div>

    <!-- Amount due -->
    <div v-if="amountDue > 0" class="flex flex-col gap-3 rounded-2xl bg-warn-soft p-4 text-warn sm:flex-row sm:items-center sm:gap-4 sm:p-5" role="alert">
      <Receipt class="size-6 shrink-0" />
      <div class="flex-1">
        <p class="text-sm font-bold">You have {{ money(amountDue, account.currency) }} due</p>
        <p class="mt-0.5 text-sm opacity-90">{{ dueInvoices.length > 1 ? `${dueInvoices.length} unpaid invoices.` : `Invoice ${dueInvoices[0].invoiceNumber}${dueInvoices[0].dueDate ? `, due ${fmtDate(dueInvoices[0].dueDate)}` : ''}.` }}
          {{ dueShortfall > 0 ? `Top up ${money(dueShortfall, account.currency)} to cover it.` : 'Your wallet covers it.' }}</p>
      </div>
      <div class="flex shrink-0 gap-2">
        <RouterLink to="/billing" class="btn-secondary btn-sm">View</RouterLink>
        <button v-if="dueShortfall > 0" class="btn-primary btn-sm" @click="emit('topup', dueShortfall)">Top up</button>
      </div>
    </div>

    <!-- Status strip -->
    <section class="grid gap-3 sm:grid-cols-3">
      <div v-for="t in [
        { key: 'a', title: 'Account', icon: UserCheck, to: '/services', v: accountTile },
        { key: 'i', title: 'Internet', icon: Wifi, to: '/usage', v: internetTile },
        { key: 'r', title: 'Router', icon: Router, to: '/router', v: routerTile },
      ]" :key="t.key">
        <RouterLink :to="t.to" class="card flex items-center gap-4 p-4 transition hover:bg-surface-2/60">
          <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><component :is="t.icon" class="size-5" /></div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold uppercase tracking-wide text-ink-3">{{ t.title }}</p>
            <div v-if="!t.v" class="skeleton mt-1 h-5 w-24" />
            <template v-else>
              <span :class="['mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', TONE[t.v.tone]]"><span class="size-1.5 rounded-full bg-current" />{{ t.v.label }}</span>
              <p v-if="t.v.note" class="mt-1 truncate text-xs text-ink-3">{{ t.v.note }}</p>
            </template>
          </div>
        </RouterLink>
      </div>
    </section>

    <!-- Plan hero -->
    <section v-if="sub" class="relative overflow-hidden rounded-3xl p-6 text-white shadow-card sm:p-8" style="background: linear-gradient(135deg, #3730a3 0%, #5b21b6 60%, #7c3aed 100%)">
      <div class="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl" />
      <div class="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/70"><Wifi class="size-4" />Current plan</p>
          <h2 class="mt-2 text-3xl font-bold tracking-tight">{{ plan?.name }}</h2>
          <p class="mt-1 text-white/75">{{ money(sub.currentPrice ?? plan?.price, plan?.currency) }} / {{ CYCLE_LABEL[plan?.billingCycle] ?? 'month' }}</p>
        </div>
        <span class="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/25">{{ titleCase(sub.status === 'GRACE_PERIOD' ? 'Grace period' : sub.status) }}</span>
      </div>

      <div class="relative mt-7 grid gap-3 sm:grid-cols-3">
        <div class="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
          <p class="flex items-center gap-1.5 text-xs text-white/70"><ArrowDownToLine class="size-3.5" />Download</p>
          <p class="mt-1 text-2xl font-bold">{{ plan?.downloadSpeed }}<span class="ml-1 text-sm font-medium text-white/70">Mbps</span></p>
        </div>
        <div class="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
          <p class="flex items-center gap-1.5 text-xs text-white/70"><ArrowUpFromLine class="size-3.5" />Upload</p>
          <p class="mt-1 text-2xl font-bold">{{ plan?.uploadSpeed }}<span class="ml-1 text-sm font-medium text-white/70">Mbps</span></p>
        </div>
        <div class="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
          <p class="flex items-center gap-1.5 text-xs text-white/70"><CalendarClock class="size-3.5" />{{ sub.status === 'ACTIVE' ? 'Renews' : 'Billing date' }}</p>
          <p class="mt-1 text-lg font-bold">{{ fmtDate(sub.nextBillingDate) }}</p>
          <p v-if="days !== null && sub.status === 'ACTIVE'" class="text-xs text-white/70">{{ days <= 0 ? 'Today' : `in ${days} day${days > 1 ? 's' : ''}` }}</p>
        </div>
      </div>

      <div v-if="renewable" class="relative mt-6 flex flex-wrap gap-3">
        <button class="btn bg-white text-indigo-700 shadow-sm hover:bg-white/90" @click="renewing = true"><RefreshCw class="size-4" />Renew now</button>
        <RouterLink to="/services" class="btn bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20">Manage plan</RouterLink>
      </div>
    </section>

    <EmptyState v-else class="card" :icon="Wifi" title="No internet plan yet" text="You don't have a subscription on this account. Browse our plans, or contact support to get connected.">
      <RouterLink to="/services" class="btn-primary btn-sm">Browse plans</RouterLink>
    </EmptyState>

    <!-- Quick actions -->
    <section class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Quick actions">
      <button class="card flex flex-col items-center gap-2 p-4 text-sm font-medium transition hover:bg-surface-2/60" @click="emit('topup', 0)"><Plus class="size-5 text-brand" />Top up</button>
      <button class="card flex flex-col items-center gap-2 p-4 text-sm font-medium transition hover:bg-surface-2/60 disabled:opacity-50" :disabled="!renewable" @click="renewing = true"><RefreshCw class="size-5 text-brand" />Renew</button>
      <RouterLink :to="{ name: 'router', query: { wifi: 1 } }" class="card flex flex-col items-center gap-2 p-4 text-sm font-medium transition hover:bg-surface-2/60"><Wifi class="size-5 text-brand" />Change Wi-Fi</RouterLink>
      <button class="card flex flex-col items-center gap-2 p-4 text-sm font-medium transition hover:bg-surface-2/60" @click="reportProblem(null)"><LifeBuoy class="size-5 text-brand" />Report a problem</button>
      <button class="card flex flex-col items-center gap-2 p-4 text-sm font-medium transition hover:bg-surface-2/60 disabled:opacity-50" :disabled="!latestInvoice || pdfBusy" @click="downloadLatest"><Spinner v-if="pdfBusy" /><Download v-else class="size-5 text-brand" />Latest invoice</button>
    </section>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Wallet -->
      <section class="card p-5 lg:col-span-1">
        <p class="text-xs font-semibold uppercase tracking-wide text-ink-3">Wallet balance</p>
        <p class="mt-2 text-3xl font-bold tracking-tight tabular-nums">{{ money(account.balance, account.currency) }}</p>
        <p v-if="sub && ['ACTIVE','GRACE_PERIOD','EXPIRED','SUSPENDED'].includes(sub.status)" class="mt-1 text-sm text-ink-2">
          {{ account.balance >= Number(sub.currentPrice ?? plan?.price) ? 'Enough for your next renewal.' : `Next renewal needs ${money(sub.currentPrice ?? plan?.price)}.` }}
        </p>
        <div class="mt-5 flex gap-2">
          <button class="btn-primary flex-1" @click="emit('topup', 0)"><Plus class="size-4" />Top up</button>
          <RouterLink to="/wallet" class="btn-secondary">History</RouterLink>
        </div>
      </section>

      <!-- Allowance -->
      <section class="card p-5 lg:col-span-2">
        <FupCard v-if="sub?.fup" :fup="sub.fup" />
        <div v-else class="flex h-full min-h-32 items-center gap-4">
          <div class="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><InfinityIcon class="size-6" /></div>
          <div>
            <p class="font-semibold text-ink">{{ sub ? 'No data cap' : 'Data allowance' }}</p>
            <p class="mt-0.5 text-sm text-ink-2">{{ sub ? 'Your plan has no fair-use data cap — use as much as you need.' : 'Your allowance shows here once you have a plan.' }}</p>
          </div>
        </div>
      </section>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Tickets -->
      <section class="card">
        <header class="flex items-center justify-between px-5 pt-5">
          <h3 class="font-semibold">Support</h3>
          <RouterLink to="/support" class="text-sm font-medium text-brand hover:underline">View all</RouterLink>
        </header>
        <div v-if="sideLoading" class="space-y-3 p-5"><div class="skeleton h-12" /><div class="skeleton h-12" /></div>
        <EmptyState v-else-if="!tickets.length" :icon="LifeBuoy" title="No tickets" text="Having trouble? Open a request and we'll help." />
        <ul v-else class="divide-y divide-line px-2 pb-2 pt-3">
          <li v-for="t in tickets.slice(0, 4)" :key="t.id">
            <RouterLink :to="`/support/${t.id}`" class="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-surface-2">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{{ t.title }}</p>
                <p class="text-xs text-ink-3">{{ t.ticketNumber }} · {{ fmtDate(t.createdAt) }}</p>
              </div>
              <StatusBadge :status="t.status" /><ChevronRight class="size-4 text-ink-3" />
            </RouterLink>
          </li>
        </ul>
        <p v-if="openTickets.length" class="border-t border-line px-5 py-3 text-xs text-ink-2">{{ openTickets.length }} open request{{ openTickets.length > 1 ? 's' : '' }}</p>
      </section>

      <!-- Payments -->
      <section class="card">
        <header class="flex items-center justify-between px-5 pt-5">
          <h3 class="font-semibold">Recent payments</h3>
          <RouterLink to="/billing" class="text-sm font-medium text-brand hover:underline">Billing</RouterLink>
        </header>
        <div v-if="sideLoading" class="space-y-3 p-5"><div class="skeleton h-12" /><div class="skeleton h-12" /></div>
        <EmptyState v-else-if="!payments.length" :icon="Plus" title="No payments yet" text="Top-ups you make will show up here." />
        <ul v-else class="divide-y divide-line px-2 pb-2 pt-3">
          <li v-for="p in payments.slice(0, 4)" :key="p.id" class="flex items-center gap-3 px-3 py-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium">{{ methodLabel(p.method) }} top-up</p>
              <p class="text-xs text-ink-3">{{ fmtDateTime(p.createdAt) }}</p>
            </div>
            <div class="text-right"><p class="text-sm font-semibold tabular-nums">{{ money(p.amount, p.currency) }}</p><StatusBadge :status="p.status" /></div>
          </li>
        </ul>
      </section>
    </div>
  </div>

  <NewTicketModal :open="!!ticketPreset" :preset="ticketPreset" @close="ticketPreset = null" @created="(t) => router.push(`/support/${t.id}`)" />
  <RenewModal :open="renewing" :subscription="sub" @close="renewing = false" @topup="(n) => { renewing = false; emit('topup', n) }" />
</template>
