<script setup>
import { ref } from 'vue'
import { Download, Share, X } from 'lucide-vue-next'
import { usePwa } from '@/stores/pwa'
import { useBranding } from '@/stores/branding'

const pwa = usePwa()
const showSteps = ref(false)
const branding = useBranding()
</script>

<template>
  <Transition name="pop">
    <aside v-if="pwa.visible" class="card fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-md items-start gap-3 p-4 shadow-lg lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0" role="dialog" aria-label="Install app">
      <img src="/icon-any-192.png" class="size-11 shrink-0 rounded-xl" alt="" />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold">Install {{ branding.appName }}</p>
        <p v-if="!showSteps" class="mt-0.5 text-xs text-ink-2">Get one-tap access from your home screen, like any other app.</p>
        <p v-else class="mt-0.5 text-xs text-ink-2">Tap <Share class="inline size-3.5 align-text-bottom" /> <b>Share</b> in Safari, then choose <b>Add to Home Screen</b>.</p>
        <div class="mt-3 flex gap-2">
          <button v-if="pwa.canPrompt" class="btn-primary btn-sm" @click="pwa.install()"><Download class="size-4" />Install</button>
          <button v-else-if="!showSteps" class="btn-primary btn-sm" @click="showSteps = true">How to install</button>
          <button class="btn-ghost btn-sm" @click="pwa.dismiss()">Not now</button>
        </div>
      </div>
      <button class="btn-ghost btn-sm -mr-1 -mt-1 !p-1.5" aria-label="Dismiss" @click="pwa.dismiss()"><X class="size-4" /></button>
    </aside>
  </Transition>
</template>
