import type { PlasmoMessaging } from "@plasmohq/messaging"
import "../../../shared/backend-api.js"
import {
  readStoredApiBaseUrl,
  resolveApiBaseUrl,
  getCandidateApiBaseUrls,
  writeStoredApiBaseUrl
} from "../backend-config"

/**
 * External message listener – receives LOGIN_SUCCESS from the website
 * (configured via externally_connectable in the manifest).
 * Stores the token so the popup can detect the login immediately.
 */
chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message?.type === "LOGIN_SUCCESS" && message.token) {
    const auth: { token: string; email?: string } = { token: message.token }
    if (message.email) auth.email = message.email
    chrome.storage.local.set({ auth })
    sendResponse({ success: true })
    return
  }

  if (message?.type === "LOGOUT") {
    chrome.storage.local.remove("auth")
    sendResponse({ success: true })
    return
  }
})

/** Reads the stored token and returns auth headers for every API request. */
async function getAuthHeaders(): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["auth"], (result) => {
      const auth = result.auth as { token?: string } | undefined
      if (auth?.token) {
        resolve({ Authorization: `Bearer ${auth.token}` })
      } else {
        resolve({})
      }
    })
  })
}

function createApiClient(baseUrl: string) {
  return (globalThis as any).PromptCacheApi.createClient({
    baseUrl,
    getAuthHeaders
  })
}

function isConnectionError(error: unknown): boolean {
  const text = String(error || "").toLowerCase()
  return (
    text.includes("failed to fetch") ||
    text.includes("networkerror") ||
    text.includes("load failed") ||
    text.includes("connection failed")
  )
}

async function callApi<T>(request: (apiClient: any) => Promise<T>): Promise<T> {
  const preferredBaseUrl = await readStoredApiBaseUrl()
  let lastError: unknown = null

  for (const baseUrl of getCandidateApiBaseUrls(preferredBaseUrl)) {
    try {
      const result = await request(createApiClient(baseUrl))
      await writeStoredApiBaseUrl(baseUrl)
      return result
    } catch (error) {
      lastError = error
      if (!isConnectionError(error)) {
        throw error
      }
    }
  }

  throw lastError ?? new Error("Connection failed")
}

export const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const { type, payload } = req.body

  if (type === "GET_API_BASE") {
    try {
      const baseUrl = await resolveApiBaseUrl(await readStoredApiBaseUrl())
      res.send({ success: true, baseUrl })
    } catch (err) {
      res.send({ success: false, error: String(err) })
    }
    return
  }

  if (type === "SEARCH") {
    try {
      const result = await callApi((apiClient) =>
        apiClient.searchSnippets({
          prompt: payload.prompt,
          topK: 3,
          minSimilarity: 0.65
        })
      )
      if (!result.ok) {
        res.send({ success: false, error: `HTTP ${result.status}` })
        return
      }
      res.send({ success: true, results: result.results })
    } catch (err) {
      res.send({ success: false, error: String(err) })
    }
    return
  }

  if (type === "LIST_SNIPPETS") {
    try {
      const result = await callApi((apiClient) =>
        apiClient.listSnippets({
          query: payload?.query ?? "",
          pageSize: 100,
          topK: 20,
          minSimilarity: 0.3
        })
      )
      if (!result.ok) {
        res.send({ success: false, error: `HTTP ${result.status}` })
        return
      }
      res.send({ success: true, snippets: result.snippets })
    } catch (err) {
      res.send({ success: false, error: String(err) })
    }
    return
  }

  if (type === "DELTA") {
    try {
      const result = await callApi((apiClient) =>
        apiClient.computeDelta({ newPrompt: payload.prompt })
      )
      res.send({ success: result.ok, delta: result.data, status: result.status })
    } catch (err) {
      res.send({ success: false, error: String(err) })
    }
    return
  }

  if (type === "SAVE") {
    try {
      const result = await callApi((apiClient) => apiClient.createSnippet(payload))
      res.send({ success: result.ok, snippet: result.data, status: result.status })
    } catch (err) {
      res.send({ success: false, error: String(err) })
    }
    return
  }
}
