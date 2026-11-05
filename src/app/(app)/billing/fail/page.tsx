import Link from "next/link";
import { CircleX } from "lucide-react";

export const metadata = { title: "결제 실패" };

/** 토스 결제창에서 실패·취소로 돌아오는 곳 (돈은 빠지지 않음) */
export default async function BillingFailPage({ searchParams }: { searchParams: Promise<{ code?: string; message?: string }> }) {
  const { code, message } = await searchParams;
  const canceled = code === "PAY_PROCESS_CANCELED";

  return (
    <main className="px-3 pt-10 md:max-w-md">
      <div className="card rounded-2xl p-6 text-center">
        <CircleX size={40} className="mx-auto text-slate-400" />
        <p className="mt-3 text-[18px] font-bold">{canceled ? "결제를 취소했어요" : "결제하지 못했어요"}</p>
        <p className="mt-1 text-[14px] text-slate-500">{canceled ? "돈은 빠지지 않았어요." : (message ?? "다시 시도해 주세요.")}</p>
        <Link href="/billing" className="mt-5 inline-block rounded-xl bg-brand px-5 py-3 text-[15px] font-semibold text-white">
          돌아가기
        </Link>
      </div>
    </main>
  );
}
