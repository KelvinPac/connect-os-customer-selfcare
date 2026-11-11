import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { useBranding } from '@/stores/branding'

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guest: true, title: 'Sign in' } },
  { path: '/forgot-password', name: 'forgot', component: () => import('@/views/ForgotPasswordView.vue'), meta: { guest: true, title: 'Reset password' } },
  { path: '/reset-password', name: 'reset', component: () => import('@/views/ResetPasswordView.vue'), meta: { guest: true, title: 'Choose a new password' } },
  {
    path: '/',
    component: () => import('@/layouts/PortalLayout.vue'),
    meta: { auth: true },
    children: [
      { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: 'Overview' } },
      { path: 'services', name: 'services', component: () => import('@/views/ServicesView.vue'), meta: { title: 'My internet' } },
      { path: 'router', name: 'router', component: () => import('@/views/RouterView.vue'), meta: { title: 'Router & Wi-Fi' } },
      { path: 'wallet', name: 'wallet', component: () => import('@/views/WalletView.vue'), meta: { title: 'Wallet' } },
      { path: 'billing', name: 'billing', component: () => import('@/views/BillingView.vue'), meta: { title: 'Billing' } },
      { path: 'usage', name: 'usage', component: () => import('@/views/UsageView.vue'), meta: { title: 'Usage' } },
      { path: 'support', name: 'support', component: () => import('@/views/SupportView.vue'), meta: { title: 'Support' } },
      { path: 'support/:id', name: 'ticket', component: () => import('@/views/TicketView.vue'), meta: { title: 'Ticket' } },
      { path: 'account', name: 'account', component: () => import('@/views/AccountView.vue'), meta: { title: 'Account' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const auth = useAuth()
  if (!auth.ready) await auth.init()
  if (to.meta.auth && !auth.isAuthed) return { name: 'login', query: to.fullPath !== '/' ? { next: to.fullPath } : {} }
  if (to.meta.guest && auth.isAuthed && to.name !== 'reset') return { name: 'dashboard' }
})

export function updateTitle(to = router.currentRoute.value) {
  document.title = `${to.meta.title ? `${to.meta.title} · ` : ''}${useBranding().appName} Portal`
}
router.afterEach((to) => updateTitle(to))
