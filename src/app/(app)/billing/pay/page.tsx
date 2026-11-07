import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAcademy } from "@/lib/session";
import { billingReady, orderName } from "@/lib/billing";
import { PLANS, isPaidTier } from "@/lib/pricing";
import { formatWon } from "@/lib/money";
import { PageTitle } from "@/components/PageTitle";
import { TossCheckout } from "@/components/BillingButtons";

export const metadata = { title: "결제" };

/** 이용권 결제 — 토스 결제위젯. /billing/pay?kind=BASIC|PLUS */
export default async function PayPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const academy = await requireAcademy();
  const { kind = "" } = await searchParams;
  if (!isPaidTier(kind) || !billingReady() || !academy.serviceUntil) redirect("/billing");
  const p = PLANS[kind];

  return (
    <main className="px-3 pt-4 md:max-w-xl">
      <PageTitle title="이용권 결제" sub={orderName(kind)} />
      <section className="card rounded-2xl p-4">
        <p className="flex items-baseline justify-between">
          <span className="text-[15px] font-bold">
            {p.label} · 카톡·문자 {p.quota}통 · 1개월
          </span>
          <b className="text-[20px] tabular-nums">{formatWon(p.price)}</b>
        </p>
        <p className="mt-1 text-[12.5px] text-slate-500">
          결제하면 바로 반영돼요. 이용 기간이 남아 있으면 그 뒤에 한 달이 이어 붙어요. 자동결제 아님.
        </p>
      </section>
      <section className="card mt-3 rounded-2xl p-2">
        <TossCheckout
          kind={kind}
          amount={p.price}
          clientKey={process.env.TOSS_CLIENT_KEY!}
          customerKey={academy.id}
          label={`${formatWon(p.price)} 결제하기`}
        />
      </section>
      <p className="mt-3 text-center text-[12px] text-slate-400">
        <Link href="/terms" className="underline">
          이용약관·환불 규정
        </Link>
      </p>
    </main>
  );
}
