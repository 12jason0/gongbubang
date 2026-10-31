import Link from "next/link";
import { CalendarClock, TriangleAlert, Wallet } from "lucide-react";
import type { PlanState } from "@/lib/plan";
import { formatWon } from "@/lib/money";

/**
 * 모든 화면 맨 위 한 줄 — 필요할 때만 보인다
 * - 이용 기간 끝남 → 빨강, 결제로
 * - 무료 체험·이용권 3일 이하 남음 → 금색
 * - 충전금 부족 → 주황
 */
export function PlanBanner({ state, credit, lowCredit }: { state: PlanState; credit: number; lowCredit: boolean }) {
  const items: React.ReactNode[] = [];

  if (state.kind === "EXPIRED") {
    items.push(
      <Link key="exp" href="/billing" className="flex items-center gap-2 rounded-xl bg-rose-500 px-3.5 py-2.5 text-[14px] text-white">
        <TriangleAlert size={17} className="shrink-0" />
        <span className="flex-1">
          <b>이용 기간이 끝났어요</b> · 기록 보기만 돼요
        </span>
        <span className="shrink-0 rounded-lg bg-white/20 px-2.5 py-1 text-[12px] font-semibold">이용권 결제</span>
      </Link>,
    );
  } else if ((state.kind === "TRIAL" || state.kind === "PAID") && state.daysLeft <= 3) {
    items.push(
      <Link key="soon" href="/billing" className="flex items-center gap-2 rounded-xl bg-gold-soft px-3.5 py-2.5 text-[14px] text-[#6b5428] ring-1 ring-gold/40">
        <CalendarClock size={17} className="shrink-0" />
        <span className="flex-1">
          {state.kind === "TRIAL" ? "무료 체험" : "이용 기간"}이 <b>{state.daysLeft === 0 ? "오늘" : `${state.daysLeft}일 뒤`}</b> 끝나요
        </span>
        <span className="shrink-0 rounded-lg bg-brand px-2.5 py-1 text-[12px] font-semibold text-white">이용권 보기</span>
      </Link>,
    );
  }

  if (lowCredit) {
    items.push(
      <Link key="credit" href="/billing" className="flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[14px] text-amber-900 ring-1 ring-amber-300">
        <Wallet size={17} className="shrink-0 text-amber-600" />
        <span className="flex-1">
          <b>카톡 충전금이 {credit <= 0 ? "없어요" : `${formatWon(credit)} 남았어요`}</b>
          {credit <= 0 && " · 학부모님께 카톡이 안 가요"}
        </span>
        <span className="shrink-0 rounded-lg bg-amber-500 px-2.5 py-1 text-[12px] font-semibold text-white">충전하기</span>
      </Link>,
    );
  }

  if (items.length === 0) return null;
  return <div className="space-y-2 px-3 pt-3 md:px-0">{items}</div>;
}
