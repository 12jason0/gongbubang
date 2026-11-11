"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, academies, orders, creditLedger } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { extendOneMonth, quotaState } from "@/lib/plan";
import { PLANS, isPaidTier } from "@/lib/pricing";

/** 계좌이체 입금 확인 → 1달 연장. 카드 결제 승인(lib/billing.ts confirmOrder)과 같은 반영 + 주문 기록(paymentKey "BANK") */
export async function adminExtend(formData: FormData) {
  await requireAdmin();
  const academyId = String(formData.get("academyId"));
  const tier = String(formData.get("tier"));
  if (!isPaidTier(tier)) throw new Error("요금제를 골라 주세요");
  await db.transaction(async (tx) => {
    const [a] = await tx.select({ until: academies.serviceUntil }).from(academies).where(eq(academies.id, academyId));
    if (!a) throw new Error("공부방이 없어요");
    const now = new Date();
    await tx.insert(orders).values({ academyId, kind: tier, amount: PLANS[tier].price, status: "DONE", paymentKey: "BANK", doneAt: now });
    await tx.update(academies).set({ serviceUntil: extendOneMonth(a.until, now), plan: tier, periodStart: now }).where(eq(academies.id, academyId));
  });
  revalidatePath("/admin");
}

/** 이번 기간 카톡 n통 더 주기 — msgUsed 를 n 만큼 줄인다(음수 가능). 기록은 credit_ledger (kind ADMIN_MSG, amount = 통수) */
export async function adminAddMessages(formData: FormData) {
  await requireAdmin();
  const academyId = String(formData.get("academyId"));
  const n = Number(formData.get("count"));
  if (!Number.isInteger(n) || n < 1 || n > 10000) throw new Error("통수를 1~10000 사이로 넣어 주세요");
  await db.transaction(async (tx) => {
    const [a] = await tx.select().from(academies).where(eq(academies.id, academyId));
    if (!a) throw new Error("공부방이 없어요");
    const q = quotaState(a);
    await tx.update(academies).set({ msgPeriod: q.key, msgUsed: q.used - n }).where(eq(academies.id, academyId));
    await tx.insert(creditLedger).values({ academyId, amount: n, balanceAfter: q.remaining + n, kind: "ADMIN_MSG", memo: `카톡 ${n}통 충전 (관리자)` });
  });
  revalidatePath("/admin");
}
