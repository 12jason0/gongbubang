// 두나용 관리 명령 (DB 를 직접 안 만지고 요금제·이용 기간 조정)
//
//   npm run admin -- list                          공부방 목록 (요금제·이용 기간·이번 달 카톡)
//   npm run admin -- plan <아이디> <BASIC|PLUS|TRIAL>  요금제 바꾸기 (이용 기간·이번 달 쓴 통수는 그대로, 전체 통수만 바뀜)
//   npm run admin -- extend <아이디> <개월>           이용 기간 늘리기 (남은 기간 끝에서 N개월. 끝났으면 오늘부터)
//   npm run admin -- days <아이디> <일수>            오늘부터 N일까지 쓸 수 있게 (예: 1달 무료 → days hyunsaem 30)
//   npm run admin -- unlimited <아이디>              기한 없음 (두나 데모 계정)

import { desc, eq } from "drizzle-orm";
import { db, academies } from "../src/db";
import { addMonths, quotaState } from "../src/lib/plan";
import { PLANS, type Tier } from "../src/lib/pricing";

const [cmd, loginId, arg] = process.argv.slice(2);

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
      const q = quotaState(a);
      console.log(`${a.loginId.padEnd(14)} ${a.name.padEnd(10)} ${q.label.padEnd(5)} ~${day(a.serviceUntil)}  카톡 ${q.remaining}/${q.total}통  ${a.ownerPhone}`);
    }
  } else if (cmd === "plan") {
    const a = await find(loginId);
    const tier = arg?.toUpperCase() as Tier;
    if (!(tier in PLANS)) throw new Error("요금제는 BASIC, PLUS, TRIAL 중 하나로 넣어 주세요");
    await db.update(academies).set({ plan: tier }).where(eq(academies.id, a.id));
    const q = quotaState({ ...a, plan: tier });
    console.log(`${a.name}: ${PLANS[tier].label} 요금제 → 이번 달 카톡 ${q.remaining}/${q.total}통 남음`);
  } else if (cmd === "extend") {
    const a = await find(loginId);
    const n = Number(arg);
    if (!Number.isInteger(n) || n < 1 || n > 24) throw new Error("개월 수를 1~24 사이 숫자로 넣어 주세요");
    const now = new Date();
    const until = addMonths(a.serviceUntil && a.serviceUntil > now ? a.serviceUntil : now, n);
    await db.update(academies).set({ serviceUntil: until }).where(eq(academies.id, a.id));
    console.log(`${a.name}: ${day(until)} 까지 사용 (${n}개월 연장)`);
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
  } else {
    console.log("사용법: npm run admin -- list | plan <아이디> <BASIC|PLUS|TRIAL> | extend <아이디> <개월> | days <아이디> <일수> | unlimited <아이디>");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
