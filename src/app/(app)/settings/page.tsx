import Link from "next/link";
import { ChevronRight, CreditCard, LogOut } from "lucide-react";
import { planState, quotaState, formatUntil } from "@/lib/plan";
import { requireAcademy } from "@/lib/session";
import { isTestMode, usesAlimtalk } from "@/lib/sms";
import { ALIMTALK_TEMPLATES } from "@/lib/alimtalk";
import { formatPhone } from "@/lib/phone";
import { SettingsForm } from "@/components/SettingsForm";
import { AttendanceNotifyToggle } from "@/components/AttendanceNotifyToggle";
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

      <Link href="/billing" className="mb-3 flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-gold">
          <CreditCard size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">이용권</span>
          <span className="block truncate text-[13px] text-slate-500">
            {(() => {
              const st = planState(academy);
              const period =
                st.kind === "UNLIMITED" ? "기한 없음" : st.kind === "EXPIRED" ? "이용 기간 끝남" : `${formatUntil(st.until)}까지`;
              const q = quotaState(academy);
              return `${q.label} · ${period} · 카톡 ${q.remaining}/${q.total}통 남음`;
            })()}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-slate-300" />
      </Link>

      <AttendanceNotifyToggle on={academy.attendanceNotify} />

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
