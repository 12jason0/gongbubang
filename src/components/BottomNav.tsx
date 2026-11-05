"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardCheck, LayoutDashboard, Megaphone, Settings, Users } from "lucide-react";

const TABS = [
  { href: "/", label: "출석부", Icon: ClipboardCheck },
  { href: "/notice", label: "공지", Icon: Megaphone },
  { href: "/stats", label: "월별", Icon: CalendarDays },
  { href: "/students", label: "학생·반", Icon: Users },
  { href: "/settings", label: "설정", Icon: Settings },
];

/** PC 메뉴: 맨 위에 대시보드 (휴대폰 탭은 그대로) */
const SIDE_TABS = [{ href: "/dashboard", label: "대시보드", Icon: LayoutDashboard }, ...TABS];

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

/** PC·태블릿(md 이상): 왼쪽에 떠 있는 유리 사이드바 */
export function SideNav({ academyName }: { academyName: string }) {
  const pathname = usePathname();
  return (
    <aside className="glass fixed top-3 bottom-3 left-3 z-20 hidden w-52 flex-col rounded-[28px] p-3 md:flex">
      <div className="flex items-center gap-2.5 px-2 pt-2 pb-4">
        <Image src="/icons/icon-192.png" alt="" width={34} height={34} className="shrink-0 rounded-xl" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-gold">공부방노트</p>
          <p className="truncate text-[15px] font-bold tracking-tight text-brand">{academyName}</p>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {SIDE_TABS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-full px-3.5 py-2.5 text-[15px] transition-colors ${
                active
                  ? "bg-brand font-semibold text-white shadow-[0_8px_18px_-10px_rgb(12_86_59/0.7)]"
                  : "text-slate-600 hover:bg-white/70 hover:text-brand"
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-gold" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
