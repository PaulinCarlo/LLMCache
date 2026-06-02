import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const extensionDir = path.resolve(__dirname, "..")
const packageJsonPath = path.join(extensionDir, "package.json")
const backendConfigPath = path.join(extensionDir, "backend-endpoints.json")

const CHAT_HOST_PERMISSIONS = [
  "https://chat.openai.com/*",
  "https://chatgpt.com/*",
  "https://claude.ai/*",
  "https://gemini.google.com/*",
  "https://bard.google.com/*",
  "https://github.com/*",
  "https://copilot.github.com/*"
]

function normalizeBaseUrl(value) {
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : ""
}

function toMatchPattern(baseUrl) {
  return `${baseUrl}/*`
}

const [packageJsonRaw, backendConfigRaw] = await Promise.all([
  fs.readFile(packageJsonPath, "utf8"),
  fs.readFile(backendConfigPath, "utf8")
])

const packageJson = JSON.parse(packageJsonRaw)
const backendConfig = JSON.parse(backendConfigRaw)

const backendBaseUrls = Array.from(
  new Set(
    [backendConfig.defaultBaseUrl, ...(backendConfig.candidateBaseUrls ?? [])]
      .map(normalizeBaseUrl)
      .filter(Boolean)
  )
)

const backendMatchPatterns = backendBaseUrls.map(toMatchPattern)

packageJson.manifest = packageJson.manifest ?? {}
packageJson.manifest.host_permissions = [...backendMatchPatterns, ...CHAT_HOST_PERMISSIONS]
packageJson.manifest.externally_connectable = {
  ...(packageJson.manifest.externally_connectable ?? {}),
  matches: backendMatchPatterns
}

await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
