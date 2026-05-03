import type { ChatAdapter } from "./types"

// Gemini uses a Quill-based rich textarea inside a <rich-textarea> custom element
const INPUT_SEL = [
  '.ql-editor[contenteditable="true"]',
  'rich-textarea div[contenteditable="true"]',
  'div[contenteditable="true"][data-placeholder]'
].join(", ")

const SEND_SEL = [
  "button.send-button",
  'button[aria-label="Send message"]',
  'button[aria-label*="Send" i][mat-icon-button]',
  'button[mattooltip*="Send" i]'
].join(", ")

function setContentEditable(el: HTMLElement, text: string): void {
  el.focus()
  document.execCommand("selectAll", false)
  document.execCommand("insertText", false, text)
}

export class GeminiAdapter implements ChatAdapter {
  readonly name = "Gemini"

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
