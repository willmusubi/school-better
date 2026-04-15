// Shared LLM provider interface. Pick a provider via LLM_PROVIDER env var;
// every route talks to this surface instead of a specific SDK.

export type LLMRole = "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface StreamOptions {
  /** Model name native to the provider (e.g. "claude-sonnet-4-6", "kimi-k2-thinking"). */
  model: string;
  /** System prompt. Becomes a system role message for OpenAI-style providers. */
  system: string;
  messages: LLMMessage[];
  /** Upper bound on generated tokens. Thinking models should get >= 16k. */
  maxTokens: number;
  /** Abort token; forwarded to fetch / SDK so a disconnected client doesn't burn tokens. */
  signal?: AbortSignal;
  /** 0..1. Kimi thinking forces 1.0 internally; providers may clamp. */
  temperature?: number;
}

export interface CreateResult {
  text: string;
}

/**
 * Every provider exposes the same two verbs:
 *  - streamChat: yields text deltas as they arrive (used by chat + tool routes)
 *  - createChat: one-shot non-streaming call (used by followups + upload classification)
 *
 * Reasoning / thinking tokens are intentionally NOT surfaced here. They exist in
 * Kimi's stream but are noise for an end-user UI that doesn't render them. If we
 * ever want a "show thinking" UI, add a second channel here.
 */
export interface LLMProvider {
  readonly name: "anthropic" | "moonshot";
  streamChat(opts: StreamOptions): AsyncIterable<{ text: string }>;
  createChat(opts: StreamOptions): Promise<CreateResult>;
}
