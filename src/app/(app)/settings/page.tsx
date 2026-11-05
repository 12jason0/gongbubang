import Link from "next/link";
import { ChevronRight, CreditCard, UserRound } from "lucide-react";
import { planState, quotaState, formatUntil } from "@/lib/plan";
import { requireAcademy } from "@/lib/session";
import { ALIMTALK_TEMPLATES } from "@/lib/alimtalk";
import { SettingsForm } from "@/components/SettingsForm";
import { AttendanceNotifyToggle } from "@/components/AttendanceNotifyToggle";
import { PageTitle } from "@/components/PageTitle";
import { ConsentNotice } from "@/components/ConsentNotice";

export default async function SettingsPage() {
  const academy = await requireAcademy();

  return (
    <main className="px-3 pt-4 pb-6">
      <PageTitle title="설정" sub="학원 이름과 학부모님께 가는 카톡" />

      {/* 보내는 번호·방식은 원장님 화면에 안 보임 (테스트 모드는 위쪽 바). 동의 안내 문구는 맨 아래 접힘
          PC(lg): 왼쪽 줄에 계정·이용권·등원 카톡·동의 문구, 오른쪽 줄에 학원 정보·카톡 미리보기 (휴대폰 순서는 그대로) */}
      <div className="lg:grid lg:grid-cols-2 lg:grid-rows-[auto_auto_auto_1fr] lg:items-start lg:gap-x-5 [&>*]:lg:col-start-1">

      {/* 마이페이지 (휴대폰은 여기가 들어가는 곳) */}
      <Link href="/me" className="card mb-3 flex items-center gap-3 rounded-2xl p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-gold">
          <UserRound size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">마이페이지</span>
          <span className="block truncate text-[13px] text-slate-500">
            {academy.loginId} · 연락처·비밀번호·결제 내역·계정 관리
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

      <div className="lg:col-start-2! lg:row-span-4 lg:row-start-1">
      <SettingsForm
        initial={{ name: academy.name, registrationNo: academy.registrationNo }}
        bodies={{ attendance: ALIMTALK_TEMPLATES.ATTENDANCE.body, feedback: ALIMTALK_TEMPLATES.FEEDBACK.body }}
      />
      </div>

      {/* 학부모 동의는 학생·반 화면 [동의 요청 보내기]가 기본. 이건 종이·문자로 직접 받을 때만 */}
      <ConsentNotice academyId={academy.id} academyName={academy.name} />
      </div>
    </main>
  );
}
