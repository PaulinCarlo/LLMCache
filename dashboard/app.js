const API_BASE = ''
let allSnippets = []
let currentSnippet = null
let activeFilter = ''
const EXTENSION_ID_STORAGE_KEY = 'pc_extension_id'
const apiClient = window.PromptCacheApi.createClient({
  baseUrl: API_BASE,
  getAuthHeaders: async () => authHeaders()
})

// ──────────────────────────────────────────────────────────
// Auth helpers
// ──────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('pc_access_token')
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function logout() {
  const extensionId = localStorage.getItem(EXTENSION_ID_STORAGE_KEY)
  if (extensionId && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      chrome.runtime.sendMessage(extensionId, { type: 'LOGOUT' }, () => {
        void chrome.runtime.lastError
      })
    } catch {
      // ignore; dashboard logout should still succeed
    }
  }
  localStorage.removeItem('pc_access_token')
  localStorage.removeItem('pc_user_email')
  localStorage.removeItem('pc_display_name')
  localStorage.removeItem('pc_user_id')
  window.location.href = 'login.html'
}

// Redirect to login if no token is stored
if (!getToken()) {
  window.location.href = 'login.html'
}

// Show logged-in user info in the navbar
const displayName = localStorage.getItem('pc_display_name') || localStorage.getItem('pc_user_email') || ''

document.addEventListener('DOMContentLoaded', () => {
  const navUser = document.getElementById('nav-user')
  if (navUser && displayName) {
    navUser.innerHTML = `
      <span class="nav-username">${escHtml(displayName)}</span>
      <button class="btn btn-sm" onclick="logout()">Sign out</button>
    `
  }
})

async function fetchSnippets(query = '') {
  const grid = document.getElementById('snippets-grid')
  grid.innerHTML = '<div class="loading">Loading snippets…</div>'
  try {
    const result = await apiClient.listSnippets({ query, pageSize: 100, topK: 20, minSimilarity: 0.3 })
    if (!result.ok) throw new Error(`HTTP ${result.status}`)
    allSnippets = result.snippets
    renderSnippets(allSnippets)
    updateStats()
  } catch (e) {
    grid.innerHTML = `<div class="empty-state"><h3>Backend not connected</h3><p>Start the API at ${API_BASE} to view snippets.</p></div>`
  }
}

function renderSnippets(snippets) {
  const grid = document.getElementById('snippets-grid')
  const filtered = activeFilter
    ? snippets.filter(s => s.environment?.language === activeFilter)
    : snippets

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state"><h3>No snippets found</h3><p>Save your first snippet using the browser extension or + Add Snippet.</p></div>'
    return
  }

  grid.innerHTML = filtered.map(s => `
    <div class="snippet-card" onclick="openDetail('${s.id}')">
      <div class="card-prompt">${escHtml(s.prompt)}</div>
      ${s.intent ? `<div class="card-intent">${escHtml(s.intent)}</div>` : ''}
      <div class="card-meta">
        ${s.environment?.language ? `<span class="badge">${escHtml(s.environment.language)}</span>` : ''}
        ${s.environment?.framework ? `<span class="badge">${escHtml(s.environment.framework)}</span>` : ''}
        <span class="badge badge-green">${s.lineCount} lines</span>
        ${s.environment?.strictMode ? '<span class="badge badge-yellow">strict</span>' : ''}
        ${s.isPublic ? '<span class="badge">public</span>' : ''}
      </div>
      <div class="card-code">${escHtml(s.code)}</div>
      <div class="card-footer">
        <span class="card-date">${new Date(s.createdAt).toLocaleDateString()}</span>
        ${s.tags?.length ? `<span class="card-date">${s.tags.slice(0,3).join(', ')}</span>` : ''}
      </div>
    </div>
  `).join('')
}

function updateStats() {
  const stats = document.getElementById('nav-stats')
  const langs = [...new Set(allSnippets.map(s => s.environment?.language).filter(Boolean))]
  stats.textContent = `${allSnippets.length} snippets · ${langs.slice(0,4).join(', ') || 'no languages'}`
}

function openDetail(id) {
  currentSnippet = allSnippets.find(s => s.id === id)
  if (!currentSnippet) return
  const body = document.getElementById('detail-body')
  const env = currentSnippet.environment || {}
  body.innerHTML = `
    <div class="detail-prompt">${escHtml(currentSnippet.prompt)}</div>
    <div class="detail-meta">
      ${env.language ? `<span class="badge">${escHtml(env.language)}${env.languageVersion ? ' ' + escHtml(env.languageVersion) : ''}</span>` : ''}
      ${env.framework ? `<span class="badge">${escHtml(env.framework)}${env.frameworkVersion ? ' ' + escHtml(env.frameworkVersion) : ''}</span>` : ''}
      ${env.runtimeVersion ? `<span class="badge">${escHtml(env.runtimeVersion)}</span>` : ''}
      ${env.packageManager ? `<span class="badge">${escHtml(env.packageManager)}</span>` : ''}
      ${env.targetPlatform ? `<span class="badge">${escHtml(env.targetPlatform)}</span>` : ''}
      ${env.buildTool ? `<span class="badge">${escHtml(env.buildTool)}</span>` : ''}
      ${env.strictMode ? '<span class="badge badge-yellow">strict mode</span>' : ''}
      <span class="badge badge-green">${currentSnippet.lineCount} lines</span>
    </div>
    ${currentSnippet.intent ? `<div class="detail-intent"><strong>Intent:</strong> ${escHtml(currentSnippet.intent)}</div>` : ''}
    ${currentSnippet.constraints ? `<div class="detail-constraints"><strong>Constraints:</strong> ${escHtml(currentSnippet.constraints)}</div>` : ''}
    ${env.keyDependencies?.length ? `<div class="detail-intent"><strong>Key Dependencies:</strong> ${escHtml(env.keyDependencies.join(', '))}</div>` : ''}
    <pre class="detail-code">${escHtml(currentSnippet.code)}</pre>
    ${currentSnippet.tags?.length ? `<div class="detail-intent" style="margin-top:8px"><strong>Tags:</strong> ${currentSnippet.tags.map(escHtml).join(', ')}</div>` : ''}
  `
  document.getElementById('detail-title').textContent = `Snippet — ${currentSnippet.environment?.language || 'Code'}`
  document.getElementById('delta-section').style.display = 'none'
  document.getElementById('delta-result').innerHTML = ''
  document.getElementById('detail-overlay').classList.add('open')
}

function closeDetail(e) {
  if (e && e.target !== e.currentTarget) return
  document.getElementById('detail-overlay').classList.remove('open')
  currentSnippet = null
}

function runDelta() {
  document.getElementById('delta-section').style.display = 'block'
  document.getElementById('new-prompt-input').focus()
}

async function submitDelta() {
  const newPrompt = document.getElementById('new-prompt-input').value.trim()
  if (!newPrompt || !currentSnippet) return

  const resultDiv = document.getElementById('delta-result')
  resultDiv.innerHTML = '<div class="loading">Computing delta…</div>'

  try {
    const result = await apiClient.computeDelta({ newPrompt, cachedSnippetId: currentSnippet.id })
    if (!result.ok) throw new Error(`HTTP ${result.status}`)
    const delta = result.data
    const statusClass = `status-${delta.cacheStatus}`
    resultDiv.innerHTML = `
      <div class="delta-card">
        <div class="confidence">
          <strong class="${statusClass}">${delta.confidenceScore}%</strong>
          <span class="badge ${statusClass}">${(delta.cacheStatus || 'miss').toUpperCase()}</span>
        </div>
        <p class="summary">${escHtml(delta.diffSummary || '')}</p>
        ${delta.whatRemains?.length ? `<h4>✓ What Applies</h4><ul>${delta.whatRemains.map(w => `<li>${escHtml(w)}</li>`).join('')}</ul>` : ''}
        ${delta.whatChanges?.length ? `<h4>⚡ What Changes</h4><ul>${delta.whatChanges.map(w => `<li>${escHtml(w)}</li>`).join('')}</ul>` : ''}
        ${delta.annotatedPatch ? `<pre>${escHtml(delta.annotatedPatch)}</pre>` : ''}
      </div>
    `
  } catch (e) {
    resultDiv.innerHTML = `<div class="loading" style="color:var(--red)">Error: ${e.message}</div>`
  }
}

async function deleteSnippet() {
  if (!currentSnippet) return
  if (!confirm(`Delete "${currentSnippet.prompt.slice(0, 60)}…"?`)) return
  try {
    const result = await apiClient.deleteSnippet(currentSnippet.id)
    if (result.ok) {
      closeDetail()
      fetchSnippets()
    }
  } catch (e) {
    alert('Delete failed: ' + e.message)
  }
}

function openModal() {
  document.getElementById('modal-overlay').classList.add('open')
}

function closeModal(e) {
  if (e && e.target !== e.currentTarget) return
  document.getElementById('modal-overlay').classList.remove('open')
}

async function saveSnippet(e) {
  e.preventDefault()
  const btn = document.getElementById('save-btn')
  btn.disabled = true
  btn.textContent = 'Saving…'

  const tagsRaw = document.getElementById('f-tags').value
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : []

  const payload = {
    prompt: document.getElementById('f-prompt').value,
    code: document.getElementById('f-code').value,
    constraints: document.getElementById('f-constraints').value,
    tags,
    isPublic: document.getElementById('f-public').checked,
    environment: {
      language: document.getElementById('f-language').value || null,
      framework: document.getElementById('f-framework').value || null,
      runtimeVersion: document.getElementById('f-runtime').value || null,
      buildTool: document.getElementById('f-buildtool').value || null,
      packageManager: document.getElementById('f-pkgmgr').value || null,
      targetPlatform: document.getElementById('f-platform').value || null,
      strictMode: document.getElementById('f-strict').checked || null,
      keyDependencies: [],
      customMetadata: []
    }
  }

  try {
    const result = await apiClient.createSnippet(payload)
    if (!result.ok) throw new Error(`HTTP ${result.status}`)
    closeModal()
    e.target.reset()
    fetchSnippets()
  } catch (err) {
    alert('Save failed: ' + err.message)
  } finally {
    btn.disabled = false
    btn.textContent = 'Save Snippet'
  }
}

function handleSearch() {
  const q = document.getElementById('search-input').value.trim()
  fetchSnippets(q)
}

function setFilter(btn, lang) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  activeFilter = lang
  renderSnippets(allSnippets)
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

fetchSnippets()
