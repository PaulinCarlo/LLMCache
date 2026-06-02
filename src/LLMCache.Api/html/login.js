const EXTENSION_ID_PARAM = 'pc_extension_id'
const EXTENSION_ID_STORAGE_KEY = 'pc_extension_id'
let currentApiBase = ''
let apiClientPromise = null

async function getApiClient() {
  if (!apiClientPromise) {
    apiClientPromise = window.PromptCacheBackend.resolveApiBaseUrl(currentApiBase).then((baseUrl) => {
      currentApiBase = baseUrl
      return window.PromptCacheApi.createClient({ baseUrl })
    })
  }

  return apiClientPromise
}

function getExtensionId() {
  const fromQuery = new URLSearchParams(window.location.search).get(EXTENSION_ID_PARAM)
  if (fromQuery) {
    localStorage.setItem(EXTENSION_ID_STORAGE_KEY, fromQuery)
    return fromQuery
  }
  return localStorage.getItem(EXTENSION_ID_STORAGE_KEY)
}

async function notifyExtension(message) {
  const extensionId = getExtensionId()
  if (!extensionId) return
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return
  try {
    await new Promise((resolve) => {
      let settled = false
      const timeoutId = setTimeout(() => {
        if (settled) return
        settled = true
        resolve()
      }, 1000)
      chrome.runtime.sendMessage(extensionId, message, () => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        const runtimeError = chrome.runtime.lastError
        if (runtimeError) {
          console.debug('Extension auth sync skipped:', runtimeError.message)
        }
        resolve()
      })
    })
  } catch {
    // Extension might be unavailable; keep dashboard login functional.
  }
}

function syncExtensionLogin(tokenResponse) {
  const token = tokenResponse?.accessToken || tokenResponse?.token
  if (!token) return
  void notifyExtension({
    type: 'LOGIN_SUCCESS',
    token,
    email: tokenResponse?.email
  })
}

function syncExtensionLogout() {
  void notifyExtension({ type: 'LOGOUT' })
}

// ──────────────────────────────────────────────────────────
// Token storage helpers
// ──────────────────────────────────────────────────────────

function saveToken(tokenResponse) {
  localStorage.setItem('pc_access_token', tokenResponse.accessToken)
  localStorage.setItem('pc_user_email', tokenResponse.email)
  localStorage.setItem('pc_display_name', tokenResponse.displayName)
  localStorage.setItem('pc_user_id', tokenResponse.userId)
  syncExtensionLogin(tokenResponse)
}

function getToken() {
  return localStorage.getItem('pc_access_token')
}

function clearToken() {
  localStorage.removeItem('pc_access_token')
  localStorage.removeItem('pc_user_email')
  localStorage.removeItem('pc_display_name')
  localStorage.removeItem('pc_user_id')
  syncExtensionLogout()
}

// ──────────────────────────────────────────────────────────
// Tab switching
// ──────────────────────────────────────────────────────────

function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((el, i) => {
    el.classList.toggle('active', (tab === 'login' && i === 0) || (tab === 'register' && i === 1))
  })
  document.getElementById('panel-login').classList.toggle('active', tab === 'login')
  document.getElementById('panel-register').classList.toggle('active', tab === 'register')
  clearErrors()
}

function clearErrors() {
  document.querySelectorAll('.auth-error, .auth-success').forEach(el => el.classList.remove('visible'))
}

function showError(panelId, message) {
  const el = document.getElementById(panelId)
  el.textContent = message
  el.classList.add('visible')
}

function showSuccess(panelId, message) {
  const el = document.getElementById(panelId)
  el.textContent = message
  el.classList.add('visible')
}

// ──────────────────────────────────────────────────────────
// Email / Password — Login
// ──────────────────────────────────────────────────────────

async function handleLogin(e) {
  e.preventDefault()
  clearErrors()
  const btn = document.getElementById('login-btn')
  btn.disabled = true
  btn.textContent = 'Signing in…'

  const email = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-password').value

  try {
    const apiClient = await getApiClient()
    const result = await apiClient.login({ email, password })
    const data = result.data
    if (!result.ok) {
      const msg = data?.message || extractErrors(data) || 'Login failed.'
      showError('login-error', msg)
      return
    }

    saveToken(data)
    window.location.href = 'index.html'
  } catch {
    showError('login-error', 'Unable to reach the server. Is the API running?')
  } finally {
    btn.disabled = false
    btn.textContent = 'Sign In'
  }
}

// ──────────────────────────────────────────────────────────
// Email / Password — Register
// ──────────────────────────────────────────────────────────

async function handleRegister(e) {
  e.preventDefault()
  clearErrors()
  const btn = document.getElementById('register-btn')
  btn.disabled = true
  btn.textContent = 'Creating account…'

  const displayName = document.getElementById('reg-name').value.trim()
  const email = document.getElementById('reg-email').value.trim()
  const password = document.getElementById('reg-password').value

  try {
    const apiClient = await getApiClient()
    const result = await apiClient.register({ email, password, displayName })
    const data = result.data
    if (!result.ok) {
      const msg = extractErrors(data) || data?.message || 'Registration failed.'
      showError('register-error', msg)
      return
    }

    // Account created — auto-login (email confirmation disabled in dev)
    saveToken(data)
    window.location.href = 'index.html'

    // ── EMAIL CONFIRMATION — uncomment when email is enabled ──
    // showSuccess('register-success', 'Account created! Check your email to confirm.')
    // document.getElementById('register-form').reset()
    // ─────────────────────────────────────────────────────────
  } catch {
    showError('register-error', 'Unable to reach the server. Is the API running?')
  } finally {
    btn.disabled = false
    btn.textContent = 'Create Account'
  }
}

// ──────────────────────────────────────────────────────────
// Social / OAuth login
// ──────────────────────────────────────────────────────────

async function socialLogin(provider) {
  const extensionId = getExtensionId()
  const returnPath = extensionId
    ? `/login.html?${EXTENSION_ID_PARAM}=${encodeURIComponent(extensionId)}`
    : '/login.html'
  const returnUrl = window.location.origin + returnPath
  const apiClient = await getApiClient()
  window.location.href = apiClient.buildExternalLoginUrl(provider, returnUrl)
}

// Handle access_token returned via query string after OAuth redirect
function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('access_token')
  const error = params.get('error')

  if (token) {
    // Minimal token response — social login only returns the access token in the URL
    saveToken({ accessToken: token })
    // Remove the token from the URL so it is not bookmarked / shared
    history.replaceState({}, '', window.location.pathname)
    window.location.href = 'index.html'
    return true
  }

  if (error) {
    showError('login-error', `Social login failed: ${error.replace(/_/g, ' ')}`)
    history.replaceState({}, '', window.location.pathname)
    return true
  }

  return false
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function extractErrors(data) {
  if (!data || typeof data !== 'object') return null
  const messages = []
  for (const key of Object.keys(data)) {
    const val = data[key]
    if (Array.isArray(val)) messages.push(...val)
    else if (typeof val === 'string') messages.push(val)
  }
  return messages.join(' ') || null
}

// ──────────────────────────────────────────────────────────
// Init — redirect to dashboard if already logged in
// ──────────────────────────────────────────────────────────

;(function init() {
  getExtensionId()
  if (handleOAuthCallback()) return
  if (getToken()) {
    window.location.href = 'index.html'
  }
})()
