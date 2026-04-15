// Factory: build a provider from current settings (UI-saved > env > default).
// Route code imports from here exclusively — no SDK-specific types leak upward.

import type { LLMProvider } from "./types";
import { AnthropicProvider, getAnthropic as _getAnthropic } from "./anthropic";
import { MoonshotProvider } from "./moonshot";
import {
  effectiveProvider,
  effectiveApiKey,
  effectiveMoonshotBaseUrl,
  effectiveModel,
} from "@/lib/app-settings";

export type { LLMMessage, StreamOptions, LLMProvider } from "./types";

// Thin wrapper so routes stay provider-agnostic; the factory handles config.
// Cached on the module, but we invalidate on every getLLM() call because the
// settings file can change underfoot and we want new calls to see new keys.
export function getLLM(): LLMProvider {
  const provider = effectiveProvider();
  if (provider === "moonshot") {
    const apiKey = effectiveApiKey("moonshot");
    if (!apiKey) {
      throw new Error(
        "Moonshot API Key 未配置。请点击右上角头像 → AI 配置,填入 Kimi/Moonshot 的 API Key。"
      );
    }
    return new MoonshotProvider({ apiKey, baseUrl: effectiveMoonshotBaseUrl() });
  }
  // Anthropic branch: apiKey may be undefined, SDK falls back to env.
  const apiKey = effectiveApiKey("anthropic");
  return new AnthropicProvider({ apiKey });
}

/** Effective model names for each call site. Call at request time, not import time. */
export const CHAT_MODEL_SLOT = "chat" as const;
export const FOLLOWUP_MODEL_SLOT = "followup" as const;
export const CLASSIFY_MODEL_SLOT = "classify" as const;

export function getChatModel(): string {
  return effectiveModel("chat");
}
export function getFollowupModel(): string {
  return effectiveModel("followup");
}
export function getClassifyModel(): string {
  return effectiveModel("classify");
}

// Image vision path. Reads the Anthropic key from UI settings first, env second.
export function getAnthropic() {
  return _getAnthropic(effectiveApiKey("anthropic"));
}
