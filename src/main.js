import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { wireAuthLoss } from './stores/auth'
import { usePwa } from './stores/pwa'
import { useBranding } from './stores/branding'
import { updateTitle } from './router'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
wireAuthLoss(router)
usePwa().init()
// Public company name/logo; fire-and-forget, the UI shows the fallback until it arrives.
useBranding().load().then(() => updateTitle())
app.mount('#app')

// Service worker only in production builds, so dev HMR is never served stale.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
