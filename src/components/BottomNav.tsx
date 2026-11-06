"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, CalendarDays, ChevronRight, ClipboardCheck, LayoutDashboard, Megaphone, Settings, UserRound, Users } from "lucide-react";

const TABS = [
  { href: "/", label: "출석부", Icon: ClipboardCheck },
  { href: "/notice", label: "공지", Icon: Megaphone },
  { href: "/stats", label: "월별", Icon: CalendarDays },
  { href: "/calendar", label: "달력", Icon: Calendar },
  { href: "/students", label: "학생·반", Icon: Users },
  { href: "/settings", label: "설정", Icon: Settings },
];

/** PC 메뉴: 맨 위에 대시보드 (휴대폰 탭은 그대로) */
const SIDE_TABS = [{ href: "/dashboard", label: "대시보드", Icon: LayoutDashboard }, ...TABS];

/**
 * 메뉴 미리 불러오기: 화면에 보이는 메뉴는 Link 가 뼈대(loading.tsx)까지 미리 받아 두고,
 * 손가락이 닿거나(touchstart) 마우스를 올리면 그 화면 데이터까지 받기 시작 → 손을 떼는 사이에 이미 받아 오는 중
 */
function useIntentPrefetch() {
  const router = useRouter();
  return (href: string) => {
    const go = () => router.prefetch(href);
    return { onTouchStart: go, onMouseEnter: go, onFocus: go };
  };
}

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

/** 휴대폰: 화면 아래 떠 있는 알약 모양 메뉴 (아래 12px + 아이폰 홈 바 영역, 양옆 12px). md 이상에서는 숨김 */
/** dotHref: 그 탭 아이콘에 빨간 점 (새 상담 신청이 있으면 달력) */
export function BottomNav({ dotHref }: { dotHref?: string | null }) {
  const pathname = usePathname();
  const intent = useIntentPrefetch();
  return (
    <nav
      className="glass fixed inset-x-3 z-20 mx-auto flex max-w-[26rem] gap-0.5 rounded-full p-1.5 shadow-[0_12px_32px_-12px_rgb(12_40_30/0.35)] md:hidden"
      style={{ bottom: "calc(12px + env(safe-area-inset-bottom))" }}
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            {...intent(href)}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10.5px] whitespace-nowrap transition-colors ${
              active ? "bg-brand font-semibold text-white shadow-[0_6px_14px_-8px_rgb(12_86_59/0.8)]" : "text-slate-500 active:bg-black/5"
            }`}
          >
            <span className="relative">
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-gold" : ""} />
              {dotHref === href && <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-rose-500 ring-2 ring-white" aria-label="새 상담 신청" />}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** PC·태블릿(md 이상): 왼쪽에 떠 있는 유리 사이드바. 화면이 낮으면(노트북 확대 125% 등) 메뉴가 넘치지 않고 사이드바 안에서 스크롤 */
export function SideNav({ academyName, loginId }: { academyName: string; loginId: string }) {
  const pathname = usePathname();
  const intent = useIntentPrefetch();
  return (
    <aside className="glass fixed top-3 bottom-3 left-3 z-20 hidden w-52 flex-col overflow-y-auto rounded-[28px] p-3 md:flex">
      <div className="flex items-center gap-2.5 px-2 pt-2 pb-4">
        <Image src="/icons/icon-192.png" alt="" width={34} height={34} className="shrink-0 rounded-xl" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-gold">공부방노트</p>
          <p className="line-clamp-2 text-[15px] leading-snug font-bold tracking-tight break-all text-brand">{academyName}</p>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {SIDE_TABS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              {...intent(href)}
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
        {...intent("/me")}
        aria-current={pathname.startsWith("/me") ? "page" : undefined}
        className={`mt-auto flex shrink-0 items-center gap-2.5 rounded-2xl px-2.5 py-2.5 transition-colors ${
          pathname.startsWith("/me") ? "bg-brand text-white" : "surface hover:bg-white/80"
        }`}
      >
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${pathname.startsWith("/me") ? "bg-white/15 text-gold" : "bg-brand-soft text-brand"}`}>
          <UserRound size={16} />
        </span>
        <span className="min-w-0 flex-1">
          {/* 폭이 좁아 "아이디 · 마이페이지"가 한 줄에 다 안 들어가 잘렸음 → 마이페이지를 첫 줄, 아이디를 둘째 줄로 */}
          <span className="block text-[13.5px] font-semibold">마이페이지</span>
          <span className={`block truncate text-[11.5px] ${pathname.startsWith("/me") ? "text-white/70" : "text-slate-500"}`}>{loginId}</span>
        </span>
        <ChevronRight size={15} className="shrink-0 opacity-60" />
      </Link>
    </aside>
  );
}
