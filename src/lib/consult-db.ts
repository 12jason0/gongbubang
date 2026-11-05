// 상담 신청 — 여러 화면이 같이 쓰는 DB 조회·정리 (서버 전용)

import { cache } from "react";
import { and, count, eq, gte, lt } from "drizzle-orm";
import { db, consultations } from "@/db";
import { todayKST } from "./date";
import { consultCutoff } from "./consult";

/** 확인 안 한 새 신청 (오늘 이후). 한 요청 안에서는 한 번만 (레이아웃 탭 점 + 출석부 배너) */
export const countNewConsults = cache(async (academyId: string) => {
  const [{ n }] = await db
    .select({ n: count() })
    .from(consultations)
    .where(and(eq(consultations.academyId, academyId), eq(consultations.status, "NEW"), gte(consultations.date, todayKST())));
  return n;
});

/** 개인정보 보관 기간: 상담 날짜에서 6개월 지난 신청은 지움 (모든 공부방, 매일 /api/cron/cleanup). 지운 건수 */
export async function deleteOldConsults(today = todayKST()) {
  const gone = await db.delete(consultations).where(lt(consultations.date, consultCutoff(today))).returning({ id: consultations.id });
  return gone.length;
}
