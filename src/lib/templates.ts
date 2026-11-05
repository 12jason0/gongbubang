// 학부모에게 가는 문자 문구 + 반·요일 도우미
// 원장님은 설정 화면에서 빈칸(끝 문장·덧붙일 말·첫 줄·마지막 인사)만 고치고,
// 학원 이름·학생 이름·시각·메모가 들어가는 자리는 여기서 정한다. (서버 발송과 설정 미리보기가 같은 함수를 씀)

export const DEFAULT_ATTENDANCE_ENDING = "등원했습니다.";
export const DEFAULT_FEEDBACK_TITLE = "오늘 수업 피드백";

/** 원장님이 고칠 수 있는 칸 (academies 테이블과 같은 이름) */
export type MessageWording = {
  name: string; // 학원 이름 — 문자 맨 앞 [ ]
  attendanceEnding: string;
  attendanceExtra: string;
  feedbackTitle: string;
  feedbackClosing: string;
};

/** [현샘영수] 김하늘 학생 4시 5분에 등원했습니다. (덧붙일 말) */
export function attendanceText(w: MessageWording, studentName: string, time: string) {
  const ending = w.attendanceEnding.trim() || DEFAULT_ATTENDANCE_ENDING;
  const extra = w.attendanceExtra.trim();
  return `[${w.name}] ${studentName} 학생 ${time}에 ${ending}${extra ? ` ${extra}` : ""}`;
}

/** [현샘영수] 김하늘 학생 오늘 수업 피드백 / (메모) / (마지막 인사) */
export function feedbackText(w: MessageWording, studentName: string, memo: string) {
  const title = w.feedbackTitle.trim() || DEFAULT_FEEDBACK_TITLE;
  const closing = w.feedbackClosing.trim();
  return `[${w.name}] ${studentName} 학생 ${title}\n\n${memo.trim()}${closing ? `\n\n${closing}` : ""}`;
}

/** [현샘영수] 김하늘 학생 10월분 교습비 납부 안내드립니다. … (알림톡 PAYMENT 템플릿과 같은 내용의 문자판) */
export function paymentText(academyName: string, studentName: string, monthLabel: string) {
  return `[${academyName}] ${studentName} 학생의 ${monthLabel} 교습비 납부 안내드립니다. 이미 납부하셨다면 이 안내는 넘기셔도 됩니다.`;
}

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
