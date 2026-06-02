import { useEffect, useMemo, useState } from "react"
import { sendToBackground } from "@plasmohq/messaging"
import "./styles/popup.css"
import {
  DEFAULT_API_BASE_URL,
  buildDashboardUrl,
  buildLoginUrl
} from "./backend-config"

interface Snippet {
  id: string
  prompt: string
  code: string
  lineCount: number
  createdAt: string
  intent?: string
  constraints?: string
  isPublic?: boolean
  environment?: {
    language?: string
    framework?: string
    runtimeVersion?: string
    buildTool?: string
    packageManager?: string
    targetPlatform?: string
    strictMode?: boolean
  }
  tags?: string[]
}

interface SaveForm {
  prompt: string
  code: string
  constraints: string
  tags: string
  isPublic: boolean
  language: string
  framework: string
  runtimeVersion: string
  buildTool: string
  packageManager: string
  targetPlatform: string
  strictMode: boolean
}

interface AuthState {
  token: string
  email?: string
}

const EMPTY_FORM: SaveForm = {
  prompt: "",
  code: "",
  constraints: "",
  tags: "",
  isPublic: false,
  language: "",
  framework: "",
  runtimeVersion: "",
  buildTool: "",
  packageManager: "",
  targetPlatform: "",
  strictMode: false
}

function describeExtensionError(error: unknown, fallback: string): string {
  const raw = String(error || "").trim()
  const lower = raw.toLowerCase()

  if (!raw) return fallback
  if (lower.includes("connection failed")) return "PromptCache API is not reachable. Start the backend and retry."
  if (lower.includes("http 401")) return "Authentication expired. Sign in again from the popup."
  if (lower.includes("http 403")) return "Access denied for this action."
  if (lower.includes("http 404")) return "PromptCache endpoint not found."
  if (lower.includes("http 5")) return "PromptCache backend error. Please retry."
  if (lower.includes("not logged in")) return "Sign in from the popup before checking prompts."
  if (lower.includes("no prompt found")) return "No prompt found on this page. Type a prompt first."
  if (
    lower.includes("receiving end does not exist") ||
    lower.includes("could not establish connection")
  ) {
    return "Prompt check is unavailable on this page."
  }

  return `${fallback}: ${raw}`
}

export default function Popup() {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [tab, setTab] = useState<"browse" | "save">("browse")
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<SaveForm>(EMPTY_FORM)
  const [saveMsg, setSaveMsg] = useState("")
  const [saveMsgType, setSaveMsgType] = useState<"success" | "error">("success")
  const [searchQuery, setSearchQuery] = useState("")
  const [autoCheck, setAutoCheck] = useState(false)
  const [auth, setAuth] = useState<AuthState>({ token: "" })
  const [checking, setChecking] = useState(false)
  const [checkMsg, setCheckMsg] = useState("")
  const [checkMsgType, setCheckMsgType] = useState<"success" | "error">("success")
  const [activeFilter, setActiveFilter] = useState("")
  const [loadingBrowse, setLoadingBrowse] = useState(false)
  const [browseError, setBrowseError] = useState("")
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL)

  useEffect(() => {
    chrome.storage.local.get(["autoCheck", "auth"], (result) => {
      setAutoCheck((result.autoCheck as boolean) ?? false)
      if (result.auth) setAuth(result.auth as AuthState)
    })

    const onStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.auth) setAuth((changes.auth.newValue ?? { token: "" }) as AuthState)
    }
    chrome.storage.onChanged.addListener(onStorageChange)
    return () => chrome.storage.onChanged.removeListener(onStorageChange)
  }, [])

  const refreshApiBaseUrl = async () => {
    try {
      const response = await sendToBackground<any, { success?: boolean; baseUrl?: string }>({
        name: "index",
        body: { type: "GET_API_BASE" }
      })

      if (response?.success && response.baseUrl) {
        setApiBaseUrl(response.baseUrl)
        return response.baseUrl
      }
    } catch {
      setApiBaseUrl(DEFAULT_API_BASE_URL)
      return DEFAULT_API_BASE_URL
    }

    return DEFAULT_API_BASE_URL
  }

  useEffect(() => {
    void refreshApiBaseUrl()
  }, [])

  const fetchSnippets = async (query = "") => {
    if (!auth.token.trim()) return
    setLoadingBrowse(true)
    setBrowseError("")

    try {
      const resp = await sendToBackground<any, any>({
        name: "index",
        body: {
          type: "LIST_SNIPPETS",
          payload: { query }
        }
      })

      if (!resp?.success) {
        setBrowseError(describeExtensionError(resp?.error, "Failed to load snippets"))
        setSnippets([])
        return
      }

      setSnippets(Array.isArray(resp.snippets) ? resp.snippets : [])
    } catch (err) {
      setBrowseError(describeExtensionError(err, "Failed to load snippets"))
      setSnippets([])
    } finally {
      setLoadingBrowse(false)
    }
  }

  useEffect(() => {
    if (!auth.token.trim()) return
    const handle = setTimeout(() => {
      void fetchSnippets(searchQuery.trim())
    }, 250)

    return () => clearTimeout(handle)
  }, [auth.token, searchQuery])

  const handleAutoCheckToggle = () => {
    const next = !autoCheck
    setAutoCheck(next)
    chrome.storage.local.set({ autoCheck: next })
  }

  const handleCheckForPrompt = async () => {
    setChecking(true)
    setCheckMsg("")
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!activeTab?.id) {
        setCheckMsgType("error")
        setCheckMsg("No active tab found for prompt check.")
      } else {
        const response = await chrome.tabs.sendMessage(activeTab.id, { type: "CHECK_PROMPT" })
        if (!response?.success) {
          setCheckMsgType("error")
          setCheckMsg(describeExtensionError(response?.error, "Prompt check failed"))
        } else if (response.hit) {
          setCheckMsgType("success")
          setCheckMsg("Cache hit found. See overlay in the chat page.")
        } else {
          setCheckMsgType("success")
          setCheckMsg("No cache match for the current prompt.")
        }
      }
    } catch (err) {
      setCheckMsgType("error")
      setCheckMsg(describeExtensionError(err, "Prompt check failed"))
    }
    setChecking(false)
    setTimeout(() => setCheckMsg(""), 3500)
  }

  const handleLogout = () => {
    setAuth({ token: "" })
    chrome.storage.local.remove("auth")
  }

  const handleLogin = async () => {
    const baseUrl = await refreshApiBaseUrl()
    const loginUrl = `${buildLoginUrl(baseUrl)}?pc_extension_id=${encodeURIComponent(chrome.runtime.id)}`
    chrome.tabs.create({ url: loginUrl })
  }

  const isLoggedIn = auth.token.trim().length > 0

  const handleSave = async () => {
    if (!form.prompt.trim() || !form.code.trim()) return

    const tags = form.tags
      ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : []

    setSaving(true)
    const resp = await sendToBackground({
      name: "index",
      body: {
        type: "SAVE",
        payload: {
          prompt: form.prompt,
          code: form.code,
          constraints: form.constraints,
          tags,
          isPublic: form.isPublic,
          environment: {
            language: form.language || null,
            framework: form.framework || null,
            runtimeVersion: form.runtimeVersion || null,
            buildTool: form.buildTool || null,
            packageManager: form.packageManager || null,
            targetPlatform: form.targetPlatform || null,
            strictMode: form.strictMode || null,
            keyDependencies: [],
            customMetadata: []
          }
        }
      }
    })
    setSaving(false)

    if (resp?.success) {
      setSaveMsgType("success")
      setSaveMsg("✓ Snippet saved!")
      setForm(EMPTY_FORM)
      setTab("browse")
      void fetchSnippets("")
      setTimeout(() => setSaveMsg(""), 2500)
      return
    }

    setSaveMsgType("error")
    setSaveMsg(`✗ ${describeExtensionError(resp?.error || (resp?.status ? `HTTP ${resp.status}` : ""), "Save failed")}`)
    setTimeout(() => setSaveMsg(""), 3000)
  }

  const languages = useMemo(() => {
    return Array.from(new Set(snippets.map((s) => s.environment?.language).filter(Boolean) as string[])).slice(0, 6)
  }, [snippets])

  const filtered = useMemo(() => {
    if (!activeFilter) return snippets
    return snippets.filter((s) => s.environment?.language === activeFilter)
  }, [activeFilter, snippets])

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
          <a href={buildDashboardUrl(apiBaseUrl)} target="_blank" rel="noreferrer">Open Dashboard →</a>
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
          title="When on, cache is checked before every send">
          <span className="toggle-track">
            <span className="toggle-knob" />
          </span>
          <span className="toggle-label">Auto Check</span>
        </button>
        <button
          className="check-btn"
          onClick={handleCheckForPrompt}
          disabled={checking}
          title="Check the current prompt against the cache">
          {checking ? "…" : "Check ⚡"}
        </button>
      </div>
      {checkMsg && (
        <div className={`check-msg ${checkMsgType === "error" ? "error" : ""}`}>
          {checkMsg}
        </div>
      )}

      <div className="popup-tabs">
        <button className={`tab ${tab === "browse" ? "active" : ""}`} onClick={() => setTab("browse")}>
          Browse ({snippets.length})
        </button>
        <button className={`tab ${tab === "save" ? "active" : ""}`} onClick={() => setTab("save")}>
          + Save
        </button>
      </div>

      {tab === "browse" && (
        <div className="browse-pane">
          <input
            className="popup-search"
            placeholder="Search snippets by prompt, language, tag…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="filter-bar">
            <button className={`filter-btn ${!activeFilter ? "active" : ""}`} onClick={() => setActiveFilter("")}>All</button>
            {languages.map((language) => (
              <button
                key={language}
                className={`filter-btn ${activeFilter === language ? "active" : ""}`}
                onClick={() => setActiveFilter(language)}>
                {language}
              </button>
            ))}
          </div>

          <div className="snippet-list">
            {loadingBrowse && <div className="empty">Loading snippets…</div>}
            {!loadingBrowse && browseError && <div className="empty">{browseError}</div>}
            {!loadingBrowse && !browseError && filtered.length === 0 && (
              <div className="empty">No snippets found. Save your first snippet using + Save.</div>
            )}
            {!loadingBrowse && !browseError && filtered.map((s) => (
              <div key={s.id} className="snippet-card">
                <div className="snippet-prompt">{s.prompt}</div>
                {s.intent && <div className="snippet-intent">{s.intent}</div>}
                <div className="snippet-meta">
                  {s.environment?.language && <span className="tag">{s.environment.language}</span>}
                  {s.environment?.framework && <span className="tag">{s.environment.framework}</span>}
                  <span className="tag lines">{s.lineCount} lines</span>
                  {s.environment?.strictMode && <span className="tag strict">strict</span>}
                  {s.isPublic && <span className="tag">public</span>}
                </div>
                <pre className="snippet-code">{s.code}</pre>
                <div className="snippet-footer">
                  <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                  <span>{s.tags?.slice(0, 3).join(", ")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "save" && (
        <div className="save-form">
          <label className="check-label">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))}
            />
            Make snippet public
          </label>

          <div className="form-group">
            <label>Prompt</label>
            <textarea
              placeholder="What did you ask the AI?"
              value={form.prompt}
              onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Code</label>
            <textarea
              placeholder="The code response / solution"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              rows={6}
            />
          </div>

          <div className="form-group">
            <label>Constraints</label>
            <input
              placeholder="Any requirements or limitations?"
              value={form.constraints}
              onChange={(e) => setForm((f) => ({ ...f, constraints: e.target.value }))}
            />
          </div>

          <div className="row">
            <input
              placeholder="Language"
              value={form.language}
              onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
            />
            <input
              placeholder="Framework"
              value={form.framework}
              onChange={(e) => setForm((f) => ({ ...f, framework: e.target.value }))}
            />
          </div>

          <div className="row">
            <input
              placeholder="Runtime Version"
              value={form.runtimeVersion}
              onChange={(e) => setForm((f) => ({ ...f, runtimeVersion: e.target.value }))}
            />
            <input
              placeholder="Build Tool"
              value={form.buildTool}
              onChange={(e) => setForm((f) => ({ ...f, buildTool: e.target.value }))}
            />
          </div>

          <div className="row">
            <input
              placeholder="Package Manager"
              value={form.packageManager}
              onChange={(e) => setForm((f) => ({ ...f, packageManager: e.target.value }))}
            />
            <input
              placeholder="Target Platform"
              value={form.targetPlatform}
              onChange={(e) => setForm((f) => ({ ...f, targetPlatform: e.target.value }))}
            />
          </div>

          <label className="check-label">
            <input
              type="checkbox"
              checked={form.strictMode}
              onChange={(e) => setForm((f) => ({ ...f, strictMode: e.target.checked }))}
            />
            Strict Mode
          </label>

          <input
            placeholder="Tags (comma-separated): react, hooks, state"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
          />

          <button className="save-btn" onClick={handleSave} disabled={saving || !form.prompt.trim() || !form.code.trim()}>
            {saving ? "Saving…" : "Save Snippet"}
          </button>
          {saveMsg && <div className={`save-msg ${saveMsgType === "error" ? "error" : ""}`}>{saveMsg}</div>}
        </div>
      )}

      <div className="popup-footer">
        <a href={buildDashboardUrl(apiBaseUrl)} target="_blank" rel="noreferrer">Open Dashboard →</a>
      </div>
    </div>
  )
}
