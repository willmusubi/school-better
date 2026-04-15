// Moonshot / Kimi provider. OpenAI-compatible REST, no SDK dependency.
//
// Docs: https://platform.moonshot.ai/docs/api/chat
//       https://platform.moonshot.ai/docs/guide/use-kimi-k2-thinking-model

import type { LLMProvider, StreamOptions, CreateResult } from "./types";

export interface MoonshotConfig {
  apiKey: string;
  /** Defaults to https://api.moonshot.ai/v1 — mainland uses api.moonshot.cn/v1. */
  baseUrl?: string;
}

interface MoonshotDelta {
  role?: string;
  content?: string;
  reasoning_content?: string;
}

interface MoonshotStreamChunk {
  choices?: Array<{
    delta?: MoonshotDelta;
    finish_reason?: string | null;
  }>;
}

interface MoonshotNonStreamResponse {
  choices?: Array<{
    message?: { role: string; content: string };
    finish_reason?: string;
  }>;
}

function buildMessages(opts: StreamOptions) {
  const msgs: Array<{ role: string; content: string }> = [];
  if (opts.system) msgs.push({ role: "system", content: opts.system });
  for (const m of opts.messages) msgs.push({ role: m.role, content: m.content });
  return msgs;
}

export class MoonshotProvider implements LLMProvider {
  readonly name = "moonshot" as const;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: MoonshotConfig) {
    if (!config.apiKey) {
      throw new Error("MoonshotProvider 需要 apiKey, 请在设置里填入 Moonshot API Key。");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || "https://api.moonshot.ai/v1").replace(/\/+$/, "");
  }

  private async postChat(opts: StreamOptions, stream: boolean): Promise<Response> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: buildMessages(opts),
        stream,
        // Moonshot's thinking models (kimi-k2-thinking, kimi-k2.5) REQUIRE
        // temperature=1.0 and 400 out on anything else ("invalid temperature:
        // only 1 is allowed"). The non-thinking turbo models tolerate 1.0 too,
        // so use 1.0 as the safe default and let callers override explicitly.
        temperature: opts.temperature ?? 1.0,
        max_tokens: opts.maxTokens,
      }),
      signal: opts.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Moonshot ${res.status} ${res.statusText}: ${body.slice(0, 500)}`);
    }
    return res;
  }

  async *streamChat(opts: StreamOptions): AsyncIterable<{ text: string }> {
    const res = await this.postChat(opts, true);
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      if (opts.signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE framing: events separated by blank lines; each event is one or more
      // `data: ...` lines. Split on `\n` and handle each line individually.
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let parsed: MoonshotStreamChunk;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }
        // Intentionally drop delta.reasoning_content — no UI for it today.
        const text = parsed.choices?.[0]?.delta?.content;
        if (typeof text === "string" && text.length > 0) {
          yield { text };
        }
      }
    }
  }

  async createChat(opts: StreamOptions): Promise<CreateResult> {
    const res = await this.postChat(opts, false);
    const data = (await res.json()) as MoonshotNonStreamResponse;
    const text = data.choices?.[0]?.message?.content ?? "";
    return { text };
  }
}
