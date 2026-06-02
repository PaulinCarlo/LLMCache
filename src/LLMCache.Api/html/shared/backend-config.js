(function (root, factory) {
  const api = factory()
  if (typeof module === "object" && module.exports) {
    module.exports = api
  }
  root.PromptCacheBackend = api
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const API_BASE_STORAGE_KEY = "pc_api_base_url"
  const API_BASE_QUERY_PARAM = "apiBaseUrl"
  const API_PROBE_PATHS = ["/login.html", "/api/snippets?pageSize=1"]
  const DEFAULT_API_BASE_CANDIDATES = [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "https://localhost:7029"
  ]

  function normalizeBaseUrl(value) {
    return typeof value === "string" ? value.trim().replace(/\/+$/, "") : ""
  }

  function readStoredApiBaseUrl() {
    try {
      return normalizeBaseUrl(localStorage.getItem(API_BASE_STORAGE_KEY))
    } catch {
      return ""
    }
  }

  function writeStoredApiBaseUrl(baseUrl) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
    if (!normalizedBaseUrl) return

    try {
      localStorage.setItem(API_BASE_STORAGE_KEY, normalizedBaseUrl)
    } catch {
      // Ignore storage failures and continue using the resolved value in-memory.
    }
  }

  function readQueryApiBaseUrl() {
    try {
      return normalizeBaseUrl(new URLSearchParams(window.location.search).get(API_BASE_QUERY_PARAM))
    } catch {
      return ""
    }
  }

  function getCurrentOriginBaseUrl() {
    if (typeof window === "undefined" || !window.location) return ""
    if (!window.location.origin || window.location.origin === "null" || window.location.protocol === "file:") {
      return ""
    }

    return normalizeBaseUrl(window.location.origin)
  }

  function getCandidateBaseUrls(preferredBaseUrl) {
    return Array.from(
      new Set(
        [
          preferredBaseUrl,
          readQueryApiBaseUrl(),
          readStoredApiBaseUrl(),
          getCurrentOriginBaseUrl(),
          ...DEFAULT_API_BASE_CANDIDATES
        ]
          .map(normalizeBaseUrl)
          .filter(Boolean)
      )
    )
  }

  async function probeApiBaseUrl(baseUrl) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
    if (!normalizedBaseUrl) return false

    for (const path of API_PROBE_PATHS) {
      try {
        const response = await fetch(`${normalizedBaseUrl}${path}`, {
          method: "GET",
          cache: "no-store"
        })

        if (response.status < 500) {
          return true
        }
      } catch {
        // Try the next probe path or base URL.
      }
    }

    return false
  }

  async function resolveApiBaseUrl(preferredBaseUrl) {
    const candidates = getCandidateBaseUrls(preferredBaseUrl)

    for (const baseUrl of candidates) {
      if (await probeApiBaseUrl(baseUrl)) {
        writeStoredApiBaseUrl(baseUrl)
        return baseUrl
      }
    }

    return candidates[0] || ""
  }

  return {
    normalizeBaseUrl,
    readStoredApiBaseUrl,
    writeStoredApiBaseUrl,
    getCandidateBaseUrls,
    resolveApiBaseUrl
  }
})
