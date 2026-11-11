<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  LayoutDashboard, Wifi, Router, Wallet, Receipt, Activity, LifeBuoy, UserRound, LogOut, Sun, Moon, MonitorSmartphone, Plus,
} from 'lucide-vue-next'
import { useAuth } from '@/stores/auth'
import { useBranding } from '@/stores/branding'
import { useAccount } from '@/stores/account'
import { useOnu } from '@/stores/onu'
import { useUi } from '@/stores/ui'
import { money } from '@/utils/format'
import TopUpModal from '@/components/TopUpModal.vue'
import InstallPrompt from '@/components/InstallPrompt.vue'

const auth = useAuth()
const account = useAccount()
const ui = useUi()
const route = useRoute()
const router = useRouter()

const nav = [
  { to: '/', name: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/services', name: 'services', label: 'My internet', icon: Wifi },
  { to: '/router', name: 'router', label: 'Router & Wi-Fi', icon: Router },
  { to: '/wallet', name: 'wallet', label: 'Wallet', icon: Wallet },
  { to: '/billing', name: 'billing', label: 'Billing', icon: Receipt },
  { to: '/usage', name: 'usage', label: 'Usage', icon: Activity },
  { to: '/support', name: 'support', label: 'Support', icon: LifeBuoy },
  { to: '/account', name: 'account', label: 'Account', icon: UserRound },
]
// Bottom bar can't fit seven; keep the five most used and tuck the rest under Account/Overview.
const mobileNav = nav.filter((n) => ['dashboard', 'services', 'wallet', 'support', 'account'].includes(n.name))

const isActive = (n) => (n.name === 'dashboard' ? route.name === 'dashboard' : String(route.name).startsWith(n.name) || (n.name === 'support' && route.name === 'ticket'))

const topUp = ref(false)
const suggested = ref(0)
const topUpMode = ref('stk')
const openTopUp = (amount = 0, mode = 'stk') => { suggested.value = Number(amount) || 0; topUpMode.value = mode === 'paybill' ? 'paybill' : 'stk'; topUp.value = true }
const menu = ref(false)
const themes = [
  { v: 'light', icon: Sun, label: 'Light' },
  { v: 'dark', icon: Moon, label: 'Dark' },
  { v: 'system', icon: MonitorSmartphone, label: 'System' },
]

onMounted(() => account.load())

async function signOut() {
  await auth.logout()
  account.reset()
  useOnu().reset()
  router.replace({ name: 'login' })
}
const branding = useBranding()
const customerNumber = computed(() => account.customer?.customerNumber ?? auth.user?.customer?.customerNumber)
</script>

<template>
  <div class="min-h-dvh lg:pl-64">
    <!-- Sidebar (desktop) -->
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
      <div class="flex h-16 items-center gap-3 px-6">
        <img :src="branding.logoSrc" class="size-8 object-contain" alt="" @error="branding.logoBroken = true" />
        <div class="leading-tight"><p class="text-sm font-bold text-ink">{{ branding.appName }}</p><p class="text-[11px] text-ink-3">Customer portal</p></div>
      </div>
      <nav class="flex-1 space-y-1 px-3 py-4" aria-label="Main">
        <RouterLink
          v-for="n in nav" :key="n.name" :to="n.to"
          :class="['group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
            isActive(n) ? 'bg-brand-soft text-brand-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink']"
        >
          <component :is="n.icon" class="size-[18px]" />{{ n.label }}
        </RouterLink>
      </nav>
      <div class="border-t border-line p-3">
        <div class="mb-2 flex rounded-xl bg-surface-2 p-1" role="group" aria-label="Theme">
          <button
            v-for="t in themes" :key="t.v" :title="t.label" :aria-label="t.label + ' theme'"
            :class="['flex flex-1 items-center justify-center rounded-lg py-1.5 transition', ui.theme === t.v ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink']"
            @click="ui.setTheme(t.v)"
          ><component :is="t.icon" class="size-4" /></button>
        </div>
        <div class="flex items-center gap-3 rounded-xl px-2 py-2">
          <div class="grid size-9 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-ink">{{ auth.initials }}</div>
          <div class="min-w-0 flex-1 leading-tight"><p class="truncate text-sm font-semibold text-ink">{{ auth.name }}</p><p class="truncate text-xs text-ink-3">{{ customerNumber }}</p></div>
          <button class="btn-ghost btn-sm !p-2" aria-label="Sign out" title="Sign out" @click="signOut"><LogOut class="size-4" /></button>
        </div>
      </div>
    </aside>

    <!-- Top bar -->
    <header class="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-bg/80 px-4 backdrop-blur-xl sm:px-6 lg:px-10">
      <div class="flex items-center gap-2.5 lg:hidden">
        <img :src="branding.logoSrc" class="size-8 object-contain" alt="" @error="branding.logoBroken = true" /><span class="text-sm font-bold">{{ branding.appName }}</span>
      </div>
      <p class="hidden text-sm text-ink-2 lg:block">Hi <b class="text-ink">{{ auth.firstName }}</b> 👋</p>
      <div class="flex items-center gap-2">
        <RouterLink to="/wallet" class="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm transition hover:bg-surface-2" aria-label="Wallet balance">
          <Wallet class="size-4 text-brand" />
          <span v-if="account.wallet" class="font-semibold tabular-nums">{{ money(account.balance, account.currency) }}</span>
          <span v-else class="skeleton inline-block h-4 w-16" />
        </RouterLink>
        <button class="btn-primary btn-sm !py-2" @click="openTopUp()"><Plus class="size-4" /><span class="hidden sm:inline">Top up</span></button>
        <div class="relative lg:hidden">
          <button class="grid size-9 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-ink" aria-label="Menu" @click="menu = !menu">{{ auth.initials }}</button>
          <div v-if="menu" class="card absolute right-0 top-11 w-52 p-2" @click="menu = false">
            <RouterLink v-for="n in nav.filter((x) => !mobileNav.includes(x))" :key="n.name" :to="n.to" class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"><component :is="n.icon" class="size-4 text-ink-3" />{{ n.label }}</RouterLink>
            <div class="my-1 flex rounded-lg bg-surface-2 p-1" @click.stop>
              <button v-for="t in themes" :key="t.v" :aria-label="t.label" :class="['flex flex-1 justify-center rounded-md py-1.5', ui.theme === t.v ? 'bg-surface shadow-sm' : 'text-ink-3']" @click="ui.setTheme(t.v)"><component :is="t.icon" class="size-4" /></button>
            </div>
            <button class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-bad hover:bg-bad-soft" @click="signOut"><LogOut class="size-4" />Sign out</button>
          </div>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
      <RouterView v-slot="{ Component }">
        <Transition name="fade" mode="out-in"><component :is="Component" @topup="openTopUp" /></Transition>
      </RouterView>
    </main>

    <!-- Bottom tab bar (mobile) -->
    <nav class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Main">
      <div class="mx-auto grid max-w-lg grid-cols-5">
        <RouterLink
          v-for="n in mobileNav" :key="n.name" :to="n.to"
          :class="['flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition', isActive(n) ? 'text-brand' : 'text-ink-3']"
        ><component :is="n.icon" class="size-5" />{{ n.label }}</RouterLink>
      </div>
    </nav>

    <TopUpModal :open="topUp" :suggested="suggested" :mode="topUpMode" @close="topUp = false" />
    <InstallPrompt />
  </div>
</template>
