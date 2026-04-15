"use client";

import { useState, useCallback, useRef } from "react";
import { Markdown } from "@/components/markdown";
import type { ToolId } from "@/app/notebooks/[id]/page";

interface ToolSlideOverProps {
  toolId: ToolId;
  notebookId: string;
  onClose: () => void;
}

type PillValue = string;

function PillGroup({ label, options, selected, onSelect }: {
  label: string;
  options: { value: PillValue; label: string }[];
  selected: PillValue;
  onSelect: (v: PillValue) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-[12px] text-ink-500">{label}</div>
      <div className="flex gap-1.5">
        {options.map((opt) => (
          <button key={opt.value} onClick={() => onSelect(opt.value)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] transition-all ${
              selected === opt.value
                ? "border-ink-700 bg-paper-50 font-medium text-ink-900 shadow-[var(--shadow-soft)]"
                : "border-ink-200/60 text-ink-500 hover:border-ink-300 hover:text-ink-700"
            }`}>
            {selected === opt.value && (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 8l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function useToolStream(notebookId: string) {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const generate = useCallback(async (tool: string, params: Record<string, string>) => {
    setResult("");
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, params, notebookId }),
        signal: controller.signal,
      });
      if (!res.ok) {
        let msg = "生成失败,请重试";
        try {
          const data = await res.json();
          msg = data.error || msg;
        } catch { /* ignore */ }
        setResult(msg);
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const { text } = JSON.parse(data);
              setResult((prev) => prev + text);
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setResult((prev) => prev + "\n\n_（已停止生成）_");
      } else {
        console.error("Tool error:", err);
        setResult("生成失败，请检查网络连接或API配置。");
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }, [notebookId]);

  return { result, loading, generate, stop };
}

function renderResult(text: string) {
  return <Markdown content={text} variant="tool" />;
}

function QuizModal({ onClose, notebookId }: { onClose: () => void; notebookId: string }) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("标准");
  const [difficulty, setDifficulty] = useState("中等");
  const { result, loading, generate, stop } = useToolStream(notebookId);

  const examples = [
    "基于必修上册第七单元，生成一套古诗文测验",
    "测验必须包含20道题，覆盖文言文翻译和鉴赏",
    "仅基于《赤壁赋》和《劝学》两篇课文出题",
    "测验必须专注于文言虚词的用法辨析",
  ];

  return (
    <div className="w-[540px] max-h-[85vh] flex flex-col rounded-2xl bg-paper-50 shadow-[var(--shadow-lg)] ring-1 ring-ink-100/40">
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-dian-500/10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dian-500">
              <rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10l2 2 4-4M8 16h8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="font-serif text-[17px] font-bold text-ink-900">{"自定义测验"}</h2>
        </div>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 hover:bg-paper-200 hover:text-ink-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
        </button>
      </div>

      {!result ? (
        <>
          <div className="flex gap-8 px-6 pb-4">
            <PillGroup label={"问题数量"} options={[{value:"更少",label:"更少"},{value:"标准",label:"标准（默认）"},{value:"更多",label:"更多"}]} selected={count} onSelect={setCount} />
            <PillGroup label={"难度等级"} options={[{value:"简单",label:"简单"},{value:"中等",label:"中等（默认）"},{value:"困难",label:"困难"}]} selected={difficulty} onSelect={setDifficulty} />
          </div>
          <div className="px-6 pb-4">
            <div className="mb-2 text-[12px] text-ink-500">{"主题应该是什么？"}</div>
            <div className="relative">
              <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={5}
                className="w-full resize-none rounded-xl border border-dian-400/40 bg-paper-50 px-4 py-3 text-[13px] leading-[1.8] text-ink-800 focus:border-dian-500/50 focus:outline-none focus:ring-2 focus:ring-dian-500/10" />
              {!topic && (
                <div className="pointer-events-none absolute inset-0 px-4 py-3">
                  <div className="text-[13px] font-medium text-ink-400">{"示例提示"}</div>
                  <ul className="mt-1 space-y-0.5">
                    {examples.map((ex) => <li key={ex} className="flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-300"><span className="mt-1 shrink-0">{"·"}</span><span>{ex}</span></li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end px-6 pb-5">
            <button onClick={() => generate("quiz", { count, difficulty, topic })} disabled={loading}
              className="rounded-xl bg-dian-500 px-6 py-2.5 text-[13px] font-semibold text-paper-50 shadow-[0_2px_10px_oklch(0.5_0.13_260/0.3)] hover:bg-dian-600 active:scale-[0.98] disabled:opacity-50">
              {loading ? "生成中..." : "生成"}
            </button>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 pb-5">
          {loading && <div className="mb-2 flex items-center justify-between gap-2 text-xs text-dian-500">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 animate-[pulse-gentle_1s_ease-in-out_infinite] rounded-full bg-dian-500" />{"生成中..."}
            </span>
            <button onClick={stop} className="rounded-md border border-ink-200 px-2 py-0.5 text-[10px] text-ink-500 hover:bg-paper-100">{"停止"}</button>
          </div>}
          <div className="rounded-xl border border-ink-100/40 bg-paper-100/50 p-4">
            {renderResult(result)}
          </div>
          {!loading && <div className="mt-3 flex gap-2">
            <button onClick={() => generate("quiz", { count, difficulty, topic })} className="rounded-lg border border-ink-200 px-3 py-1.5 text-[11px] text-ink-600 hover:bg-paper-100">{"重新生成"}</button>
            <button onClick={onClose} className="rounded-lg bg-ink-800 px-3 py-1.5 text-[11px] font-medium text-paper-50 hover:bg-ink-900">{"完成"}</button>
          </div>}
        </div>
      )}
    </div>
  );
}

function StudentSimModal({ onClose, notebookId }: { onClose: () => void; notebookId: string }) {
  const [topic, setTopic] = useState("");
  const [studentType, setStudentType] = useState("混合");
  const { result, loading, generate, stop } = useToolStream(notebookId);

  const examples = [
    "模拟学生在学习《赤壁赋》时可能提出的问题",
    "重点模拟基础薄弱学生对文言文翻译的困惑",
    "模拟好奇心强的学生对苏轼思想的深入追问",
    "模拟学生在课堂讨论环节的自发提问",
  ];

  return (
    <div className="w-[540px] max-h-[85vh] flex flex-col rounded-2xl bg-paper-50 shadow-[var(--shadow-lg)] ring-1 ring-ink-100/40">
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zhusha-600/10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zhusha-600">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="font-serif text-[17px] font-bold text-ink-900">{"模拟学生提问"}</h2>
        </div>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 hover:bg-paper-200 hover:text-ink-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
        </button>
      </div>

      {!result ? (
        <>
          <div className="px-6 pb-4">
            <PillGroup label={"学生类型"} options={[
              {value:"优等生",label:"优等生"},
              {value:"中等生",label:"中等生"},
              {value:"学困生",label:"学困生"},
              {value:"混合",label:"混合（默认）"},
            ]} selected={studentType} onSelect={setStudentType} />
          </div>
          <div className="px-6 pb-4">
            <div className="mb-2 text-[12px] text-ink-500">{"课堂主题是什么？"}</div>
            <div className="relative">
              <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={5}
                className="w-full resize-none rounded-xl border border-zhusha-400/30 bg-paper-50 px-4 py-3 text-[13px] leading-[1.8] text-ink-800 focus:border-zhusha-500/40 focus:outline-none focus:ring-2 focus:ring-zhusha-500/10" />
              {!topic && (
                <div className="pointer-events-none absolute inset-0 px-4 py-3">
                  <div className="text-[13px] font-medium text-ink-400">{"示例提示"}</div>
                  <ul className="mt-1 space-y-0.5">
                    {examples.map((ex) => <li key={ex} className="flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-300"><span className="mt-1 shrink-0">{"·"}</span><span>{ex}</span></li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end px-6 pb-5">
            <button onClick={() => generate("student-sim", { studentType, topic })} disabled={loading}
              className="rounded-xl bg-zhusha-600 px-6 py-2.5 text-[13px] font-semibold text-paper-50 shadow-[0_2px_10px_oklch(0.46_0.2_24/0.3)] hover:bg-zhusha-700 active:scale-[0.98] disabled:opacity-50">
              {loading ? "模拟中..." : "开始模拟"}
            </button>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 pb-5">
          {loading && <div className="mb-2 flex items-center justify-between gap-2 text-xs text-zhusha-600">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 animate-[pulse-gentle_1s_ease-in-out_infinite] rounded-full bg-zhusha-500" />{"模拟中..."}
            </span>
            <button onClick={stop} className="rounded-md border border-ink-200 px-2 py-0.5 text-[10px] text-ink-500 hover:bg-paper-100">{"停止"}</button>
          </div>}
          <div className="rounded-xl border border-ink-100/40 bg-paper-100/50 p-4">
            {renderResult(result)}
          </div>
          {!loading && <div className="mt-3 flex gap-2">
            <button onClick={() => generate("student-sim", { studentType, topic })} className="rounded-lg border border-ink-200 px-3 py-1.5 text-[11px] text-ink-600 hover:bg-paper-100">{"重新模拟"}</button>
            <button onClick={onClose} className="rounded-lg bg-ink-800 px-3 py-1.5 text-[11px] font-medium text-paper-50 hover:bg-ink-900">{"完成"}</button>
          </div>}
        </div>
      )}
    </div>
  );
}

function LessonModal({ onClose, notebookId }: { onClose: () => void; notebookId: string }) {
  const [topic, setTopic] = useState("");
  const { result, loading, generate, stop } = useToolStream(notebookId);

  const examples = [
    "基于《赤壁赋》设计一堂课的教案",
    "设计《劝学》与《师说》的对比阅读课",
    "设计一堂文言文虚词专题复习课",
  ];

  return (
    <div className="w-[540px] max-h-[85vh] flex flex-col rounded-2xl bg-paper-50 shadow-[var(--shadow-lg)] ring-1 ring-ink-100/40">
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zhu-500/10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zhu-500">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /><path d="M9 7h6M9 11h4" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="font-serif text-[17px] font-bold text-ink-900">{"课程设计"}</h2>
        </div>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 hover:bg-paper-200 hover:text-ink-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
        </button>
      </div>
      {!result ? (
        <>
          <div className="px-6 pb-4">
            <div className="mb-2 text-[12px] text-ink-500">{"课题是什么？"}</div>
            <div className="relative">
              <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={4}
                className="w-full resize-none rounded-xl border border-zhu-400/30 bg-paper-50 px-4 py-3 text-[13px] leading-[1.8] text-ink-800 focus:border-zhu-500/40 focus:outline-none focus:ring-2 focus:ring-zhu-500/10" />
              {!topic && (
                <div className="pointer-events-none absolute inset-0 px-4 py-3">
                  <div className="text-[13px] font-medium text-ink-400">{"示例提示"}</div>
                  <ul className="mt-1 space-y-0.5">
                    {examples.map((ex) => <li key={ex} className="flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-300"><span className="mt-1 shrink-0">{"·"}</span><span>{ex}</span></li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end px-6 pb-5">
            <button onClick={() => generate("lesson-design", { topic })} disabled={loading}
              className="rounded-xl bg-zhu-500 px-6 py-2.5 text-[13px] font-semibold text-paper-50 shadow-[0_2px_10px_oklch(0.55_0.13_155/0.3)] hover:bg-zhu-600 active:scale-[0.98] disabled:opacity-50">
              {loading ? "生成中..." : "生成教案"}
            </button>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 pb-5">
          {loading && <div className="mb-2 flex items-center justify-between gap-2 text-xs text-zhu-500">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 animate-[pulse-gentle_1s_ease-in-out_infinite] rounded-full bg-zhu-500" />{"生成中..."}
            </span>
            <button onClick={stop} className="rounded-md border border-ink-200 px-2 py-0.5 text-[10px] text-ink-500 hover:bg-paper-100">{"停止"}</button>
          </div>}
          <div className="rounded-xl border border-ink-100/40 bg-paper-100/50 p-4">
            {renderResult(result)}
          </div>
          {!loading && <div className="mt-3 flex gap-2">
            <button onClick={() => generate("lesson-design", { topic })} className="rounded-lg border border-ink-200 px-3 py-1.5 text-[11px] text-ink-600 hover:bg-paper-100">{"重新生成"}</button>
            <button onClick={onClose} className="rounded-lg bg-ink-800 px-3 py-1.5 text-[11px] font-medium text-paper-50 hover:bg-ink-900">{"完成"}</button>
          </div>}
        </div>
      )}
    </div>
  );
}

export function ToolSlideOver({ toolId, notebookId, onClose }: ToolSlideOverProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-ink-900/8 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative z-10 animate-fade-in-up">
        {toolId === "quiz" && <QuizModal onClose={onClose} notebookId={notebookId} />}
        {toolId === "student-sim" && <StudentSimModal onClose={onClose} notebookId={notebookId} />}
        {toolId === "lesson" && <LessonModal onClose={onClose} notebookId={notebookId} />}
      </div>
    </div>
  );
}
