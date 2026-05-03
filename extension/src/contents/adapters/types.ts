export interface ChatAdapter {
  /** Human-readable platform name */
  readonly name: string

  /** Read the current text from the prompt input */
  getPromptText(): string

  /**
   * Write text into the prompt input, simulating user input so the host
   * application's state (React / Angular / etc.) is updated correctly.
   */
  setPromptText(text: string): void

  /**
   * Attach a send interceptor.  The handler is called with the current
   * prompt before every send attempt.
   *
   * - Return `true`  → let the send proceed normally.
   * - Return `false` → block the send (caller will show cached result).
   *
   * Returns a cleanup function that removes the interceptor.
   */
  interceptSend(handler: (prompt: string) => Promise<boolean>): () => void
}
