// 이용 기간 계산 — 무료 체험 / 이용권 / 기간 끝남

import { todayKST } from "./date";

export type PlanInfo = {
  serviceUntil: Date | null; // null = 기한 없음 (관리자·데모 계정)
  plan: string; // TRIAL / PAID
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
  return { kind: a.plan === "PAID" ? "PAID" : "TRIAL", until: a.serviceUntil, daysLeft };
}

export function isActive(a: PlanInfo, now = new Date()) {
  return planState(a, now).kind !== "EXPIRED";
}

/** 1개월 연장: 아직 기간이 남았으면 그 끝에서, 끝났으면 지금부터 한 달 */
export function extendOneMonth(current: Date | null, now = new Date()) {
  const base = current && current > now ? new Date(current) : new Date(now);
  const next = new Date(base);
  next.setMonth(next.getMonth() + 1);
  // 1/31 + 1개월 → 3/3 처럼 넘치면 그 달 말일로
  if (next.getDate() !== base.getDate()) next.setDate(0);
  return next;
}

/** "2026년 11월 14일" (한국 날짜) */
export function formatUntil(d: Date) {
  const [y, m, day] = todayKST(d).split("-").map(Number);
  return `${y}년 ${m}월 ${day}일`;
}
