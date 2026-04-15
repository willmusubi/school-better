"use client";

import { useState } from "react";
import { AddSourceModal } from "@/components/add-source-modal";
import { DocumentRow } from "@/components/document-row";

export interface DocItem {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  pages: number;
  fileType: string;
  status: string;
  summary: string;
  truncated?: boolean;
  contentLength?: number;
}

interface SourcesPanelProps {
  notebookId: string;
  docs: DocItem[];
  collapsed: boolean;
  onToggle: () => void;
  onChanged: () => void;
  showAddModal: boolean;
  onShowAddModal: (show: boolean) => void;
}

const typeStyles: Record<string, { bg: string; text: string; label: string }> = {
  pdf: { bg: "bg-zhusha-600/8", text: "text-zhusha-600", label: "P" },
  doc: { bg: "bg-dian-500/8", text: "text-dian-500", label: "W" },
  img: { bg: "bg-zhu-500/8", text: "text-zhu-500", label: "图" },
  ppt: { bg: "bg-jin-500/10", text: "text-jin-500", label: "S" },
};

const groupOrder = ["教材", "试卷", "教案", "教学反思", "其他"];
const groupIcons: Record<string, string> = {
  "教材": "📖",
  "试卷": "📝",
  "教案": "📋",
  "教学反思": "💡",
  "其他": "📄",
};

export function SourcesPanel({
  notebookId,
  docs,
  collapsed,
  onToggle,
  onChanged,
  showAddModal,
  onShowAddModal,
}: SourcesPanelProps) {
  const grouped = groupOrder
    .map((label) => ({
      label,
      icon: groupIcons[label] || "📄",
      items: docs.filter((d) => d.typeLabel === label),
    }))
    .filter((g) => g.items.length > 0);

  const totalDocs = docs.length;
  const readyDocs = docs.filter((d) => d.status === "ready").length;

  if (collapsed) {
    return (
      <div className="flex w-12 shrink-0 flex-col items-center border-r border-ink-100/60 bg-paper-100 pt-4">
        <button onClick={onToggle} className="flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-paper-300 hover:text-ink-600">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 4l4 4-4 4" /></svg>
        </button>
        {totalDocs > 0 && (
          <div className="mt-2 flex h-5 w-5 items-center justify-center rounded-full bg-zhusha-600/10 text-[9px] font-bold text-zhusha-600">
            {totalDocs}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="paper-texture flex w-[260px] shrink-0 flex-col border-r border-ink-100/40 bg-paper-100">
      <div className="flex items-center justify-between px-4 py-3.5">
        <span className="text-[13px] font-semibold text-ink-700">知识库来源</span>
        <button onClick={onToggle} className="flex h-6 w-6 items-center justify-center rounded text-ink-300 hover:bg-paper-300 hover:text-ink-500">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 4l-4 4 4 4" /></svg>
        </button>
      </div>

      {/* Add source button */}
      <div className="px-3 pb-3">
        <button
          data-upload-trigger
          onClick={() => onShowAddModal(true)}
          className="group flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-ink-200/60 px-4 py-3.5 transition-all hover:border-ink-300 hover:bg-paper-200/50"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper-300/60 group-hover:bg-paper-300">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-400">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </div>
          <div className="text-left">
            <span className="block text-xs font-medium text-ink-600">添加资料</span>
            <span className="block text-[10px] text-ink-400">文件 · 网页链接 · 粘贴文本</span>
          </div>
        </button>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {totalDocs === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-paper-300/60">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-300">
                <path d="M4 4h16v16H4z M8 8h8M8 12h6" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-xs text-ink-400">还没有上传文档</p>
            <p className="mt-0.5 text-[10px] text-ink-300">上传教材、试卷或教案开始</p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.label} className="mb-1">
              <div className="flex items-center gap-1.5 px-2 pb-1 pt-3">
                <span className="text-[11px]">{group.icon}</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">
                  {group.label}
                </span>
                <span className="text-[10px] text-ink-300">{group.items.length}</span>
              </div>
              {group.items.map((item) => {
                const s = typeStyles[item.fileType] || typeStyles.doc;
                return (
                  <DocumentRow
                    key={item.id}
                    item={item}
                    typeStyle={s}
                    onChanged={onChanged}
                  />
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Stats */}
      {totalDocs > 0 && (
        <div className="border-t border-ink-100/40 bg-paper-50/50 px-4 py-3">
          <div className="flex items-center justify-between text-[11px] text-ink-400">
            <span><span className="font-semibold text-ink-600">{totalDocs}</span> 个文档</span>
            <span><span className="font-semibold text-zhu-500">{readyDocs}</span> 已就绪</span>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddSourceModal
          notebookId={notebookId}
          onClose={() => onShowAddModal(false)}
          onAdded={onChanged}
        />
      )}
    </div>
  );
}
