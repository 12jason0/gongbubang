"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { loadTossPayments, type TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";
import { createOrder } from "@/app/actions";
import type { OrderKind } from "@/lib/billing";
import { PLANS } from "@/lib/pricing";

/** [5,900원 · 150통] — 결제위젯 화면(/billing/pay)으로 */
export function PayLink({ kind, primary, disabled }: { kind: OrderKind; primary?: boolean; disabled?: boolean }) {
  const p = PLANS[kind];
  const cls = `flex w-full items-center justify-center rounded-xl py-3 text-[15px] font-semibold tabular-nums ${
    primary ? "bg-brand text-white" : "bg-brand-soft text-brand"
  }`;
  const label = `${p.price.toLocaleString("ko-KR")}원 · ${p.quota}통`;
  if (disabled) return <span className={`${cls} opacity-40`}>{label}</span>;
  return (
    <Link href={`/billing/pay?kind=${kind}`} className={cls}>
      {label}
    </Link>
  );
}

/** 토스 결제위젯 — 결제수단·약관을 그리고, [결제하기]를 누르면 서버에서 주문(금액)을 만든 뒤 결제를 요청한다 */
export function TossCheckout({
  kind,
  amount,
  clientKey,
  customerKey,
  label,
}: {
  kind: OrderKind;
  amount: number;
  clientKey: string;
  customerKey: string;
  label: string;
}) {
  const widgets = useRef<TossPaymentsWidgets | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 위젯은 한 자리에 한 번만 그린다 (개발 모드 StrictMode 가 effect 를 두 번 돌려도)
  const init = useRef<Promise<TossPaymentsWidgets> | null>(null);
  useEffect(() => {
    init.current ??= (async () => {
      const w = (await loadTossPayments(clientKey)).widgets({ customerKey });
      await w.setAmount({ currency: "KRW", value: amount });
      await Promise.all([
        w.renderPaymentMethods({ selector: "#payment-method" }),
        w.renderAgreement({ selector: "#agreement" }),
      ]);
      return w;
    })();
    init.current.then(
      (w) => {
        widgets.current = w;
        setReady(true);
      },
      (e) => setError(e instanceof Error ? e.message : "결제창을 불러오지 못했어요."),
    );
  }, [clientKey, customerKey, amount]);

  function pay() {
    setError(null);
    start(async () => {
      const o = await createOrder(kind);
      if (!o.ok) return setError(o.error);
      try {
        await widgets.current!.requestPayment({
          orderId: o.orderId,
          orderName: o.orderName,
          successUrl: `${window.location.origin}/billing/success`,
          failUrl: `${window.location.origin}/billing/fail`,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (!/취소|cancel/i.test(msg)) setError(msg || "결제를 요청하지 못했어요.");
      }
    });
  }

  return (
    <div>
      <div id="payment-method" />
      <div id="agreement" />
      <button
        onClick={pay}
        disabled={!ready || busy}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand py-3.5 text-[15px] font-semibold text-white disabled:opacity-40"
      >
        <CreditCard size={17} className="text-gold" />
        {!ready ? "결제창 불러오는 중…" : busy ? "결제 요청 중…" : label}
      </button>
      {error && <p className="mt-1.5 text-[13px] text-rose-600">{error}</p>}
    </div>
  );
}
