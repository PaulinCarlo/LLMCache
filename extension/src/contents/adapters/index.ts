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
  if (hostname === "chatgpt.com" || hostname === "chat.openai.com")
    return new ChatGPTAdapter()
  if (hostname === "claude.ai") return new ClaudeAdapter()
  if (hostname === "gemini.google.com" || hostname === "bard.google.com")
    return new GeminiAdapter()
  if (hostname === "github.com") return new GithubAdapter()
  return null
}
