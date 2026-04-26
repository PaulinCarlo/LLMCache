import { useEffect, useState } from "react"
import { sendToBackground } from "@plasmohq/messaging"
import "./styles/popup.css"

interface Snippet {
  id: string
  prompt: string
  code: string
  lineCount: number
  intent: string
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
  intent: string
  language: string
  framework: string
}

const API_BASE = "http://localhost:5000"

export default function Popup() {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [tab, setTab] = useState<"browse" | "save">("browse")
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<SaveForm>({ prompt: "", code: "", intent: "", language: "", framework: "" })
  const [saveMsg, setSaveMsg] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchSnippets()
  }, [])

  const fetchSnippets = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/snippets?pageSize=50`)
      if (res.ok) setSnippets(await res.json())
    } catch { /* backend not running */ }
  }

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
          intent: form.intent,
          environment: { language: form.language, framework: form.framework },
          constraints: "",
          tags: []
        }
      }
    })
    setSaving(false)
    if (resp?.success) {
      setSaveMsg("✓ Snippet saved!")
      setForm({ prompt: "", code: "", intent: "", language: "", framework: "" })
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
      </div>

      <div className="popup-tabs">
        <button className={`tab ${tab === "browse" ? "active" : ""}`} onClick={() => setTab("browse")}>
          Browse ({snippets.length})
        </button>
        <button className={`tab ${tab === "save" ? "active" : ""}`} onClick={() => setTab("save")}>
          + Save New
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
            placeholder="Intent (optional: why you needed this)"
            value={form.intent}
            onChange={e => setForm(f => ({ ...f, intent: e.target.value }))}
          />
          <div className="row">
            <input
              placeholder="Language (e.g. TypeScript)"
              value={form.language}
              onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
            />
            <input
              placeholder="Framework (e.g. React)"
              value={form.framework}
              onChange={e => setForm(f => ({ ...f, framework: e.target.value }))}
            />
          </div>
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
