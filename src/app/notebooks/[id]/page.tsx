"use client";

import { useState, useEffect, use, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { SourcesPanel, type DocItem } from "@/components/sources-panel";
import { ChatPanel } from "@/components/chat-panel";
import { StudioPanel } from "@/components/studio-panel";
import { ToolSlideOver } from "@/components/tool-slide-over";
import { NotebookTopBar } from "@/components/notebook-topbar";

export type ToolId = "quiz" | "student-sim" | "lesson" | null;

interface Notebook {
  id: string;
  title: string;
  emoji: string;
}

// Polls every 2s while there are still parsing docs, otherwise stays idle.
// 30s heartbeat covers external mutations (e.g. delete from another tab).
const FAST_POLL_MS = 2000;
const SLOW_POLL_MS = 30_000;

export default function NotebookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: notebookId } = use(params);
  const router = useRouter();
  const [activeTool, setActiveTool] = useState<ToolId>(null);
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    fetch(`/api/notebooks/${notebookId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) {
          router.push("/");
          return;
        }
        setNotebook(data);
      });
  }, [notebookId, router]);

  // Single source of truth for documents. Conditional polling cadence:
  // fast (2s) while any doc is still parsing, slow (30s) when idle.
  const refreshDocs = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch(`/api/documents?notebookId=${notebookId}`);
      if (res.ok) setDocs(await res.json());
    } catch { /* network blip */ }
    finally {
      inFlightRef.current = false;
    }
  }, [notebookId]);

  useEffect(() => {
    refreshDocs();
  }, [refreshDocs]);

  // Adjust polling speed based on whether anything is parsing.
  const hasParsing = useMemo(() => docs.some((d) => d.status === "parsing"), [docs]);

  useEffect(() => {
    const interval = setInterval(refreshDocs, hasParsing ? FAST_POLL_MS : SLOW_POLL_MS);
    return () => clearInterval(interval);
  }, [hasParsing, refreshDocs]);

  // Tab focus → instant refresh (so external changes show up).
  useEffect(() => {
    const onFocus = () => refreshDocs();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshDocs]);

  const sourceCount = docs.length;

  const truncatedDocs = useMemo(
    () => docs.filter((d) => d.truncated).map((d) => d.name),
    [docs]
  );
  const contextWarning = truncatedDocs.length
    ? `${truncatedDocs.length} 份文档超长,只有前 8000 字进入 AI 上下文 (${truncatedDocs.slice(0, 2).join("、")}${truncatedDocs.length > 2 ? "…" : ""})`
    : null;

  const triggerUpload = useCallback(() => {
    setShowAddModal(true);
  }, []);

  if (!notebook) {
    return (
      <div className="flex h-full items-center justify-center bg-paper-100">
        <div className="text-sm text-ink-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <NotebookTopBar
        notebook={notebook}
        onBack={() => router.push("/")}
        onRenamed={(newTitle) => setNotebook({ ...notebook, title: newTitle })}
        onDeleted={() => router.push("/")}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SourcesPanel
          notebookId={notebookId}
          docs={docs}
          collapsed={sourcesCollapsed}
          onToggle={() => setSourcesCollapsed(!sourcesCollapsed)}
          onChanged={refreshDocs}
          showAddModal={showAddModal}
          onShowAddModal={setShowAddModal}
        />

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <ChatPanel
            notebookId={notebookId}
            sourceCount={sourceCount}
            contextWarning={contextWarning}
            onTriggerUpload={triggerUpload}
          />
          {activeTool && (
            <ToolSlideOver
              toolId={activeTool}
              notebookId={notebookId}
              onClose={() => setActiveTool(null)}
            />
          )}
        </div>

        <StudioPanel activeTool={activeTool} onSelectTool={setActiveTool} />
      </div>
    </div>
  );
}
