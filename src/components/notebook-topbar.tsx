"use client";

import { useState, useRef, useEffect } from "react";
import { ProfileMenu } from "@/components/profile-menu";

interface NotebookTopBarProps {
  notebook: { id: string; title: string; emoji: string };
  onBack: () => void;
  onRenamed?: (newTitle: string) => void;
  onDeleted?: () => void;
}

export function NotebookTopBar({ notebook, onBack, onRenamed, onDeleted }: NotebookTopBarProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(notebook.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitle(notebook.title);
  }, [notebook.title]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const saveRename = async () => {
    const newTitle = title.trim();
    if (!newTitle || newTitle === notebook.title) {
      setEditing(false);
      setTitle(notebook.title);
      return;
    }
    try {
      await fetch(`/api/notebooks/${notebook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      onRenamed?.(newTitle);
    } catch (e) {
      console.error("Rename failed:", e);
    }
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(`确定删除笔记本 "${notebook.title}" 吗？该操作不可撤销。`)) return;
    try {
      await fetch(`/api/notebooks/${notebook.id}`, { method: "DELETE" });
      onDeleted?.();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between bg-paper-50 px-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-paper-200 hover:text-ink-700"
          title="返回所有笔记本"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="mx-1 h-5 w-px bg-ink-200/60" />
        <div className="group flex items-center gap-2">
          <span className="text-lg">{notebook.emoji}</span>
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") {
                  setTitle(notebook.title);
                  setEditing(false);
                }
              }}
              className="font-serif text-[16px] font-semibold tracking-tight text-ink-900 bg-paper-100 rounded-md px-2 py-1 outline-none ring-1 ring-zhusha-500/30 focus:ring-2 focus:ring-zhusha-500/40 min-w-[240px]"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 font-serif text-[16px] font-semibold tracking-tight text-ink-900 hover:bg-paper-200"
              title="点击重命名"
            >
              {notebook.title}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-ink-300 opacity-0 transition-opacity group-hover:opacity-100">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          {/* Notebook options */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                menuOpen
                  ? "bg-paper-300 text-ink-700"
                  : "text-ink-400 hover:bg-paper-200 hover:text-ink-700"
              }`}
              title="笔记本选项"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-full z-30 mt-1.5 min-w-[160px] rounded-xl bg-paper-50 py-1.5 shadow-[var(--shadow-lg)] ring-1 ring-ink-100/40 animate-fade-in-up">
                <button
                  onClick={() => {
                    setEditing(true);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-ink-700 hover:bg-paper-200"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  重命名笔记本
                </button>
                <div className="my-1 mx-3 h-px bg-ink-100" />
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-zhusha-600 hover:bg-zhusha-600/5"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  删除笔记本
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full bg-paper-200 py-1.5 pr-3.5 pl-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zhusha-600/10 text-[10px] text-zhusha-600">文</span>
          <span className="text-xs font-medium text-ink-700">高中语文</span>
        </div>
        <ProfileMenu />
      </div>
    </header>
  );
}
