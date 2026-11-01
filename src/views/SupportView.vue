<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight, LifeBuoy, MessageSquare, Plus, Star } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import NewTicketModal from '@/components/NewTicketModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import ErrorState from '@/components/ErrorState.vue'
import { customerApi } from '@/api'
import { useAuth } from '@/stores/auth'
import { fmtDate, titleCase } from '@/utils/format'

const auth = useAuth()
const router = useRouter()
const tickets = ref([])
const loading = ref(true)
const error = ref('')
const creating = ref(false)
const filter = ref('open')

async function load() {
  loading.value = true
  error.value = ''
  try { tickets.value = await customerApi.tickets(auth.customerId) } catch (e) { error.value = e.message } finally { loading.value = false }
}
onMounted(load)

const isOpen = (t) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status)
const shown = computed(() => tickets.value.filter((t) => (filter.value === 'open' ? isOpen(t) : filter.value === 'closed' ? !isOpen(t) : true)))
const count = (f) => tickets.value.filter((t) => (f === 'open' ? isOpen(t) : f === 'closed' ? !isOpen(t) : true)).length
</script>

<template>
  <PageHeader title="Support" subtitle="Track your requests or ask us for help.">
    <button class="btn-primary" @click="creating = true"><Plus class="size-4" />New request</button>
  </PageHeader>

  <div class="mb-5 inline-flex rounded-xl bg-surface-2 p-1 text-sm">
    <button v-for="f in ['open', 'closed', 'all']" :key="f" :class="['rounded-lg px-4 py-2 font-medium capitalize transition', filter === f ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink']" @click="filter = f">
      {{ f }} <span class="ml-1 text-xs text-ink-3">{{ count(f) }}</span>
    </button>
  </div>

  <ErrorState v-if="error" :message="error" @retry="load" />
  <div v-else-if="loading" class="card space-y-3 p-5"><div v-for="i in 4" :key="i" class="skeleton h-16" /></div>

  <section v-else class="card overflow-hidden">
    <EmptyState v-if="!shown.length" :icon="LifeBuoy" :title="filter === 'open' ? 'No open requests' : 'Nothing here'" text="If something isn't working, open a request and we'll look into it.">
      <button class="btn-primary btn-sm" @click="creating = true"><Plus class="size-4" />New request</button>
    </EmptyState>
    <ul v-else class="divide-y divide-line">
      <li v-for="t in shown" :key="t.id">
        <RouterLink :to="`/support/${t.id}`" class="flex items-center gap-4 px-5 py-4 transition hover:bg-surface-2/60">
          <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><LifeBuoy class="size-5" /></div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{{ t.title }}</p>
            <p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
              <span class="font-mono">{{ t.ticketNumber }}</span><span>· {{ titleCase(t.category) }}</span><span>· {{ fmtDate(t.createdAt) }}</span>
              <span v-if="t._count?.comments" class="inline-flex items-center gap-1"><MessageSquare class="size-3" />{{ t._count.comments }}</span>
              <span v-if="t.rating" class="inline-flex items-center gap-0.5 text-warn"><Star class="size-3 fill-current" />{{ t.rating }}</span>
            </p>
          </div>
          <StatusBadge :status="t.status" /><ChevronRight class="size-4 shrink-0 text-ink-3" />
        </RouterLink>
      </li>
    </ul>
  </section>

  <NewTicketModal :open="creating" @close="creating = false" @created="(t) => router.push(`/support/${t.id}`)" />
</template>
