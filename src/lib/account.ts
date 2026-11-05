// 원장님 계정 도우미 — 탈퇴·재가입, 무료 체험 반복 가입 막기

import crypto from "node:crypto";
import { and, count, countDistinct, eq, gte, inArray, isNull, ne, or } from "drizzle-orm";
import { db, academies, students, deletedParentHashes } from "@/db";
import { planState } from "@/lib/plan";
import type { CurrentAcademy } from "@/lib/session";

/** 학부모 번호가 다른 공부방과 이만큼 겹치면 "이미 체험한 공부방"으로 본다 */
export const OVERLAP_LIMIT = 5;

// 번호 → 되돌릴 수 없는 값 (HMAC). SESSION_SECRET 을 바꾸면 예전 값과 안 맞으니 바꾸지 말 것
const hmac = (kind: string, phone: string) =>
  crypto.createHmac("sha256", process.env.SESSION_SECRET ?? "").update(`${kind}:${phone.replace(/\D/g, "")}`).digest("base64url");

/** 원장님 휴대폰 번호 → 해시. 가입할 때 넣고, 탈퇴해서 번호를 지워도 이 값은 남긴다 */
export const trialPhoneHash = (phone: string) => hmac("trial-phone", phone);
/** 학부모 번호 → 해시 (탈퇴한 공부방 비교용) */
export const parentPhoneHash = (phone: string) => hmac("parent-phone", phone);

/**
 * 이 번호로 무료 체험을 이미 쓴 계정이 있나 (살아 있는 계정 + 탈퇴 계정).
 * 해시로 비교하고, 해시를 넣기 전에 가입한 예전 계정은 지금 연락처(숫자만)로도 비교한다.
 */
export async function trialUsedByPhone(ownerPhone: string) {
  const digits = ownerPhone.replace(/\D/g, "");
  const [hit] = await db
    .select({ id: academies.id })
    .from(academies)
    .where(or(eq(academies.trialPhoneHash, trialPhoneHash(digits)), and(isNull(academies.deletedAt), eq(academies.ownerPhone, digits))))
    .limit(1);
  return !!hit;
}

/**
 * 체험 중인 공부방의 학부모 번호가 다른 공부방(살아 있는 계정 + 탈퇴 계정)과 OVERLAP_LIMIT개 이상 겹치면 체험을 바로 끝낸다.
 * 결제한 계정은 검사하지 않는다 (형제가 다른 공부방에 다니는 경우). 관리자가 풀어 준(CLEARED) 계정도.
 * 학생을 추가·수정한 뒤 부른다. 끝냈으면 true.
 */
export async function endTrialIfOverlap(a: CurrentAcademy): Promise<boolean> {
  if (planState(a).kind !== "TRIAL" || a.trialBlock) return false;

  const mine = [...new Set((await db.select({ p: students.parentPhone }).from(students).where(eq(students.academyId, a.id))).map((r) => r.p))];
  if (mine.length < OVERLAP_LIMIT) return false;

  const [live] = await db
    .select({ id: students.academyId, n: countDistinct(students.parentPhone) })
    .from(students)
    .where(and(ne(students.academyId, a.id), inArray(students.parentPhone, mine)))
    .groupBy(students.academyId)
    .having(gte(countDistinct(students.parentPhone), OVERLAP_LIMIT))
    .limit(1);
  const [gone] = live
    ? []
    : await db
        .select({ id: deletedParentHashes.academyId, n: count() })
        .from(deletedParentHashes)
        .where(and(ne(deletedParentHashes.academyId, a.id), inArray(deletedParentHashes.hash, mine.map(parentPhoneHash))))
        .groupBy(deletedParentHashes.academyId)
        .having(gte(count(), OVERLAP_LIMIT))
        .limit(1);
  const hit = live ?? gone;
  if (!hit) return false;

  const [other] = await db.select({ loginId: academies.loginId, deletedAt: academies.deletedAt }).from(academies).where(eq(academies.id, hit.id));
  await db
    .update(academies)
    .set({
      serviceUntil: new Date(),
      trialBlock: "BLOCKED",
      trialBlockNote: `${other?.deletedAt ? `탈퇴 계정(${hit.id})` : other?.loginId} 와 학부모 번호 ${hit.n}개 겹침`,
    })
    .where(eq(academies.id, a.id));
  return true;
}
