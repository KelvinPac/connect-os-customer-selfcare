<script setup>
import { onMounted, ref, watch } from 'vue'
import { Download, FileText, Receipt, Repeat, CreditCard } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import Modal from '@/components/Modal.vue'
import Spinner from '@/components/Spinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import { customerApi, invoiceApi } from '@/api'
import { useAuth } from '@/stores/auth'
import { useUi } from '@/stores/ui'
import { fmtDate, fmtDateTime, methodLabel, money, titleCase } from '@/utils/format'

const auth = useAuth()
const ui = useUi()

const tabs = [
  { key: 'invoices', label: 'Invoices', icon: FileText, fetch: customerApi.invoices },
  { key: 'payments', label: 'Payments', icon: CreditCard, fetch: customerApi.payments },
  { key: 'renewals', label: 'Renewals', icon: Repeat, fetch: customerApi.renewals },
]
const tab = ref('invoices')
const cache = ref({})
const loading = ref(true)
const error = ref('')

const detail = ref(null)
const detailLoading = ref(false)
const pdfBusy = ref('')

async function load() {
  const t = tabs.find((x) => x.key === tab.value)
  if (cache.value[t.key]) return
  loading.value = true
  error.value = ''
  try { cache.value[t.key] = await t.fetch(auth.customerId) } catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(load)
watch(tab, load)

async function openInvoice(id) {
  detail.value = { id }
  detailLoading.value = true
  try { detail.value = await invoiceApi.get(id) } catch (e) { ui.error(e.message); detail.value = null } finally { detailLoading.value = false }
}

// The PDF endpoint needs the bearer token, so fetch as a blob rather than linking to it.
async function downloadPdf(inv) {
  pdfBusy.value = inv.id
  try {
    const blob = await invoiceApi.pdf(inv.id)
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: `${inv.invoiceNumber}.pdf` })
    document.body.append(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  } catch (e) { ui.error(e.message) } finally { pdfBusy.value = '' }
}

const list = () => cache.value[tab.value] ?? []
</script>

<template>
  <PageHeader title="Billing" subtitle="Invoices, payments and renewal history." />

  <div class="mb-5 inline-flex rounded-xl bg-surface-2 p-1 text-sm" role="tablist">
    <button v-for="t in tabs" :key="t.key" role="tab" :aria-selected="tab === t.key" :class="['flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition', tab === t.key ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink']" @click="tab = t.key">
      <component :is="t.icon" class="size-4" /><span>{{ t.label }}</span>
    </button>
  </div>

  <ErrorState v-if="error" :message="error" @retry="load" />
  <div v-else-if="loading" class="card space-y-3 p-5"><div v-for="i in 5" :key="i" class="skeleton h-12" /></div>

  <section v-else class="card overflow-hidden">
    <!-- Invoices -->
    <template v-if="tab === 'invoices'">
      <EmptyState v-if="!list().length" :icon="Receipt" title="No invoices yet" text="An invoice is created each time your plan is activated or renewed." />
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[640px]">
          <thead class="border-b border-line bg-surface-2/60"><tr><th class="th">Invoice</th><th class="th">Issued</th><th class="th">Period</th><th class="th text-right">Total</th><th class="th">Status</th><th class="th" /></tr></thead>
          <tbody class="divide-y divide-line">
            <tr v-for="i in list()" :key="i.id" class="cursor-pointer transition hover:bg-surface-2/60" @click="openInvoice(i.id)">
              <td class="td font-mono text-xs font-medium">{{ i.invoiceNumber }}</td>
              <td class="td text-ink-2">{{ fmtDate(i.issueDate) }}</td>
              <td class="td text-ink-2">{{ i.billingPeriodStart ? `${fmtDate(i.billingPeriodStart)} → ${fmtDate(i.billingPeriodEnd)}` : '—' }}</td>
              <td class="td text-right font-semibold tabular-nums">{{ money(i.total, i.currency) }}</td>
              <td class="td"><StatusBadge :status="i.status" /></td>
              <td class="td text-right"><button class="btn-ghost btn-sm !p-2" aria-label="Download PDF" :disabled="pdfBusy === i.id" @click.stop="downloadPdf(i)"><Spinner v-if="pdfBusy === i.id" /><Download v-else class="size-4" /></button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Payments -->
    <template v-else-if="tab === 'payments'">
      <EmptyState v-if="!list().length" :icon="CreditCard" title="No payments yet" text="Wallet top-ups you make will be listed here." />
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[600px]">
          <thead class="border-b border-line bg-surface-2/60"><tr><th class="th">Reference</th><th class="th">Date</th><th class="th">Method</th><th class="th text-right">Amount</th><th class="th">Status</th></tr></thead>
          <tbody class="divide-y divide-line">
            <tr v-for="p in list()" :key="p.id">
              <td class="td font-mono text-xs"><p class="font-medium">{{ p.paymentNumber }}</p><p v-if="p.mpesaReceiptNo" class="text-ink-3">{{ p.mpesaReceiptNo }}</p></td>
              <td class="td text-ink-2">{{ fmtDateTime(p.paidAt || p.createdAt) }}</td>
              <td class="td text-ink-2">{{ methodLabel(p.method) }}</td>
              <td class="td text-right font-semibold tabular-nums">{{ money(p.amount, p.currency) }}</td>
              <td class="td"><StatusBadge :status="p.status" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Renewals -->
    <template v-else>
      <EmptyState v-if="!list().length" :icon="Repeat" title="No renewals yet" text="Each activation and renewal charge appears here." />
      <ul v-else class="divide-y divide-line">
        <li v-for="r in list()" :key="r.invoiceId" class="flex flex-wrap items-center gap-4 px-5 py-4">
          <div :class="['grid size-10 place-items-center rounded-xl', r.type === 'ACTIVATION' ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-ink-2']"><Repeat class="size-5" /></div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">{{ r.planName }} <span class="text-ink-3">· {{ titleCase(r.type) }}</span></p>
            <p class="text-xs text-ink-3">{{ fmtDate(r.billingPeriodStart) }} → {{ fmtDate(r.billingPeriodEnd) }} · {{ r.invoiceNumber }}</p>
          </div>
          <div class="text-right"><p class="text-sm font-semibold tabular-nums">{{ money(r.amount) }}</p><StatusBadge :status="r.status" /></div>
        </li>
      </ul>
    </template>
  </section>

  <!-- Invoice detail -->
  <Modal :open="!!detail" :title="detail?.invoiceNumber || 'Invoice'" :subtitle="detail?.issueDate ? `Issued ${fmtDate(detail.issueDate)}` : ''" wide @close="detail = null">
    <div v-if="detailLoading || !detail?.items" class="space-y-3"><div class="skeleton h-10" /><div class="skeleton h-32" /></div>
    <div v-else class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge :status="detail.status" />
        <p class="text-sm text-ink-2">Due {{ fmtDate(detail.dueDate) }}<template v-if="detail.paidAt"> · Paid {{ fmtDate(detail.paidAt) }}</template></p>
      </div>
      <div class="overflow-x-auto rounded-xl border border-line">
        <table class="w-full min-w-[420px] text-sm">
          <thead class="bg-surface-2/60"><tr><th class="th">Description</th><th class="th text-right">Qty</th><th class="th text-right">Unit</th><th class="th text-right">Total</th></tr></thead>
          <tbody class="divide-y divide-line">
            <tr v-for="it in detail.items" :key="it.id"><td class="td">{{ it.description }}</td><td class="td text-right tabular-nums">{{ Number(it.quantity) }}</td><td class="td text-right tabular-nums">{{ money(it.unitPrice, detail.currency) }}</td><td class="td text-right font-medium tabular-nums">{{ money(it.total, detail.currency) }}</td></tr>
          </tbody>
        </table>
      </div>
      <dl class="ml-auto w-full max-w-xs space-y-2 text-sm">
        <div class="flex justify-between"><dt class="text-ink-2">Subtotal</dt><dd class="tabular-nums">{{ money(detail.subtotal, detail.currency) }}</dd></div>
        <div v-if="Number(detail.taxAmount) > 0" class="flex justify-between"><dt class="text-ink-2">Tax</dt><dd class="tabular-nums">{{ money(detail.taxAmount, detail.currency) }}</dd></div>
        <div v-if="Number(detail.discountAmount) > 0" class="flex justify-between"><dt class="text-ink-2">Discount</dt><dd class="tabular-nums">−{{ money(detail.discountAmount, detail.currency) }}</dd></div>
        <div class="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>Total</dt><dd class="tabular-nums">{{ money(detail.total, detail.currency) }}</dd></div>
        <div class="flex justify-between text-ok"><dt>Paid</dt><dd class="tabular-nums">{{ money(detail.amountPaid, detail.currency) }}</dd></div>
        <div v-if="Number(detail.amountDue) > 0" class="flex justify-between font-semibold text-bad"><dt>Amount due</dt><dd class="tabular-nums">{{ money(detail.amountDue, detail.currency) }}</dd></div>
      </dl>
    </div>
    <template #footer>
      <button class="btn-secondary" @click="detail = null">Close</button>
      <button v-if="detail?.items" class="btn-primary" :disabled="pdfBusy === detail.id" @click="downloadPdf(detail)"><Spinner v-if="pdfBusy === detail.id" /><Download v-else class="size-4" />Download PDF</button>
    </template>
  </Modal>
</template>
