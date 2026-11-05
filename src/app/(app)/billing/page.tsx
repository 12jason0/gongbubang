import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { CalendarCheck, MessageSquareText, TriangleAlert } from "lucide-react";
import { db, creditLedger } from "@/db";
import { requireAcademy } from "@/lib/session";
import { planState, formatUntil } from "@/lib/plan";
import { CREDIT_PACKS, MESSAGE_PRICE, SUBSCRIPTION_PRICE } from "@/lib/pricing";
import { billingReady } from "@/lib/billing";
import { formatWon } from "@/lib/money";
import { PageTitle } from "@/components/PageTitle";
import { PayButton } from "@/components/BillingButtons";

export const metadata = { title: "이용권·충전" };

const KIND_LABEL: Record<string, string> = { CHARGE: "충전", USE: "발송", REFUND: "환불", ADMIN: "조정" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const academy = await requireAcademy();
  const state = planState(academy);
  const ready = billingReady();
  const ledger = await db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.academyId, academy.id))
    .orderBy(desc(creditLedger.createdAt))
    .limit(15);
  const fromBlocked = (await searchParams).expired === "1";

  const status =
    state.kind === "UNLIMITED"
      ? "기한 없이 쓰는 계정이에요"
      : state.kind === "EXPIRED"
        ? `${formatUntil(state.until)}에 이용 기간이 끝났어요`
        : `${state.kind === "TRIAL" ? "무료 체험 중" : "이용 중"} · ${formatUntil(state.until)}까지 (${state.daysLeft}일 남음)`;

  return (
    <main className="px-3 pt-4 md:max-w-2xl">
      <PageTitle title="이용권·충전" sub="공부방노트 이용권과 학부모님께 가는 카톡·문자 충전금" />

      {(state.kind === "EXPIRED" || fromBlocked) && (
        <p className="mb-3 flex gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-[14px] leading-relaxed text-rose-800 ring-1 ring-rose-200">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-rose-500" />
          <span>
            <b>이용 기간이 끝났어요.</b> 이용권을 결제하면 출석 체크·발송을 다시 쓸 수 있어요. 지난 기록 보기와 영수증 원부 인쇄는
            지금도 돼요.
          </span>
        </p>
      )}

      {/* 이용권 */}
      <section className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <CalendarCheck size={19} />
          </span>
          <div>
            <h2 className="text-[15px] font-bold">이용권</h2>
            <p className={`text-[13px] ${state.kind === "EXPIRED" ? "font-semibold text-rose-600" : "text-slate-500"}`}>{status}</p>
          </div>
        </div>
        {state.kind !== "UNLIMITED" && (
          <div className="mt-4">
            <PayButton
              kind="SUBSCRIPTION"
              amount={SUBSCRIPTION_PRICE}
              label={`${state.kind === "EXPIRED" ? "1개월 이용권 결제" : "1개월 연장"} · ${formatWon(SUBSCRIPTION_PRICE)}`}
              primary
              disabled={!ready}
            />
            <p className="mt-2 text-[12px] text-slate-400">
              자동으로 결제되지 않아요. {state.kind !== "EXPIRED" && "남은 기간 뒤에 한 달이 이어 붙어요."}
            </p>
          </div>
        )}
      </section>

      {/* 충전금 */}
      <section className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-black/5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-[#8a6d35]">
            <MessageSquareText size={19} />
          </span>
          <div className="flex-1">
            <h2 className="text-[15px] font-bold">카톡·문자 충전금</h2>
            <p className="text-[13px] text-slate-500">이용권과 따로, 보낸 만큼만 빠져요 (무료 체험 중에도)</p>
          </div>
          <p className="text-[22px] font-bold tabular-nums">{formatWon(academy.creditWon)}</p>
        </div>

        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-500">
          카카오 알림톡 1건 {formatWon(MESSAGE_PRICE.ALIMTALK)} · 문자 단문 {formatWon(MESSAGE_PRICE.SMS)} · 문자 장문{" "}
          {formatWon(MESSAGE_PRICE.LMS)}. 보내지 못한 건은 다시 넣어드려요. 충전금이 모자라면 그때 보낼 카톡은 안 나가고 &lsquo;보내지 못한
          문자&rsquo;로 남아서, 충전한 뒤 다시 보낼 수 있어요.
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {CREDIT_PACKS.map((won) => (
            <PayButton key={won} kind="CREDIT" amount={won} label={formatWon(won)} disabled={!ready} />
          ))}
        </div>
        {!ready && <p className="mt-2 text-[12px] text-amber-700">카드 결제 준비 중이에요. 충전·결제가 필요하면 관리자에게 연락 주세요.</p>}
      </section>

      {/* 내역 */}
      <section className="mt-3 rounded-2xl bg-white ring-1 ring-black/5">
        <h2 className="px-4 pt-3 pb-2 text-[13px] font-semibold text-slate-500">충전금 내역 (최근 15건)</h2>
        {ledger.length === 0 ? (
          <p className="px-4 pb-4 text-[13px] text-slate-400">아직 내역이 없어요</p>
        ) : (
          <ul className="divide-y divide-black/5 border-t border-black/5">
            {ledger.map((l) => (
              <li key={l.id} className="flex items-center gap-2 px-4 py-2.5 text-[13px]">
                <span className="w-[74px] shrink-0 text-slate-400 tabular-nums">
                  {l.createdAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" })}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-slate-400">{KIND_LABEL[l.kind] ?? l.kind}</span> {l.memo}
                </span>
                <span className={`shrink-0 font-semibold tabular-nums ${l.amount > 0 ? "text-emerald-600" : "text-slate-700"}`}>
                  {l.amount > 0 ? "+" : ""}
                  {l.amount.toLocaleString("ko-KR")}
                </span>
                <span className="w-[64px] shrink-0 text-right text-slate-400 tabular-nums">{l.balanceAfter.toLocaleString("ko-KR")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-4 text-center text-[12px] text-slate-400">
        <Link href="/terms" className="underline">
          이용약관·환불 규정
        </Link>
      </p>
    </main>
  );
}
