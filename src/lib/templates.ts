// 학부모에게 가는 문자 문구 + 반·요일 도우미
// 문구는 원장님이 설정 화면에서 바꿀 수 있고, 비어 있으면 아래 기본 문구를 쓴다.

export const DEFAULT_ATTENDANCE_TEMPLATE = "[{학원}] {이름} 학생 {시각}에 등원했습니다.";
export const DEFAULT_FEEDBACK_TEMPLATE = "[{학원}] {이름} 학생 오늘 수업 피드백\n\n{메모}";

type Vars = { 학원: string; 이름?: string; 시각?: string; 메모?: string };

export function renderTemplate(template: string, vars: Vars) {
  return template.replace(/\{(학원|이름|시각|메모)\}/g, (_, k: keyof Vars) => (vars[k] ?? "").trim());
}

export function attendanceText(tpl: string | null | undefined, academyName: string, studentName: string, time: string) {
  return renderTemplate(tpl || DEFAULT_ATTENDANCE_TEMPLATE, { 학원: academyName, 이름: studentName, 시각: time });
}

export function feedbackText(tpl: string | null | undefined, academyName: string, studentName: string, memo: string) {
  return renderTemplate(tpl || DEFAULT_FEEDBACK_TEMPLATE, { 학원: academyName, 이름: studentName, 메모: memo });
}

export function noticeText(academyName: string, content: string) {
  return `[${academyName}] ${content.trim()}`;
}

// ── 요일 ── 0=일 1=월 … 6=토
export const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 화면에는 월요일부터

export function parseDays(days: string): number[] {
  return days
    .split(",")
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
}

export function formatDays(days: string) {
  const set = new Set(parseDays(days));
  const list = WEEK_ORDER.filter((d) => set.has(d));
  return list.length === 0 ? "요일 없음" : list.map((d) => DAY_LABELS[d]).join("·");
}

/** "2026-10-30" → 5 (금) */
export function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// ── 정렬 ── 초 → 중 → 고 → 그 외, 같은 단계 안에서는 학년 숫자 → 이름
function stage(grade: string) {
  const i = ["초", "중", "고"].indexOf(grade.trim()[0]);
  return i === -1 ? 9 : i;
}

export function byGradeName(a: { grade: string; name: string }, b: { grade: string; name: string }) {
  return (
    stage(a.grade) - stage(b.grade) ||
    a.grade.localeCompare(b.grade, "ko", { numeric: true }) ||
    a.name.localeCompare(b.name, "ko")
  );
}

/** 반 정렬: 시각 → 이름 */
export function byTimeName(a: { time: string; name: string }, b: { time: string; name: string }) {
  return (a.time || "99").localeCompare(b.time || "99") || a.name.localeCompare(b.name, "ko");
}
