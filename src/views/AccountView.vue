<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, Lock, LogOut, ShieldCheck, ShieldOff, UserRound, Users } from 'lucide-vue-next'
import PageHeader from '@/components/PageHeader.vue'
import Field from '@/components/Field.vue'
import Modal from '@/components/Modal.vue'
import Spinner from '@/components/Spinner.vue'
import { authApi, customerApi } from '@/api'
import { useAuth } from '@/stores/auth'
import { useAccount } from '@/stores/account'
import { useOnu } from '@/stores/onu'
import { useUi } from '@/stores/ui'
import { fmtDate, titleCase } from '@/utils/format'

const auth = useAuth()
const account = useAccount()
const ui = useUi()
const router = useRouter()

const tabs = [
  { key: 'profile', label: 'Profile', icon: UserRound },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security', icon: Lock },
  { key: 'contacts', label: 'Contacts', icon: Users },
]
const tab = ref('profile')
const c = computed(() => account.customer)

// ── Profile ───────────────────────────────────────────────────────────────────
// Only customer-editable contact/address fields are ever sent. PUT /customers/:id accepts the
// full admin schema, so never spread the customer object into the request.
const profile = reactive({ phone: '', alternatePhone: '', street: '', estate: '', town: '', county: '' })
const prefs = reactive({ notifyEmail: true, notifySms: true, notifyWhatsapp: false })
const saving = ref('')
const errors = ref({})

function hydrate() {
  if (!c.value) return
  Object.assign(profile, { phone: c.value.user?.phone ?? '', alternatePhone: c.value.alternatePhone ?? '', street: c.value.street ?? '', estate: c.value.estate ?? '', town: c.value.town ?? '', county: c.value.county ?? '' })
  Object.assign(prefs, { notifyEmail: c.value.notifyEmail, notifySms: c.value.notifySms, notifyWhatsapp: c.value.notifyWhatsapp })
}
onMounted(async () => { await account.load(); hydrate(); loadContacts() })
watch(c, hydrate)

async function save(kind, body) {
  saving.value = kind
  errors.value = {}
  try {
    await customerApi.update(auth.customerId, body)
    await account.refresh()
    ui.success('Saved.')
  } catch (e) { errors.value = e.fieldErrors ?? {}; ui.error(e.message) } finally { saving.value = '' }
}
const saveProfile = () => save('profile', Object.fromEntries(Object.entries(profile).map(([k, v]) => [k, v.trim()]).filter(([k, v]) => v !== '' || k !== 'phone')))
const savePrefs = () => save('prefs', { ...prefs })

// ── Password ──────────────────────────────────────────────────────────────────
const pw = reactive({ current: '', next: '', confirm: '' })
const pwError = ref('')
async function changePassword() {
  pwError.value = ''
  if (pw.next.length < 8) return (pwError.value = 'New password must be at least 8 characters.')
  if (pw.next !== pw.confirm) return (pwError.value = "Passwords don't match.")
  saving.value = 'pw'
  try {
    await authApi.changePassword(pw.current, pw.next)
    Object.assign(pw, { current: '', next: '', confirm: '' })
    ui.success('Password changed.')
  } catch (e) { pwError.value = e.message } finally { saving.value = '' }
}

// ── 2FA ───────────────────────────────────────────────────────────────────────
const twoFa = reactive({ open: false, qr: '', secret: '', code: '', busy: false, error: '' })
const disabling = ref(false)
async function start2fa() {
  Object.assign(twoFa, { open: true, qr: '', secret: '', code: '', error: '', busy: true })
  try { const r = await authApi.setup2FA(); twoFa.qr = r.qrCode; twoFa.secret = r.secret } catch (e) { twoFa.error = e.message } finally { twoFa.busy = false }
}
async function verify2fa() {
  twoFa.busy = true
  twoFa.error = ''
  try {
    await authApi.verify2FA(twoFa.code.trim())
    await auth.loadMe()
    twoFa.open = false
    ui.success('Two-factor authentication is on.')
  } catch (e) { twoFa.error = e.message } finally { twoFa.busy = false }
}
async function disable2fa() {
  saving.value = '2fa'
  try { await authApi.disable2FA(); await auth.loadMe(); disabling.value = false; ui.success('Two-factor authentication turned off.') } catch (e) { ui.error(e.message) } finally { saving.value = '' }
}

// ── Contacts ──────────────────────────────────────────────────────────────────
// Customers can list and add contacts; removal is admin-only in the API.
const contacts = ref([])
const contact = reactive({ open: false, name: '', phone: '', email: '', relationship: '', busy: false, error: '' })
async function loadContacts() { try { contacts.value = await customerApi.contacts(auth.customerId) } catch { /* shown empty */ } }
async function addContact() {
  contact.error = ''
  if (!contact.name.trim()) return (contact.error = 'Name is required.')
  contact.busy = true
  try {
    await customerApi.addContact(auth.customerId, Object.fromEntries(Object.entries({ name: contact.name, phone: contact.phone, email: contact.email, relationship: contact.relationship }).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)))
    contact.open = false
    Object.assign(contact, { name: '', phone: '', email: '', relationship: '' })
    await loadContacts()
    ui.success('Contact added.')
  } catch (e) { contact.error = e.message } finally { contact.busy = false }
}

async function signOut() { await auth.logout(); account.reset(); useOnu().reset(); router.replace({ name: 'login' }) }
</script>

<template>
  <PageHeader title="Account" subtitle="Your details, notifications and security." />

  <div class="grid gap-6 lg:grid-cols-[220px_1fr]">
    <nav class="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Account sections">
      <button v-for="t in tabs" :key="t.key" :class="['flex items-center gap-3 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition', tab === t.key ? 'bg-brand-soft text-brand-ink' : 'text-ink-2 hover:bg-surface-2']" @click="tab = t.key">
        <component :is="t.icon" class="size-4" />{{ t.label }}
      </button>
      <button class="mt-2 hidden items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-bad hover:bg-bad-soft lg:flex" @click="signOut"><LogOut class="size-4" />Sign out</button>
    </nav>

    <div v-if="!c" class="skeleton h-80" />

    <!-- Profile -->
    <section v-else-if="tab === 'profile'" class="card p-5 sm:p-6">
      <div class="mb-6 flex items-center gap-4">
        <div class="grid size-14 place-items-center rounded-full bg-brand-soft text-lg font-bold text-brand-ink">{{ auth.initials }}</div>
        <div><p class="text-lg font-semibold">{{ auth.name }}</p><p class="text-sm text-ink-2">{{ c.customerNumber }} · {{ titleCase(c.segment) }} · Customer since {{ fmtDate(c.createdAt) }}</p></div>
      </div>
      <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="saveProfile">
        <Field label="Email" for="p-email" hint="Contact support to change your login email."><input id="p-email" class="input" :value="c.user?.email" disabled /></Field>
        <Field label="Phone" for="p-phone" :error="errors.phone"><input id="p-phone" v-model="profile.phone" class="input" inputmode="tel" /></Field>
        <Field label="Alternate phone" for="p-alt" :error="errors.alternatePhone"><input id="p-alt" v-model="profile.alternatePhone" class="input" inputmode="tel" /></Field>
        <Field label="Service zone" for="p-zone"><input id="p-zone" class="input" :value="[c.zone?.name, c.zone?.location?.name].filter(Boolean).join(' · ')" disabled /></Field>
        <Field label="Street" for="p-street"><input id="p-street" v-model="profile.street" class="input" /></Field>
        <Field label="Estate" for="p-estate"><input id="p-estate" v-model="profile.estate" class="input" /></Field>
        <Field label="Town" for="p-town"><input id="p-town" v-model="profile.town" class="input" /></Field>
        <Field label="County" for="p-county"><input id="p-county" v-model="profile.county" class="input" /></Field>
        <div class="flex justify-end sm:col-span-2"><button class="btn-primary" :disabled="saving === 'profile'"><Spinner v-if="saving === 'profile'" />Save changes</button></div>
      </form>
    </section>

    <!-- Notifications -->
    <section v-else-if="tab === 'notifications'" class="card p-5 sm:p-6">
      <h2 class="font-semibold">How should we reach you?</h2>
      <p class="mt-1 text-sm text-ink-2">Renewal reminders, receipts and ticket updates are sent on the channels you choose.</p>
      <ul class="mt-5 divide-y divide-line">
        <li v-for="o in [{ k: 'notifySms', l: 'SMS', d: 'Text messages to your phone' }, { k: 'notifyEmail', l: 'Email', d: 'Receipts and account notices' }, { k: 'notifyWhatsapp', l: 'WhatsApp', d: 'Messages on WhatsApp' }]" :key="o.k" class="flex items-center justify-between gap-4 py-4">
          <div><p class="text-sm font-medium">{{ o.l }}</p><p class="text-xs text-ink-3">{{ o.d }}</p></div>
          <button type="button" role="switch" :aria-checked="prefs[o.k]" :aria-label="o.l" :class="['relative h-6 w-11 shrink-0 rounded-full transition', prefs[o.k] ? 'bg-brand' : 'bg-line']" @click="prefs[o.k] = !prefs[o.k]">
            <span :class="['absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', prefs[o.k] ? 'left-[22px]' : 'left-0.5']" />
          </button>
        </li>
      </ul>
      <div class="mt-4 flex justify-end"><button class="btn-primary" :disabled="saving === 'prefs'" @click="savePrefs"><Spinner v-if="saving === 'prefs'" />Save preferences</button></div>
    </section>

    <!-- Security -->
    <div v-else-if="tab === 'security'" class="space-y-6">
      <section class="card p-5 sm:p-6">
        <h2 class="font-semibold">Change password</h2>
        <form class="mt-4 grid max-w-md gap-4" @submit.prevent="changePassword">
          <p v-if="pwError" class="rounded-xl bg-bad-soft px-3.5 py-3 text-sm text-bad" role="alert">{{ pwError }}</p>
          <Field label="Current password" for="pw-c"><input id="pw-c" v-model="pw.current" type="password" class="input" autocomplete="current-password" required /></Field>
          <Field label="New password" for="pw-n" hint="At least 8 characters."><input id="pw-n" v-model="pw.next" type="password" class="input" autocomplete="new-password" required /></Field>
          <Field label="Confirm new password" for="pw-f"><input id="pw-f" v-model="pw.confirm" type="password" class="input" autocomplete="new-password" required /></Field>
          <div><button class="btn-primary" :disabled="saving === 'pw'"><Spinner v-if="saving === 'pw'" />Update password</button></div>
        </form>
      </section>

      <section class="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div class="flex items-center gap-4">
          <div :class="['grid size-11 place-items-center rounded-xl', auth.user.twoFactorEnabled ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-ink-3']"><component :is="auth.user.twoFactorEnabled ? ShieldCheck : ShieldOff" class="size-5" /></div>
          <div><h2 class="font-semibold">Two-factor authentication</h2><p class="text-sm text-ink-2">{{ auth.user.twoFactorEnabled ? 'On — a code from your authenticator app is needed to sign in.' : 'Add a second step with an authenticator app for extra protection.' }}</p></div>
        </div>
        <button v-if="!auth.user.twoFactorEnabled" class="btn-primary" @click="start2fa">Set up</button>
        <button v-else class="btn-danger" @click="disabling = true">Turn off</button>
      </section>
    </div>

    <!-- Contacts -->
    <section v-else class="card overflow-hidden">
      <header class="flex items-center justify-between border-b border-line px-5 py-4"><h2 class="font-semibold">Additional contacts</h2><button class="btn-secondary btn-sm" @click="contact.open = true">Add contact</button></header>
      <p v-if="!contacts.length" class="px-5 py-10 text-center text-sm text-ink-2">No extra contacts. Add someone we can reach if you're unavailable.</p>
      <ul v-else class="divide-y divide-line">
        <li v-for="p in contacts" :key="p.id" class="flex items-center gap-4 px-5 py-4">
          <div class="grid size-10 place-items-center rounded-full bg-surface-2 text-sm font-semibold text-ink-2">{{ p.name?.[0]?.toUpperCase() }}</div>
          <div class="min-w-0 flex-1"><p class="text-sm font-medium">{{ p.name }}<span v-if="p.isPrimary" class="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-ink">Primary</span></p><p class="truncate text-xs text-ink-3">{{ [p.relationship, p.phone, p.email].filter(Boolean).join(' · ') }}</p></div>
        </li>
      </ul>
    </section>
  </div>

  <!-- 2FA setup -->
  <Modal :open="twoFa.open" title="Set up two-factor authentication" subtitle="Scan with Google Authenticator, Authy or similar." @close="twoFa.open = false">
    <div v-if="twoFa.busy && !twoFa.qr" class="skeleton mx-auto size-48" />
    <div v-else class="space-y-4">
      <p v-if="twoFa.error" class="rounded-xl bg-bad-soft px-3.5 py-3 text-sm text-bad" role="alert">{{ twoFa.error }}</p>
      <template v-if="twoFa.qr">
        <img :src="twoFa.qr" alt="Two-factor QR code" class="mx-auto size-48 rounded-xl bg-white p-2" />
        <p class="text-center text-xs text-ink-3">Can't scan? Enter this key: <code class="select-all font-mono text-ink">{{ twoFa.secret }}</code></p>
        <Field label="6-digit code" for="tf-code"><input id="tf-code" v-model="twoFa.code" class="input text-center font-mono text-lg tracking-[0.4em]" inputmode="numeric" maxlength="6" placeholder="000000" @keydown.enter.prevent="verify2fa" /></Field>
      </template>
    </div>
    <template #footer>
      <button class="btn-secondary" @click="twoFa.open = false">Cancel</button>
      <button class="btn-primary" :disabled="twoFa.code.length !== 6 || twoFa.busy" @click="verify2fa"><Spinner v-if="twoFa.busy" />Turn on</button>
    </template>
  </Modal>

  <Modal :open="disabling" title="Turn off two-factor?" subtitle="Your account will be protected by your password only." @close="disabling = false">
    <p class="text-sm text-ink-2">You can set it up again at any time.</p>
    <template #footer>
      <button class="btn-secondary" @click="disabling = false">Keep it on</button>
      <button class="btn-danger" :disabled="saving === '2fa'" @click="disable2fa"><Spinner v-if="saving === '2fa'" />Turn off</button>
    </template>
  </Modal>

  <Modal :open="contact.open" title="Add a contact" @close="contact.open = false">
    <form class="space-y-4" @submit.prevent="addContact">
      <p v-if="contact.error" class="rounded-xl bg-bad-soft px-3.5 py-3 text-sm text-bad">{{ contact.error }}</p>
      <Field label="Name" for="ct-n"><input id="ct-n" v-model="contact.name" class="input" required /></Field>
      <Field label="Relationship" for="ct-r"><input id="ct-r" v-model="contact.relationship" class="input" placeholder="e.g. Spouse" /></Field>
      <Field label="Phone" for="ct-p"><input id="ct-p" v-model="contact.phone" class="input" inputmode="tel" /></Field>
      <Field label="Email" for="ct-e"><input id="ct-e" v-model="contact.email" type="email" class="input" /></Field>
    </form>
    <template #footer>
      <button class="btn-secondary" @click="contact.open = false">Cancel</button>
      <button class="btn-primary" :disabled="contact.busy" @click="addContact"><Spinner v-if="contact.busy" />Add contact</button>
    </template>
  </Modal>
</template>
