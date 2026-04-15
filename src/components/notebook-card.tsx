"use client";

import { useState, useRef, useEffect } from "react";

interface Notebook {
  id: string;
  title: string;
  emoji: string;
  color: string;
  createdAt: number;
  sourceCount: number;
}

interface Props {
  notebook: Notebook;
  colorClass: string;
  onOpen: () => void;
  onChanged: () => void;
}

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function NotebookCard({ notebook, colorClass, onOpen, onChanged }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(notebook.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const saveRename = async () => {
    const newTitle = editTitle.trim();
    if (!newTitle || newTitle === notebook.title) {
      setEditing(false);
      setEditTitle(notebook.title);
      return;
    }
    try {
      await fetch(`/api/notebooks/${notebook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      onChanged();
    } catch (e) {
      console.error("Rename failed:", e);
    }
    setEditing(false);
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (!confirm(`确定删除笔记本 "${notebook.title}" 吗？该操作不可撤销。`)) return;
    try {
      await fetch(`/api/notebooks/${notebook.id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !editing && !menuOpen && onOpen()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !editing && !menuOpen) {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`group relative flex aspect-[4/5] cursor-pointer flex-col rounded-2xl p-5 text-left transition-all hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-zhusha-500/40 ${colorClass}`}
    >
      <div className="flex items-start justify-between">
        <span className="text-4xl">{notebook.emoji}</span>
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
              menuOpen
                ? "bg-paper-50/80 text-ink-700 opacity-100"
                : "text-ink-500 opacity-0 hover:bg-paper-50/50 hover:text-ink-700 group-hover:opacity-100"
            }`}
            title="笔记本选项"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full z-30 mt-1 min-w-[160px] rounded-xl bg-paper-50 py-1.5 shadow-[var(--shadow-lg)] ring-1 ring-ink-100/40 animate-fade-in-up"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-ink-700 hover:bg-paper-200"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                重命名
              </button>
              <div className="my-1 mx-3 h-px bg-ink-100" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-zhusha-600 hover:bg-zhusha-600/5"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                删除
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={saveRename}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") {
                setEditing(false);
                setEditTitle(notebook.title);
              }
            }}
            className="mb-2 block w-full rounded-md bg-paper-50 px-2 py-1 font-serif text-[15px] font-bold text-ink-900 outline-none ring-1 ring-zhusha-500/30 focus:ring-2 focus:ring-zhusha-500/40"
          />
        ) : (
          <h3 className="mb-2 line-clamp-3 font-serif text-[15px] font-bold leading-snug text-ink-900">
            {notebook.title}
          </h3>
        )}
        <div className="flex items-center gap-2 text-[11px] text-ink-500">
          <span>{formatDate(notebook.createdAt)}</span>
          <span className="text-ink-300">·</span>
          <span>{notebook.sourceCount} 份资料</span>
        </div>
      </div>
    </div>
  );
}
