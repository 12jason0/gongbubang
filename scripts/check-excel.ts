// 엑셀 올리기 칸 맞추기·학년 계산 점검 (DB 없이): npx tsx scripts/check-excel.ts
import assert from "node:assert/strict";
import { guessColumns, hasHeader } from "../src/lib/excel-import";
import { checkImportRow } from "../src/lib/roster";

// 제목으로 맞추기 + 저장 안 하는 칸
const h1 = ["번호", "학생명", "학교", "학년", "보호자 연락처", "주소", "원비", "결제일", "수업"];
const b1 = [["1", "김민준", "OO초", "5", "010-1234-5678", "서울", "250000", "10", "초등 영어 A"]];
const g1 = guessColumns(h1, b1);
assert.deepEqual(
  { name: g1.name, grade: g1.grade, phone: g1.phone, fee: g1.fee, due: g1.due, classes: g1.classes },
  { name: 1, grade: 3, phone: 4, fee: 6, due: 7, classes: 8 },
);
// 번호 칸 여러 개(학생·엄마·아빠) → 제목에 학부모 말이 있는 앞 칸(어머니)
const h2 = ["이름", "학생 휴대폰", "어머니 휴대폰", "아버지 휴대폰"];
const b2 = [["이서연", "010-1111-2222", "010-3333-4444", "010-5555-6666"]];
const g2 = guessColumns(h2, b2);
assert.equal(g2.phone, 2);
assert.equal(g2.name, 0);
// 학부모 칸 번호가 틀려 있어도(자리수) 제목으로 학부모 칸을 찾음
assert.equal(guessColumns(["이름", "학년", "엄마 연락처"], [["김하늘", "초3", "010-12-3"]]).phone, 2);
// 학부모 말은 없고 번호 칸이 하나 → 그 칸. "번호"(1,2,3) 칸은 번호 칸 아님
assert.equal(guessColumns(["번호", "이름", "연락처"], [["1", "김하늘", "010-1234-5678"]]).phone, 2);
// 학부모 말 없이 번호 칸이 둘 → 못 찾음(-1) → 원장님께 물어봄
assert.equal(guessColumns(["이름", "연락처1", "연락처2"], [["김하늘", "010-1234-5678", "010-2222-3333"]]).phone, -1);
// 제목 줄 판단
assert.equal(hasHeader(h1), true);
assert.equal(hasHeader(["김민준", "초5", "01012345678"]), false);
// 학년은 계산하지 않음: 생년월일·나이 칸이 있어도 학년 칸이 없으면 -1 (빈칸으로 저장)
assert.equal(guessColumns(["이름", "생년월일", "나이", "학부모 번호"], [["김하늘", "2015-03-02", "11", "010-1234-5678"]]).grade, -1);

// 줄 검사: 앞 0 빠진 번호, 학년 "5학년"은 그대로(초/중/고 없음 → 원장님이 고침), 반 여러 개
const r = checkImportRow({ name: "김민준", grade: "초등 5", phone: "1012345678", birth: "", classes: "영어A, 수학B", fee: "25만", due: "말일" }, 1);
assert.ok(r.ok && r.parentPhone === "01012345678" && r.grade === "초5" && r.dueDay === 31 && r.classNames.length === 2, JSON.stringify(r));
assert.equal(checkImportRow({ name: "", grade: "초5", phone: "01012345678", birth: "", classes: "", fee: "", due: "" }, 2).ok, false);
// 학년이 없어도 저장 (학년만 빈칸)
const noGrade = checkImportRow({ name: "김하늘", grade: "", phone: "01012345678", birth: "", classes: "", fee: "", due: "" }, 3);
assert.ok(noGrade.ok && noGrade.grade === "", JSON.stringify(noGrade));
assert.equal(checkImportRow({ name: "김하늘", grade: "초5", phone: "", birth: "", classes: "", fee: "", due: "" }, 4).ok, false);
console.log("check-excel: 모두 통과");
