import { NextRequest, NextResponse } from "next/server";
import { loadSettings, saveSettings, redactForClient, type AppSettings } from "@/lib/app-settings";

// API keys must be valid for an HTTP Authorization header — that means ASCII
// only, no whitespace, no control chars. Chinese / emoji / newlines break the
// undici ByteString converter with an obscure "value > 255" error. Validate
// up front so the teacher gets a clear message instead.
function validateApiKey(raw: string, provider: "anthropic" | "moonshot"): string | null {
  if (raw === "") return null; // empty is "clear this key", always ok
  const trimmed = raw.trim();
  if (trimmed !== raw) return "API Key 前后有空白字符,请去掉";
  if (trimmed.length > 500) return "API Key 过长,请检查是否贴错内容";
  // Allow printable ASCII only. Catches Chinese error messages, smart quotes,
  // stray newlines from copy-paste, etc.
  if (!/^[\x21-\x7e]+$/.test(trimmed)) {
    return "API Key 只能包含可见 ASCII 字符,检测到中文或其他特殊符号。请确认粘贴的是 Key 本身,不是错误信息或链接。";
  }
  if (provider === "anthropic" && !trimmed.startsWith("sk-")) {
    return "Claude API Key 应以 sk- 开头 (console.anthropic.com 生成)";
  }
  if (provider === "moonshot" && !trimmed.startsWith("sk-")) {
    return "Moonshot API Key 应以 sk- 开头";
  }
  return null;
}

// GET returns the redacted view: provider, key hints, model names. The raw
// API keys are never sent back to the client, even if it asks.
export async function GET() {
  try {
    loadSettings(); // ensures cache is primed
    return NextResponse.json(redactForClient());
  } catch (err) {
    console.error("[settings] GET error:", err);
    return NextResponse.json({ error: "读取设置失败" }, { status: 500 });
  }
}

// POST accepts a partial patch. Fields absent from the body are left untouched.
// Empty strings mean "clear this value" — handled inside saveSettings.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<AppSettings>;

    // Whitelist what we accept. Keeps stray fields and prototype pollution out.
    const patch: Partial<AppSettings> = {};
    if (body.provider === "anthropic" || body.provider === "moonshot") {
      patch.provider = body.provider;
    }
    if (body.apiKeys && typeof body.apiKeys === "object") {
      patch.apiKeys = {};
      if (typeof body.apiKeys.anthropic === "string") {
        const err = validateApiKey(body.apiKeys.anthropic, "anthropic");
        if (err) return NextResponse.json({ error: err }, { status: 400 });
        patch.apiKeys.anthropic = body.apiKeys.anthropic;
      }
      if (typeof body.apiKeys.moonshot === "string") {
        const err = validateApiKey(body.apiKeys.moonshot, "moonshot");
        if (err) return NextResponse.json({ error: err }, { status: 400 });
        patch.apiKeys.moonshot = body.apiKeys.moonshot;
      }
    }
    if (typeof body.moonshotBaseUrl === "string") patch.moonshotBaseUrl = body.moonshotBaseUrl;
    if (body.models && typeof body.models === "object") {
      patch.models = {};
      if (typeof body.models.chat === "string") patch.models.chat = body.models.chat;
      if (typeof body.models.followup === "string") patch.models.followup = body.models.followup;
      if (typeof body.models.classify === "string") patch.models.classify = body.models.classify;
    }

    saveSettings(patch);
    return NextResponse.json(redactForClient());
  } catch (err) {
    console.error("[settings] POST error:", err);
    const msg = err instanceof Error ? err.message : "保存设置失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
