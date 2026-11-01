import { defineStore } from 'pinia'
import { onuApi } from '@/api'
import { titleCase } from '@/utils/format'

const STATES = {
  online: { label: 'Online', hint: 'Your ONU is connected to the network.', tone: 'ok' },
  los: { label: 'LOS — no light', hint: 'The fibre signal is lost. Check the fibre cable is seated and not bent, or report a fault.', tone: 'bad' },
  'power fail': { label: 'Power off', hint: 'The ONU lost power. Check the adapter and the wall socket.', tone: 'bad' },
  offline: { label: 'Offline', hint: 'The ONU is not reachable. Try restarting it, or report a fault.', tone: 'bad' },
}

// GET /onus/me, shared by Dashboard and Router & Wi-Fi.
// → { sn, model, status:{state,lastChange}, signal:{quality,rx1490Dbm,rx1310Dbm}, device:{…}, wifi:{ssid,password} }
export const useOnu = defineStore('onu', {
  state: () => ({ data: null, loading: false, error: '', loaded: false }),
  getters: {
    state(s) {
      const raw = s.data?.status?.state
      if (!raw) return null
      const key = String(raw).toLowerCase().trim()
      return STATES[key] ?? (/los/.test(key) ? STATES.los : /power/.test(key) ? STATES['power fail'] : { label: titleCase(key), hint: '', tone: 'muted' })
    },
  },
  actions: {
    async load() {
      this.loading = true
      this.error = ''
      try { this.data = await onuApi.me() } catch (e) {
        this.data = null
        if (e.status !== 404) this.error = e.message // 404 = no ONU linked to this customer
      } finally { this.loading = false; this.loaded = true }
    },
    reset() { this.$reset() },
  },
})
