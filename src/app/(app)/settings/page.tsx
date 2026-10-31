import { LogOut } from "lucide-react";
import { requireAcademy } from "@/lib/session";
import { isTestMode, usesAlimtalk } from "@/lib/sms";
import { ALIMTALK_TEMPLATES } from "@/lib/alimtalk";
import { formatPhone } from "@/lib/phone";
import { SettingsForm } from "@/components/SettingsForm";
import { PageTitle } from "@/components/PageTitle";
import { ConsentNotice } from "@/components/ConsentNotice";
import { logout } from "../../actions";

export default async function SettingsPage() {
  const academy = await requireAcademy();
  const testMode = isTestMode();
  const kakao = {
    attendance: usesAlimtalk("ATTENDANCE") ? ALIMTALK_TEMPLATES.ATTENDANCE.body : undefined,
    feedback: usesAlimtalk("FEEDBACK") ? ALIMTALK_TEMPLATES.FEEDBACK.body : undefined,
  };
  const anyKakao = (["ATTENDANCE", "FEEDBACK", "PAYMENT"] as const).some(usesAlimtalk);

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
          registrationNo: academy.registrationNo,
        }}
        kakao={kakao}
      />

      <div className="mt-3">
        <ConsentNotice academyId={academy.id} academyName={academy.name} />
      </div>

      <section className="mt-3 rounded-2xl bg-white p-4 text-sm ring-1 ring-black/5">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">문자 보내는 번호</span>
          <span className="font-semibold tabular-nums">
            {academy.senderPhone ? formatPhone(academy.senderPhone) : "미등록"}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-slate-500">보내는 방식</span>
          {testMode ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">테스트 모드</span>
          ) : anyKakao ? (
            <span className="rounded-full bg-[#fef01b]/40 px-2 py-0.5 text-xs font-semibold text-[#3c3600]">카카오 알림톡 + 문자</span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">문자</span>
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
