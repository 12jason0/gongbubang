// 학부모에게 가는 문구 도우미 + 반·요일 도우미
// 등원·피드백·원비·공지 문구는 카카오 알림톡 템플릿(lib/alimtalk.ts) 하나로 정하고, 문자로 갈 때도 같은 글을 쓴다.

// ── 카톡 한 통 길이 ── 알림톡은 1,000자까지. 문자(장문)도 한글 약 1,000자라 같은 기준

export const KAKAO_MAX_CHARS = 1000;

/** 템플릿 #{변수} 채우기 (서버 발송·화면 미리보기 공통) */
export function fillTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/#\{([^}]+)\}/g, (_, k: string) => vars[k] ?? "");
}

/**
 * 내용 변수(field) 때문에 KAKAO_MAX_CHARS 를 넘으면 앞부분만 남기고 "…\n\n전체 보기: 링크" 를 붙인다.
 * 넘지 않으면 vars 그대로.
 */
export function fitKakao(body: string, vars: Record<string, string>, field: string, link: string) {
  const content = (vars[field] ?? "").trim();
  const full = { ...vars, [field]: content };
  if (fillTemplate(body, full).length <= KAKAO_MAX_CHARS) return full;
  const tail = `…\n\n전체 보기: ${link}`;
  const room = KAKAO_MAX_CHARS - fillTemplate(body, { ...vars, [field]: "" }).length - tail.length;
  return { ...vars, [field]: content.slice(0, Math.max(0, room)).trimEnd() + tail };
}

/** "2026-10" → "10월분" */
export function monthLabel(month: string) {
  return `${Number(month.slice(5, 7))}월분`;
}

export function noticeText(academyName: string, content: string) {
  return `[${academyName}] ${content.trim()}`;
}

/** 공지 글자 수 한도 (링크형은 문자에 본문이 안 들어가서 글자 수로 셈) */
export const NOTICE_MAX_CHARS = 1000;

/** 링크형 공지 (문자판). 알림톡판은 lib/alimtalk.ts NOTICE */
export function noticeLinkText(academyName: string, names: string, link: string) {
  return `[${academyName}] ${names} 학부모님, 새 공지가 있어요. 아래 링크에서 확인해 주세요\n${link}`;
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
