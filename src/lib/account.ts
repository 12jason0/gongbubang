// 원장님 계정 도우미 — 탈퇴·재가입

import crypto from "node:crypto";

/**
 * 원장님 휴대폰 번호 → 되돌릴 수 없는 값 (HMAC). 탈퇴할 때 이 값만 남기고 번호는 지운다.
 * 같은 번호로 다시 가입하면 이 값이 같아서 무료 체험을 다시 주지 않는다.
 * (SESSION_SECRET 을 바꾸면 예전 값과 안 맞으니 바꾸지 말 것)
 */
export function trialPhoneHash(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return crypto.createHmac("sha256", process.env.SESSION_SECRET ?? "").update(`trial-phone:${digits}`).digest("base64url");
}
