"use client";

import { useState, useRef } from "react";

interface Props {
  notebookId: string;
  onClose: () => void;
  onAdded?: () => void;
}

type Mode = "main" | "urls" | "text";

const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 25);

export function AddSourceModal({ notebookId, onClose, onAdded }: Props) {
  const [mode, setMode] = useState<Mode>("main");
  const [urls, setUrls] = useState("");
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    setUploading(true);
    setErrors([]);
    const arr = Array.from(files);

    // Validate client-side first so we don't even kick off doomed uploads.
    const tooLarge = arr.filter((f) => f.size > MAX_UPLOAD_MB * 1024 * 1024);
    const valid = arr.filter((f) => f.size <= MAX_UPLOAD_MB * 1024 * 1024);
    const localErrors = tooLarge.map(
      (f) => `${f.name}: 超过 ${MAX_UPLOAD_MB} MB 上限`
    );

    // Parallel upload — Promise.all so a single huge file doesn't block the rest.
    const results = await Promise.allSettled(
      valid.map(async (file) => {
        const form = new FormData();
        form.append("file", file);
        form.append("notebookId", notebookId);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `${file.name}: 上传失败`);
        }
        return file.name;
      })
    );

    const remoteErrors = results
      .map((r, i) =>
        r.status === "rejected"
          ? `${valid[i]?.name || "file"}: ${(r.reason as Error).message || "上传失败"}`
          : null
      )
      .filter((e): e is string => !!e);

    const allErrors = [...localErrors, ...remoteErrors];
    setUploading(false);
    onAdded?.();

    if (allErrors.length > 0) {
      setErrors(allErrors);
      // Keep modal open so user can see errors. They can close manually.
      return;
    }
    onClose();
  };

  const submitUrls = async () => {
    const urlList = urls
      .split(/\s+|\n+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0 && /^https?:\/\//.test(u));

    if (urlList.length === 0) return;

    setUploading(true);
    try {
      await fetch("/api/add-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "urls", notebookId, urls: urlList }),
      });
      onAdded?.();
      onClose();
    } catch (e) {
      console.error("URL submit failed:", e);
    }
    setUploading(false);
  };

  const submitText = async () => {
    if (!text.trim()) return;
    setUploading(true);
    try {
      await fetch("/api/add-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "text", notebookId, text }),
      });
      onAdded?.();
      onClose();
    } catch (e) {
      console.error("Text submit failed:", e);
    }
    setUploading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-ink-900/15 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-[520px] max-h-[85vh] overflow-y-auto rounded-2xl bg-paper-50 shadow-[var(--shadow-lg)] ring-1 ring-ink-100/40 animate-fade-in-up">
        {mode === "main" && (
          <>
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="font-serif text-[17px] font-bold text-ink-900">添加知识库资料</h2>
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 hover:bg-paper-200 hover:text-ink-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Drop zone */}
            <div className="px-6 pb-5">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
                }}
                className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                  dragOver
                    ? "border-zhusha-500 bg-zhusha-600/5"
                    : "border-ink-200/60 bg-paper-100/50"
                }`}
              >
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-paper-200">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-400">
                    <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-[13px] font-medium text-ink-600">
                  {uploading ? "上传中..." : "拖拽文件到这里"}
                </p>
                <p className="mt-1 text-[11px] text-ink-400">
                  支持 PDF、Word、图片、PPT 等 · 单个 ≤ {MAX_UPLOAD_MB} MB
                </p>
              </div>
              {errors.length > 0 && (
                <div className="mt-3 rounded-xl border border-zhusha-500/40 bg-zhusha-600/5 px-3 py-2.5">
                  <div className="mb-1 text-[11px] font-semibold text-zhusha-700">部分文件未上传</div>
                  <ul className="space-y-0.5 text-[11px] text-ink-700">
                    {errors.map((e, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="mt-1 shrink-0 text-zhusha-500">·</span>
                        <span className="break-all">{e}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Three action buttons */}
            <div className="grid grid-cols-3 gap-3 px-6 pb-6">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.ppt,.pptx,.txt"
                className="hidden"
                onChange={(e) => e.target.files && uploadFiles(e.target.files)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="group flex flex-col items-center gap-2 rounded-xl border border-ink-200/60 bg-paper-50 px-3 py-4 transition-all hover:border-zhusha-500/30 hover:bg-zhusha-600/5 disabled:opacity-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zhusha-600/10 text-zhusha-600">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-[12px] font-medium text-ink-700">上传文件</span>
              </button>

              <button
                onClick={() => setMode("urls")}
                className="group flex flex-col items-center gap-2 rounded-xl border border-ink-200/60 bg-paper-50 px-3 py-4 transition-all hover:border-dian-500/30 hover:bg-dian-500/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dian-500/10 text-dian-500">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-[12px] font-medium text-ink-700">网页链接</span>
              </button>

              <button
                onClick={() => setMode("text")}
                className="group flex flex-col items-center gap-2 rounded-xl border border-ink-200/60 bg-paper-50 px-3 py-4 transition-all hover:border-zhu-500/30 hover:bg-zhu-500/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zhu-500/10 text-zhu-500">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M14 3v4a1 1 0 001 1h4M14 3l5 5v13a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2h7zM9 13h6M9 17h5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-[12px] font-medium text-ink-700">粘贴文本</span>
              </button>
            </div>
          </>
        )}

        {mode === "urls" && (
          <>
            <div className="flex items-center gap-2 px-6 pt-5 pb-3">
              <button onClick={() => setMode("main")} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-paper-200 hover:text-ink-700">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <h2 className="flex-1 font-serif text-[17px] font-bold text-ink-900">网页链接</h2>
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 hover:bg-paper-200 hover:text-ink-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="px-6 pb-5">
              <p className="mb-3 text-[12px] text-ink-500">粘贴网页链接作为知识库来源。</p>
              <textarea
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder="粘贴链接..."
                rows={6}
                autoFocus
                className="w-full resize-none rounded-xl border border-zhusha-400/30 bg-paper-50 px-4 py-3 text-[13px] leading-[1.7] text-ink-800 placeholder:text-ink-300 focus:border-zhusha-500/40 focus:outline-none focus:ring-2 focus:ring-zhusha-500/10"
              />
              <ul className="mt-3 space-y-1 text-[11px] leading-relaxed text-ink-400">
                <li>· 多个链接请用空格或换行分隔</li>
                <li>· 只会导入网页的可见文本内容</li>
                <li>· 付费文章/需登录的页面不支持</li>
                <li>· 不支持视频内容(如YouTube、B站)</li>
              </ul>
            </div>

            <div className="flex justify-end px-6 pb-5">
              <button
                onClick={submitUrls}
                disabled={uploading || !urls.trim()}
                className="rounded-xl bg-dian-500 px-6 py-2.5 text-[13px] font-semibold text-paper-50 shadow-[0_2px_10px_oklch(0.5_0.13_260/0.3)] hover:bg-dian-600 active:scale-[0.98] disabled:opacity-40"
              >
                {uploading ? "导入中..." : "导入"}
              </button>
            </div>
          </>
        )}

        {mode === "text" && (
          <>
            <div className="flex items-center gap-2 px-6 pt-5 pb-3">
              <button onClick={() => setMode("main")} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-paper-200 hover:text-ink-700">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <h2 className="flex-1 font-serif text-[17px] font-bold text-ink-900">粘贴文本</h2>
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 hover:bg-paper-200 hover:text-ink-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="px-6 pb-5">
              <p className="mb-3 text-[12px] text-ink-500">粘贴复制的文本作为知识库来源。</p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="在此粘贴文本..."
                rows={9}
                autoFocus
                className="w-full resize-none rounded-xl border border-zhusha-400/30 bg-paper-50 px-4 py-3 text-[13px] leading-[1.8] text-ink-800 placeholder:text-ink-300 focus:border-zhusha-500/40 focus:outline-none focus:ring-2 focus:ring-zhusha-500/10"
              />
            </div>

            <div className="flex justify-end px-6 pb-5">
              <button
                onClick={submitText}
                disabled={uploading || !text.trim()}
                className="rounded-xl bg-zhu-500 px-6 py-2.5 text-[13px] font-semibold text-paper-50 shadow-[0_2px_10px_oklch(0.55_0.13_155/0.3)] hover:bg-zhu-600 active:scale-[0.98] disabled:opacity-40"
              >
                {uploading ? "导入中..." : "导入"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
