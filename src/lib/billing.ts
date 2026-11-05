// 결제 — 토스페이먼츠 결제창(카드). 1개월 요금제(기본·넉넉).
//
// 흐름: ① createOrder 로 주문을 DB 에 먼저 저장(금액 고정) → ② 화면에서 결제창 → ③ 토스가 /billing/success 로 돌려보냄
//       → ④ confirmOrder: 주문 금액과 같은지 확인 후 토스 "결제 승인" API 호출 → 성공해야만 요금제·이용 기간 반영
// 같은 주문이 두 번 반영되지 않게, 승인 전에 상태를 READY → CONFIRMING 으로 먼저 바꿔서 확보한다.
//
// env: TOSS_CLIENT_KEY (test_ck_… / live_ck_…), TOSS_SECRET_KEY (test_sk_… / live_sk_…) — "API 개별 연동 키" (결제위젯 키 아님)

import { and, eq } from "drizzle-orm";
import { db, academies, orders } from "@/db";
import { PLANS, isPaidTier, type PaidTier } from "./pricing";
import { extendOneMonth } from "./plan";

export type OrderKind = PaidTier;

/** 주문의 요금제. 예전 이용권 주문(SUBSCRIPTION)은 기본, 충전금 주문(CREDIT)은 더 이상 처리 안 함 → null */
function tierOfOrder(kind: string): PaidTier | null {
  if (kind === "SUBSCRIPTION") return "BASIC";
  return isPaidTier(kind) ? kind : null;
}

export function billingReady() {
  const ck = process.env.TOSS_CLIENT_KEY ?? "";
  const sk = process.env.TOSS_SECRET_KEY ?? "";
  if (!ck || !sk) return false;
  // 운영(Vercel Production)에 테스트 키가 들어가 있으면 결제를 막는다.
  // 테스트 결제는 돈이 안 빠지는데 요금제 통수는 생겨서, 그 통수로 두나 솔라피 잔액이 실제로 나가기 때문.
  if (process.env.VERCEL_ENV === "production" && (ck.startsWith("test_") || sk.startsWith("test_"))) return false;
  return true;
}

export function orderName(kind: OrderKind) {
  return `공부방노트 ${PLANS[kind].label} 1개월 (카톡 ${PLANS[kind].quota}통)`;
}

/** 금액은 화면이 아니라 서버가 정한다 */
export function priceFor(kind: OrderKind): number {
  return PLANS[kind].price;
}

export async function createOrderRow(academyId: string, kind: OrderKind, amount: number) {
  const [o] = await db.insert(orders).values({ academyId, kind, amount }).returning({ id: orders.id });
  return o.id;
}

type ConfirmResult = { ok: true; kind: OrderKind; amount: number; already: boolean } | { ok: false; error: string };
// kind: 결제한 요금제

export async function confirmOrder(academyId: string, paymentKey: string, orderId: string, amount: number): Promise<ConfirmResult> {
  if (!billingReady()) return { ok: false, error: "결제 준비 중이에요. 관리자에게 문의해 주세요." };
  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.academyId, academyId)));
  if (!order) return { ok: false, error: "주문을 찾을 수 없어요." };
  const tier = tierOfOrder(order.kind);
  // 충전금 주문이 결제창에 남아 있던 경우: 승인 요청을 안 보내서 돈이 빠지지 않게 끝낸다
  if (!tier) return { ok: false, error: "충전금은 더 이상 판매하지 않아요. 요금제로 결제해 주세요." };
  if (order.status === "DONE") return { ok: true, kind: tier, amount: order.amount, already: true };
  if (order.amount !== amount) return { ok: false, error: "결제 금액이 주문과 달라요. 결제가 진행되지 않았어요." };

  // 확보: READY 일 때만 CONFIRMING 으로 (새로고침·두 번 열기에도 한 번만 승인)
  const claimed = await db
    .update(orders)
    .set({ status: "CONFIRMING", paymentKey })
    .where(and(eq(orders.id, orderId), eq(orders.status, "READY")))
    .returning({ id: orders.id });
  if (claimed.length === 0) {
    return order.status === "CONFIRMING"
      ? { ok: false, error: "결제를 확인하는 중이에요. 잠시 뒤 새로고침해 주세요." }
      : { ok: false, error: order.failReason ?? "이미 처리된 주문이에요." };
  }

  let body: { status?: string; totalAmount?: number; message?: string; code?: string } | null = null;
  let httpOk = false;
  try {
    const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64"),
        "Content-Type": "application/json",
        "Idempotency-Key": orderId, // 같은 주문을 다시 승인 요청해도 토스가 한 번만 처리
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
      signal: AbortSignal.timeout(20_000),
    });
    httpOk = res.ok;
    body = await res.json().catch(() => null);
  } catch (e) {
    console.error("토스 결제 승인 호출 실패", e);
    // 승인이 됐는지 모르는 상태 — CONFIRMING 으로 남겨 두고 관리자가 토스 상점관리자에서 확인
    return { ok: false, error: "결제 확인 중 연결이 끊겼어요. 카드에서 돈이 빠졌다면 연락 주세요." };
  }

  if (!httpOk || body?.status !== "DONE" || body?.totalAmount !== amount) {
    const reason = body?.message ?? "결제를 승인하지 못했어요.";
    await db.update(orders).set({ status: "FAILED", failReason: reason }).where(eq(orders.id, orderId));
    return { ok: false, error: reason };
  }

  // 승인 완료 → 반영 (주문 DONE 과 요금제·이용 기간을 한 번에)
  // 결제일부터 통수를 새로 센다 (periodStart = 지금). 기간이 남아 있으면 그 끝에 한 달이 이어 붙는다.
  await db.transaction(async (tx) => {
    await tx.update(orders).set({ status: "DONE", doneAt: new Date() }).where(eq(orders.id, orderId));
    const [a] = await tx.select({ until: academies.serviceUntil }).from(academies).where(eq(academies.id, academyId));
    await tx
      .update(academies)
      .set({ serviceUntil: extendOneMonth(a?.until ?? null), plan: tier, periodStart: new Date() })
      .where(eq(academies.id, academyId));
  });
  return { ok: true, kind: tier, amount, already: false };
}
