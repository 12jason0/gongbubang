// 이용 기간 계산 — 무료 체험 / 이용권 / 기간 끝남

import { todayKST } from "./date";
import { PLANS, tierOf, type Tier } from "./pricing";

export type PlanInfo = {
  serviceUntil: Date | null; // null = 기한 없음 (관리자·데모 계정)
  plan: string; // TRIAL / BASIC / PLUS (예전 PAID = BASIC)
};

export type PlanState =
  | { kind: "UNLIMITED" }
  | { kind: "TRIAL" | "PAID"; until: Date; daysLeft: number }
  | { kind: "EXPIRED"; until: Date };

/** 지금 쓸 수 있는지 + 며칠 남았는지 (한국 날짜 기준 남은 날 수, 오늘 끝나면 0) */
export function planState(a: PlanInfo, now = new Date()): PlanState {
  if (!a.serviceUntil) return { kind: "UNLIMITED" };
  if (a.serviceUntil <= now) return { kind: "EXPIRED", until: a.serviceUntil };
  const daysLeft = Math.round(
    (Date.parse(todayKST(a.serviceUntil)) - Date.parse(todayKST(now))) / 86_400_000,
  );
  return { kind: tierOf(a.plan) === "TRIAL" ? "TRIAL" : "PAID", until: a.serviceUntil, daysLeft };
}

export function isActive(a: PlanInfo, now = new Date()) {
  return planState(a, now).kind !== "EXPIRED";
}

/** n개월 뒤 같은 날 (1/31 + 1개월 → 2월 말일처럼 넘치면 그 달 말일로) */
export function addMonths(base: Date, n: number) {
  const next = new Date(base);
  next.setMonth(next.getMonth() + n);
  if (next.getDate() !== base.getDate()) next.setDate(0);
  return next;
}

/** 1개월 연장: 아직 기간이 남았으면 그 끝에서, 끝났으면 지금부터 한 달 */
export function extendOneMonth(current: Date | null, now = new Date()) {
  return addMonths(current && current > now ? current : now, 1);
}

// ───── 카톡 통수 ─────
// 기준일(periodStart: 마지막 결제일, 없으면 가입일)부터 한 달씩 끊어서 센다.
// msgPeriod 에는 "지금 세고 있는 기간의 시작"을 적어 두고, 기간이 바뀌면 msgUsed 는 0 부터 다시.

export type QuotaInfo = { plan: string; periodStart: Date | null; createdAt: Date; msgPeriod: string; msgUsed: number };

/** 지금이 들어 있는 한 달 기간 [start, end) */
export function currentPeriod(anchor: Date, now = new Date()) {
  let k = Math.max(0, (now.getFullYear() - anchor.getFullYear()) * 12 + now.getMonth() - anchor.getMonth() - 1);
  while (addMonths(anchor, k + 1) <= now) k++;
  return { start: addMonths(anchor, k), end: addMonths(anchor, k + 1) };
}

export function quotaState(a: QuotaInfo, now = new Date()) {
  const tier: Tier = tierOf(a.plan);
  const { start, end } = currentPeriod(a.periodStart ?? a.createdAt, now);
  const key = start.toISOString();
  const total = PLANS[tier].quota;
  const used = a.msgPeriod === key ? a.msgUsed : 0;
  return { tier, label: PLANS[tier].label, key, end, total, used, remaining: Math.max(0, total - used) };
}

export type QuotaState = ReturnType<typeof quotaState>;

/** "2026년 11월 14일" (한국 날짜) */
export function formatUntil(d: Date) {
  const [y, m, day] = todayKST(d).split("-").map(Number);
  return `${y}년 ${m}월 ${day}일`;
}
