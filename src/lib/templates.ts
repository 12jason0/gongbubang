// 학부모에게 가는 문자 문구. 원장님 요청이 오면 여기만 고치면 된다.

export function attendanceText(academyName: string, studentName: string, time: string) {
  return `[${academyName}] ${studentName} 학생 ${time}에 등원했습니다.`;
}

export function feedbackText(academyName: string, studentName: string, memo: string) {
  return `[${academyName}] ${studentName} 학생 오늘 수업 피드백\n\n${memo.trim()}`;
}

export function noticeText(academyName: string, content: string) {
  return `[${academyName}] ${content.trim()}`;
}

export const GROUPS = ["초등", "중등", "고등"] as const;
export type Group = (typeof GROUPS)[number];

/** 초등 → 중등 → 고등, 같은 반 안에서는 학년 → 이름 순 */
export function byGroupGradeName(
  a: { group: string; grade: string; name: string },
  b: { group: string; grade: string; name: string },
) {
  const order = (g: string) => {
    const i = GROUPS.indexOf(g as Group);
    return i === -1 ? 9 : i;
  };
  return (
    order(a.group) - order(b.group) ||
    a.grade.localeCompare(b.grade, "ko", { numeric: true }) ||
    a.name.localeCompare(b.name, "ko")
  );
}
