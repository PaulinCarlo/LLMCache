import type { ChatAdapter } from "./types"

// ChatGPT uses a contenteditable div (#prompt-textarea) in the current UI
const INPUT_SEL = "#prompt-textarea"
const SEND_SEL = 'button[data-testid="send-button"]'

function setInputText(el: Element, text: string): void {
  if ((el as HTMLElement).isContentEditable) {
    ;(el as HTMLElement).focus()
    document.execCommand("selectAll", false)
    document.execCommand("insertText", false, text)
  } else {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    )?.set
    setter?.call(el, text)
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  }
}

export class ChatGPTAdapter implements ChatAdapter {
  readonly name = "ChatGPT"

  getPromptText(): string {
    const el = document.querySelector<HTMLElement>(INPUT_SEL)
    if (!el) return ""
    return (el as HTMLTextAreaElement).value ?? el.innerText ?? ""
  }

  setPromptText(text: string): void {
    const el = document.querySelector(INPUT_SEL)
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
