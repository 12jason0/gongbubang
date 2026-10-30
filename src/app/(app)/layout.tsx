import { requireAcademy } from "@/lib/session";
import { isTestMode } from "@/lib/sms";
import { BottomNav, SideNav } from "@/components/BottomNav";
import { ToastProvider } from "@/components/Toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const academy = await requireAcademy();
  const testMode = isTestMode();

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-canvas pb-24 md:max-w-none md:pb-10 md:pl-56">
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
      <SideNav academyName={academy.name} testMode={testMode} />
      {/* PC에서는 본문을 넓게, 너무 퍼지지 않게 가운데 */}
      <div className="md:mx-auto md:max-w-6xl md:px-5 md:pt-4">
        <ToastProvider>{children}</ToastProvider>
      </div>
      <BottomNav />
    </div>
  );
}
