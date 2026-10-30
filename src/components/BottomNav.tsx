"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardCheck, Megaphone, Settings, Users } from "lucide-react";

const TABS = [
  { href: "/", label: "출석부", Icon: ClipboardCheck },
  { href: "/notice", label: "공지", Icon: Megaphone },
  { href: "/stats", label: "월별", Icon: CalendarDays },
  { href: "/students", label: "학생·반", Icon: Users },
  { href: "/settings", label: "설정", Icon: Settings },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

/** 휴대폰: 화면 아래 탭 (md 이상에서는 숨김) */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md border-t border-black/5 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      {TABS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex flex-1 flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] ${
              active ? "font-semibold text-brand" : "text-slate-400"
            }`}
          >
            {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gold" aria-hidden />}
            <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** PC·태블릿(md 이상): 왼쪽 사이드바 */
export function SideNav({ academyName, testMode }: { academyName: string; testMode: boolean }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col bg-brand text-white md:flex">
      <div className="flex items-center gap-2 px-5 pt-6 pb-5">
        <span className="h-5 w-1 shrink-0 rounded-full bg-gold" aria-hidden />
        <span className="truncate text-[17px] font-bold tracking-tight">{academyName}</span>
      </div>
      <nav className="flex flex-col gap-0.5 px-3">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] ${
                active ? "bg-white/10 font-semibold text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              {active && <span className="absolute top-2.5 bottom-2.5 left-0 w-0.5 rounded-full bg-gold" aria-hidden />}
              <Icon size={19} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-gold" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>
      {testMode && (
        <p
          title="솔라피 키가 없어 문자는 실제로 나가지 않고 기록만 남아요"
          className="mx-3 mt-auto mb-5 rounded-xl bg-amber-400/15 px-3 py-2 text-[12px] font-semibold text-amber-200"
        >
          테스트 모드 · 문자는 기록만 남아요
        </p>
      )}
    </aside>
  );
}
