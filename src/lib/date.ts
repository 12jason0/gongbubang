// 서버(Vercel)는 UTC로 돌아가므로 날짜·시각은 항상 한국 시간으로 계산한다

const KST = "Asia/Seoul";

/** 한국 날짜 "2026-10-30" */
export function todayKST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 한국 시각 "16:05" */
export function timeKST(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** 문자에 쓰는 한국 시각, 24시간 기준 "16시 5분" (정각이면 "16시") */
export function spokenTimeKST(date: Date = new Date()): string {
  const [h, m] = timeKST(date).split(":").map(Number);
  return m ? `${h}시 ${m}분` : `${h}시`;
}

/** "2026-10" */
export function thisMonthKST(): string {
  return todayKST().slice(0, 7);
}

export function isValidDate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function isValidMonth(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}$/.test(s);
}

/** "2026-10-30" → "10월 30일 (금)" */
export function formatDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  ];
  return `${m}월 ${d}일 (${day})`;
}

/** 날짜 하루 앞/뒤로 */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

// ── 분기 ── "2026-4" = 2026년 4분기 (10~12월)
export function quarterOf(date: string): string {
  return `${date.slice(0, 4)}-${Math.ceil(Number(date.slice(5, 7)) / 3)}`;
}

export function isValidQuarter(s: string | undefined): s is string {
  return !!s && /^\d{4}-[1-4]$/.test(s);
}

/** "2026-4" → { from: "2026-10-01", to: "2027-01-01", months: ["2026-10","2026-11","2026-12"] } (to 는 포함 안 함) */
export function quarterRange(q: string) {
  const [y, n] = q.split("-").map(Number);
  const first = `${y}-${String(n * 3 - 2).padStart(2, "0")}`;
  return { from: `${first}-01`, to: `${shiftMonth(first, 3)}-01`, months: [0, 1, 2].map((i) => shiftMonth(first, i)) };
}

export function shiftQuarter(q: string, n: number): string {
  return quarterOf(`${shiftMonth(quarterRange(q).from.slice(0, 7), n * 3)}-01`);
}

/** 월 앞/뒤로 "2026-10" → "2026-11" */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return t.toISOString().slice(0, 7);
}
