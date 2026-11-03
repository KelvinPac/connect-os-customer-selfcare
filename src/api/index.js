// Every call here maps to an endpoint in the ConnectOS API docs
// (docs/UI_INTEGRATION_GUIDE.md, TICKETING_API_GUIDE.md, SUBSCRIPTION_PREVIEW_API.md).
import { http } from './http'

export const authApi = {
  /** channel: SMS (default) | WHATSAPP | EMAIL. Always a generic 200; one code per account per 60s, valid 5 min. */
  requestOtp: (phone, channel = 'SMS') => http.post('/auth/customer/otp/request', { phone, channel }, { auth: false }),
  /** → { accessToken, refreshToken } like /auth/login; totpCode required if the account has 2FA. */
  verifyOtp: (phone, code, totpCode) => http.post('/auth/customer/otp/verify', { phone, code, ...(totpCode ? { totpCode } : {}) }, { auth: false }),
  login: (email, password, totpCode) => http.post('/auth/login', { email, password, ...(totpCode ? { totpCode } : {}) }, { auth: false }),
  logout: (refreshToken) => http.post('/auth/logout', { refreshToken }),
  me: () => http.get('/auth/me'),
  forgotPassword: (email) => http.post('/auth/forgot-password', { email }, { auth: false }),
  resetPassword: (token, password) => http.post('/auth/reset-password', { token, password }, { auth: false }),
  changePassword: (currentPassword, newPassword) => http.post('/auth/change-password', { currentPassword, newPassword }),
  setup2FA: () => http.post('/auth/2fa/setup'),
  verify2FA: (totpCode) => http.post('/auth/2fa/verify', { totpCode }),
  disable2FA: () => http.post('/auth/2fa/disable'),
}

export const customerApi = {
  get: (id) => http.get(`/customers/${id}`),
  update: (id, body) => http.put(`/customers/${id}`, body),
  subscriptions: (id) => http.get(`/customers/${id}/subscriptions`),
  invoices: (id) => http.get(`/customers/${id}/invoices`),
  payments: (id) => http.get(`/customers/${id}/payments`),
  tickets: (id) => http.get(`/customers/${id}/tickets`),
  renewals: (id) => http.get(`/customers/${id}/renewals`),
  usage: (id) => http.get(`/customers/${id}/usage`),
  /** → { data: { id, balance, currency, transactions }, meta } */
  wallet: async (id, page = 1, limit = 15) => {
    const b = await http.list(`/customers/${id}/wallet`, { page, limit })
    return { wallet: b.data, meta: b.meta }
  },
  contacts: (id) => http.get(`/customers/${id}/contacts`),
  addContact: (id, body) => http.post(`/customers/${id}/contacts`, body),
}

export const planApi = {
  // public endpoint; the API does not filter by isPublic itself, so the caller does.
  list: () => http.get('/plans', { isActive: true, limit: 100, sortBy: 'sortOrder', sortOrder: 'asc' }, { auth: false }),
}

export const subscriptionApi = {
  get: (id) => http.get(`/subscriptions/${id}`),
  preview: (id) => http.get(`/subscriptions/${id}/preview`),
  renew: (id) => http.post(`/subscriptions/${id}/renew`),
  changePlanPreview: (id, planId) => http.get(`/subscriptions/${id}/change-plan/preview`, { planId }),
  changePlan: (id, planId) => http.post(`/subscriptions/${id}/change-plan`, { planId }),
}

export const paymentApi = {
  stkPush: (phone, amount) => http.post('/payments/mpesa/stkpush', { phone, amount }),
  get: (id) => http.get(`/payments/${id}`),
}

export const invoiceApi = {
  get: (id) => http.get(`/invoices/${id}`),
  pdf: (id) => http.blob(`/invoices/${id}/pdf`),
}

export const ticketApi = {
  get: (id) => http.get(`/tickets/${id}`),
  create: (body) => http.post('/tickets', body),
  comment: (id, body) => http.post(`/tickets/${id}/comments`, { body }),
  resolve: (id, resolutionNote) => http.post(`/tickets/${id}/resolve`, resolutionNote ? { resolutionNote } : {}),
  close: (id, closeNote) => http.post(`/tickets/${id}/close`, closeNote ? { closeNote } : {}),
  rate: (id, body) => http.post(`/tickets/${id}/rate`, body),
}

// ONUs (api-docs.json, tag "ONUs"): id "me" resolves to the signed-in customer's own ONU.
export const onuApi = {
  me: () => http.get('/onus/me'),
  /** body: { ssid?, password? } — ssid 1-32 [A-Za-z0-9 _.\-@#], password 8-63 [A-Za-z0-9_.\-@#!]; 5 changes/min */
  changeWifi: (body) => http.put('/onus/me/wifi', body),
}
