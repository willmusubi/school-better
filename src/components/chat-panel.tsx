"use client";

import { useState, useRef, useEffect } from "react";
import { Markdown } from "@/components/markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  notebookId: string;
  sourceCount: number;
  contextWarning?: string | null;
  onTriggerUpload: () => void;
}

const STARTER_PROMPTS = [
  "帮我分析这篇课文的论证思路",
  "基于试卷第5题举一反三",
  "整理本单元的文言文知识点",
];

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

export function ChatPanel({
  notebookId,
  sourceCount,
  contextWarning,
  onTriggerUpload,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Stop following the live stream once the user scrolls up.
  const userPinnedUpRef = useRef(false);
  // AbortController for the in-flight chat stream — wired to the Stop button.
  const abortRef = useRef<AbortController | null>(null);

  const isNearBottom = (el: HTMLDivElement) =>
    el.scrollHeight - el.scrollTop - el.clientHeight < 80;

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    userPinnedUpRef.current = false;
    setShowJumpToBottom(false);
  };

  // Smart auto-scroll: only follow the stream when user hasn't scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!userPinnedUpRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Hydrate from server on first load (per notebook).
  useEffect(() => {
    let cancelled = false;
    setHistoryLoaded(false);
    setMessages([]);
    fetch(`/api/notebooks/${notebookId}/messages`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { id: string; role: "user" | "assistant"; content: string }[]) => {
        if (cancelled) return;
        setMessages(data.map((m) => ({ id: m.id, role: m.role, content: m.content })));
        setHistoryLoaded(true);
        // Defer scroll to after DOM paint
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        });
      })
      .catch(() => {
        if (!cancelled) setHistoryLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [notebookId]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = isNearBottom(el);
    userPinnedUpRef.current = !atBottom;
    setShowJumpToBottom(!atBottom && messages.length > 0);
  };

  const stopStream = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { id: newId(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    userPinnedUpRef.current = false;
    setShowJumpToBottom(false);

    const assistantId = newId();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, notebookId }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errMsg = "请求失败";
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch { /* ignore */ }
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: errMsg } : m))
        );
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
              const { text: chunk } = JSON.parse(data);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + chunk } : m
                )
              );
            } catch { /* skip malformed */ }
          }
        }
      }
    } catch (err) {
      const isAbort = (err as Error)?.name === "AbortError";
      if (isAbort) {
        // User pressed Stop — leave the partial response, tag it.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: (m.content || "") + "\n\n_（已停止生成）_" }
              : m
          )
        );
      } else {
        console.error("Chat error:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content || "抱歉,发生了错误。请检查网络连接或API配置。" }
              : m
          )
        );
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-paper-200">
      {/* Knowledge-base context warning */}
      {contextWarning && (
        <div className="shrink-0 border-b border-jin-500/40 bg-jin-500/10 px-8 py-2.5 text-[11px] text-ink-700">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-jin-500 align-middle" />
          {contextWarning}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-8 py-8"
      >
        <div className="mx-auto max-w-[640px]">
          {!historyLoaded && messages.length === 0 ? (
            <div className="flex justify-center pt-20 text-sm text-ink-400">加载历史…</div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zhusha-600/10 shadow-[var(--shadow-soft)]">
                <span className="font-serif text-2xl font-bold text-zhusha-600">宝</span>
              </div>
              <h2 className="font-serif text-lg font-bold text-ink-800">
                {sourceCount === 0 ? "欢迎使用教师百宝箱" : "你的专属教学助手已就绪"}
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-400">
                {sourceCount === 0
                  ? "上传你的教学资料（教材、试卷、教案），AI会基于你的知识库提供教学支持。"
                  : `已加载 ${sourceCount} 份资料。你可以提问、生成测验、模拟学生提问、设计教案。`}
              </p>
              {sourceCount > 0 && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {STARTER_PROMPTS.map((hint) => (
                    <button
                      key={hint}
                      onClick={() => setInput(hint)}
                      className="rounded-full border border-ink-200/60 px-3 py-1.5 text-[11px] text-ink-500 hover:border-ink-300 hover:bg-paper-50 hover:text-ink-700"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink-800 px-5 py-3 text-[13px] leading-relaxed text-paper-50 shadow-[var(--shadow-md)]">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3.5">
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zhusha-600/10 shadow-[var(--shadow-soft)]">
                        <span className="font-serif text-xs font-bold text-zhusha-600">宝</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="rounded-2xl rounded-tl-md bg-paper-50 px-5 py-4 shadow-[var(--shadow-soft)]">
                          {msg.content ? (
                            <Markdown content={msg.content} variant="chat" />
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-ink-400">
                              <span className="inline-block h-2 w-2 animate-[pulse-gentle_1s_ease-in-out_infinite] rounded-full bg-zhusha-500" />
                              思考中...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Jump-to-bottom pill, shown when user has scrolled up */}
      {showJumpToBottom && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink-800 px-3.5 py-1.5 text-[11px] font-medium text-paper-50 shadow-[var(--shadow-md)] hover:bg-ink-900 active:scale-95 animate-fade-in"
          aria-label="滚动到底部"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14m0 0l-6-6m6 6l6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          回到底部
        </button>
      )}

      {/* Input / Upload CTA */}
      <div className="shrink-0 border-t border-ink-100/30 bg-paper-100 px-8 py-4">
        <div className="mx-auto max-w-[640px]">
          {sourceCount === 0 ? (
            <button
              onClick={onTriggerUpload}
              className="group flex w-full items-center justify-between rounded-2xl bg-paper-50 px-6 py-4 shadow-[var(--shadow-md)] ring-1 ring-ink-100/40 transition-all hover:ring-zhusha-500/30 hover:shadow-[var(--shadow-lg)]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zhusha-600/10 transition-colors group-hover:bg-zhusha-600/15">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-zhusha-600">
                    <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-[14px] font-medium text-ink-600 group-hover:text-ink-800">
                  上传资料，开始使用
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-ink-400">0 份资料</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-200 transition-all group-hover:bg-zhusha-600 group-hover:text-paper-50">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-500 group-hover:text-paper-50">
                    <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </button>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-2xl bg-paper-50 shadow-[var(--shadow-md)] ring-1 ring-ink-100/40 focus-within:ring-2 focus-within:ring-zhusha-500/20">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="基于你的知识库提问... (Enter 发送,Shift+Enter 换行)"
                  rows={1}
                  disabled={isStreaming}
                  className="max-h-40 w-full resize-none bg-transparent px-5 py-3.5 pr-14 text-[13px] text-ink-800 placeholder:text-ink-300 focus:outline-none disabled:opacity-60"
                  onKeyDown={(e) => {
                    // Ignore Enter while IME is composing (Chinese/Japanese input).
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing &&
                      e.keyCode !== 229
                    ) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                {isStreaming ? (
                  <button
                    onClick={stopStream}
                    className="absolute right-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-xl bg-ink-800 text-paper-50 shadow-[0_2px_8px_oklch(0.22_0.02_250/0.3)] hover:bg-ink-900 active:scale-95"
                    aria-label="停止生成"
                    title="停止生成"
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="3" y="3" width="10" height="10" rx="1.5" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    className="absolute right-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-xl bg-zhusha-600 text-paper-50 shadow-[0_2px_8px_oklch(0.46_0.2_24/0.3)] hover:bg-zhusha-700 active:scale-95 disabled:opacity-40"
                    aria-label="发送"
                    title="发送"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 19V5m0 0l-5 5m5-5l5 5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="mt-2 text-center text-[10px] text-ink-300">
                回答基于你上传的知识库文档生成 · 请教师审核后使用
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
