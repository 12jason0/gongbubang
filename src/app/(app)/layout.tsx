import { requireAcademy } from "@/lib/session";
import { isTestMode } from "@/lib/sms";
import { logout } from "../actions";
import { BottomNav } from "@/components/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const academy = await requireAcademy();
  const testMode = isTestMode();

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-[#f5f6f8] pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-brand px-4 py-3 text-white">
        <span className="text-base font-bold">{academy.name}</span>
        <form action={logout}>
          <button className="text-xs text-white/70">로그아웃</button>
        </form>
      </header>
      {testMode && (
        <p className="bg-amber-100 px-4 py-2 text-xs text-amber-800">
          테스트 모드 — 문자는 실제로 나가지 않고 기록만 남아요 (솔라피 키 미설정)
        </p>
      )}
      {children}
      <BottomNav />
    </div>
  );
}
