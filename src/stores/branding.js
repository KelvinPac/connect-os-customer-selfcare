import { defineStore } from 'pinia'
import { API_ROOT } from '@/api/http'

// Company name + logo from the public GET /company/name and /company/logo endpoints.
// Falls back to VITE_APP_NAME / "ConnectOS" and the bundled icon when the API has
// nothing or can't be reached, and keeps the last good answer in localStorage so
// the name doesn't flash on the next visit.
const FALLBACK_NAME = import.meta.env.VITE_APP_NAME || 'ConnectOS'
const KEY = 'cos.branding'

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* private mode */ } }

export const useBranding = defineStore('branding', {
  state: () => {
    const c = read()
    return { name: c?.name || '', hasLogo: !!c?.hasLogo, logoBroken: false, loaded: false }
  },
  getters: {
    appName: (s) => s.name || FALLBACK_NAME,
    logoSrc: (s) => (s.hasLogo && !s.logoBroken ? `${API_ROOT}/company/logo` : '/favicon.svg'),
  },
  actions: {
    async load() {
      if (this.loaded) return
      this.loaded = true
      try {
        const res = await fetch(`${API_ROOT}/company/name`, { headers: { Accept: 'application/json' } })
        if (!res.ok) return
        const { data } = await res.json()
        if (!data?.name) return
        this.name = data.name
        this.hasLogo = !!data.hasLogo
        this.logoBroken = false
        write({ name: this.name, hasLogo: this.hasLogo })
      } catch { /* offline or API down: keep the fallback / cached values */ }
    },
  },
})
