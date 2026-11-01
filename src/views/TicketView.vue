<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, CheckCheck, Send, Star, XCircle, Sparkles } from 'lucide-vue-next'
import StatusBadge from '@/components/StatusBadge.vue'
import Modal from '@/components/Modal.vue'
import Spinner from '@/components/Spinner.vue'
import ErrorState from '@/components/ErrorState.vue'
import { ticketApi } from '@/api'
import { useAuth } from '@/stores/auth'
import { useUi } from '@/stores/ui'
import { fmtDateTime, titleCase } from '@/utils/format'

const route = useRoute()
const auth = useAuth()
const ui = useUi()

const ticket = ref(null)
const loading = ref(true)
const error = ref('')
const reply = ref('')
const sending = ref(false)
const confirm = ref(null) // 'resolve' | 'close'
const note = ref('')
const acting = ref(false)
const thread = ref(null)

const rating = ref({ open: false, stars: 0, hover: 0, comment: '', improve: '', recommend: null, busy: false })

async function load(silent = false) {
  if (!silent) loading.value = true
  error.value = ''
  try {
    ticket.value = await ticketApi.get(route.params.id)
    await nextTick()
    thread.value?.scrollTo({ top: thread.value.scrollHeight })
  } catch (e) { error.value = e.status === 403 ? 'This request belongs to another account.' : e.status === 404 ? 'We couldn\'t find that request.' : e.message } finally { loading.value = false }
}
onMounted(() => load())

const t = computed(() => ticket.value)
const isClosed = computed(() => ['CLOSED', 'CANCELLED'].includes(t.value?.status))
const isResolved = computed(() => t.value?.status === 'RESOLVED')
const canRate = computed(() => (isResolved.value || t.value?.status === 'CLOSED') && !t.value?.rating)
const statusEvents = computed(() => (t.value?.history ?? []).filter((h) => h.field === 'status').slice().reverse())
const mine = (c) => c.authorId === auth.user?.id

async function send() {
  const body = reply.value.trim()
  if (!body) return
  sending.value = true
  try { await ticketApi.comment(t.value.id, body); reply.value = ''; await load(true) } catch (e) { ui.error(e.message) } finally { sending.value = false }
}

async function act() {
  acting.value = true
  try {
    if (confirm.value === 'resolve') await ticketApi.resolve(t.value.id, note.value.trim())
    else await ticketApi.close(t.value.id, note.value.trim())
    ui.success(confirm.value === 'resolve' ? 'Marked as resolved.' : 'Request closed.')
    confirm.value = null
    note.value = ''
    await load(true)
    if (canRate.value) rating.value.open = true
  } catch (e) { ui.error(e.message) } finally { acting.value = false }
}

async function submitRating() {
  const r = rating.value
  if (!r.stars) return
  r.busy = true
  try {
    await ticketApi.rate(t.value.id, {
      rating: r.stars,
      ...(r.comment.trim() && { ratingComment: r.comment.trim() }),
      ...(r.improve.trim() && { improvementFeedback: r.improve.trim() }),
      ...(r.recommend !== null && { wouldRecommend: r.recommend }),
    })
    ui.success('Thanks for your feedback!')
    r.open = false
    await load(true)
  } catch (e) { ui.error(e.message) } finally { r.busy = false }
}
const starLabels = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']
</script>

<template>
  <RouterLink to="/support" class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink"><ArrowLeft class="size-4" />All requests</RouterLink>

  <ErrorState v-if="error" :message="error" @retry="load()" />
  <div v-else-if="loading" class="space-y-4"><div class="skeleton h-24" /><div class="skeleton h-80" /></div>

  <div v-else-if="t" class="grid gap-6 lg:grid-cols-[1fr_300px]">
    <div class="min-w-0 space-y-4">
      <header class="card p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-mono text-xs text-ink-3">{{ t.ticketNumber }}</p>
            <h1 class="mt-1 text-xl font-bold tracking-tight">{{ t.title }}</h1>
          </div>
          <StatusBadge :status="t.status" />
        </div>
        <p class="mt-3 whitespace-pre-line text-sm text-ink-2">{{ t.description }}</p>
      </header>

      <section class="card flex flex-col">
        <h2 class="border-b border-line px-5 py-3.5 text-sm font-semibold">Conversation</h2>
        <div ref="thread" class="max-h-[28rem] space-y-4 overflow-y-auto px-5 py-5">
          <p v-if="!t.comments?.length" class="py-6 text-center text-sm text-ink-3">No messages yet. Our team will reply here.</p>
          <template v-for="c in t.comments" :key="c.id">
            <p v-if="c.isSystem" class="mx-auto max-w-md rounded-full bg-surface-2 px-4 py-1.5 text-center text-xs italic text-ink-2">{{ c.body }}</p>
            <div v-else :class="['flex', mine(c) ? 'justify-end' : 'justify-start']">
              <div :class="['max-w-[85%] rounded-2xl px-4 py-3 text-sm', mine(c) ? 'bubble-me rounded-br-md' : 'rounded-bl-md bg-surface-2 text-ink']">
                <p v-if="!mine(c)" class="mb-1 text-xs font-semibold text-brand">{{ c.authorName || 'Support' }}</p>
                <p class="whitespace-pre-line">{{ c.body }}</p>
                <p :class="['mt-1.5 text-[11px]', mine(c) ? 'opacity-70' : 'text-ink-3']">{{ fmtDateTime(c.createdAt) }}</p>
              </div>
            </div>
          </template>
        </div>
        <form v-if="!isClosed" class="flex items-end gap-2 border-t border-line p-3" @submit.prevent="send">
          <textarea v-model="reply" rows="1" class="input max-h-32 min-h-[2.75rem] flex-1 resize-none" placeholder="Write a reply…" aria-label="Reply" @keydown.enter.exact.prevent="send" />
          <button class="btn-primary !p-3" :disabled="!reply.trim() || sending" aria-label="Send"><Spinner v-if="sending" /><Send v-else class="size-4" /></button>
        </form>
        <p v-else class="border-t border-line px-5 py-4 text-center text-sm text-ink-2">This request is closed. <RouterLink to="/support" class="font-medium text-brand hover:underline">Open a new one</RouterLink> if you still need help.</p>
      </section>
    </div>

    <aside class="space-y-4">
      <section v-if="!isClosed" class="card space-y-2 p-5">
        <h2 class="text-sm font-semibold">Actions</h2>
        <button v-if="!isResolved" class="btn-secondary w-full justify-start" @click="confirm = 'resolve'"><CheckCheck class="size-4 text-ok" />Mark as resolved</button>
        <button class="btn-secondary w-full justify-start" @click="confirm = 'close'"><XCircle class="size-4 text-ink-3" />Close request</button>
      </section>

      <section v-if="canRate" class="card bg-brand-soft p-5">
        <p class="flex items-center gap-2 text-sm font-semibold text-brand-ink"><Sparkles class="size-4" />How did we do?</p>
        <p class="mt-1 text-sm text-ink-2">Rate the support you received.</p>
        <button class="btn-primary btn-sm mt-3" @click="rating.open = true">Leave feedback</button>
      </section>
      <section v-else-if="t.rating" class="card p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-ink-3">Your rating</p>
        <p class="mt-2 flex gap-0.5 text-warn"><Star v-for="n in 5" :key="n" :class="['size-5', n <= t.rating && 'fill-current']" /></p>
        <p v-if="t.ratingComment" class="mt-2 text-sm text-ink-2">"{{ t.ratingComment }}"</p>
      </section>

      <section class="card p-5">
        <h2 class="text-sm font-semibold">Details</h2>
        <dl class="mt-3 space-y-3 text-sm">
          <div class="flex justify-between gap-3"><dt class="text-ink-3">Category</dt><dd class="text-right font-medium">{{ titleCase(t.category) }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-ink-3">Priority</dt><dd class="font-medium">{{ titleCase(t.priority) }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-ink-3">Opened</dt><dd class="text-right font-medium">{{ fmtDateTime(t.createdAt) }}</dd></div>
          <div v-if="t.assignedTo" class="flex justify-between gap-3"><dt class="text-ink-3">Handled by</dt><dd class="font-medium">{{ t.assignedTo.firstName }} {{ t.assignedTo.lastName }}</dd></div>
          <div v-if="t.resolvedAt" class="flex justify-between gap-3"><dt class="text-ink-3">Resolved</dt><dd class="text-right font-medium">{{ fmtDateTime(t.resolvedAt) }}</dd></div>
        </dl>
      </section>

      <section v-if="statusEvents.length" class="card p-5">
        <h2 class="text-sm font-semibold">Progress</h2>
        <ol class="relative mt-4 space-y-4 border-l border-line pl-5">
          <li v-for="(h, i) in statusEvents" :key="i" class="relative">
            <span class="absolute -left-[25px] top-1 size-2.5 rounded-full bg-brand ring-4 ring-surface" />
            <p class="text-sm font-medium">{{ titleCase(h.newValue) }}</p><p class="text-xs text-ink-3">{{ fmtDateTime(h.createdAt) }}</p>
          </li>
        </ol>
      </section>
    </aside>
  </div>

  <!-- Resolve / close -->
  <Modal :open="!!confirm" :title="confirm === 'resolve' ? 'Mark as resolved?' : 'Close this request?'" :subtitle="confirm === 'resolve' ? 'Let us know the problem is sorted.' : 'You won\'t be able to reply after closing.'" @close="confirm = null">
    <label class="label" for="act-note">Note (optional)</label>
    <textarea id="act-note" v-model="note" class="input min-h-24 resize-y" placeholder="Anything we should know?" />
    <template #footer>
      <button class="btn-secondary" @click="confirm = null">Cancel</button>
      <button class="btn-primary" :disabled="acting" @click="act"><Spinner v-if="acting" />{{ confirm === 'resolve' ? 'Mark resolved' : 'Close request' }}</button>
    </template>
  </Modal>

  <!-- Rating -->
  <Modal :open="rating.open" title="How was our support?" subtitle="Your feedback helps us improve." @close="rating.open = false">
    <div class="space-y-5">
      <div class="text-center">
        <div class="inline-flex gap-1" role="radiogroup" aria-label="Rating">
          <button v-for="n in 5" :key="n" type="button" role="radio" :aria-checked="rating.stars === n" :aria-label="`${n} star${n > 1 ? 's' : ''}`" class="rounded-lg p-1 transition hover:scale-110" @mouseenter="rating.hover = n" @mouseleave="rating.hover = 0" @click="rating.stars = n">
            <Star :class="['size-9 transition', n <= (rating.hover || rating.stars) ? 'fill-warn text-warn' : 'text-line']" />
          </button>
        </div>
        <p class="mt-1 h-5 text-sm font-medium text-ink-2">{{ starLabels[rating.hover || rating.stars] }}</p>
      </div>
      <div><label class="label" for="r-c">Comments</label><textarea id="r-c" v-model="rating.comment" class="input min-h-20 resize-y" placeholder="What went well?" /></div>
      <div><label class="label" for="r-i">How can we improve?</label><textarea id="r-i" v-model="rating.improve" class="input min-h-20 resize-y" /></div>
      <div>
        <p class="label">Would you recommend us?</p>
        <div class="flex gap-2"><button v-for="o in [{ v: true, l: 'Yes' }, { v: false, l: 'No' }]" :key="o.l" type="button" :class="['btn-secondary flex-1', rating.recommend === o.v && '!border-brand !bg-brand-soft !text-brand-ink']" @click="rating.recommend = o.v">{{ o.l }}</button></div>
      </div>
    </div>
    <template #footer>
      <button class="btn-secondary" @click="rating.open = false">Not now</button>
      <button class="btn-primary" :disabled="!rating.stars || rating.busy" @click="submitRating"><Spinner v-if="rating.busy" />Submit</button>
    </template>
  </Modal>
</template>
