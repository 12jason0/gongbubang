// 가입 때 원장님 휴대폰 문자 인증 — 솔라피를 켤 때 같이 켠다. 지금은 꺼 둠 (가입 화면에 인증번호 칸이 안 나옴)
//
// 켜는 법: PHONE_VERIFY = true 로 바꾸고 phoneCodeOk 를 채운다
//  1) 가입 화면 "인증번호 받기" → 서버 액션이 6자리 번호를 만들어 솔라피로 보내고, 번호 해시·만료 시각(5분)을 저장
//  2) 가입할 때 phoneCodeOk 가 저장한 값과 비교 (틀리면 5번까지)

export const PHONE_VERIFY = false;

/** 인증번호가 맞는지. 아직 안 만듦 — 켜 놓고 이걸 안 채우면 가입이 다 막히게 false (실수로 켜도 체험 막기가 뚫리지 않게) */
export async function phoneCodeOk(phone: string, code: string): Promise<boolean> {
  void phone;
  void code;
  return false;
}
