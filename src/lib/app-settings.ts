// Server-side app settings: provider choice, API keys, model overrides.
// Persisted to data/settings.json (gitignored via data/).
//
// Resolution order at call sites: UI settings (this file) > env var > default.
// Keys are only sent to the client as redacted hints; the raw value never leaves
// the server after the teacher types it in once.

import * as fs from "fs";
import * as path from "path";

export type ProviderName = "anthropic" | "moonshot";

export interface AppSettings {
  provider: ProviderName;
  apiKeys: {
    anthropic?: string;
    moonshot?: string;
  };
  moonshotBaseUrl?: string;
  models: {
    chat?: string;
    followup?: string;
    classify?: string;
  };
}

/** What the client is allowed to see. API keys appear as "sk-...last4" or null. */
export interface RedactedSettings {
  provider: ProviderName;
  apiKeyHints: {
    anthropic: string | null;
    moonshot: string | null;
  };
  moonshotBaseUrl: string;
  /** Effective (resolved) model names — override > env > default. */
  models: {
    chat: string;
    followup: string;
    classify: string;
  };
  /** Raw UI overrides, or null if the teacher hasn't set one. Used for pre-selecting UI state. */
  modelOverrides: {
    chat: string | null;
    followup: string | null;
    classify: string | null;
  };
  /** For UX: tells the client whether env vars are providing a fallback. */
  envFallback: {
    anthropic: boolean;
    moonshot: boolean;
  };
}

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

const DEFAULT_MODELS = {
  anthropic: {
    chat: "claude-sonnet-4-6",
    followup: "claude-haiku-4-5-20251001",
    classify: "claude-sonnet-4-6",
  },
  moonshot: {
    chat: "kimi-k2-thinking",
    followup: "kimi-k2-turbo-preview",
    classify: "kimi-k2-turbo-preview",
  },
} as const;

function emptySettings(): AppSettings {
  return {
    provider: (process.env.LLM_PROVIDER === "moonshot" || process.env.LLM_PROVIDER === "kimi")
      ? "moonshot"
      : "anthropic",
    apiKeys: {},
    models: {},
  };
}

let cached: AppSettings | null = null;

export function loadSettings(): AppSettings {
  if (cached) return cached;
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      cached = {
        provider: parsed.provider === "moonshot" ? "moonshot" : "anthropic",
        apiKeys: parsed.apiKeys || {},
        moonshotBaseUrl: parsed.moonshotBaseUrl,
        models: parsed.models || {},
      };
      return cached;
    }
  } catch (err) {
    console.error("[settings] failed to load, using empty:", err);
  }
  cached = emptySettings();
  return cached;
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const next: AppSettings = {
    provider: patch.provider ?? current.provider,
    apiKeys: { ...current.apiKeys, ...(patch.apiKeys || {}) },
    moonshotBaseUrl: patch.moonshotBaseUrl !== undefined ? patch.moonshotBaseUrl : current.moonshotBaseUrl,
    models: { ...current.models, ...(patch.models || {}) },
  };

  // Empty strings mean "unset this key/model override". Normalize them away.
  (["anthropic", "moonshot"] as const).forEach((k) => {
    if (next.apiKeys[k] === "") delete next.apiKeys[k];
  });
  (["chat", "followup", "classify"] as const).forEach((k) => {
    if (next.models[k] === "") delete next.models[k];
  });
  if (next.moonshotBaseUrl === "") next.moonshotBaseUrl = undefined;

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${SETTINGS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
    fs.renameSync(tmp, SETTINGS_FILE);
    cached = next;
  } catch (err) {
    console.error("[settings] failed to persist:", err);
    throw new Error("保存设置失败,请检查磁盘权限");
  }
  return next;
}

/**
 * Effective value for a given setting: UI-provided first, env var second,
 * default third. Routes call these helpers instead of reading settings directly.
 */
export function effectiveProvider(): ProviderName {
  return loadSettings().provider;
}

export function effectiveApiKey(provider: ProviderName): string | undefined {
  const s = loadSettings();
  const fromUi = s.apiKeys[provider];
  if (fromUi) return fromUi;
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY || undefined;
  return process.env.MOONSHOT_API_KEY || undefined;
}

export function effectiveMoonshotBaseUrl(): string {
  const s = loadSettings();
  return (
    s.moonshotBaseUrl ||
    process.env.MOONSHOT_BASE_URL ||
    "https://api.moonshot.ai/v1"
  );
}

export function effectiveModel(slot: "chat" | "followup" | "classify"): string {
  const s = loadSettings();
  const provider = s.provider;
  // UI override
  if (s.models[slot]) return s.models[slot]!;
  // Env var override (legacy)
  const envKey = `LLM_${slot.toUpperCase()}_MODEL`;
  if (process.env[envKey]) return process.env[envKey]!;
  return DEFAULT_MODELS[provider][slot];
}

/** Build the sanitized view that's safe to send back to the client. */
export function redactForClient(): RedactedSettings {
  const s = loadSettings();
  const hint = (raw: string | undefined): string | null => {
    if (!raw) return null;
    const last4 = raw.slice(-4);
    return `${raw.slice(0, 3)}•••${last4}`;
  };
  const p = s.provider;
  return {
    provider: p,
    apiKeyHints: {
      anthropic: hint(s.apiKeys.anthropic),
      moonshot: hint(s.apiKeys.moonshot),
    },
    moonshotBaseUrl: s.moonshotBaseUrl || process.env.MOONSHOT_BASE_URL || "https://api.moonshot.ai/v1",
    models: {
      chat: s.models.chat || process.env.LLM_CHAT_MODEL || DEFAULT_MODELS[p].chat,
      followup: s.models.followup || process.env.LLM_FOLLOWUP_MODEL || DEFAULT_MODELS[p].followup,
      classify: s.models.classify || process.env.LLM_CLASSIFY_MODEL || DEFAULT_MODELS[p].classify,
    },
    modelOverrides: {
      chat: s.models.chat || null,
      followup: s.models.followup || null,
      classify: s.models.classify || null,
    },
    envFallback: {
      anthropic: !s.apiKeys.anthropic && !!process.env.ANTHROPIC_API_KEY,
      moonshot: !s.apiKeys.moonshot && !!process.env.MOONSHOT_API_KEY,
    },
  };
}
