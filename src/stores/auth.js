import { defineStore } from 'pinia'
import { authApi } from '@/api'
import { tokens, setAuthLostHandler } from '@/api/http'

export const useAuth = defineStore('auth', {
  state: () => ({ user: null, ready: false }),
  getters: {
    isAuthed: (s) => !!s.user,
    customerId: (s) => s.user?.customer?.id ?? null,
    name: (s) => (s.user?.customer ? `${s.user.customer.firstName} ${s.user.customer.lastName}`.trim() : s.user?.email ?? ''),
    firstName: (s) => s.user?.customer?.firstName ?? 'there',
    initials() {
      const c = this.user?.customer
      return c ? `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase() : '?'
    },
  },
  actions: {
    /** Restore a session on page load. */
    async init() {
      if (tokens.get()) {
        try { await this.loadMe() } catch { tokens.clear(); this.user = null }
      }
      this.ready = true
    },
    async loadMe() {
      const me = await authApi.me()
      if (me.role !== 'CUSTOMER' || !me.customer) {
        throw Object.assign(new Error('This portal is for ConnectOS customers. Staff should use the admin console.'), { notCustomer: true })
      }
      this.user = me
    },
    async login(email, password, totpCode) {
      return this.startSession(await authApi.login(email, password, totpCode))
    },
    async loginWithOtp(phone, code, totpCode) {
      return this.startSession(await authApi.verifyOtp(phone, code, totpCode))
    },
    async startSession({ accessToken, refreshToken }) {
      tokens.set({ accessToken, refreshToken })
      try {
        await this.loadMe()
      } catch (e) {
        tokens.clear()
        this.user = null
        throw e
      }
    },
    async logout() {
      const t = tokens.get()
      try { if (t?.refreshToken) await authApi.logout(t.refreshToken) } catch { /* best effort */ }
      this.clear()
    },
    clear() {
      tokens.clear()
      this.user = null
    },
  },
})

export function wireAuthLoss(router) {
  setAuthLostHandler(() => {
    const auth = useAuth()
    if (!auth.user) return
    auth.clear()
    router.replace({ name: 'login', query: { expired: '1' } })
  })
}
