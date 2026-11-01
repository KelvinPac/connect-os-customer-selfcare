<script setup>
import { computed } from 'vue'
import { titleCase } from '@/utils/format'

const props = defineProps({ status: String })

const TONES = {
  // subscriptions
  ACTIVE: 'ok', GRACE_PERIOD: 'warn', EXPIRED: 'bad', SUSPENDED: 'bad', PENDING: 'info', CANCELLED: 'muted',
  // invoices / payments
  PAID: 'ok', COMPLETED: 'ok', PARTIAL: 'warn', OVERDUE: 'bad', FAILED: 'bad', REVERSED: 'muted', REFUNDED: 'muted', VOID: 'muted', DRAFT: 'muted',
  // tickets
  OPEN: 'info', IN_PROGRESS: 'brand', WAITING_CUSTOMER: 'warn', WAITING_THIRD_PARTY: 'warn', RESOLVED: 'ok', CLOSED: 'muted',
  // wallet
  TOPUP: 'ok', PAYMENT: 'muted', REFUND: 'info', ADJUSTMENT: 'info',
}
const CLS = {
  ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad',
  info: 'bg-info-soft text-info', brand: 'bg-brand-soft text-brand-ink', muted: 'bg-surface-2 text-ink-2',
}
const LABEL = { GRACE_PERIOD: 'Grace period', PENDING: 'Awaiting activation' }

const tone = computed(() => TONES[props.status] ?? 'muted')
const label = computed(() => LABEL[props.status] ?? titleCase(props.status))
</script>

<template>
  <span :class="['inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', CLS[tone]]">
    <span class="size-1.5 rounded-full bg-current" />{{ label }}
  </span>
</template>
