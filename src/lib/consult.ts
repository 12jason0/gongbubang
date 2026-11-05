// 상담 예약 — 받는 시간(요일+시간대) → 고를 수 있는 빈 시간. 학부모 화면·서버 저장이 같은 함수를 쓴다

import { fromMin, toMin } from "./class-colors";
import { shiftDate, shiftMonth } from "./date";
import { DAY_LABELS, weekdayOf } from "./templates";

export type ConsultRule = { days: number[]; start: string; end: string }; // days: 0=일 … 6=토
export type Booked = { date: string; start: string; end: string };
export type Slot = { start: string; end: string };

export const CONSULT_LENGTHS = [20, 30, 40, 60];
export const CONSULT_DAYS_AHEAD = 14; // 오늘부터 2주 안에서 고름
const LEAD_MIN = 60; // 지금부터 1시간 안의 시간은 못 고름 (원장님이 확인할 틈)
const MAX_RULES = 7;

export const CONSULT_STATUS: Record<string, string> = { NEW: "새 신청", CONFIRMED: "확정", PROPOSED: "다른 시간 제안함", CANCELED: "취소" };
export const ACTIVE_STATUS = ["NEW", "CONFIRMED", "PROPOSED"]; // 시간을 차지하는 신청

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** DB 글 → 규칙. 잘못된 줄은 버림 */
export function parseHours(raw: string): ConsultRule[] {
  try {
    const list = JSON.parse(raw || "[]");
    return Array.isArray(list) ? list.filter(isRule).slice(0, MAX_RULES) : [];
  } catch {
    return [];
  }
}

function isRule(r: unknown): r is ConsultRule {
  const x = r as ConsultRule;
  return (
    !!x &&
    Array.isArray(x.days) &&
    x.days.length > 0 &&
    x.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    TIME.test(x.start) &&
    TIME.test(x.end) &&
    x.start < x.end
  );
}

/** 원장님이 넣은 규칙 검사 → 저장할 JSON 또는 오류 문구 */
export function checkHours(rules: unknown, minutes: number): { ok: true; json: string } | { ok: false; message: string } {
  if (!CONSULT_LENGTHS.includes(minutes)) return { ok: false, message: "상담 길이를 골라 주세요." };
  if (!Array.isArray(rules) || rules.length > MAX_RULES) return { ok: false, message: "다시 넣어 주세요." };
  const clean: ConsultRule[] = [];
  for (const r of rules) {
    const days = [...new Set((r?.days ?? []) as number[])].sort();
    const rule = { days, start: String(r?.start ?? ""), end: String(r?.end ?? "") };
    if (!rule.days.length) return { ok: false, message: "요일을 골라 주세요." };
    if (!isRule(rule)) return { ok: false, message: "시간을 확인해 주세요. 끝 시각이 시작보다 늦어야 해요." };
    if (toMin(rule.end) - toMin(rule.start) < minutes) return { ok: false, message: `시간대가 상담 길이(${minutes}분)보다 짧아요.` };
    clean.push(rule);
  }
  return { ok: true, json: clean.length ? JSON.stringify(clean) : "" };
}

/** 보관 기간: 상담 날짜가 이 날보다 앞이면 지움 (6개월). "2026-11-06" → "2026-05-06". 31일처럼 없는 날짜여도 글자 비교라 그 달 말일까지 남김 */
export const consultCutoff = (today: string) => `${shiftMonth(today.slice(0, 7), -6)}-${today.slice(8)}`;

const overlaps = (a: Slot, b: Slot) => a.start < b.end && b.start < a.end;

/** 그날 고를 수 있는 시간: 규칙의 시간대를 상담 길이로 자름 − 이미 찬 시간 − 지난 시간(오늘이면 지금+1시간 전) */
export function freeSlotsOn(date: string, rules: ConsultRule[], minutes: number, booked: Booked[], today: string, nowTime: string): Slot[] {
  if (date < today) return [];
  const w = weekdayOf(date);
  const taken = booked.filter((b) => b.date === date);
  const earliest = date === today ? toMin(nowTime) + LEAD_MIN : -1;
  const out = new Map<string, Slot>(); // 규칙끼리 겹쳐도 한 번만
  for (const r of rules) {
    if (!r.days.includes(w)) continue;
    for (let s = toMin(r.start); s + minutes <= toMin(r.end); s += minutes) {
      const slot = { start: fromMin(s), end: fromMin(s + minutes) };
      if (s < earliest || taken.some((b) => overlaps(b, slot))) continue;
      out.set(slot.start, slot);
    }
  }
  return [...out.values()].sort((a, b) => a.start.localeCompare(b.start));
}

/** 오늘부터 2주: 빈 시간이 있는 날만 */
export function freeDays(rules: ConsultRule[], minutes: number, booked: Booked[], today: string, nowTime: string) {
  return Array.from({ length: CONSULT_DAYS_AHEAD }, (_, i) => shiftDate(today, i))
    .map((date) => ({ date, slots: freeSlotsOn(date, rules, minutes, booked, today, nowTime) }))
    .filter((d) => d.slots.length > 0);
}

/** "11/12(목) 오후 3:00" — 문자·목록용 */
export function consultWhen(date: string, start: string) {
  const m = toMin(start);
  const h = Math.floor(m / 60);
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8))}(${DAY_LABELS[weekdayOf(date)]}) ${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(m % 60).padStart(2, "0")}`;
}

/** 원장님 → 학부모님 문자 문구 (휴대폰 문자 앱에 채워 넣기만, 보내는 건 원장님이) */
export function consultSmsText(academyName: string, c: { date: string; start: string; status: string; parentName: string }) {
  const when = consultWhen(c.date, c.start);
  if (c.status === "CONFIRMED") return `[${academyName}] ${c.parentName}님, ${when} 상담이 확정되었어요. 그때 뵐게요.`;
  if (c.status === "PROPOSED") return `[${academyName}] ${c.parentName}님, 신청하신 시간이 어려워 ${when}에 상담 어떠세요? 괜찮으시면 답장 부탁드려요.`;
  if (c.status === "CANCELED") return `[${academyName}] ${c.parentName}님, 죄송하지만 ${when} 상담이 어려워 취소되었어요. 편하실 때 다시 연락 주세요.`;
  return `[${academyName}] ${c.parentName}님, ${when} 상담 신청 확인했어요.`;
}
