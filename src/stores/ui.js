import { defineStore } from 'pinia'

let id = 0
const read = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k, v) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } }

export const useUi = defineStore('ui', {
  state: () => ({ toasts: [], theme: read('cos.theme') || 'system' }),
  actions: {
    toast(message, type = 'info', ms = 4500) {
      const t = { id: ++id, message, type }
      this.toasts.push(t)
      setTimeout(() => this.dismiss(t.id), ms)
    },
    success(m) { this.toast(m, 'success') },
    error(m) { this.toast(m, 'error', 6500) },
    dismiss(tid) { this.toasts = this.toasts.filter((t) => t.id !== tid) },
    setTheme(t) {
      this.theme = t
      write('cos.theme', t === 'system' ? '' : t)
      if (t === 'system') delete document.documentElement.dataset.theme
      else document.documentElement.dataset.theme = t
    },
  },
})
