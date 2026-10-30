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
