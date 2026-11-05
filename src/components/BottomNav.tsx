"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChevronRight, ClipboardCheck, LayoutDashboard, Megaphone, Settings, UserRound, Users } from "lucide-react";

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
    <nav className="glass fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md rounded-t-[22px] bg-white/35 pb-[env(safe-area-inset-bottom)] md:hidden">
      {TABS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex flex-1 flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] ${
              active ? "font-semibold text-brand" : "text-slate-500"
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
export function SideNav({ academyName, loginId }: { academyName: string; loginId: string }) {
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
      {/* 맨 아래: 공부방 이름·아이디 → 마이페이지 */}
      <Link
        href="/me"
        aria-current={pathname === "/me" ? "page" : undefined}
        className={`mt-auto flex items-center gap-2.5 rounded-2xl px-2.5 py-2.5 transition-colors ${
          pathname === "/me" ? "bg-brand text-white" : "surface hover:bg-white/80"
        }`}
      >
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${pathname === "/me" ? "bg-white/15 text-gold" : "bg-brand-soft text-brand"}`}>
          <UserRound size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold">{academyName}</span>
          <span className={`block truncate text-[11.5px] ${pathname === "/me" ? "text-white/70" : "text-slate-500"}`}>{loginId} · 마이페이지</span>
        </span>
        <ChevronRight size={15} className="shrink-0 opacity-60" />
      </Link>
    </aside>
  );
}
