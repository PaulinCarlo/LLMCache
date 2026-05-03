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
  userId: string
  apiKey: string
}

const API_BASE = "http://localhost:5000"

export default function Popup() {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [tab, setTab] = useState<"browse" | "save" | "account">("browse")
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<SaveForm>({ prompt: "", code: "", framework: "" })
  const [saveMsg, setSaveMsg] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [autoCheck, setAutoCheck] = useState(false)
  const [auth, setAuth] = useState<AuthState>({ userId: "", apiKey: "" })
  const [authSaved, setAuthSaved] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    fetchSnippets()
    chrome.storage.local.get(["autoCheck", "auth"], (result) => {
      setAutoCheck((result.autoCheck as boolean) ?? false)
      if (result.auth) setAuth(result.auth as AuthState)
    })
  }, [])

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

  const handleSaveAuth = () => {
    chrome.storage.local.set({ auth })
    setAuthSaved(true)
    setTimeout(() => setAuthSaved(false), 2000)
  }

  const handleLogout = () => {
    const empty: AuthState = { userId: "", apiKey: "" }
    setAuth(empty)
    chrome.storage.local.remove("auth")
  }

  const isLoggedIn = auth.userId.trim().length > 0

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

  return (
    <div className="popup">
      <div className="popup-header">
        <span className="popup-logo">⚡</span>
        <span className="popup-title">PromptCache</span>
        {isLoggedIn && (
          <span className="popup-user" title={auth.userId}>👤 {auth.userId}</span>
        )}
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
        <button className={`tab ${tab === "account" ? "active" : ""}`} onClick={() => setTab("account")}>
          Account{isLoggedIn ? " ✓" : ""}
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

      {tab === "account" && (
        <div className="save-form">
          <div className="account-status">
            {isLoggedIn
              ? <span className="status-on">● Logged in as {auth.userId}</span>
              : <span className="status-off">● Not logged in</span>}
          </div>
          <input
            placeholder="User ID / Email"
            value={auth.userId}
            onChange={e => setAuth(a => ({ ...a, userId: e.target.value }))}
          />
          <input
            type="password"
            placeholder="API Key"
            value={auth.apiKey}
            onChange={e => setAuth(a => ({ ...a, apiKey: e.target.value }))}
          />
          <div className="row">
            <button
              className="save-btn"
              onClick={handleSaveAuth}
              disabled={!auth.userId || !auth.apiKey}
            >
              {authSaved ? "✓ Saved!" : "Save Credentials"}
            </button>
            {isLoggedIn && (
              <button className="save-btn logout-btn" onClick={handleLogout}>
                Logout
              </button>
            )}
          </div>
        </div>
      )}

      <div className="popup-footer">
        <a href="http://localhost:3000" target="_blank" rel="noreferrer">Open Dashboard →</a>
      </div>
    </div>
  )
}
