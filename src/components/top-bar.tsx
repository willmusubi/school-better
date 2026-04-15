import { ProfileMenu } from "@/components/profile-menu";

export function TopBar() {
  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between bg-paper-50 px-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-3.5">
        {/* Logo — ink seal style */}
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zhusha-600 shadow-[0_2px_8px_oklch(0.46_0.2_24/0.3)]">
          <span className="font-serif text-base font-bold text-paper-50 drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">
            宝
          </span>
        </div>
        <div className="flex items-baseline gap-2.5">
          <h1 className="font-serif text-[17px] font-bold tracking-tight text-ink-900">
            教师百宝箱
          </h1>
          <span className="text-[11px] font-light tracking-wide text-ink-400">AI 教学知识库</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Subject badge */}
        <div className="flex items-center gap-2 rounded-full bg-paper-200 py-1.5 pr-3.5 pl-2.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zhusha-600/10 text-[10px] text-zhusha-600">
            文
          </span>
          <span className="text-xs font-medium text-ink-700">高中语文</span>
        </div>

        <ProfileMenu />
      </div>
    </header>
  );
}
