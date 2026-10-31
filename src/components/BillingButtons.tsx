"use client";

import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { createOrder } from "@/app/actions";
import type { OrderKind } from "@/lib/billing";

/** 결제 버튼 — 서버에서 주문(금액)을 만든 뒤 토스 결제창(카드)을 연다 */
export function PayButton({
  kind,
  amount,
  label,
  primary,
  disabled,
}: {
  kind: OrderKind;
  amount: number;
  label: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pay() {
    setError(null);
    start(async () => {
      const o = await createOrder(kind, amount);
      if (!o.ok) {
        setError(o.error);
        return;
      }
      try {
        const toss = await loadTossPayments(o.clientKey);
        const payment = toss.payment({ customerKey: o.customerKey });
        await payment.requestPayment({
          method: "CARD",
          amount: { currency: "KRW", value: o.amount },
          orderId: o.orderId,
          orderName: o.orderName,
          successUrl: `${window.location.origin}/billing/success`,
          failUrl: `${window.location.origin}/billing/fail`,
        });
      } catch (e) {
        // 결제창을 닫은 경우 등
        const msg = e instanceof Error ? e.message : "";
        if (!/취소|cancel/i.test(msg)) setError(msg || "결제창을 열지 못했어요.");
      }
    });
  }

  return (
    <div>
      <button
        onClick={pay}
        disabled={busy || disabled}
        className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-[15px] font-semibold disabled:opacity-40 ${
          primary ? "bg-brand text-white" : "bg-brand-soft text-brand"
        }`}
      >
        {primary && <CreditCard size={17} className="text-gold" />}
        {busy ? "결제창 여는 중…" : label}
      </button>
      {error && <p className="mt-1.5 text-[13px] text-rose-600">{error}</p>}
    </div>
  );
}
