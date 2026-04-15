"use client";

import type { ToolId } from "@/app/notebooks/[id]/page";

interface StudioPanelProps {
  activeTool: ToolId;
  onSelectTool: (tool: ToolId) => void;
}

const TOOLS = [
  {
    id: "quiz" as const,
    name: "测验生成",
    desc: "基于教材章节自动生成完整测验",
    iconPath: "M9 11l2 2 4-4",
    iconExtra: "M4 4h16v16H4z",
    accentBg: "bg-dian-500",
    accentLight: "bg-dian-500/8",
    accentText: "text-dian-500",
    tag: "核心",
    tagColor: "bg-dian-500 text-paper-50",
  },
  {
    id: "student-sim" as const,
    name: "模拟学生提问",
    desc: "模拟不同水平的学生提问，帮助备课",
    iconPath: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2",
    iconExtra: "M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
    accentBg: "bg-zhusha-600",
    accentLight: "bg-zhusha-600/8",
    accentText: "text-zhusha-600",
    tag: "核心",
    tagColor: "bg-zhusha-600 text-paper-50",
  },
  {
    id: "lesson" as const,
    name: "课程设计",
    desc: "AI辅助生成教案框架",
    iconPath: "M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
    iconExtra: "M9 7h6M9 11h4",
    accentBg: "bg-zhu-500",
    accentLight: "bg-zhu-500/8",
    accentText: "text-zhu-500",
    tag: "核心",
    tagColor: "bg-zhu-500 text-paper-50",
  },
];

export function StudioPanel({ activeTool, onSelectTool }: StudioPanelProps) {
  return (
    <div className="paper-texture flex w-[220px] shrink-0 flex-col border-l border-ink-100/40 bg-paper-100">
      {/* Header */}
      <div className="px-4 pt-4 pb-1">
        <h2 className="font-serif text-[15px] font-bold text-ink-900">教学百宝箱</h2>
        <p className="mt-1 text-[10px] leading-relaxed text-ink-400">
          基于你的知识库运行的专属教学工具
        </p>
      </div>

      {/* Divider */}
      <div className="mx-4 my-3 h-px bg-gradient-to-r from-ink-100/60 via-ink-200/40 to-transparent" />

      {/* Tools */}
      <div className="flex-1 overflow-y-auto px-3 stagger-children">
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.id;
          const isComingSoon = tool.tag === "即将上线";
          return (
            <button
              key={tool.id}
              onClick={() => !isComingSoon && onSelectTool(isActive ? null : tool.id)}
              disabled={isComingSoon}
              className={`group mb-2.5 flex w-full flex-col rounded-xl p-3 text-left transition-all animate-fade-in-up ${
                isActive
                  ? `bg-paper-50 shadow-[var(--shadow-md)] ring-1 ring-ink-100/60`
                  : isComingSoon
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-paper-200/60 hover:shadow-[var(--shadow-soft)]"
              }`}
            >
              {/* Icon + tag row */}
              <div className="flex items-start justify-between">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  isActive ? tool.accentLight : "bg-paper-300/50 group-hover:bg-paper-300"
                }`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                    className={isActive ? tool.accentText : "text-ink-500 group-hover:text-ink-700"} strokeLinecap="round" strokeLinejoin="round">
                    <path d={tool.iconPath} />
                    <path d={tool.iconExtra} />
                  </svg>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${tool.tagColor}`}>
                  {tool.tag}
                </span>
              </div>

              {/* Text */}
              <div className="mt-2.5">
                <div className={`text-[13px] font-semibold ${isActive ? "text-ink-900" : "text-ink-700"}`}>
                  {tool.name}
                </div>
                <div className="mt-0.5 text-[10px] leading-relaxed text-ink-400">
                  {tool.desc}
                </div>
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-zhusha-600">
                  <span className="inline-block h-1.5 w-1.5 animate-[pulse-gentle_2s_ease-in-out_infinite] rounded-full bg-zhusha-500" />
                  运行中
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-ink-100/40 px-4 py-3">
        <p className="text-[10px] leading-relaxed text-ink-300">
          工具生成内容基于你上传的知识库文档，与你的教学进度和风格对齐
        </p>
      </div>
    </div>
  );
}
