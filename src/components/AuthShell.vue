<script setup>
import { Zap, ShieldCheck, Headset, Router, Wifi } from 'lucide-vue-next'
import NetworkBackground from '@/components/NetworkBackground.vue'
import { useBranding } from '@/stores/branding'
defineProps({ title: String, subtitle: String })
const branding = useBranding()
const points = [
  { icon: Router, text: 'Check your router’s status and signal strength' },
  { icon: Wifi, text: 'Change your Wi-Fi name and password yourself' },
  { icon: Zap, text: 'Top up with M-Pesa and renew in seconds' },
  { icon: ShieldCheck, text: 'Track your data allowance and billing' },
  { icon: Headset, text: 'Get help from our team, any time' },
]
</script>

<template>
  <div class="grid min-h-dvh grid-rows-[auto_1fr] lg:grid-cols-[1.05fr_1fr] lg:grid-rows-1">
    <!-- Mobile hero: brand + tagline over a cropped globe -->
    <header class="relative h-36 overflow-hidden px-5 pt-6 text-white lg:hidden" style="background: linear-gradient(145deg, #3730a3 0%, #5b21b6 55%, #7c3aed 100%)">
      <NetworkBackground compact />
      <div class="relative flex items-center gap-2.5"><img :src="branding.logoSrc" class="size-8 rounded-lg object-contain ring-1 ring-white/30" alt="" @error="branding.logoBroken = true" /><span class="font-bold">{{ branding.appName }}</span></div>
      <p class="relative mt-5 max-w-[14rem] text-xl font-bold leading-tight tracking-tight">Your internet, in your hands.</p>
    </header>
    <aside class="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between" style="background: linear-gradient(145deg, #3730a3 0%, #5b21b6 55%, #7c3aed 100%)">
      <div class="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-fuchsia-400/20 blur-3xl" />
      <NetworkBackground />
      <div class="relative flex items-center gap-3"><img :src="branding.logoSrc" class="size-10 rounded-xl object-contain ring-1 ring-white/30" alt="" @error="branding.logoBroken = true" /><span class="text-lg font-bold">{{ branding.appName }}</span></div>
      <div class="relative max-w-md">
        <h2 class="text-4xl font-bold leading-tight tracking-tight">Your internet, in your hands.</h2>
        <p class="mt-3 text-white/75">Manage your plan, wallet, router and support requests — all in one place.</p>
        <ul class="mt-10 space-y-4">
          <li v-for="p in points" :key="p.text" class="flex items-center gap-3 text-sm text-white/90">
            <span class="grid size-9 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20"><component :is="p.icon" class="size-4" /></span>{{ p.text }}
          </li>
        </ul>
      </div>
      <p class="relative text-xs text-white/50">© {{ new Date().getFullYear() }} {{ branding.appName }}</p>
    </aside>

    <main class="relative flex items-start justify-center px-5 py-8 lg:items-center lg:py-10">
      <div class="w-full max-w-sm">
        <h1 class="text-2xl font-bold tracking-tight text-ink">{{ title }}</h1>
        <p v-if="subtitle" class="mt-1.5 text-sm text-ink-2">{{ subtitle }}</p>
        <div class="mt-8"><slot /></div>
        <div class="mt-8 text-center text-sm text-ink-2"><slot name="footer" /></div>
      </div>
    </main>
  </div>
</template>
