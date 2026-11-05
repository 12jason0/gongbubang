// 엑셀 올리기 칸 맞추기·학년 계산 점검 (DB 없이): npx tsx scripts/check-excel.ts
import assert from "node:assert/strict";
import { gradeFromAge, gradeFromBirthYear, guessColumns, hasHeader } from "../src/lib/excel-import";
import { checkImportRow } from "../src/lib/roster";

// 제목으로 맞추기 + 저장 안 하는 칸
const h1 = ["번호", "학생명", "학교", "학년", "보호자 연락처", "주소", "원비", "결제일", "수업"];
const b1 = [["1", "김민준", "OO초", "5", "010-1234-5678", "서울", "250000", "10", "초등 영어 A"]];
const g1 = guessColumns(h1, b1);
assert.deepEqual(
  { name: g1.map.name, grade: g1.map.grade, phone: g1.map.phone, fee: g1.map.fee, due: g1.map.due, classes: g1.map.classes },
  { name: 1, grade: 3, phone: 4, fee: 6, due: 7, classes: 8 },
);
// 번호 칸 여러 개(학생·엄마·아빠) → 자동으로 안 고름
const h2 = ["이름", "학생 휴대폰", "어머니 휴대폰", "아버지 휴대폰"];
const b2 = [["이서연", "010-1111-2222", "010-3333-4444", "010-5555-6666"]];
const g2 = guessColumns(h2, b2);
assert.equal(g2.map.phone, -1);
assert.deepEqual(g2.phoneChoices, [1, 2, 3]);
assert.equal(g2.map.name, 0);
// 제목 줄 판단
assert.equal(hasHeader(h1), true);
assert.equal(hasHeader(["김민준", "초5", "01012345678"]), false);
// 학년 계산 (3월에 새 학년)
assert.equal(gradeFromBirthYear(2015, "2026-11-05"), "초5");
assert.equal(gradeFromBirthYear(2015, "2026-02-05"), "초4");
assert.equal(gradeFromBirthYear(2012, "2026-11-05"), "중2");
assert.equal(gradeFromBirthYear(2022, "2026-11-05"), "");
assert.equal(gradeFromAge("11", "2026-11-05"), "초5");
// 줄 검사: 앞 0 빠진 번호, 학년 "5학년"은 그대로(초/중/고 없음 → 원장님이 고침), 반 여러 개
const r = checkImportRow({ name: "김민준", grade: "초등 5", phone: "1012345678", birth: "", classes: "영어A, 수학B", fee: "25만", due: "말일" }, 1);
assert.ok(r.ok && r.parentPhone === "01012345678" && r.grade === "초5" && r.dueDay === 31 && r.classNames.length === 2, JSON.stringify(r));
assert.equal(checkImportRow({ name: "", grade: "초5", phone: "01012345678", birth: "", classes: "", fee: "", due: "" }, 2).ok, false);
console.log("check-excel: 모두 통과");
