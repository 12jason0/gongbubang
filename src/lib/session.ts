import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, academies } from "@/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signToken, verifyToken } from "./token";

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
      attendanceEnding: academies.attendanceEnding,
      attendanceExtra: academies.attendanceExtra,
      feedbackTitle: academies.feedbackTitle,
      feedbackClosing: academies.feedbackClosing,
    })
    .from(academies)
    .where(eq(academies.id, academyId));
  if (!academy) redirect("/login");
  return academy;
}

export type CurrentAcademy = Awaited<ReturnType<typeof requireAcademy>>;
