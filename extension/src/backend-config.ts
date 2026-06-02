export const DEFAULT_API_BASE_URL = "http://localhost:3001"

export const API_BASE_CANDIDATES = [
  DEFAULT_API_BASE_URL,
  "http://127.0.0.1:3001",
  "https://localhost:7029"
] as const

const API_BASE_STORAGE_KEY = "apiBaseUrl"

export function getCandidateApiBaseUrls(preferred?: string | null): string[] {
  return Array.from(new Set([preferred, ...API_BASE_CANDIDATES].filter(Boolean))) as string[]
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
  return new Promise((resolve) => {
    chrome.storage.local.set({ [API_BASE_STORAGE_KEY]: baseUrl }, () => resolve())
  })
}

export async function probeApiBaseUrl(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/login.html`, {
      method: "GET",
      cache: "no-store"
    })
    return response.ok
  } catch {
    return false
  }
}

export async function resolveApiBaseUrl(preferred?: string | null): Promise<string> {
  for (const baseUrl of getCandidateApiBaseUrls(preferred)) {
    if (await probeApiBaseUrl(baseUrl)) {
      await writeStoredApiBaseUrl(baseUrl)
      return baseUrl
    }
  }

  return preferred || DEFAULT_API_BASE_URL
}

export function buildDashboardUrl(baseUrl: string): string {
  return baseUrl
}

export function buildLoginUrl(baseUrl: string): string {
  return `${baseUrl}/login.html`
}
