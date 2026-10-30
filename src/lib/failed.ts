import { and, count, eq, gte, isNull, ne, or } from "drizzle-orm";
import { db, messageLogs } from "@/db";
import { todayKST } from "./date";

const RETRY_DAYS = 7; // 일주일 넘은 실패는 다시 보내지 않음

/** 아직 해결 안 된 실패 문자 조건 (등원 문자는 오늘 것만 — 지난 날 "등원했습니다"는 의미 없음) */
export function unresolvedFailures(academyId: string) {
  return and(
    eq(messageLogs.academyId, academyId),
    eq(messageLogs.status, "FAILED"),
    isNull(messageLogs.resolvedAt),
    gte(messageLogs.createdAt, new Date(Date.now() - RETRY_DAYS * 86_400_000)),
    or(ne(messageLogs.kind, "ATTENDANCE"), eq(messageLogs.refDate, todayKST())),
  );
}

/** 출석부 위 "보내지 못한 문자 N건" */
export async function countFailedMessages(academyId: string) {
  const [r] = await db.select({ n: count() }).from(messageLogs).where(unresolvedFailures(academyId));
  return r.n;
}
