"use client";

import { useEffect, useRef, useState } from "react";
import { useSurname } from "@/lib/profile";

// Avatar + popover in the top bar corner. Clicking the avatar opens a small
// editor where the teacher types their 姓 (single character). The avatar
// reflects that character; AI addresses them as "{姓}老师" in responses.
export function ProfileMenu() {
  const [surname, setSurnameValue] = useSurname();
  const [open, setOpen] = useState(false);
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
        </div>
      )}
    </div>
  );
}
