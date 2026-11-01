// Thin fetch client for the ConnectOS API.
//  - unwraps the { success, message, data, meta } envelope
//  - attaches the bearer token and transparently refreshes it once on 401 (single-flight)
//  - throws ApiError carrying status, message and per-field validation errors

const BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
const KEY = 'cos.tokens'

export class ApiError extends Error {
  constructor(message, status, errors = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
  /** { field: message } map for form display */
  get fieldErrors() {
    return Object.fromEntries(this.errors.map((e) => [e.field, e.message]))
  }
}

export const tokens = {
  get() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null } catch { return null }
  },
  set(t) {
    try { localStorage.setItem(KEY, JSON.stringify(t)) } catch { /* private mode */ }
  },
  clear() {
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  },
}

let onAuthLost = () => {}
export const setAuthLostHandler = (fn) => { onAuthLost = fn }

let refreshing = null
async function refreshTokens() {
  const t = tokens.get()
  if (!t?.refreshToken) throw new ApiError('Session expired.', 401)
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: t.refreshToken }),
  })
    .then(async (r) => {
      const body = await r.json().catch(() => ({}))
      if (!r.ok || !body.success) throw new ApiError(body.message || 'Session expired.', 401)
      tokens.set({ accessToken: body.data.accessToken, refreshToken: body.data.refreshToken })
      return body.data.accessToken
    })
    .finally(() => { refreshing = null })
  return refreshing
}

function buildUrl(path, query) {
  const url = `${BASE}${path}`
  if (!query) return url
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') qs.set(k, v)
  const s = qs.toString()
  return s ? `${url}?${s}` : url
}

async function raw(method, path, { query, body, auth = true, signal, isRetry = false } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const t = tokens.get()
    if (t?.accessToken) headers.Authorization = `Bearer ${t.accessToken}`
  }

  let res
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0)
  }

  // Access tokens live 15 min: refresh once, replay the request.
  if (res.status === 401 && auth && !isRetry && tokens.get()?.refreshToken && !path.startsWith('/auth/')) {
    try {
      await refreshTokens()
    } catch {
      tokens.clear()
      onAuthLost()
      throw new ApiError('Your session has expired. Please sign in again.', 401)
    }
    return raw(method, path, { query, body, auth, signal, isRetry: true })
  }
  return res
}

async function request(method, path, opts = {}) {
  const res = await raw(method, path, opts)
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) {
    if (res.status === 401 && opts.auth !== false && !path.startsWith('/auth/login')) {
      tokens.clear()
      onAuthLost()
    }
    throw new ApiError(body?.message || `Request failed (${res.status})`, res.status, body?.errors || [])
  }
  return body
}

export const http = {
  /** returns data only */
  get: async (path, query, o) => (await request('GET', path, { query, ...o })).data,
  /** returns { data, meta } — for paginated lists */
  list: async (path, query, o) => {
    const b = await request('GET', path, { query, ...o })
    return { data: b.data, meta: b.meta }
  },
  post: async (path, body = {}, o) => (await request('POST', path, { body, ...o })).data,
  put: async (path, body = {}, o) => (await request('PUT', path, { body, ...o })).data,
  /** binary download with auth (e.g. invoice PDF) → Blob */
  blob: async (path) => {
    const res = await raw('GET', path)
    if (!res.ok) {
      const b = await res.json().catch(() => null)
      throw new ApiError(b?.message || `Download failed (${res.status})`, res.status)
    }
    return res.blob()
  },
}
