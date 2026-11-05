// 무료 체험 반복 가입 막기 점검 (lib/account.ts) — 로컬 테스트 DB 전용. 만든 줄은 끝에 지운다
//   DATABASE_URL=postgresql://…@localhost:…/test SESSION_SECRET=… npx tsx scripts/check-trial.ts
import assert from "node:assert/strict";
import { eq, inArray, like } from "drizzle-orm";
import { db, academies, students, deletedParentHashes } from "../src/db";
import { endTrialIfOverlap, parentPhoneHash, trialPhoneHash, trialUsedByPhone } from "../src/lib/account";
import type { CurrentAcademy } from "../src/lib/session";

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) throw new Error("로컬 DB 에서만 돌려요 (DATABASE_URL 이 localhost 가 아님)");

const P = "zzcheck_"; // 이 점검이 만든 계정 아이디 앞머리
const day = 86_400_000;
const parents = (from: number) => Array.from({ length: 5 }, (_, i) => `0109999${String(from + i).padStart(4, "0")}`);

async function make(loginId: string, opts: { phone: string; plan?: string; days?: number; deleted?: boolean }) {
  const [a] = await db
    .insert(academies)
    .values({
      name: loginId,
      loginId: P + loginId,
      passwordHash: "x",
      senderPhone: "",
      ownerPhone: opts.deleted ? "" : opts.phone,
      plan: opts.plan ?? "TRIAL",
      serviceUntil: new Date(Date.now() + (opts.days ?? 14) * day),
      trialPhoneHash: trialPhoneHash(opts.phone),
      deletedAt: opts.deleted ? new Date() : null,
    })
    .returning();
  return a as unknown as CurrentAcademy;
}
const addParents = (a: CurrentAcademy, phones: string[]) =>
  db.insert(students).values(phones.map((p, i) => ({ academyId: a.id, name: `학생${i}`, grade: "초5", parentPhone: p })));
const reload = async (a: CurrentAcademy) => (await db.select().from(academies).where(eq(academies.id, a.id)))[0];

async function main() {
  await cleanup();
  // 1) 같은 번호: 하이픈 있든 없든, 살아 있는 계정·탈퇴 계정 모두
  await make("live", { phone: "01011112222" });
  await make("gone", { phone: "01033334444", deleted: true });
  assert.equal(await trialUsedByPhone("010-1111-2222"), true, "살아 있는 계정 번호(하이픈)");
  assert.equal(await trialUsedByPhone("01033334444"), true, "탈퇴 계정 번호");
  assert.equal(await trialUsedByPhone("010-5555-6666"), false, "처음 보는 번호");

  // 2) 학부모 번호 5개 겹침 — 살아 있는 체험 계정과
  const a = await make("a", { phone: "01000000001" });
  await addParents(a, parents(1));
  const b = await make("b", { phone: "01000000002" });
  await addParents(b, parents(1).slice(0, 4));
  assert.equal(await endTrialIfOverlap(b), false, "4개 겹침은 통과");
  await addParents(b, parents(1).slice(4));
  assert.equal(await endTrialIfOverlap(b), true, "5개 겹침이면 체험 끝");
  const b2 = await reload(b);
  assert.equal(b2.trialBlock, "BLOCKED");
  assert.ok(b2.serviceUntil! <= new Date(), "이용 기간이 지금으로");
  assert.match(b2.trialBlockNote, /학부모 번호 5개 겹침/);

  // 3) 결제한 계정은 검사 안 함
  const paid = await make("paid", { phone: "01000000003", plan: "BASIC", days: 30 });
  await addParents(paid, parents(1));
  assert.equal(await endTrialIfOverlap(paid), false, "결제 계정은 안 막힘");

  // 4) 탈퇴 계정의 학부모 해시와 겹침
  const g = await make("gone2", { phone: "01000000004", deleted: true });
  await db.insert(deletedParentHashes).values(parents(100).map((p) => ({ academyId: g.id, hash: parentPhoneHash(p) })));
  const c = await make("c", { phone: "01000000005" });
  await addParents(c, parents(100));
  assert.equal(await endTrialIfOverlap(c), true, "탈퇴 계정과 5개 겹침이면 체험 끝");

  // 5) 관리자가 풀어 준 계정(CLEARED)은 다시 검사 안 함
  await db.update(academies).set({ trialBlock: "CLEARED", serviceUntil: new Date(Date.now() + 7 * day) }).where(eq(academies.id, c.id));
  assert.equal(await endTrialIfOverlap(await reload(c)), false, "풀어 준 계정은 통과");

  console.log("check-trial: 모두 통과");
  await cleanup();
  process.exit(0);
}

async function cleanup() {
  const ids = (await db.select({ id: academies.id }).from(academies).where(like(academies.loginId, `${P}%`))).map((r) => r.id);
  if (ids.length) await db.delete(academies).where(inArray(academies.id, ids)); // 학생·해시는 cascade
}

main().catch(async (e) => {
  console.error(e);
  await cleanup();
  process.exit(1);
});
