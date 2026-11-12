import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db, academies } from "@/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signToken, verifyToken } from "./token";
import { isActive } from "./plan";
import { isAdminLoginId } from "./admin";

export async function createSession(academyId: string) {
  // 관리자 계정이면 쿠키에 표시 (proxy 가 DB 없이 화면을 막을 수 있게)
  const [row] = await db.select({ loginId: academies.loginId }).from(academies).where(eq(academies.id, academyId));
  const admin = !!row && isAdminLoginId(row.loginId);
  // https 로 접속했을 때만 secure (내 컴퓨터에서 http 로 테스트할 때도 로그인되게)
  const https = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(SESSION_COOKIE, await signToken(academyId, admin), {
    httpOnly: true,
    secure: https,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * 로그인 쿠키의 공부방 id (서명 확인만, DB 안 감). 없으면 로그인 화면으로.
 * 화면은 이 id 로 자기 쿼리를 requireAcademy 와 "동시에" 시작해서 DB 왕복을 한 번 줄인다.
 * (그 공부방이 DB 에 없으면 requireAcademy 가 로그인 화면으로 보내므로 결과는 안 쓰임)
 */
export const currentAcademyId = cache(async () => {
  const academyId = await verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!academyId) redirect("/login");
  return academyId;
});

/** 로그인한 공부방. 없으면 로그인 화면으로 — 한 요청 안에서는 한 번만 조회 (레이아웃·화면이 같이 써도) */
export const requireAcademy = cache(async () => {
  const academyId = await currentAcademyId();

  const [academy] = await db
    .select({
      id: academies.id,
      name: academies.name,
      senderPhone: academies.senderPhone,
      registrationNo: academies.registrationNo,
      loginId: academies.loginId,
      ownerPhone: academies.ownerPhone,
      attendanceNotify: academies.attendanceNotify,
      consultHours: academies.consultHours,
      consultMinutes: academies.consultMinutes,
      serviceUntil: academies.serviceUntil,
      plan: academies.plan,
      periodStart: academies.periodStart,
      msgPeriod: academies.msgPeriod,
      msgUsed: academies.msgUsed,
      trialPhoneHash: academies.trialPhoneHash,
      trialBlock: academies.trialBlock,
      kakaoId: academies.kakaoId,
      trialKakaoHash: academies.trialKakaoHash,
      createdAt: academies.createdAt,
    })
    .from(academies)
    .where(and(eq(academies.id, academyId), isNull(academies.deletedAt))); // 탈퇴한 공부방은 없는 것으로
  // 쿠키는 맞는데 공부방이 없음(지워진 계정 등) → proxy 가 쿠키를 지우게 표시해서 보냄 (무한 이동 방지)
  if (!academy) redirect("/login?stale=1");
  return academy;
});

export type CurrentAcademy = Awaited<ReturnType<typeof requireAcademy>>;

/**
 * 바꾸는 동작(출석·발송·학생 추가 등)용. 이용 기간이 끝났으면 결제 화면으로 보낸다.
 * 보기·원부 인쇄·설정·결제는 기간이 끝나도 되게 requireAcademy 를 그대로 쓴다.
 */
export async function requireActiveAcademy() {
  const academy = await requireAcademy();
  if (!isActive(academy)) redirect("/billing?expired=1");
  return academy;
}
