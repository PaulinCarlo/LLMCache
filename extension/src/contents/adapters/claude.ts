import type { ChatAdapter } from "./types"

// Claude uses a ProseMirror-based contenteditable editor
const INPUT_SEL = [
  'div[contenteditable="true"].ProseMirror',
  'div.ProseMirror[contenteditable="true"]',
  'div[contenteditable="true"][data-placeholder]',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]'
].join(", ")

const SEND_SEL = [
  'button[aria-label="Send Message"]',
  'button[aria-label="Send"]',
  'button[data-testid="send-button"]',
  'button[type="submit"][aria-label*="Send" i]'
].join(", ")

function setContentEditable(el: HTMLElement, text: string): void {
  el.focus()
  document.execCommand("selectAll", false)
  document.execCommand("insertText", false, text)
}

export class ClaudeAdapter implements ChatAdapter {
  readonly name = "Claude"

  private getInput(): HTMLElement | null {
    return document.querySelector(INPUT_SEL)
  }

  getPromptText(): string {
    return this.getInput()?.innerText ?? ""
  }

  setPromptText(text: string): void {
    const el = this.getInput()
    if (el) setContentEditable(el, text)
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
