// 요금 — 원장님이 내는 돈. 전부 env 로 바꿀 수 있고, 없으면 아래 기본값.
//
// - 이용권: 가입하면 무료 체험(TRIAL_DAYS일), 그 뒤로는 1개월 이용권을 결제해서 씀
// - 카톡·문자: 이용권과 별도. 미리 충전한 충전금에서 보낼 때마다 건당 차감 (무료 체험 중에도 차감)
//   원가(솔라피, VAT 별도): 알림톡 13원 / 단문 18원 / 장문 45원 → 아래 기본값은 원가 + VAT + 약간

function num(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : fallback;
}

export const TRIAL_DAYS = num("TRIAL_DAYS", 14);
export const SUBSCRIPTION_PRICE = num("SUBSCRIPTION_PRICE", 5900); // 1개월 이용권(원)

/** 건당 차감 금액(원) */
export const MESSAGE_PRICE = {
  ALIMTALK: num("PRICE_ALIMTALK", 15),
  SMS: num("PRICE_SMS", 20), // 문자 단문 (한글 약 45자까지)
  LMS: num("PRICE_LMS", 50), // 문자 장문
};

/** 충전 금액 버튼 */
export const CREDIT_PACKS = [5000, 10000, 30000];

/** 충전금이 이 밑이면 출석부 위에 "충전해 주세요" */
export const LOW_CREDIT_WON = num("LOW_CREDIT_WON", 1000);
