import { currentAcademyId, requireAcademy } from "@/lib/session";
import { countNewConsults } from "@/lib/consult-db";
import { isTestMode } from "@/lib/sms";
import { planState, quotaState } from "@/lib/plan";
import { PlanBanner } from "@/components/PlanBanner";
import { BottomNav, SideNav } from "@/components/BottomNav";
import { ToastProvider } from "@/components/Toast";
import { HelpButton, HelpProvider } from "@/components/Help";
import { formatDateLabel, todayKST } from "@/lib/date";
import { StickyBar } from "@/components/StickyBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [academy, consultNew] = await Promise.all([requireAcademy(), currentAcademyId().then(countNewConsults)]);
  const testMode = isTestMode();

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-[calc(96px+env(safe-area-inset-bottom))] md:max-w-none md:pb-10 md:pl-56">
      <HelpProvider>
      <StickyBar className="sticky top-0 z-20 flex h-14 items-center gap-2 px-4 text-brand md:hidden">
        <span className="h-5 w-1 rounded-full bg-gold" aria-hidden />
        <span className="text-[17px] font-bold tracking-tight">{academy.name}</span>
        {testMode && (
          <span
            title="솔라피 키가 없어 문자는 실제로 나가지 않고 기록만 남아요"
            className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-300/60"
          >
            테스트 모드
          </span>
        )}
        <span className="ml-auto" />
        <HelpButton />
      </StickyBar>
      <SideNav academyName={academy.name} loginId={academy.loginId} />
      {/* PC: 왼쪽 메뉴 빼고 화면 폭 전체. 양옆 여백 = 여기 12/20px + 각 화면 main 의 px-3(12px) = 24px, 넓은 화면 32px */}
      <div className="md:px-3 xl:px-5">
        {/* PC 위쪽 바: 공부방 이름 · 오늘 날짜 · 테스트 모드 (휴대폰은 위 초록 헤더 그대로) */}
        <StickyBar className="sticky top-0 z-10 mb-2 hidden h-16 items-center gap-3 md:-mx-3 md:flex md:px-6 xl:-mx-5 xl:px-8">
          <span className="h-5 w-1 shrink-0 rounded-full bg-gold" aria-hidden />
          <span className="truncate text-[16px] font-bold tracking-tight text-brand">{academy.name}</span>
          <span className="shrink-0 text-[13.5px] font-medium text-slate-500">오늘 {formatDateLabel(todayKST())}</span>
          {testMode && (
            <span
              title="솔라피 키가 없어 문자는 실제로 나가지 않고 기록만 남아요"
              className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-[12px] font-semibold text-amber-700 ring-1 ring-amber-300/60"
            >
              테스트 모드 · 문자는 기록만 남아요
            </span>
          )}
          <span className="ml-auto" />
          <HelpButton />
        </StickyBar>
        <PlanBanner state={planState(academy)} quota={quotaState(academy)} />
        <ToastProvider>{children}</ToastProvider>
      </div>
      <BottomNav dotHref={consultNew > 0 ? "/calendar" : null} />
      </HelpProvider>
    </div>
  );
}
