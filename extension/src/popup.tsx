import { useEffect, useState } from "react"
import { sendToBackground } from "@plasmohq/messaging"
import "./styles/popup.css"

interface Snippet {
  id: string
  prompt: string
  code: string
  lineCount: number
  createdAt: string
  environment: {
    language?: string
    framework?: string
  }
  tags: string[]
}

interface SaveForm {
  prompt: string
  code: string
  framework: string
}

interface AuthState {
  token: string
  email?: string
}

const API_BASE = "http://localhost:3000"
const WEBSITE_LOGIN_URL = "http://localhost:3000/login"

export default function Popup() {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [tab, setTab] = useState<"browse" | "save">("browse")
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<SaveForm>({ prompt: "", code: "", framework: "" })
  const [saveMsg, setSaveMsg] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [autoCheck, setAutoCheck] = useState(false)
  const [auth, setAuth] = useState<AuthState>({ token: "" })
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    chrome.storage.local.get(["autoCheck", "auth"], (result) => {
      setAutoCheck((result.autoCheck as boolean) ?? false)
      if (result.auth) setAuth(result.auth as AuthState)
    })

    // Update auth instantly when the background receives a LOGIN_SUCCESS handshake
    const onStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.auth) setAuth((changes.auth.newValue ?? { token: "" }) as AuthState)
    }
    chrome.storage.onChanged.addListener(onStorageChange)
    return () => chrome.storage.onChanged.removeListener(onStorageChange)
  }, [])

  useEffect(() => {
    if (auth.token) fetchSnippets()
  }, [auth.token])

  const fetchSnippets = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/snippets?pageSize=50`)
      if (res.ok) setSnippets(await res.json())
    } catch { /* backend not running */ }
  }

  const handleAutoCheckToggle = () => {
    const next = !autoCheck
    setAutoCheck(next)
    chrome.storage.local.set({ autoCheck: next })
  }

  const handleCheckForPrompt = async () => {
    setChecking(true)
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (activeTab?.id) {
        await chrome.tabs.sendMessage(activeTab.id, { type: "CHECK_PROMPT" })
      }
    } catch { /* content script not available on this page */ }
    setChecking(false)
  }

  const handleLogout = () => {
    setAuth({ token: "" })
    chrome.storage.local.remove("auth")
  }

  const handleLogin = () => {
    chrome.tabs.create({ url: WEBSITE_LOGIN_URL })
  }

  const isLoggedIn = auth.token.trim().length > 0

  const handleSave = async () => {
    if (!form.prompt || !form.code) return
    setSaving(true)
    const resp = await sendToBackground({
      name: "index",
      body: {
        type: "SAVE",
        payload: {
          prompt: form.prompt,
          code: form.code,
          environment: { framework: form.framework || undefined },
          constraints: "",
          tags: []
        }
      }
    })
    setSaving(false)
    if (resp?.success) {
      setSaveMsg("✓ Snippet saved!")
      setForm({ prompt: "", code: "", framework: "" })
      fetchSnippets()
      setTimeout(() => setSaveMsg(""), 2500)
    }
  }

  const filtered = searchQuery
    ? snippets.filter(s =>
        s.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.environment?.language?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : snippets

  if (!isLoggedIn) {
    return (
      <div className="popup">
        <div className="popup-header">
          <span className="popup-logo">⚡</span>
          <span className="popup-title">PromptCache</span>
        </div>
        <div className="login-screen">
          <div className="login-icon">⚡</div>
          <h2 className="login-title">Welcome to PromptCache</h2>
          <p className="login-desc">
            Sign in to save and retrieve your AI prompt snippets.
          </p>
          <button className="login-btn" onClick={handleLogin} aria-label="Sign in or Register (opens in new tab)">
            Sign in / Register →
          </button>
        </div>
        <div className="popup-footer">
          <a href="http://localhost:3000" target="_blank" rel="noreferrer">Open Dashboard →</a>
        </div>
      </div>
    )
  }

  return (
    <div className="popup">
      <div className="popup-header">
        <span className="popup-logo">⚡</span>
        <span className="popup-title">PromptCache</span>
        <span className="popup-user" title={auth.email ?? "Logged in"}>
          👤 {auth.email ?? "Logged in"}
        </span>
        <button className="header-logout" onClick={handleLogout} title="Logout" aria-label="Logout">
          ↩
        </button>
      </div>

      <div className="popup-toolbar">
        <button
          className={`toggle-btn ${autoCheck ? "on" : ""}`}
          onClick={handleAutoCheckToggle}
          title="When on, cache is checked before every send"
        >
          <span className="toggle-track">
            <span className="toggle-knob" />
          </span>
          <span className="toggle-label">Auto Check</span>
        </button>
        <button
          className="check-btn"
          onClick={handleCheckForPrompt}
          disabled={checking}
          title="Check the current prompt against the cache"
        >
          {checking ? "…" : "Check ⚡"}
        </button>
      </div>

      <div className="popup-tabs">
        <button className={`tab ${tab === "browse" ? "active" : ""}`} onClick={() => setTab("browse")}>
          Browse ({snippets.length})
        </button>
        <button className={`tab ${tab === "save" ? "active" : ""}`} onClick={() => setTab("save")}>
          + Save
        </button>
      </div>

      {tab === "browse" && (
        <div>
          <input
            className="popup-search"
            placeholder="Search snippets…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <div className="snippet-list">
            {filtered.length === 0 && (
              <div className="empty">No snippets yet. Save your first one!</div>
            )}
            {filtered.map(s => (
              <div key={s.id} className="snippet-card">
                <div className="snippet-prompt">{s.prompt}</div>
                <div className="snippet-meta">
                  {s.environment?.language && <span className="tag">{s.environment.language}</span>}
                  {s.environment?.framework && <span className="tag">{s.environment.framework}</span>}
                  <span className="tag lines">{s.lineCount} lines</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "save" && (
        <div className="save-form">
          <textarea
            placeholder="Prompt (what did you ask the AI?)"
            value={form.prompt}
            onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
            rows={3}
          />
          <textarea
            placeholder="Code (the response / solution)"
            value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
            rows={5}
          />
          <input
            placeholder="Framework (e.g. React) — optional"
            value={form.framework}
            onChange={e => setForm(f => ({ ...f, framework: e.target.value }))}
          />
          <button className="save-btn" onClick={handleSave} disabled={saving || !form.prompt || !form.code}>
            {saving ? "Saving…" : "Save Snippet"}
          </button>
          {saveMsg && <div className="save-msg">{saveMsg}</div>}
        </div>
      )}

      <div className="popup-footer">
        <a href="http://localhost:3000" target="_blank" rel="noreferrer">Open Dashboard →</a>
      </div>
    </div>
  )
}
