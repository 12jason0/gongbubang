// 실행: npx tsx src/lib/usage.check.ts — toVisits 확인 (DB 안 씀)
import assert from "node:assert/strict";
import { toVisits } from "./usage";

const t = (m: number) => new Date(Date.UTC(2026, 10, 13, 5, m));
const ev = (m: number, kind: string, screen = "", detail = "") => ({ kind, screen, detail, at: t(m) });
const v = toVisits([
  ev(0, "VIEW", "출석부"),
  ev(0, "VIEW", "출석부"), // 두 번 찍힘 → 한 번
  ev(3, "VIEW", "학생"),
  ev(4, "VIEW", "엑셀 올리기"),
  ev(5, "ACTION", "엑셀 올리기", "실패: 파일 형식"),
  ev(13, "LEAVE"),
  ev(50, "VIEW", "공지"), // 37분 쉼 → 새 방문
]);
assert.equal(v.length, 2);
assert.deepEqual(v[0].steps.map((s) => s.text), ["출석부", "학생", "엑셀 올리기", "엑셀 올리기(실패: 파일 형식)"]);
assert.equal(v[0].minutes, 13);
assert.equal(v[0].left, true);
assert.equal(v[0].lastStay, 9);
assert.equal(v[1].left, false);
console.log("ok");
