import { LogOut } from "lucide-react";
import { requireAcademy } from "@/lib/session";
import { isTestMode } from "@/lib/sms";
import { formatPhone } from "@/lib/phone";
import { SettingsForm } from "@/components/SettingsForm";
import { PageTitle } from "@/components/PageTitle";
import { logout } from "../../actions";

export default async function SettingsPage() {
  const academy = await requireAcademy();
  const testMode = isTestMode();

  return (
    <main className="px-3 pt-4 md:max-w-2xl">
      <PageTitle title="설정" sub="학원 이름과 학부모님께 가는 문자 문구" />

      <SettingsForm
        initial={{
          name: academy.name,
          attendanceEnding: academy.attendanceEnding,
          attendanceExtra: academy.attendanceExtra,
          feedbackTitle: academy.feedbackTitle,
          feedbackClosing: academy.feedbackClosing,
        }}
      />

      <section className="mt-3 rounded-2xl bg-white p-4 text-sm ring-1 ring-black/5">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">문자 보내는 번호</span>
          <span className="font-semibold tabular-nums">
            {academy.senderPhone ? formatPhone(academy.senderPhone) : "미등록"}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-slate-500">문자 발송</span>
          {testMode ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">테스트 모드</span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">연결됨</span>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">보내는 번호를 바꾸려면 관리자에게 문의해 주세요.</p>
      </section>

      <form action={logout} className="mt-3">
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-medium text-slate-500 ring-1 ring-black/5">
          <LogOut size={16} /> 로그아웃
        </button>
      </form>
    </main>
  );
}
