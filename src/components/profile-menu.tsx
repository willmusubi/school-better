"use client";

import { useEffect, useRef, useState } from "react";
import { useSurname } from "@/lib/profile";
import { SettingsModal } from "@/components/settings-modal";

// Avatar + popover in the top bar corner. Clicking the avatar opens a small
// editor where the teacher types their 姓 (single character). The avatar
// reflects that character; AI addresses them as "{姓}老师" in responses.
export function ProfileMenu() {
  const [surname, setSurnameValue] = useSurname();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(surname);
      // Focus after the popover mounts so the teacher can type immediately.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, surname]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const save = () => {
    // Keep only the first character — the avatar is a single-char badge, and the
    // system prompt already adds "老师" after the surname.
    const clean = Array.from(draft.trim())[0] || "";
    setSurnameValue(clean);
    setOpen(false);
  };

  // Empty state: show a plus, not a random letter. Avoids lying about who's signed in.
  const badge = surname || "+";

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={surname ? `${surname}老师 · 点击修改` : "设置姓名"}
        aria-label={surname ? `${surname}老师` : "设置姓名"}
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ring-2 transition-all ${
          surname
            ? "bg-dian-500/10 text-dian-600 ring-dian-500/10 hover:ring-dian-500/25"
            : "bg-paper-200 text-ink-400 ring-paper-300 hover:bg-paper-300 hover:text-ink-600"
        }`}
      >
        {badge}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-40 mt-2 w-[220px] rounded-xl bg-paper-50 p-3 shadow-[var(--shadow-lg)] ring-1 ring-ink-100/40 animate-fade-in-up"
        >
          <div className="mb-1.5 text-[12px] font-medium text-ink-600">你的姓氏</div>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            maxLength={2}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="例如 王"
            className="w-full rounded-lg border border-ink-200/60 bg-paper-50 px-3 py-2 text-[14px] text-ink-800 placeholder:text-ink-300 focus:border-dian-500/40 focus:outline-none focus:ring-2 focus:ring-dian-500/10"
          />
          <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
            AI 会以 "{(Array.from(draft.trim())[0] || surname || "X")}老师" 称呼你。
          </p>
          <div className="mt-3 flex justify-end gap-2">
            {surname && (
              <button
                onClick={() => {
                  setSurnameValue("");
                  setOpen(false);
                }}
                className="rounded-lg px-3 py-1.5 text-[11px] text-ink-500 hover:bg-paper-200 hover:text-ink-700"
              >
                清除
              </button>
            )}
            <button
              onClick={save}
              className="rounded-lg bg-ink-800 px-3.5 py-1.5 text-[11px] font-medium text-paper-50 hover:bg-ink-900 active:scale-95"
            >
              保存
            </button>
          </div>

          {/* Divider + AI settings link */}
          <div className="-mx-3 mt-3 border-t border-ink-100/40" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setSettingsOpen(true);
            }}
            className="-mx-1 mt-2 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-ink-700 hover:bg-paper-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-ink-500">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>AI 配置</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-auto text-ink-300">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
