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

/** 문자에 쓰는 한국 시각 "4시 5분" (정각이면 "4시") — 공부방은 오후 수업이라 오전/오후는 안 붙임 */
export function spokenTimeKST(date: Date = new Date()): string {
  const [h, m] = timeKST(date).split(":").map(Number);
  const hour = h % 12 || 12;
  return m ? `${hour}시 ${m}분` : `${hour}시`;
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

/** 월 앞/뒤로 "2026-10" → "2026-11" */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return t.toISOString().slice(0, 7);
}
