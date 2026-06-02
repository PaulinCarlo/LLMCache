import type { ChatAdapter } from "./types"

// GitHub Copilot Chat – selectors target the sidebar chat panel on github.com
const INPUT_SEL = [
  "#copilot-chat-textarea",
  'textarea[data-testid="copilot-chat-input"]',
  'textarea[data-testid="chat-input-textarea"]',
  'div[contenteditable="true"][data-testid="copilot-chat-input"]',
  'textarea[placeholder*="Ask Copilot" i]',
  'textarea[name="userMessage"]'
].join(", ")

const SEND_SEL = [
  'button[data-testid="copilot-chat-submit"]',
  'button[data-testid="chat-input-send-button"]',
  'button[aria-label*="Send" i][type="submit"]',
  'button[aria-label="Submit"]',
  "form.copilot-chat button[type='submit']"
].join(", ")

function setTextareaValue(el: HTMLTextAreaElement, text: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  )?.set
  setter?.call(el, text)
  el.dispatchEvent(new Event("input", { bubbles: true }))
  el.dispatchEvent(new Event("change", { bubbles: true }))
}

export class GithubAdapter implements ChatAdapter {
  readonly name = "GitHub Copilot"

  private getInput(): HTMLElement | null {
    return document.querySelector<HTMLElement>(INPUT_SEL)
  }

  getPromptText(): string {
    const input = this.getInput()
    if (!input) return ""
    if (input instanceof HTMLTextAreaElement) return input.value ?? ""
    return input.innerText ?? ""
  }

  setPromptText(text: string): void {
    const el = this.getInput()
    if (!el) return
    if (el instanceof HTMLTextAreaElement) {
      setTextareaValue(el, text)
      return
    }
    if (el.isContentEditable) {
      el.focus()
      document.execCommand("selectAll", false)
      document.execCommand("insertText", false, text)
    }
  }

  interceptSend(handler: (prompt: string) => Promise<boolean>): () => void {
    let active = true

    const onCapture = async (e: Event) => {
      if (!active) return
      if (!(e.target as Element)?.closest(SEND_SEL)) return
      const prompt = this.getPromptText()
      if (!prompt.trim()) return
      e.preventDefault()
      e.stopImmediatePropagation()
      const allow = await handler(prompt)
      if (allow) {
        active = false
        document.querySelector<HTMLElement>(SEND_SEL)?.click()
        active = true
      }
    }

    document.addEventListener("click", onCapture, { capture: true })
    return () => document.removeEventListener("click", onCapture, { capture: true })
  }
}
