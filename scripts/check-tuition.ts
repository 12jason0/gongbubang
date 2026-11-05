// 교습비·납부일 도우미 점검 (DB 없이): npx tsx scripts/check-tuition.ts
import assert from "node:assert/strict";
import { beforeDue, dueDateOf, feeLabel, parseDueDay, parseFee } from "../src/lib/money";
import { parseRoster } from "../src/lib/roster";

// 납부일: 말일(31)·그 달에 없는 날은 말일로
assert.equal(dueDateOf("2026-02", 31), "2026-02-28");
assert.equal(dueDateOf("2028-02", 30), "2028-02-29");
assert.equal(dueDateOf("2026-11", 10), "2026-11-10");
// 납부일 전 / 지남 / 없음
assert.equal(beforeDue("2026-11", 10, "2026-11-09"), true);
assert.equal(beforeDue("2026-11", 10, "2026-11-10"), false); // 납부일 당일은 미납으로 봄
assert.equal(beforeDue("2026-11", null, "2026-11-01"), false);
assert.equal(beforeDue("2026-12", 5, "2026-11-30"), true); // 다음 달
// 입력
assert.equal(parseFee("250,000"), 250000);
assert.equal(parseFee("25만"), 250000);
assert.equal(parseFee(""), null);
assert.ok(Number.isNaN(parseFee("abc")));
assert.equal(parseDueDay("말일"), 31);
assert.equal(parseDueDay("매달 10일"), 10);
assert.ok(Number.isNaN(parseDueDay("32")));
assert.equal(feeLabel(250000, 10), "25만 원 · 10일");
assert.equal(feeLabel(null, 31), "말일");
assert.equal(feeLabel(null, null), "");
// 명단 붙여넣기: 교습비·납부일 칸 (순서 자유, 없어도 됨)
const [a, b, c] = parseRoster("김민준 초5 010-1234-5678 25만원 10일\n이서연\t중2\t01098765432\t2012-03-02\t250,000원\t말일\n박지호 고1 010-2222-3333");
assert.ok(a.ok && a.monthlyFee === 250000 && a.dueDay === 10 && a.grade === "초5", JSON.stringify(a));
assert.ok(b.ok && b.monthlyFee === 250000 && b.dueDay === 31 && b.birthDate === "2012-03-02", JSON.stringify(b));
assert.ok(c.ok && c.monthlyFee === null && c.dueDay === null, JSON.stringify(c));
console.log("check-tuition: 모두 통과");
