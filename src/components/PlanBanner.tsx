import Link from "next/link";
import { CalendarClock, MessageCircleOff, TriangleAlert } from "lucide-react";
import type { PlanState, QuotaState } from "@/lib/plan";
import { PLANS } from "@/lib/pricing";

/**
 * 모든 화면 맨 위 한 줄 — 필요할 때만 보인다
 * - 이용 기간 끝남 → 빨강, 결제로
 * - 무료 체험·이용권 3일 이하 남음 → 금색
 * - 이번 기간 카톡을 다 씀 → 빨강 + [9,900원으로 올리기] / 얼마 안 남음 → 주황
 */
export function PlanBanner({ state, quota }: { state: PlanState; quota: QuotaState }) {
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

  const upgrade = quota.tier !== "PLUS" && (
    <span className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[12px] font-semibold text-rose-600">
      {PLANS.PLUS.price.toLocaleString("ko-KR")}원으로 올리기
    </span>
  );
  if (state.kind !== "EXPIRED" && quota.remaining === 0) {
    items.push(
      <Link key="quota" href="/billing#PLUS" className="flex items-center gap-2 rounded-xl bg-rose-500 px-3.5 py-2.5 text-[14px] text-white">
        <MessageCircleOff size={17} className="shrink-0" />
        <span className="flex-1">
          <b>이번 달 카톡을 다 썼어요</b> · 출석은 기록되고 학부모님께 카톡은 안 가요
          {quota.tier === "PLUS" && " (다음 이용 기간에 다시 채워져요)"}
        </span>
        {upgrade}
      </Link>,
    );
  } else if (state.kind !== "EXPIRED" && quota.remaining <= Math.max(1, Math.ceil(quota.total * 0.1))) {
    items.push(
      <Link key="quota" href="/billing#PLUS" className="flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[14px] text-amber-900 ring-1 ring-amber-300">
        <MessageCircleOff size={17} className="shrink-0 text-amber-600" />
        <span className="flex-1">
          이번 달 카톡이 <b>{quota.remaining}통</b> 남았어요
        </span>
        <span className="shrink-0 rounded-lg bg-amber-500 px-2.5 py-1 text-[12px] font-semibold text-white">요금제 보기</span>
      </Link>,
    );
  }

  if (items.length === 0) return null;
  return <div className="space-y-2 px-3 pt-3 md:px-0">{items}</div>;
}
