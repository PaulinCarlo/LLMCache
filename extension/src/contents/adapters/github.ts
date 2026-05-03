import type { ChatAdapter } from "./types"

// GitHub Copilot Chat – selectors target the sidebar chat panel on github.com
const INPUT_SEL = [
  "#copilot-chat-textarea",
  'textarea[data-testid="copilot-chat-input"]',
  'textarea[placeholder*="Ask Copilot" i]',
  'textarea[name="userMessage"]'
].join(", ")

const SEND_SEL = [
  'button[data-testid="copilot-chat-submit"]',
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

  private getInput(): HTMLTextAreaElement | null {
    return document.querySelector(INPUT_SEL)
  }

  getPromptText(): string {
    return this.getInput()?.value ?? ""
  }

  setPromptText(text: string): void {
    const el = this.getInput()
    if (el) setTextareaValue(el, text)
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
