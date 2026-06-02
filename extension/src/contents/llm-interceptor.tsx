import cssText from "data-text:../styles/widget.css"
import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useRef, useState } from "react"
import { sendToBackground } from "@plasmohq/messaging"
import { getAdapter, type ChatAdapter } from "./adapters"

export const config: PlasmoCSConfig = {
  matches: [
    "https://chat.openai.com/*",
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://bard.google.com/*",
    "https://www.bing.com/chat*",
    "https://github.com/*",
    "https://copilot.github.com/*"
  ],
  all_frames: false
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

// Fallback generic selectors used when no site-specific adapter is available
const FALLBACK_SELECTORS = [
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

interface FeedbackError {
  title: string
  detail: string
}

async function searchCache(prompt: string) {
  return sendToBackground<any, any>({
    name: "index",
    body: { type: "SEARCH", payload: { prompt } }
  })
}

const CONNECTION_FAILED = "connection failed"

async function searchCacheWithTimeout(prompt: string, timeoutMs = 5000) {
  const timeout = new Promise<{ success: false; error: string }>((resolve) =>
    setTimeout(() => resolve({ success: false, error: CONNECTION_FAILED }), timeoutMs)
  )
  return Promise.race([searchCache(prompt), timeout])
}

function buildErrorFeedback(error: unknown, action: string): FeedbackError {
  const raw = String(error || "").trim()
  const lower = raw.toLowerCase()

  if (!raw) {
    return {
      title: `${action} failed`,
      detail: "Unexpected extension error. Please try again."
    }
  }

  if (lower.includes(CONNECTION_FAILED)) {
    return {
      title: "Connection failed",
      detail: "PromptCache API is not reachable. Start the backend and try again."
    }
  }

  if (lower.includes("http 401")) {
    return {
      title: "Authentication required",
      detail: "Your session expired. Sign in again from the PromptCache popup."
    }
  }

  if (lower.includes("http 403")) {
    return {
      title: "Access denied",
      detail: "Your account is not allowed to perform this action."
    }
  }

  if (lower.includes("http 404")) {
    return {
      title: "Service not found",
      detail: "PromptCache endpoint not found. Verify backend URL and route setup."
    }
  }

  if (lower.includes("http 5")) {
    return {
      title: "Server error",
      detail: "PromptCache backend failed to process this request. Try again shortly."
    }
  }

  if (lower.includes("no prompt found")) {
    return {
      title: "No prompt detected",
      detail: "Type a prompt first, then run cache check again."
    }
  }

  if (lower.includes("not logged in")) {
    return {
      title: "Not logged in",
      detail: "Sign in from the PromptCache popup to enable cache checks."
    }
  }

  return {
    title: `${action} failed`,
    detail: raw
  }
}

function CacheWidget({
  results,
  onClose,
  onDelta,
  onUse
}: {
  results: SearchResult[]
  onClose: () => void
  onDelta: (result: SearchResult) => void
  onUse: (result: SearchResult) => void
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
        <pre className="pc-code">
          {best.snippet.code.slice(0, 300)}
          {best.snippet.code.length > 300 ? "\n..." : ""}
        </pre>
      </div>
      <div className="pc-actions">
        <button className="pc-btn pc-btn-primary" onClick={() => onUse(best)}>
          Use Response
        </button>
        <button className="pc-btn" onClick={() => onDelta(best)}>
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
  const statusColor =
    delta.cacheStatus === "hit"
      ? "#22c55e"
      : delta.cacheStatus === "partial"
        ? "#f59e0b"
        : "#ef4444"

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
  const [error, setError] = useState<FeedbackError | null>(null)
  const adapterRef = useRef<ChatAdapter | null>(null)
  const autoCheckRef = useRef(false)
  const isLoggedInRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPromptRef = useRef("")

  // Keep autoCheck flag in sync with storage
  useEffect(() => {
    chrome.storage.local.get(["autoCheck"], (r) => {
      autoCheckRef.current = (r.autoCheck as boolean) ?? false
    })
    const onChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ("autoCheck" in changes) {
        autoCheckRef.current = (changes.autoCheck.newValue as boolean) ?? false
      }
    }
    chrome.storage.onChanged.addListener(onChange)
    return () => chrome.storage.onChanged.removeListener(onChange)
  }, [])

  // Keep isLoggedIn flag in sync with storage
  useEffect(() => {
    chrome.storage.local.get(["auth"], (r) => {
      isLoggedInRef.current = !!(r.auth as { token?: string } | undefined)?.token
    })
    const onChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ("auth" in changes) {
        isLoggedInRef.current = !!(changes.auth.newValue as { token?: string } | undefined)?.token
      }
    }
    chrome.storage.onChanged.addListener(onChange)
    return () => chrome.storage.onChanged.removeListener(onChange)
  }, [])

  // Set up adapter, send interceptor, and fallback input listener
  useEffect(() => {
    let sendCleanup: (() => void) | null = null

    const setup = () => {
      const adapter = getAdapter()
      adapterRef.current = adapter

      if (adapter) {
        // Intercept send button via the site-specific adapter
        sendCleanup?.()
        sendCleanup = adapter.interceptSend(async (prompt) => {
          if (!autoCheckRef.current) return true // pass-through when disabled
          if (!isLoggedInRef.current) return true // pass-through when not logged in
          setIsLoading(true)
          const resp = await searchCacheWithTimeout(prompt)
          setIsLoading(false)
          if (resp?.error) {
            setError(buildErrorFeedback(resp.error, "Cache check"))
            return true // unblock send on timeout
          }
          if (
            resp?.success &&
            resp.results?.length > 0 &&
            resp.results[0].similarityScore >= 0.65
          ) {
            setResults(resp.results)
            setDelta(null)
            return false // block send – show cached result
          }
          return true // no hit – let send proceed
        })
      } else {
        // No adapter: attach a generic input listener for real-time suggestions
        const attachInput = (input: Element) => {
          const handleInput = () => {
            const text =
              (input as HTMLInputElement).value ||
              (input as HTMLElement).innerText ||
              ""
            if (text.length < 20 || text === lastPromptRef.current) return
            lastPromptRef.current = text
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(async () => {
              if (!isLoggedInRef.current) return // skip when not logged in
              setIsLoading(true)
              const resp = await searchCacheWithTimeout(text)
              setIsLoading(false)
              if (resp?.error) {
                setError(buildErrorFeedback(resp.error, "Cache check"))
                return
              }
              if (
                resp?.success &&
                resp.results?.length > 0 &&
                resp.results[0].similarityScore >= 0.65
              ) {
                setResults(resp.results)
                setDelta(null)
              }
            }, 800)
          }
          input.addEventListener("input", handleInput)
          input.addEventListener("keyup", handleInput)
        }

        for (const sel of FALLBACK_SELECTORS) {
          const el = document.querySelector(sel)
          if (el) {
            attachInput(el)
            break
          }
        }
      }
    }

    setup()

    const observer = new MutationObserver(() => {
      if (!adapterRef.current) setup()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      sendCleanup?.()
    }
  }, [])

  // Handle CHECK_PROMPT messages sent from the popup
  useEffect(() => {
    const onMessage = (
      message: any,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (r: any) => void
    ) => {
      if (message.type !== "CHECK_PROMPT") return false

      if (!isLoggedInRef.current) {
        sendResponse({ success: false, error: "Not logged in" })
        return false
      }

      const adapter = adapterRef.current
      const prompt = adapter ? adapter.getPromptText() : ""
      if (!prompt.trim()) {
        sendResponse({ success: false, error: "No prompt found" })
        return false
      }

      setIsLoading(true)
      searchCacheWithTimeout(prompt).then((resp) => {
        setIsLoading(false)
        if (resp?.error) {
          setError(buildErrorFeedback(resp.error, "Cache check"))
          sendResponse({ success: false, error: resp.error })
          return
        }
        if (
          resp?.success &&
          resp.results?.length > 0 &&
          resp.results[0].similarityScore >= 0.65
        ) {
          setResults(resp.results)
          setDelta(null)
          sendResponse({ success: true, hit: true })
        } else {
          sendResponse({ success: true, hit: false })
        }
      })
      return true // async response
    }

    chrome.runtime.onMessage.addListener(onMessage)
    return () => chrome.runtime.onMessage.removeListener(onMessage)
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
    } else {
      setError(buildErrorFeedback(resp?.error, "Delta analysis"))
    }
  }

  // Paste the cached code response back into the chat input
  const handleUse = (result: SearchResult) => {
    adapterRef.current?.setPromptText(result.snippet.code)
    setResults(null)
  }

  if (!results && !delta && !isLoading && !error) return null

  return (
    <div className="pc-container">
      {isLoading && (
        <div className="pc-widget pc-loading">
          <span className="pc-icon">⚡</span> Checking cache…
        </div>
      )}
      {error && !isLoading && (
        <div className="pc-widget pc-error">
          <div className="pc-header">
            <span className="pc-icon">⚠</span>
            <span className="pc-title">{error.title}</span>
            <button className="pc-close" onClick={() => setError(null)} aria-label="Dismiss">✕</button>
          </div>
          <div className="pc-body">
            <p className="pc-error-detail">{error.detail}</p>
          </div>
        </div>
      )}
      {results && !isLoading && (
        <CacheWidget
          results={results}
          onClose={() => setResults(null)}
          onDelta={handleDelta}
          onUse={handleUse}
        />
      )}
      {delta && !isLoading && (
        <DeltaWidget delta={delta} onClose={() => setDelta(null)} />
      )}
    </div>
  )
}

export default PromptCacheOverlay
