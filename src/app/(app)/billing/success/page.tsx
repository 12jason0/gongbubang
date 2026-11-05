import Link from "next/link";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { requireAcademy } from "@/lib/session";
import { confirmOrder } from "@/lib/billing";
import { PLANS } from "@/lib/pricing";

export const metadata = { title: "결제 확인" };

/** 토스 결제창에서 돌아오는 곳 — 여기서 서버가 결제 승인을 요청하고, 성공해야만 반영된다 */
export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ paymentKey?: string; orderId?: string; amount?: string }>;
}) {
  const academy = await requireAcademy();
  const { paymentKey, orderId, amount } = await searchParams;
  const won = Number(amount);

  const result =
    paymentKey && orderId && Number.isInteger(won)
      ? await confirmOrder(academy.id, paymentKey, orderId, won)
      : ({ ok: false, error: "결제 정보가 없어요." } as const);

  return (
    <main className="px-3 pt-10 md:max-w-md">
      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-black/5">
        {result.ok ? (
          <>
            <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
            <p className="mt-3 text-[18px] font-bold">
              {PLANS[result.kind].label} 요금제 결제가 끝났어요
            </p>
            <p className="mt-1 text-[14px] text-slate-500">
              이용 기간이 한 달 늘고, 오늘부터 카톡 {PLANS[result.kind].quota}통을 새로 세요.
            </p>
          </>
        ) : (
          <>
            <TriangleAlert size={40} className="mx-auto text-rose-500" />
            <p className="mt-3 text-[18px] font-bold">결제가 끝나지 않았어요</p>
            <p className="mt-1 text-[14px] text-slate-500">{result.error}</p>
          </>
        )}
        <Link href="/billing" className="mt-5 inline-block rounded-xl bg-brand px-5 py-3 text-[15px] font-semibold text-white">
          이용권으로
        </Link>
      </div>
    </main>
  );
}
