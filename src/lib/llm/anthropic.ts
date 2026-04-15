// Anthropic provider. Wraps @anthropic-ai/sdk in the common LLMProvider shape.

import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, StreamOptions, CreateResult } from "./types";

export interface AnthropicConfig {
  /** Optional — if omitted, the SDK reads ANTHROPIC_API_KEY from the env. */
  apiKey?: string;
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic;

  constructor(config: AnthropicConfig = {}) {
    this.client = new Anthropic(config.apiKey ? { apiKey: config.apiKey } : {});
  }

  async *streamChat(opts: StreamOptions): AsyncIterable<{ text: string }> {
    const stream = await this.client.messages.stream(
      {
        model: opts.model,
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages: opts.messages,
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      },
      { signal: opts.signal }
    );

    for await (const event of stream) {
      if (opts.signal?.aborted) break;
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { text: event.delta.text };
      }
    }
  }

  async createChat(opts: StreamOptions): Promise<CreateResult> {
    const result = await this.client.messages.create(
      {
        model: opts.model,
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages: opts.messages,
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      },
      { signal: opts.signal }
    );
    const first = result.content[0];
    const text = first?.type === "text" ? first.text : "";
    return { text };
  }
}

// ---- Legacy helper for the image-vision path in /api/upload ----
// Vision stays on Anthropic even when LLM_PROVIDER=moonshot, since Moonshot's
// multimodal request shape differs. This helper reads the key from UI settings
// first, env var second, so changing it in the UI propagates here too.
let visionClient: Anthropic | null = null;
let visionClientKey: string | undefined;

export function getAnthropic(apiKey?: string): Anthropic {
  if (!visionClient || visionClientKey !== apiKey) {
    visionClient = new Anthropic(apiKey ? { apiKey } : {});
    visionClientKey = apiKey;
  }
  return visionClient;
}
