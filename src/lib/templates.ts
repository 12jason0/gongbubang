// 학부모에게 가는 문구 도우미 + 반·요일 도우미
// 등원·피드백·원비·수업 일정 문구는 카카오 알림톡 템플릿(lib/alimtalk.ts) 하나로 정하고, 문자로 갈 때도 같은 글을 쓴다.

// ── 카톡 한 통 길이 ── 알림톡은 1,000자까지. 문자(장문)도 한글 약 1,000자라 같은 기준

export const KAKAO_MAX_CHARS = 1000;

/** 템플릿 #{변수} 채우기 (서버 발송·화면 미리보기 공통) */
export function fillTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/#\{([^}]+)\}/g, (_, k: string) => vars[k] ?? "");
}

/** 카톡 한 통을 넘겨 내용을 줄였을 때 끝에 붙는 말 (알림톡 버튼 "피드백 전체 보기"로 이어짐) */
export const KAKAO_CUT_TAIL = "…(전체 내용은 아래 버튼)";

/** 문자 바이트 수 (한글 2바이트, 영문·숫자 1바이트). 장문은 2,000바이트까지 */
export function textBytes(text: string): number {
  let n = 0;
  for (const ch of text) n += ch.charCodeAt(0) > 127 ? 2 : 1;
  return n;
}

/** 문자(장문) 한 통 한도 */
export const LMS_MAX_BYTES = 2000;

/**
 * 내용 변수(field) 때문에 한 통 한도(기본: 카톡 1,000자)를 넘으면 내용을 줄이고 끝에 KAKAO_CUT_TAIL 을 붙인다.
 * 넘지 않으면 vars 그대로 (내용은 앞뒤 빈칸만 정리, 줄바꿈은 그대로). cut: 줄였는지.
 * 문자로 보낼 때는 max=LMS_MAX_BYTES, measure=textBytes 로 바이트 기준
 */
export function fitKakao(
  body: string,
  vars: Record<string, string>,
  field: string,
  max = KAKAO_MAX_CHARS,
  measure: (text: string) => number = (t) => t.length,
) {
  const content = (vars[field] ?? "").trim();
  const full = { ...vars, [field]: content };
  if (measure(fillTemplate(body, full)) <= max) return { vars: full, cut: false };
  const chars = Array.from(content); // 이모지가 반으로 잘리지 않게
  const cutTo = (n: number) => ({ ...vars, [field]: chars.slice(0, n).join("").trimEnd() + KAKAO_CUT_TAIL });
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(fillTemplate(body, cutTo(mid))) <= max) lo = mid;
    else hi = mid - 1;
  }
  return { vars: cutTo(lo), cut: true };
}

/** "2026-10" → "10월분" */
export function monthLabel(month: string) {
  return `${Number(month.slice(5, 7))}월분`;
}

export function noticeText(academyName: string, content: string) {
  return `[${academyName}] ${content.trim()}`;
}


/** 수업 일정 안내 입력칸 글자 수 한도 (알림톡 한 통 1,000자 안에 들게) */
export const SCHEDULE_DATE_MAX = 40;
export const SCHEDULE_TEXT_MAX = 500;

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
