"use client";

import { useEffect, useState, useCallback } from "react";

type Provider = "anthropic" | "moonshot";

interface RedactedSettings {
  provider: Provider;
  apiKeyHints: { anthropic: string | null; moonshot: string | null };
  moonshotBaseUrl: string;
  models: { chat: string; followup: string; classify: string };
  modelOverrides: { chat: string | null; followup: string | null; classify: string | null };
  envFallback: { anthropic: boolean; moonshot: boolean };
}

// Preset model lists per provider. "自定义..." sentinel lets the teacher type
// a new model name we haven't put on the list yet (common during API rollout).
const MODEL_OPTIONS: Record<Provider, { value: string; label: string }[]> = {
  anthropic: [
    { value: "claude-sonnet-4-6", label: "claude-sonnet-4-6 · 默认,平衡" },
    { value: "claude-opus-4-6", label: "claude-opus-4-6 · 最强推理" },
    { value: "claude-haiku-4-5-20251001", label: "claude-haiku-4-5 · 快速 / 便宜" },
  ],
  moonshot: [
    { value: "kimi-k2-thinking", label: "kimi-k2-thinking · 默认,强制思考" },
    { value: "kimi-k2-thinking-turbo", label: "kimi-k2-thinking-turbo · 快速思考" },
    { value: "kimi-k2.5", label: "kimi-k2.5 · 最新,思考默认开" },
    { value: "kimi-k2-turbo-preview", label: "kimi-k2-turbo-preview · 快速,不思考" },
    { value: "kimi-k2-0905-preview", label: "kimi-k2-0905-preview · 早期预览版" },
  ],
};

const CUSTOM_SENTINEL = "__custom__";

interface Props {
  onClose: () => void;
}

const MOONSHOT_BASE_OPTIONS = [
  { value: "https://api.moonshot.ai/v1", label: "海外 · api.moonshot.ai" },
  { value: "https://api.moonshot.cn/v1", label: "国内 · api.moonshot.cn" },
];

export function SettingsModal({ onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [provider, setProvider] = useState<Provider>("anthropic");
  const [anthropicHint, setAnthropicHint] = useState<string | null>(null);
  const [moonshotHint, setMoonshotHint] = useState<string | null>(null);
  const [anthropicEnvFallback, setAnthropicEnvFallback] = useState(false);
  const [moonshotEnvFallback, setMoonshotEnvFallback] = useState(false);

  // Draft values — empty string means "don't update"; undefined never sent.
  // We keep drafts separate from hints so the teacher can see "sk-...58A" as
  // a hint and type a new key to replace it.
  const [anthropicKeyDraft, setAnthropicKeyDraft] = useState("");
  const [moonshotKeyDraft, setMoonshotKeyDraft] = useState("");
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showMoonshotKey, setShowMoonshotKey] = useState(false);

  const [moonshotBaseUrl, setMoonshotBaseUrl] = useState(MOONSHOT_BASE_OPTIONS[0].value);

  // chatModel / followupModel: the teacher's override. Empty = "use default".
  // We track dirty flags so we know whether the teacher actually touched the
  // field — only dirty fields get sent on save.
  const [chatModel, setChatModel] = useState("");
  const [followupModel, setFollowupModel] = useState("");
  const [chatDirty, setChatDirty] = useState(false);
  const [followupDirty, setFollowupDirty] = useState(false);
  const [chatModelDefault, setChatModelDefault] = useState("");
  const [followupModelDefault, setFollowupModelDefault] = useState("");

  const hydrate = useCallback((s: RedactedSettings) => {
    setProvider(s.provider);
    setAnthropicHint(s.apiKeyHints.anthropic);
    setMoonshotHint(s.apiKeyHints.moonshot);
    setAnthropicEnvFallback(s.envFallback.anthropic);
    setMoonshotEnvFallback(s.envFallback.moonshot);
    setMoonshotBaseUrl(s.moonshotBaseUrl);
    // Pre-select saved overrides; otherwise leave blank so the dropdown shows "使用默认".
    setChatModel(s.modelOverrides.chat || "");
    setFollowupModel(s.modelOverrides.followup || "");
    setChatDirty(false);
    setFollowupDirty(false);
    setChatModelDefault(s.models.chat);
    setFollowupModelDefault(s.models.followup);
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("加载设置失败"))))
      .then((data: RedactedSettings) => {
        if (!cancelled) hydrate(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "加载设置失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  // When the teacher changes provider, reset the default hints + clear any
  // pre-selected model overrides that belong to the other provider.
  useEffect(() => {
    if (loading) return;
    if (provider === "moonshot") {
      setChatModelDefault((c) => c.startsWith("kimi-") ? c : "kimi-k2-thinking");
      setFollowupModelDefault((c) => c.startsWith("kimi-") ? c : "kimi-k2-turbo-preview");
    } else {
      setChatModelDefault((c) => c.startsWith("claude-") ? c : "claude-sonnet-4-6");
      setFollowupModelDefault((c) => c.startsWith("claude-") ? c : "claude-haiku-4-5-20251001");
    }
    // When switching providers, any stored model override from the other
    // provider is nonsense — clear the draft so we don't save a cross-provider
    // mismatch (e.g. kimi-* saved while provider=anthropic).
    const valid = MODEL_OPTIONS[provider].map((o) => o.value);
    setChatModel((c) => (c && !valid.includes(c) && !c.startsWith(provider === "moonshot" ? "kimi-" : "claude-") ? "" : c));
    setFollowupModel((c) => (c && !valid.includes(c) && !c.startsWith(provider === "moonshot" ? "kimi-" : "claude-") ? "" : c));
  }, [provider, loading]);

  const keyDraftInvalid = (draft: string): boolean =>
    draft !== "" && (/[\u0080-\uffff]/.test(draft) || /\s/.test(draft));
  const canSave =
    !saving &&
    !keyDraftInvalid(anthropicKeyDraft) &&
    !keyDraftInvalid(moonshotKeyDraft);

  const save = async () => {
    setSaving(true);
    setError(null);
    // Build a patch that only includes fields the teacher actually changed.
    // Empty drafts stay undefined so the server leaves the saved key alone.
    const patch: {
      provider: Provider;
      apiKeys?: { anthropic?: string; moonshot?: string };
      moonshotBaseUrl?: string;
      models?: { chat?: string; followup?: string };
    } = { provider };
    const apiKeys: { anthropic?: string; moonshot?: string } = {};
    if (anthropicKeyDraft.trim()) apiKeys.anthropic = anthropicKeyDraft.trim();
    if (moonshotKeyDraft.trim()) apiKeys.moonshot = moonshotKeyDraft.trim();
    if (Object.keys(apiKeys).length > 0) patch.apiKeys = apiKeys;
    patch.moonshotBaseUrl = moonshotBaseUrl;
    // Dirty model fields go through; empty + dirty means "clear this override".
    const models: { chat?: string; followup?: string } = {};
    if (chatDirty) models.chat = chatModel.trim();
    if (followupDirty) models.followup = followupModel.trim();
    if (Object.keys(models).length > 0) patch.models = models;

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "保存失败");
      }
      const updated: RedactedSettings = await res.json();
      hydrate(updated);
      // Clear the API-key drafts after save — the teacher sees a new hint and
      // knows it landed. Model drafts stay so the teacher can see what's active.
      setAnthropicKeyDraft("");
      setMoonshotKeyDraft("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const clearKey = async (which: Provider) => {
    if (!confirm(`确定清除已保存的 ${which === "anthropic" ? "Claude" : "Kimi"} API Key 吗?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKeys: { [which]: "" } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "清除失败");
      }
      const updated: RedactedSettings = await res.json();
      hydrate(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "清除失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-ink-900/15 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-[560px] max-h-[88vh] overflow-y-auto rounded-2xl bg-paper-50 shadow-[var(--shadow-lg)] ring-1 ring-ink-100/40 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-dian-500/10 text-dian-500">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="font-serif text-[17px] font-bold text-ink-900">AI 配置</h2>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 hover:bg-paper-200 hover:text-ink-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="px-6 pb-8 text-center text-sm text-ink-400">加载中…</div>
        ) : (
          <div className="px-6 pb-5 space-y-5">
            {/* Provider */}
            <section>
              <div className="mb-2 text-[12px] font-medium text-ink-600">使用哪个 AI</div>
              <div className="grid grid-cols-2 gap-2">
                <ProviderCard
                  active={provider === "anthropic"}
                  onClick={() => setProvider("anthropic")}
                  title="Claude (Anthropic)"
                  hint="海外模型,需要翻墙代理"
                />
                <ProviderCard
                  active={provider === "moonshot"}
                  onClick={() => setProvider("moonshot")}
                  title="Kimi (Moonshot)"
                  hint="国内直连,含思考模式"
                />
              </div>
            </section>

            {/* Anthropic section */}
            {provider === "anthropic" && (
              <section>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[12px] font-medium text-ink-600">Claude API Key</span>
                  {anthropicHint ? (
                    <span className="text-[10px] text-ink-400">当前已保存: <code className="text-zhu-600">{anthropicHint}</code></span>
                  ) : anthropicEnvFallback ? (
                    <span className="text-[10px] text-zhu-600">✓ 环境变量已配置</span>
                  ) : (
                    <span className="text-[10px] text-zhusha-600">未配置</span>
                  )}
                </div>
                <KeyInput
                  value={anthropicKeyDraft}
                  onChange={setAnthropicKeyDraft}
                  show={showAnthropicKey}
                  onToggleShow={() => setShowAnthropicKey((v) => !v)}
                  placeholder="sk-ant-api03-..."
                  hasStored={!!anthropicHint}
                  onClear={anthropicHint ? () => clearKey("anthropic") : undefined}
                />
                <p className="mt-1.5 text-[10px] leading-relaxed text-ink-400">
                  到 console.anthropic.com 申请。仅在本机保存,不会上传任何云端。
                </p>
              </section>
            )}

            {/* Moonshot section */}
            {provider === "moonshot" && (
              <>
                <section>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[12px] font-medium text-ink-600">Kimi / Moonshot API Key</span>
                    {moonshotHint ? (
                      <span className="text-[10px] text-ink-400">当前已保存: <code className="text-zhu-600">{moonshotHint}</code></span>
                    ) : moonshotEnvFallback ? (
                      <span className="text-[10px] text-zhu-600">✓ 环境变量已配置</span>
                    ) : (
                      <span className="text-[10px] text-zhusha-600">未配置</span>
                    )}
                  </div>
                  <KeyInput
                    value={moonshotKeyDraft}
                    onChange={setMoonshotKeyDraft}
                    show={showMoonshotKey}
                    onToggleShow={() => setShowMoonshotKey((v) => !v)}
                    placeholder="sk-..."
                    hasStored={!!moonshotHint}
                    onClear={moonshotHint ? () => clearKey("moonshot") : undefined}
                  />
                  <p className="mt-1.5 text-[10px] leading-relaxed text-ink-400">
                    国内教师建议到 platform.moonshot.cn 申请;海外到 platform.moonshot.ai。
                  </p>
                </section>

                <section>
                  <div className="mb-2 text-[12px] font-medium text-ink-600">Moonshot 接入地址</div>
                  <div className="grid grid-cols-2 gap-2">
                    {MOONSHOT_BASE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setMoonshotBaseUrl(opt.value)}
                        className={`rounded-lg border px-3 py-2 text-left text-[12px] transition-all ${
                          moonshotBaseUrl === opt.value
                            ? "border-dian-500 bg-dian-500/5 text-ink-900"
                            : "border-ink-200/60 text-ink-600 hover:border-ink-300 hover:bg-paper-100"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* Model overrides */}
            <section>
              <div className="mb-2 text-[12px] font-medium text-ink-600">模型选择 (可选)</div>
              <div className="space-y-2">
                <ModelSelect
                  label="对话 / 工具"
                  value={chatModel}
                  onChange={(v) => { setChatModel(v); setChatDirty(true); }}
                  options={MODEL_OPTIONS[provider]}
                  defaultLabel={chatModelDefault}
                />
                <ModelSelect
                  label="追问 / 分类"
                  value={followupModel}
                  onChange={(v) => { setFollowupModel(v); setFollowupDirty(true); }}
                  options={MODEL_OPTIONS[provider]}
                  defaultLabel={followupModelDefault}
                />
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-ink-400">
                不选即用默认。官方模型列表: <code className="text-zhu-600">{provider === "moonshot" ? "platform.moonshot.cn/docs" : "docs.anthropic.com/claude/models"}</code>
              </p>
            </section>

            {error && (
              <div className="rounded-lg bg-zhusha-600/5 px-3 py-2 text-[11px] text-zhusha-600">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-end gap-2 border-t border-ink-100/40 px-6 py-4">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-lg px-4 py-2 text-[12px] text-ink-600 hover:bg-paper-200 disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={save}
              disabled={!canSave}
              className="rounded-lg bg-ink-800 px-5 py-2 text-[12px] font-medium text-paper-50 hover:bg-ink-900 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              title={!canSave && !saving ? "请检查 API Key 格式" : undefined}
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProviderCard({
  active, onClick, title, hint,
}: { active: boolean; onClick: () => void; title: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-3 text-left transition-all ${
        active
          ? "border-dian-500 bg-dian-500/5 shadow-[var(--shadow-soft)]"
          : "border-ink-200/60 hover:border-ink-300 hover:bg-paper-100"
      }`}
    >
      <div className="flex items-center gap-1.5">
        {active && (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-dian-500">
            <path d="M4 8l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <span className="text-[13px] font-medium text-ink-800">{title}</span>
      </div>
      <div className="mt-0.5 text-[10px] text-ink-400">{hint}</div>
    </button>
  );
}

function KeyInput({
  value, onChange, show, onToggleShow, placeholder, hasStored, onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder: string;
  hasStored: boolean;
  onClear?: () => void;
}) {
  // Inline validation mirrors the server check so the teacher sees problems
  // the moment they type/paste, not after save.
  const warning = (() => {
    if (!value) return null;
    // Silent auto-fix for leading/trailing whitespace happens in onChange below,
    // so by the time we check here value should already be trimmed.
    if (/[\u0080-\uffff]/.test(value)) {
      return "包含中文或特殊字符 — 请确认粘贴的是 Key,不是错误信息";
    }
    if (/\s/.test(value)) {
      return "Key 内不能有空格或换行";
    }
    return null;
  })();

  return (
    <div className="space-y-1">
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? "text" : "password"}
            value={value}
            // Trim outer whitespace silently; browsers often copy a trailing newline
            // or leading space along with the real key.
            onChange={(e) => onChange(e.target.value.replace(/^\s+|\s+$/g, ""))}
            placeholder={hasStored ? "留空则保留已有 Key" : placeholder}
            className={`w-full rounded-lg border bg-paper-50 px-3 py-2 pr-10 font-mono text-[12px] text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-2 ${
              warning
                ? "border-zhusha-600/40 focus:border-zhusha-600/60 focus:ring-zhusha-600/10"
                : "border-ink-200/60 focus:border-dian-500/40 focus:ring-dian-500/10"
            }`}
          />
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-400 hover:text-ink-700"
            aria-label={show ? "隐藏" : "显示"}
            title={show ? "隐藏" : "显示"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              {show ? (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" />
                </>
              ) : (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg px-2.5 text-[11px] text-ink-400 hover:bg-paper-200 hover:text-zhusha-600"
            title="清除已保存的 Key"
          >
            清除
          </button>
        )}
      </div>
      {warning && (
        <p className="text-[10px] leading-relaxed text-zhusha-600">
          ⚠ {warning}
        </p>
      )}
    </div>
  );
}

function ModelSelect({
  label, value, onChange, options, defaultLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  defaultLabel: string;
}) {
  // If value is non-empty and not in the preset list, show the custom text input.
  const isPreset = value === "" || options.some((o) => o.value === value);
  const [custom, setCustom] = useState(!isPreset);

  // If the teacher re-opens the modal and the stored value is custom, keep the
  // text input visible.
  useEffect(() => {
    if (!options.some((o) => o.value === value) && value !== "") setCustom(true);
  }, [value, options]);

  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[11px] text-ink-500">{label}</span>
      {custom ? (
        <div className="flex flex-1 items-center gap-1.5">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="模型名称"
            autoFocus
            className="flex-1 rounded-lg border border-ink-200/60 bg-paper-50 px-3 py-1.5 font-mono text-[11px] text-ink-800 placeholder:text-ink-300 focus:border-dian-500/40 focus:outline-none focus:ring-2 focus:ring-dian-500/10"
          />
          <button
            type="button"
            onClick={() => { setCustom(false); onChange(""); }}
            className="rounded-lg px-2 py-1 text-[10px] text-ink-500 hover:bg-paper-200 hover:text-ink-700"
            title="返回预设列表"
          >
            预设
          </button>
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (v === CUSTOM_SENTINEL) {
              setCustom(true);
              onChange("");
            } else {
              onChange(v);
            }
          }}
          className="flex-1 rounded-lg border border-ink-200/60 bg-paper-50 px-3 py-1.5 text-[11px] text-ink-800 focus:border-dian-500/40 focus:outline-none focus:ring-2 focus:ring-dian-500/10"
        >
          <option value="">使用默认 ({defaultLabel})</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
          <option value={CUSTOM_SENTINEL}>自定义...</option>
        </select>
      )}
    </div>
  );
}
