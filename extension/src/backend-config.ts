import backendEndpoints from "../backend-endpoints.json"

const API_BASE_STORAGE_KEY = "apiBaseUrl"
const API_PROBE_PATHS = ["/login.html", "/api/snippets?pageSize=1"] as const
const API_PROBE_TIMEOUT_MS = 2500

export function normalizeApiBaseUrl(baseUrl?: string | null): string {
  return typeof baseUrl === "string" ? baseUrl.trim().replace(/\/+$/, "") : ""
}

const CONFIGURED_API_BASE_URLS = Array.from(
  new Set(
    [backendEndpoints.defaultBaseUrl, ...backendEndpoints.candidateBaseUrls]
      .map(normalizeApiBaseUrl)
      .filter(Boolean)
  )
)

export const DEFAULT_API_BASE_URL = CONFIGURED_API_BASE_URLS[0] || "http://localhost:3001"

export const API_BASE_CANDIDATES = CONFIGURED_API_BASE_URLS as readonly string[]

export function getCandidateApiBaseUrls(preferred?: string | null): string[] {
  return Array.from(
    new Set([normalizeApiBaseUrl(preferred), ...API_BASE_CANDIDATES].filter(Boolean))
  )
}

export async function readStoredApiBaseUrl(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([API_BASE_STORAGE_KEY], (result) => {
      const value = result[API_BASE_STORAGE_KEY]
      resolve(typeof value === "string" && value.trim() ? value : null)
    })
  })
}

export async function writeStoredApiBaseUrl(baseUrl: string): Promise<void> {
  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl)
  return new Promise((resolve) => {
    chrome.storage.local.set({ [API_BASE_STORAGE_KEY]: normalizedBaseUrl }, () => resolve())
  })
}

function buildProbeRequests(baseUrl: string): string[] {
  return API_PROBE_PATHS.map((path) => `${baseUrl}${path}`)
}

async function probeUrl(url: string): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_PROBE_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    })
    return response.status < 500
  } catch {
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function probeApiBaseUrl(baseUrl: string): Promise<boolean> {
  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl)
  if (!normalizedBaseUrl) return false

  for (const url of buildProbeRequests(normalizedBaseUrl)) {
    if (await probeUrl(url)) {
      return true
    }
  }

  return false
}

export async function resolveApiBaseUrl(preferred?: string | null): Promise<string> {
  const normalizedPreferred = normalizeApiBaseUrl(preferred)

  for (const baseUrl of getCandidateApiBaseUrls(normalizedPreferred)) {
    if (await probeApiBaseUrl(baseUrl)) {
      await writeStoredApiBaseUrl(baseUrl)
      return baseUrl
    }
  }

  return normalizedPreferred || DEFAULT_API_BASE_URL
}

export function buildDashboardUrl(baseUrl: string): string {
  return baseUrl
}

export function buildLoginUrl(baseUrl: string): string {
  return `${baseUrl}/login.html`
}
