import cssText from "data-text:../styles/widget.css"
import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useRef, useState } from "react"
import { sendToBackground } from "@plasmohq/messaging"

export const config: PlasmoCSConfig = {
  matches: [
    "https://chat.openai.com/*",
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://bard.google.com/*",
    "https://www.bing.com/chat*"
  ],
  all_frames: false
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

const SELECTORS = [
  "#prompt-textarea",
  "[contenteditable='true']",
  "textarea[placeholder]",
  "div[role='textbox']"
]

interface SearchResult {
  snippet: {
    id: string
    prompt: string
    code: string
    lineCount: number
    intent: string
    environment: {
      language?: string
      framework?: string
    }
  }
  similarityScore: number
}

interface DeltaResult {
  cacheStatus: string
  confidenceScore: number
  diffSummary: string
  annotatedPatch: string
  whatChanges: string[]
  whatRemains: string[]
}

function CacheWidget({ results, onClose, onDelta }: {
  results: SearchResult[]
  onClose: () => void
  onDelta: (result: SearchResult) => void
}) {
  const best = results[0]
  const pct = Math.round(best.similarityScore * 100)

  return (
    <div className="pc-widget" role="dialog" aria-label="PromptCache result">
      <div className="pc-header">
        <span className="pc-icon">⚡</span>
        <span className="pc-title">Cache Hit — {pct}% match</span>
        <button className="pc-close" onClick={onClose} aria-label="Dismiss">✕</button>
      </div>
      <div className="pc-body">
        <p className="pc-cached-prompt">"{best.snippet.prompt}"</p>
        <div className="pc-meta">
          {best.snippet.environment?.language && (
            <span className="pc-badge">{best.snippet.environment.language}</span>
          )}
          {best.snippet.environment?.framework && (
            <span className="pc-badge">{best.snippet.environment.framework}</span>
          )}
          <span className="pc-badge pc-lines">{best.snippet.lineCount} lines</span>
        </div>
        <pre className="pc-code">{best.snippet.code.slice(0, 300)}{best.snippet.code.length > 300 ? "\n..." : ""}</pre>
      </div>
      <div className="pc-actions">
        <button className="pc-btn pc-btn-primary" onClick={() => onDelta(best)}>
          Analyze Diff
        </button>
        <button className="pc-btn" onClick={onClose}>
          Dismiss
        </button>
      </div>
    </div>
  )
}

function DeltaWidget({ delta, onClose }: { delta: DeltaResult; onClose: () => void }) {
  const statusColor = delta.cacheStatus === "hit" ? "#22c55e" : delta.cacheStatus === "partial" ? "#f59e0b" : "#ef4444"
  return (
    <div className="pc-widget pc-delta" role="dialog" aria-label="Delta analysis">
      <div className="pc-header">
        <span className="pc-icon">🔍</span>
        <span className="pc-title">Delta Analysis</span>
        <button className="pc-close" onClick={onClose} aria-label="Dismiss">✕</button>
      </div>
      <div className="pc-body">
        <div className="pc-confidence">
          <span style={{ color: statusColor }}>●</span>
          <strong>{delta.confidenceScore}% confidence</strong>
          <span className="pc-status-badge" style={{ backgroundColor: statusColor }}>
            {delta.cacheStatus.toUpperCase()}
          </span>
        </div>
        <p className="pc-summary">{delta.diffSummary}</p>
        {delta.whatRemains.length > 0 && (
          <div className="pc-section">
            <h4>✓ What Applies</h4>
            <ul>{delta.whatRemains.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}
        {delta.whatChanges.length > 0 && (
          <div className="pc-section">
            <h4>⚡ What Changes</h4>
            <ul>{delta.whatChanges.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}
        {delta.annotatedPatch && (
          <pre className="pc-patch">{delta.annotatedPatch.slice(0, 500)}</pre>
        )}
      </div>
      <div className="pc-actions">
        <button className="pc-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

function PromptCacheOverlay() {
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [delta, setDelta] = useState<DeltaResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPromptRef = useRef("")

  useEffect(() => {
    let observer: MutationObserver | null = null

    const attachToInput = (input: Element) => {
      const handleInput = () => {
        const text = (input as HTMLInputElement | HTMLTextAreaElement).value ||
          (input as HTMLElement).innerText || ""
        if (text.length < 20 || text === lastPromptRef.current) return
        lastPromptRef.current = text
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(async () => {
          setIsLoading(true)
          const resp = await sendToBackground({ name: "index", body: { type: "SEARCH", payload: { prompt: text } } })
          setIsLoading(false)
          if (resp?.success && resp.results?.length > 0 && resp.results[0].similarityScore >= 0.65) {
            setResults(resp.results)
            setDelta(null)
          }
        }, 800)
      }
      input.addEventListener("input", handleInput)
      input.addEventListener("keyup", handleInput)
    }

    const tryAttach = () => {
      for (const sel of SELECTORS) {
        const el = document.querySelector(sel)
        if (el) { attachToInput(el); return }
      }
    }

    tryAttach()
    observer = new MutationObserver(tryAttach)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer?.disconnect()
  }, [])

  const handleDelta = async (result: SearchResult) => {
    setIsLoading(true)
    const resp = await sendToBackground({
      name: "index",
      body: { type: "DELTA", payload: { prompt: result.snippet.prompt } }
    })
    setIsLoading(false)
    if (resp?.success) {
      setDelta(resp.delta)
      setResults(null)
    }
  }

  if (!results && !delta && !isLoading) return null

  return (
    <div className="pc-container">
      {isLoading && (
        <div className="pc-widget pc-loading">
          <span className="pc-icon">⚡</span> Checking cache…
        </div>
      )}
      {results && !isLoading && (
        <CacheWidget results={results} onClose={() => setResults(null)} onDelta={handleDelta} />
      )}
      {delta && !isLoading && (
        <DeltaWidget delta={delta} onClose={() => setDelta(null)} />
      )}
    </div>
  )
}

export default PromptCacheOverlay
