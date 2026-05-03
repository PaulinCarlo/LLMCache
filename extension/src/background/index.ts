import type { PlasmoMessaging } from "@plasmohq/messaging"

const API_BASE = "http://localhost:5000"
const DEBOUNCE_MS = 500

let debounceTimers = new Map<number, ReturnType<typeof setTimeout>>()

/** Reads stored credentials and returns auth headers to attach to every request. */
async function getAuthHeaders(): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["auth"], (result) => {
      const auth = result.auth as { userId?: string; apiKey?: string } | undefined
      if (auth?.apiKey) {
        resolve({
          Authorization: `Bearer ${auth.apiKey}`,
          ...(auth.userId ? { "X-User-Id": auth.userId } : {})
        })
      } else {
        resolve({})
      }
    })
  })
}

export const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const { type, payload, tabId } = req.body

  if (type === "SEARCH") {
    const tid = tabId ?? 0
    const existing = debounceTimers.get(tid)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(async () => {
      debounceTimers.delete(tid)
      try {
        const headers = await getAuthHeaders()
        const response = await fetch(
          `${API_BASE}/api/snippets/search?prompt=${encodeURIComponent(payload.prompt)}&topK=3&minSimilarity=0.65`,
          { headers }
        )
        if (!response.ok) {
          res.send({ success: false, error: `HTTP ${response.status}` })
          return
        }
        const data = await response.json()
        res.send({ success: true, results: data })
      } catch (err) {
        res.send({ success: false, error: String(err) })
      }
    }, DEBOUNCE_MS)

    debounceTimers.set(tid, timer)
  }

  if (type === "DELTA") {
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_BASE}/api/delta`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ newPrompt: payload.prompt })
      })
      const data = await response.json()
      res.send({ success: true, delta: data })
    } catch (err) {
      res.send({ success: false, error: String(err) })
    }
  }

  if (type === "SAVE") {
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_BASE}/api/snippets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(payload)
      })
      const data = await response.json()
      res.send({ success: response.ok, snippet: data })
    } catch (err) {
      res.send({ success: false, error: String(err) })
    }
  }
}
