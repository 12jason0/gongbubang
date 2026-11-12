import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, academies, payments } from "@/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * 영수증 원부 일련번호 — 공부방별 1, 2, 3 …
 * academies.receiptSeq 를 한 줄 UPDATE 로 올려서 받으므로 동시에 저장해도 겹치지 않고,
 * 납부 기록을 지워도 줄지 않아 같은 번호가 다시 쓰이지 않는다.
 */
export async function nextReceiptSerials(tx: Tx, academyId: string, n = 1): Promise<number[]> {
  if (n <= 0) return [];
  const [row] = await tx
    .update(academies)
    .set({ receiptSeq: sql`${academies.receiptSeq} + ${n}` })
    .where(eq(academies.id, academyId))
    .returning({ seq: academies.receiptSeq });
  return Array.from({ length: n }, (_, i) => row.seq - n + 1 + i);
}

/** 번호가 아직 없는 납부 기록(번호 칸이 생기기 전 코드가 넣은 것)에 저장한 순서대로 번호를 붙인다 */
export async function fillMissingSerials(academyId: string) {
  const [missing] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.academyId, academyId), isNull(payments.serialNo)))
    .limit(1);
  if (!missing) return;
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.academyId, academyId), isNull(payments.serialNo)))
      .orderBy(asc(payments.createdAt), asc(payments.id))
      .for("update");
    const serials = await nextReceiptSerials(tx, academyId, rows.length);
    for (const [i, r] of rows.entries()) {
      await tx.update(payments).set({ serialNo: serials[i] }).where(eq(payments.id, r.id));
    }
  });
}
