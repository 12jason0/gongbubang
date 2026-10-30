import { LogOut } from "lucide-react";
import { requireAcademy } from "@/lib/session";
import { isTestMode } from "@/lib/sms";
import { logout } from "../actions";
import { BottomNav } from "@/components/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const academy = await requireAcademy();
  const testMode = isTestMode();

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-canvas pb-24">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 bg-brand px-4 text-white">
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
        <form action={logout} className="ml-auto">
          <button aria-label="로그아웃" className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60">
            <LogOut size={18} />
          </button>
        </form>
      </header>
      {children}
      <BottomNav />
    </div>
  );
}
