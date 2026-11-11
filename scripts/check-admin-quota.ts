// 관리자 카톡 충전(msgUsed 음수)이 통수 계산에 맞게 반영되는지: npx tsx scripts/check-admin-quota.ts
import assert from "node:assert";
import { quotaState } from "../src/lib/plan";

const base = { plan: "BASIC", periodStart: new Date("2026-11-01T00:00:00Z"), createdAt: new Date("2026-01-01"), msgPeriod: "", msgUsed: 0 };
const now = new Date("2026-11-11T00:00:00Z");
const q0 = quotaState({ ...base, msgUsed: 140, msgPeriod: quotaState(base, now).key }, now);
assert.equal(q0.remaining, 10);
// 50통 충전 = msgUsed 140 → 90
const q1 = quotaState({ ...base, msgUsed: q0.used - 50, msgPeriod: q0.key }, now);
assert.equal(q1.remaining, 60);
// 다 쓴 상태 이상으로 충전 (음수)
const q2 = quotaState({ ...base, msgUsed: -50, msgPeriod: q0.key }, now);
assert.equal(q2.remaining, 200);
console.log("ok");
