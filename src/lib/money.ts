// 교습비 도우미 — 서버(DB)와 화면 양쪽에서 쓴다

export const PAYMENT_METHODS = ["결제선생", "카드", "계좌이체", "현금"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const isPaymentMethod = (m: string): m is PaymentMethod => (PAYMENT_METHODS as readonly string[]).includes(m);

/** 350000 → "350,000원" */
export function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 표처럼 좁은 곳: 350000 → "35만", 355000 → "35.5만", 9000 → "9,000" */
export function shortWon(n: number): string {
  if (n < 10000) return n.toLocaleString("ko-KR");
  return `${Math.round(n / 1000) / 10}만`;
}

/** "350,000" / "35만" 같은 입력 → 350000. 숫자가 아니면 NaN */
export function parseWon(input: string): number {
  const s = input.replace(/[,\s원]/g, "");
  if (!s) return 0;
  const man = s.match(/^(\d+(?:\.\d+)?)만$/);
  if (man) return Math.round(Number(man[1]) * 10000);
  return /^\d+$/.test(s) ? Number(s) : NaN;
}

// ── 학생별 월 교습비·납부일 ──

/** 그 달의 납부일 "2026-02-28" — 31(말일)이나 그 달에 없는 날은 말일로 */
export function dueDateOf(month: string, dueDay: number): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(dueDay, last)).padStart(2, "0")}`;
}

export const dueDayLabel = (d: number) => (d >= 31 ? "말일" : `${d}일`);

/** 목록 작은 글씨: "25만 원 · 10일" (없는 칸은 뺌, 둘 다 없으면 "") */
export function feeLabel(fee: number | null, dueDay: number | null): string {
  return [fee ? (fee < 10000 ? formatWon(fee) : `${shortWon(fee)} 원`) : "", dueDay ? dueDayLabel(dueDay) : ""].filter(Boolean).join(" · ");
}

/** 이 달 납부일이 아직 안 지났으면 true (납부일 없으면 false → 기록 없으면 바로 미납) */
export function beforeDue(month: string, dueDay: number | null, today: string): boolean {
  return !!dueDay && dueDateOf(month, dueDay) > today;
}

/** 교습비 입력 "250,000" / "25만" / "" → 250000 / null. 잘못되면 NaN */
export function parseFee(input: string): number | null {
  if (!input.trim()) return null;
  const n = parseWon(input);
  return Number.isFinite(n) && n > 0 && n <= 10_000_000 ? n : NaN;
}

/** 납부일 입력 "10" / "10일" / "말일" / "" → 10 / 31 / null. 잘못되면 NaN */
export function parseDueDay(input: string): number | null {
  const t = input.replace(/\s+/g, "").replace(/^매달|^매월/, "");
  if (!t) return null;
  if (t === "말일") return 31;
  const m = t.match(/^(\d{1,2})일?$/);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 31 ? n : NaN;
}
