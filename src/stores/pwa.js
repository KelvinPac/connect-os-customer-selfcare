import { defineStore } from 'pinia'

const KEY = 'cos.installDismissed'
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000
const read = () => { try { return Number(localStorage.getItem(KEY)) || 0 } catch { return 0 } }
const write = (v) => { try { localStorage.setItem(KEY, String(v)) } catch { /* ignore */ } }

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// Install prompt. Chromium/Android fire `beforeinstallprompt` (captured and replayed from our own button);
// iOS Safari has no such event, so there we show "Share → Add to Home Screen" instructions instead.
let deferred = null
export const usePwa = defineStore('pwa', {
  state: () => ({ canPrompt: false, installed: standalone(), dismissedAt: read(), ios: isIos() }),
  getters: {
    // Show once, only in a browser tab, and not again for 14 days after "Not now".
    visible: (s) => !s.installed && (s.canPrompt || s.ios) && Date.now() - s.dismissedAt > SNOOZE_MS,
  },
  actions: {
    init() {
      window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; this.canPrompt = true })
      window.addEventListener('appinstalled', () => { deferred = null; this.canPrompt = false; this.installed = true })
    },
    async install() {
      if (!deferred) return
      deferred.prompt()
      const { outcome } = await deferred.userChoice
      deferred = null
      this.canPrompt = false
      if (outcome === 'dismissed') this.dismiss()
    },
    dismiss() { this.dismissedAt = Date.now(); write(this.dismissedAt) },
  },
})
