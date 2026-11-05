import Link from "next/link";
import { CalendarCheck, Check, MessageCircle, TriangleAlert } from "lucide-react";
import { requireAcademy } from "@/lib/session";
import { planState, quotaState, formatUntil } from "@/lib/plan";
import { PAID_TIERS, PLANS } from "@/lib/pricing";
import { billingReady } from "@/lib/billing";
import { formatWon } from "@/lib/money";
import { PageTitle } from "@/components/PageTitle";
import { PayButton } from "@/components/BillingButtons";

export const metadata = { title: "이용권" };

const BLURB = { BASIC: "학생 10명 안팎, 등원 카톡 위주", PLUS: "학생이 많거나 공지·피드백도 자주" } as const;

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ expired?: string; trial?: string }> }) {
  const academy = await requireAcademy();
  const state = planState(academy);
  const quota = quotaState(academy);
  const ready = billingReady();
  const sp = await searchParams;
  const fromBlocked = sp.expired === "1";
  const trialUsed = sp.trial === "used";

  const status =
    state.kind === "UNLIMITED"
      ? "기한 없이 쓰는 계정이에요"
      : state.kind === "EXPIRED"
        ? `${formatUntil(state.until)}에 이용 기간이 끝났어요`
        : `${quota.label}${state.kind === "TRIAL" ? "" : " 요금제"} · ${formatUntil(state.until)}까지 (${state.daysLeft}일 남음)`;

  return (
    <main className="px-3 pt-4 md:max-w-2xl">
      <PageTitle title="이용권" sub="공부방노트 요금제 · 학부모님께 가는 카톡·문자 통수 포함" />

      {trialUsed && (
        <p className="mb-3 rounded-xl bg-gold-soft px-3.5 py-3 text-[14px] leading-relaxed text-[#6b5428] ring-1 ring-gold/40">
          이 연락처로 무료 체험을 이미 쓰셨어요. 요금제를 결제하면 바로 쓸 수 있어요.
        </p>
      )}

      {!trialUsed && (state.kind === "EXPIRED" || fromBlocked) && (
        <p className="mb-3 flex gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-[14px] leading-relaxed text-rose-800 ring-1 ring-rose-200">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-rose-500" />
          <span>
            <b>이용 기간이 끝났어요.</b> 요금제를 결제하면 출석 체크·발송을 다시 쓸 수 있어요. 지난 기록 보기와 영수증 원부 인쇄는
            지금도 돼요.
          </span>
        </p>
      )}

      {/* 지금 상태 */}
      <section className="card rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <CalendarCheck size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-bold">지금 요금제</h2>
            <p className={`text-[13px] ${state.kind === "EXPIRED" ? "font-semibold text-rose-600" : "text-slate-500"}`}>{status}</p>
          </div>
        </div>
        {state.kind !== "EXPIRED" && (
          <div className="mt-4">
            <div className="flex items-end justify-between text-[13px]">
              <span className="flex items-center gap-1.5 font-semibold">
                <MessageCircle size={15} className="text-gold" /> 이번 달 카톡
              </span>
              <span className="text-slate-500">
                <b className={`text-[18px] tabular-nums ${quota.remaining === 0 ? "text-rose-600" : "text-brand"}`}>{quota.remaining}</b> / {quota.total}통 남음
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-brand-soft">
              <div
                className={`h-full rounded-full ${quota.remaining === 0 ? "bg-rose-500" : "bg-brand"}`}
                style={{ width: `${(quota.remaining / quota.total) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-[12px] text-slate-400">
              {quota.refillOn ? `${formatUntil(quota.refillOn)}부터 다시 ${quota.total}통` : "이용 기간이 끝나면 요금제를 결제해서 이어 써요"} · 알림톡·문자
              모두 1건 = 1통, 보내지 못한 건은 안 세요
            </p>
          </div>
        )}
      </section>

      {/* 요금제 2개 */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {PAID_TIERS.map((t) => {
          const p = PLANS[t];
          const current = quota.tier === t && state.kind !== "EXPIRED";
          return (
            <section
              key={t}
              id={t}
              className={`card scroll-mt-20 rounded-2xl p-4 ${t === "PLUS" ? "outline-2 outline-gold" : ""}`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-bold">{p.label}</h2>
                {current && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">지금 요금제</span>}
              </div>
              <p className="mt-1 text-[24px] font-bold tracking-tight tabular-nums">
                {formatWon(p.price)}
                <span className="text-[14px] font-medium text-slate-400"> / 1개월</span>
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-[14px]">
                <Check size={16} className="text-brand" /> 카톡·문자 <b>{p.quota}통</b>
              </p>
              <p className="mt-1 text-[12.5px] text-slate-500">{BLURB[t]}</p>
              {state.kind !== "UNLIMITED" && (
                <div className="mt-4">
                  <PayButton kind={t} label={`${formatWon(p.price)} 결제`} primary={t === "PLUS"} disabled={!ready} />
                </div>
              )}
            </section>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-[12px] leading-relaxed text-slate-400">
        자동으로 결제되지 않아요. 결제한 날부터 통수를 새로 세고, 이용 기간이 남아 있으면 그 뒤에 한 달이 이어 붙어요.
      </p>
      {!ready && <p className="mt-1 px-1 text-[12px] text-amber-700">카드 결제 준비 중이에요. 결제가 필요하면 관리자에게 연락 주세요.</p>}

      <p className="mt-4 text-center text-[12px] text-slate-400">
        <Link href="/terms" className="underline">
          이용약관·환불 규정
        </Link>
      </p>
    </main>
  );
}
