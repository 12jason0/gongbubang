import Link from "next/link";
import { ChevronRight, CreditCard, LogOut, UserRound } from "lucide-react";
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
    <main className="px-3 pt-4 md:max-w-5xl">
      <PageTitle title="설정" sub="학원 이름과 학부모님께 가는 문자 문구" />

      {/* PC: 왼쪽 문구 설정, 오른쪽 동의 문구·보내는 번호·로그아웃 (휴대폰은 위에서 아래로 같은 순서) */}
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,380px)] md:items-start md:gap-4">
      <div>

      {/* 마이페이지 (휴대폰은 여기가 들어가는 곳) */}
      <Link href="/me" className="card mb-3 flex items-center gap-3 rounded-2xl p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-gold">
          <UserRound size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">마이페이지</span>
          <span className="block truncate text-[13px] text-slate-500">
            {academy.loginId} · 연락처·비밀번호·결제 내역·탈퇴
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-slate-400" />
      </Link>

      <Link href="/billing" className="card mb-3 flex items-center gap-3 rounded-2xl p-4">
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
      </div>

      <div className="max-md:mt-3 md:sticky md:top-20">
        <ConsentNotice academyId={academy.id} academyName={academy.name} />

      <section className="card mt-3 rounded-2xl p-4 text-sm">
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
        <button className="card flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium text-slate-500">
          <LogOut size={16} /> 로그아웃
        </button>
      </form>
      </div>
      </div>
    </main>
  );
}
