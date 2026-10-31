// 두나용 관리 명령 (DB 를 직접 안 만지고 이용 기간·충전금 조정)
//
//   npm run admin -- list                          공부방 목록 (이용 기간·충전금)
//   npm run admin -- days <아이디> <일수>            오늘부터 N일까지 쓸 수 있게 (예: 현샘영수 1달 무료 → days hyunsaem 30)
//   npm run admin -- unlimited <아이디>              기한 없음 (두나 데모 계정)
//   npm run admin -- credit <아이디> <원> [메모]      충전금 넣기(+)/빼기(-) — 계좌이체로 받았을 때 등

import { desc, eq, sql } from "drizzle-orm";
import { db, academies, creditLedger } from "../src/db";

const [cmd, loginId, arg, ...rest] = process.argv.slice(2);

async function find(id: string | undefined) {
  if (!id) throw new Error("아이디를 넣어 주세요");
  const [a] = await db.select().from(academies).where(eq(academies.loginId, id));
  if (!a) throw new Error(`아이디 ${id} 공부방이 없어요`);
  return a;
}

const day = (d: Date | null) => (d ? d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "기한 없음");

async function main() {
  if (cmd === "list") {
    const rows = await db.select().from(academies).orderBy(desc(academies.createdAt));
    for (const a of rows) {
      console.log(`${a.loginId.padEnd(14)} ${a.name.padEnd(10)} ${a.plan.padEnd(6)} ~${day(a.serviceUntil)}  충전금 ${a.creditWon}원  ${a.ownerPhone}`);
    }
  } else if (cmd === "days") {
    const a = await find(loginId);
    const n = Number(arg);
    if (!Number.isInteger(n) || n < 0) throw new Error("일수를 숫자로 넣어 주세요");
    const until = new Date(Date.now() + n * 86_400_000);
    await db.update(academies).set({ serviceUntil: until }).where(eq(academies.id, a.id));
    console.log(`${a.name}: ${day(until)} 까지 사용`);
  } else if (cmd === "unlimited") {
    const a = await find(loginId);
    await db.update(academies).set({ serviceUntil: null }).where(eq(academies.id, a.id));
    console.log(`${a.name}: 기한 없음`);
  } else if (cmd === "credit") {
    const a = await find(loginId);
    const won = Number(arg);
    if (!Number.isInteger(won) || won === 0) throw new Error("금액을 원 단위 정수로 넣어 주세요 (빼려면 -1000)");
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(academies)
        .set({ creditWon: sql`${academies.creditWon} + ${won}` })
        .where(eq(academies.id, a.id))
        .returning({ balance: academies.creditWon });
      await tx.insert(creditLedger).values({
        academyId: a.id,
        amount: won,
        balanceAfter: row.balance,
        kind: "ADMIN",
        memo: rest.join(" ") || "관리자 조정",
      });
      console.log(`${a.name}: 충전금 ${won > 0 ? "+" : ""}${won}원 → 잔액 ${row.balance}원`);
    });
  } else {
    console.log("사용법: npm run admin -- list | days <아이디> <일수> | unlimited <아이디> | credit <아이디> <원> [메모]");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
