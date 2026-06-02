import type { ChatAdapter } from "./types"

// Gemini uses a Quill-based rich textarea inside a <rich-textarea> custom element
const INPUT_SEL = [
  'rich-textarea textarea',
  '.ql-editor[contenteditable="true"]',
  'rich-textarea div[contenteditable="true"]',
  'div[contenteditable="true"][data-placeholder]',
  'div[aria-label*="Enter a prompt" i][contenteditable="true"]'
].join(", ")

const SEND_SEL = [
  'button[data-test-id*="send" i]',
  "button.send-button",
  'button[aria-label="Send message"]',
  'button[aria-label="Send"]',
  'button[aria-label*="Send" i][mat-icon-button]',
  'button[mattooltip*="Send" i]',
  'button[aria-label*="Submit" i]'
].join(", ")

function setInputText(el: HTMLElement, text: string): void {
  if (el instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    )?.set
    setter?.call(el, text)
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
    return
  }

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
    const input = this.getInput()
    if (!input) return ""
    if (input instanceof HTMLTextAreaElement) return input.value ?? ""
    return input.innerText ?? ""
  }

  setPromptText(text: string): void {
    const el = this.getInput()
    if (el) setInputText(el, text)
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
