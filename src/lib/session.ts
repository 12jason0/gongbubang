import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, academies } from "@/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signToken, verifyToken } from "./token";
import { isActive } from "./plan";

export async function createSession(academyId: string) {
  // https 로 접속했을 때만 secure (내 컴퓨터에서 http 로 테스트할 때도 로그인되게)
  const https = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(SESSION_COOKIE, await signToken(academyId), {
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

/** 로그인한 공부방. 없으면 로그인 화면으로 */
export async function requireAcademy() {
  const academyId = await verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!academyId) redirect("/login");

  const [academy] = await db
    .select({
      id: academies.id,
      name: academies.name,
      senderPhone: academies.senderPhone,
      registrationNo: academies.registrationNo,
      attendanceEnding: academies.attendanceEnding,
      attendanceExtra: academies.attendanceExtra,
      feedbackTitle: academies.feedbackTitle,
      feedbackClosing: academies.feedbackClosing,
      serviceUntil: academies.serviceUntil,
      plan: academies.plan,
      creditWon: academies.creditWon,
    })
    .from(academies)
    .where(eq(academies.id, academyId));
  // 쿠키는 맞는데 공부방이 없음(지워진 계정 등) → proxy 가 쿠키를 지우게 표시해서 보냄 (무한 이동 방지)
  if (!academy) redirect("/login?stale=1");
  return academy;
}

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
