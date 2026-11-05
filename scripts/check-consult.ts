// 상담 예약 빈 시간 계산 점검 (DB 없이): npx tsx scripts/check-consult.ts
import assert from "node:assert/strict";
import { checkHours, consultCutoff, freeDays, freeSlotsOn, parseHours } from "../src/lib/consult";

// 2026-11-09 = 월요일
const rules = parseHours(JSON.stringify([{ days: [1, 3], start: "14:00", end: "16:00" }]));
assert.equal(rules.length, 1);
const starts = (date: string, booked = [] as { date: string; start: string; end: string }[], today = "2026-11-06", now = "10:00") =>
  freeSlotsOn(date, rules, 30, booked, today, now).map((s) => s.start);

// 30분씩 자름, 끝 시각을 넘는 칸은 없음
assert.deepEqual(starts("2026-11-09"), ["14:00", "14:30", "15:00", "15:30"]);
// 요일이 아니면 없음 (화요일)
assert.deepEqual(starts("2026-11-10"), []);
// 이미 찬 시간(겹치는 것까지) 빠짐: 14:20~14:50 이 차 있으면 14:00·14:30 둘 다 못 고름
assert.deepEqual(starts("2026-11-09", [{ date: "2026-11-09", start: "14:20", end: "14:50" }]), ["15:00", "15:30"]);
// 지난 날짜 없음, 오늘은 지금+1시간 전 칸 빠짐 (14:10 → 15:10 이후만)
assert.deepEqual(starts("2026-11-02", [], "2026-11-09", "14:10"), []);
assert.deepEqual(starts("2026-11-09", [], "2026-11-09", "14:10"), ["15:30"]);
// 규칙이 겹쳐도 한 번만
const dup = parseHours(JSON.stringify([{ days: [1], start: "14:00", end: "15:00" }, { days: [1], start: "14:30", end: "15:30" }]));
assert.deepEqual(freeSlotsOn("2026-11-09", dup, 30, [], "2026-11-06", "10:00").map((s) => s.start), ["14:00", "14:30", "15:00"]);
// 2주 안에서 빈 시간 있는 날만 (11/6 금 기준: 월·수 → 9,11,16,18일)
assert.deepEqual(freeDays(rules, 30, [], "2026-11-06", "10:00").map((d) => d.date), ["2026-11-09", "2026-11-11", "2026-11-16", "2026-11-18"]);
// 망가진 값은 빈 규칙
assert.deepEqual(parseHours("not json"), []);
assert.deepEqual(parseHours(JSON.stringify([{ days: [9], start: "14:00", end: "15:00" }])), []);

// 원장님 입력 검사
assert.equal(checkHours([{ days: [1], start: "14:00", end: "16:00" }], 30).ok, true);
assert.equal(checkHours([{ days: [], start: "14:00", end: "16:00" }], 30).ok, false); // 요일 없음
assert.equal(checkHours([{ days: [1], start: "16:00", end: "14:00" }], 30).ok, false); // 끝이 먼저
assert.equal(checkHours([{ days: [1], start: "14:00", end: "14:20" }], 30).ok, false); // 상담 길이보다 짧음
assert.equal(checkHours([{ days: [1], start: "14:00", end: "16:00" }], 25).ok, false); // 없는 길이
const empty = checkHours([], 30);
assert.ok(empty.ok && empty.json === ""); // 다 지우면 링크 닫힘
// 보관 기간 6개월: 이 날보다 앞선 상담 날짜는 지움
assert.equal(consultCutoff("2026-11-06"), "2026-05-06");
assert.equal(consultCutoff("2026-03-15"), "2025-09-15"); // 해 넘김
assert.ok("2026-02-28" < consultCutoff("2026-08-31") && "2026-03-01" > consultCutoff("2026-08-31")); // 2월 31일 없음 → 2월까지 지움
console.log("check-consult: 모두 통과");
