export type { ChatAdapter } from "./types"
export { ChatGPTAdapter } from "./chatgpt"
export { ClaudeAdapter } from "./claude"
export { GeminiAdapter } from "./gemini"
export { GithubAdapter } from "./github"

import type { ChatAdapter } from "./types"
import { ChatGPTAdapter } from "./chatgpt"
import { ClaudeAdapter } from "./claude"
import { GeminiAdapter } from "./gemini"
import { GithubAdapter } from "./github"

/**
 * Returns the appropriate ChatAdapter for the current page hostname,
 * or null when no adapter covers the active site.
 */
export function getAdapter(): ChatAdapter | null {
  const { hostname } = window.location
  const host = hostname.toLowerCase()
  if (host === "chatgpt.com" || host === "chat.openai.com")
    return new ChatGPTAdapter()
  if (host === "claude.ai") return new ClaudeAdapter()
  if (host === "gemini.google.com" || host === "bard.google.com")
    return new GeminiAdapter()
  if (host === "github.com" || host === "www.github.com" || host === "copilot.github.com")
    return new GithubAdapter()
  return null
}
