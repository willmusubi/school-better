"use client";

import { useState } from "react";

interface Props {
  onClose: () => void;
  onCreate: (title: string) => void;
}

const SUGGESTIONS = [
  "高一语文必修上册",
  "高一语文必修下册",
  "《赤壁赋》专题",
  "文言文复习",
  "高考冲刺复习",
  "古诗词鉴赏专题",
];

export function CreateNotebookModal({ onClose, onCreate }: Props) {
  const [title, setTitle] = useState("");

  const handleSubmit = () => {
    if (title.trim()) onCreate(title.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-ink-900/15 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[480px] rounded-2xl bg-paper-50 p-6 shadow-[var(--shadow-lg)] ring-1 ring-ink-100/40 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-ink-900">新建笔记本</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 hover:bg-paper-200 hover:text-ink-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-[12px] text-ink-500">笔记本名称</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如: 高一语文必修上册"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") onClose();
            }}
            className="w-full rounded-xl border border-ink-200 bg-paper-50 px-4 py-3 text-[14px] text-ink-800 placeholder:text-ink-300 focus:border-zhusha-500/40 focus:outline-none focus:ring-2 focus:ring-zhusha-500/10"
          />
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-[12px] text-ink-500">或选择一个常用场景</label>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setTitle(s)}
                className="rounded-full border border-ink-200/60 px-3 py-1 text-[11px] text-ink-500 hover:border-zhusha-500/30 hover:bg-zhusha-600/5 hover:text-ink-800"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-ink-200 px-4 py-2 text-[13px] text-ink-600 hover:bg-paper-200">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="rounded-lg bg-zhusha-600 px-5 py-2 text-[13px] font-medium text-paper-50 shadow-[0_2px_8px_oklch(0.46_0.2_24/0.3)] hover:bg-zhusha-700 active:scale-[0.98] disabled:opacity-40"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
