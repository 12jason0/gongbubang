import { requireAcademy } from "@/lib/session";
import { isTestMode } from "@/lib/sms";
import { planState, quotaState } from "@/lib/plan";
import { PlanBanner } from "@/components/PlanBanner";
import { BottomNav, SideNav } from "@/components/BottomNav";
import { ToastProvider } from "@/components/Toast";
import { ExampleModeProvider, ExampleToggle } from "@/components/ExampleMode";
import { formatDateLabel, todayKST } from "@/lib/date";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const academy = await requireAcademy();
  const testMode = isTestMode();

  return (
    <div className="pc-canvas mx-auto min-h-dvh max-w-md bg-canvas pb-24 md:max-w-none md:pb-10 md:pl-56">
      <ExampleModeProvider>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 bg-brand px-4 text-white md:hidden">
        <span className="h-5 w-1 rounded-full bg-gold" aria-hidden />
        <span className="text-[17px] font-bold tracking-tight">{academy.name}</span>
        {testMode && (
          <span
            title="솔라피 키가 없어 문자는 실제로 나가지 않고 기록만 남아요"
            className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200"
          >
            테스트 모드
          </span>
        )}

      </header>
      <SideNav academyName={academy.name} />
      {/* PC에서는 본문을 넓게, 너무 퍼지지 않게 가운데 */}
      <div className="md:mx-auto md:max-w-6xl md:px-5 md:pt-3">
        {/* PC 위쪽 바: 공부방 이름 · 오늘 날짜 · 테스트 모드 (휴대폰은 위 초록 헤더 그대로) */}
        <header className="glass sticky top-3 z-10 mb-4 hidden h-14 items-center gap-3 rounded-full pr-2 pl-5 md:flex">
          <span className="h-5 w-1 shrink-0 rounded-full bg-gold" aria-hidden />
          <span className="truncate text-[16px] font-bold tracking-tight text-brand">{academy.name}</span>
          <span className="surface shrink-0 rounded-full px-3 py-1 text-[13px] font-medium text-slate-600">
            오늘 {formatDateLabel(todayKST())}
          </span>
          {testMode && (
            <span
              title="솔라피 키가 없어 문자는 실제로 나가지 않고 기록만 남아요"
              className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-[12px] font-semibold text-amber-700 ring-1 ring-amber-300/60"
            >
              테스트 모드 · 문자는 기록만 남아요
            </span>
          )}
          <span className="ml-auto" />
          <ExampleToggle />
        </header>
        <PlanBanner state={planState(academy)} quota={quotaState(academy)} />
        <ToastProvider>{children}</ToastProvider>
      </div>
      <BottomNav />
      </ExampleModeProvider>
    </div>
  );
}
