"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/top-bar";
import { CreateNotebookModal } from "@/components/create-notebook-modal";
import { NotebookCard } from "@/components/notebook-card";

interface Notebook {
  id: string;
  title: string;
  emoji: string;
  color: string;
  createdAt: number;
  sourceCount: number;
}

const COLOR_MAP: Record<string, string> = {
  "paper-300": "bg-paper-300",
  "zhusha-300": "bg-zhusha-600/15",
  "dian-300": "bg-dian-500/15",
  "zhu-300": "bg-zhu-500/15",
  "jin-300": "bg-jin-500/15",
};

export default function Home() {
  const router = useRouter();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const refreshNotebooks = useCallback(async () => {
    try {
      const res = await fetch("/api/notebooks");
      if (res.ok) {
        const data = await res.json();
        setNotebooks(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshNotebooks();
  }, [refreshNotebooks]);

  const handleCreate = async (title: string) => {
    const res = await fetch("/api/notebooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const nb = await res.json();
      router.push(`/notebooks/${nb.id}`);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1200px] px-8 py-10">
          {/* Tabs + Create button */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex gap-6">
              <h2 className="font-serif text-xl font-bold text-ink-900">
                我的笔记本
              </h2>
              <button className="font-serif text-sm text-ink-400 hover:text-ink-600">
                精选模板
              </button>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-paper-50 shadow-[var(--shadow-md)] hover:bg-ink-800 active:scale-[0.98]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              新建笔记本
            </button>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="py-20 text-center text-sm text-ink-400">加载中...</div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {/* Create new card */}
              <button
                onClick={() => setShowCreate(true)}
                className="group flex aspect-[4/5] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink-200 bg-paper-100 p-6 transition-all hover:border-zhusha-500/40 hover:bg-paper-50 hover:shadow-[var(--shadow-md)]"
              >
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-paper-300 transition-colors group-hover:bg-zhusha-600/15">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-400 group-hover:text-zhusha-600">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-ink-500 group-hover:text-ink-700">新建笔记本</span>
              </button>

              {/* Notebook cards */}
              {notebooks.map((nb) => (
                <NotebookCard
                  key={nb.id}
                  notebook={nb}
                  colorClass={COLOR_MAP[nb.color] || "bg-paper-300"}
                  onOpen={() => router.push(`/notebooks/${nb.id}`)}
                  onChanged={refreshNotebooks}
                />
              ))}
            </div>
          )}

          {notebooks.length === 0 && !loading && (
            <div className="mt-12 text-center">
              <p className="text-sm text-ink-400">还没有笔记本,点击上方创建你的第一本</p>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateNotebookModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
