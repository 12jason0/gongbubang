// 요금제 — 원장님이 내는 돈. 카톡·문자는 요금제에 들어 있는 통수만큼 (충전금 없음)
//
// - 가입하면 무료 체험 TRIAL_DAYS일 (카톡 30통)
// - 그 뒤로는 1개월 이용권을 결제: 기본 5,900원(150통) / 넉넉 9,900원(400통). 자동결제 아님
// - 통수는 이용 기간(결제일부터 1개월) 단위로 새로 센다. 알림톡·문자 모두 1건 = 1통(기타 공지 문자만 SMS_UNITS), 실패·접수 거절은 안 셈
//   원가 참고(솔라피, VAT 별도): 알림톡 13원 / 단문 18원 / 장문 45원

function num(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : fallback;
}

/**
 * 문자로만 나가는 기타 공지는 문자 원가만큼 통수를 뺀다 (알림톡 13원 = 1통 기준, 올림).
 * 단문 18원 → 2통, 장문 45원 → 4통. 그 밖의 종류는 알림톡이든 대체 문자든 1통
 */
export const SMS_UNITS = { short: 2, long: 4 };

export const TRIAL_DAYS = num("TRIAL_DAYS", 14);

export type Tier = "TRIAL" | "BASIC" | "PLUS";
export type PaidTier = Exclude<Tier, "TRIAL">;

export const PLANS: Record<Tier, { label: string; price: number; quota: number }> = {
  TRIAL: { label: "무료 체험", price: 0, quota: 30 },
  BASIC: { label: "기본", price: 5900, quota: 150 },
  PLUS: { label: "넉넉", price: 9900, quota: 400 },
};

export const PAID_TIERS: PaidTier[] = ["BASIC", "PLUS"];

export const isPaidTier = (s: string): s is PaidTier => s === "BASIC" || s === "PLUS";

/** DB 의 plan 값 → 요금제. 예전 "PAID"(이용권 하나뿐이던 때)는 기본으로 본다 */
export function tierOf(plan: string): Tier {
  if (plan === "PLUS") return "PLUS";
  if (plan === "BASIC" || plan === "PAID") return "BASIC";
  return "TRIAL";
}
