import { defineStore } from 'pinia'
import { customerApi } from '@/api'
import { useAuth } from './auth'

const LIVE = ['ACTIVE', 'GRACE_PERIOD', 'EXPIRED', 'SUSPENDED', 'PENDING']

// Customer detail + wallet balance, shared by Dashboard / Services / Wallet.
export const useAccount = defineStore('account', {
  state: () => ({ customer: null, wallet: null, loading: false, error: '', loadedAt: 0 }),
  getters: {
    subscriptions: (s) => s.customer?.subscriptions ?? [],
    // The one the customer is "on": prefer ACTIVE, then at-risk states, then pending.
    primary() {
      const order = ['ACTIVE', 'GRACE_PERIOD', 'EXPIRED', 'SUSPENDED', 'PENDING']
      const subs = this.subscriptions.filter((x) => LIVE.includes(x.status))
      return subs.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))[0] ?? null
    },
    balance: (s) => Number(s.wallet?.balance ?? 0),
    currency: (s) => s.wallet?.currency ?? 'KES',
  },
  actions: {
    async load({ force = false } = {}) {
      if (!force && this.customer && Date.now() - this.loadedAt < 30_000) return
      const id = useAuth().customerId
      if (!id) return
      this.loading = !this.customer
      this.error = ''
      try {
        const [customer, w] = await Promise.all([customerApi.get(id), customerApi.wallet(id, 1, 1)])
        this.customer = customer
        this.wallet = w.wallet
        this.loadedAt = Date.now()
      } catch (e) {
        this.error = e.message
      } finally {
        this.loading = false
      }
    },
    refresh() { return this.load({ force: true }) },
    reset() { this.$reset() },
  },
})
