"use client";

import { useState, useRef, useEffect } from "react";

interface DocItem {
  id: string;
  name: string;
  pages: number;
  fileType: string;
  status: string;
  summary: string;
}

interface Props {
  item: DocItem;
  typeStyle: { bg: string; text: string; label: string };
  onChanged: () => void;
}

export function DocumentRow({ item, typeStyle, onChanged }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isParsing = item.status === "parsing";

  // Close menu on outside click
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

  // Focus input when editing
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const saveRename = async () => {
    const name = editName.trim();
    if (!name || name === item.name) {
      setEditing(false);
      setEditName(item.name);
      return;
    }
    try {
      await fetch(`/api/documents/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      onChanged();
    } catch (e) {
      console.error("Rename failed:", e);
    }
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(`确定删除 "${item.name}" 吗？`)) return;
    try {
      await fetch(`/api/documents/${item.id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      console.error("Delete failed:", e);
    }
    setMenuOpen(false);
  };

  return (
    <div
      className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all ${
        isParsing ? "opacity-60" : "hover:bg-paper-200"
      }`}
      title={item.summary}
    >
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${typeStyle.bg} ${typeStyle.text}`}>
        {isParsing ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
            <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
          </svg>
        ) : (
          typeStyle.label
        )}
      </span>

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") {
                setEditing(false);
                setEditName(item.name);
              }
            }}
            className="w-full rounded bg-paper-50 px-1.5 py-0.5 text-[12px] text-ink-800 outline-none ring-1 ring-zhusha-500/30 focus:ring-2 focus:ring-zhusha-500/40"
          />
        ) : (
          <span className="block truncate text-[12px] leading-snug text-ink-700 group-hover:text-ink-900">
            {item.name}
          </span>
        )}
        {isParsing && (
          <span className="text-[10px] text-ink-400">解析中...</span>
        )}
      </div>

      {!isParsing && !editing && (
        <>
          <span className="shrink-0 text-[10px] tabular-nums text-ink-300 group-hover:hidden">{item.pages}页</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-ink-400 hover:bg-paper-300 hover:text-ink-700 group-hover:flex"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
            </svg>
          </button>
        </>
      )}

      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-2 top-full z-30 mt-1 min-w-[140px] rounded-lg bg-paper-50 py-1 shadow-[var(--shadow-lg)] ring-1 ring-ink-100/40 animate-fade-in"
        >
          <button
            onClick={() => {
              setEditing(true);
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-ink-700 hover:bg-paper-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            重命名
          </button>
          <button
            onClick={handleDelete}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-zhusha-600 hover:bg-zhusha-600/5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            删除
          </button>
        </div>
      )}
    </div>
  );
}
