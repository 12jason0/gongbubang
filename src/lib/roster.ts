// 명단 붙여넣기 — 엑셀·카톡·메모장에서 복사한 줄을 학생으로 바꾼다.
// 화면 미리보기와 서버 저장이 같은 함수를 써서, 보이는 결과와 저장 결과가 어긋나지 않게 한다.
//
// 한 줄 = 학생 한 명. 칸 순서는 자유 (번호·생년월일은 모양으로 찾고, 남은 칸이 이름 → 학년)
//   김민준 초5 010-1234-5678
//   이서연	중2	01098765432	2012-03-02   ← 엑셀에서 복사하면 탭으로 나뉨
//   010 2222 3333, 박지호, 고1
//   최하은 초3 010-3333-4444 25만원 10일   ← 교습비(원·만원)·납부일(○일·말일)은 있으면

import { isValidDate, todayKST } from "./date";
import { isValidMobile } from "./phone";
import { parseDueDay, parseFee } from "./money";

export const ROSTER_MAX_LINES = 100;

export type RosterOk = {
  line: number;
  ok: true;
  name: string;
  grade: string;
  parentPhone: string;
  birthDate: string | null;
  monthlyFee: number | null;
  dueDay: number | null;
};
export type RosterErr = { line: number; ok: false; text: string; error: string };
export type RosterRow = RosterOk | RosterErr;

const PHONE = /(?<!\d)01[016789][\s.-]*\d{3,4}[\s.-]*\d{4}(?!\d)/;
const FEE = /(?<![\d.])\d{1,3}(?:,\d{3})+\s*원?|(?<![\d.])\d+(?:\.\d+)?\s*만\s*원?|(?<![\d.])\d{4,8}\s*원/;
const DUE = /(?<![\d.])(?:[1-9]|[12]\d|3[01])\s*일(?![가-힣])|말일/;
const DATE = /(19|20)\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?\.?|(?<!\d)(19|20)\d{6}(?!\d)/;

/** "초등5" "초등학교 5학년" "중 2" → "초5" "중2". 모르는 모양은 그대로 둔다 */
export function normalizeGrade(raw: string): string {
  const t = raw.replace(/\s+/g, "");
  const m = t.match(/^(예비)?(초|중|고)(등학교|등|학교)?(\d)(학년)?$/);
  return m ? `${m[1] ?? ""}${m[2]}${m[4]}` : raw.trim();
}

export function parseBirth(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  const parts = raw.match(/\d+/g) ?? [];
  const [y, mo, da] = parts.length >= 3 ? parts : [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)];
  const iso = `${y}-${mo.padStart(2, "0")}-${da.padStart(2, "0")}`;
  return isValidDate(iso) && iso <= todayKST() && iso >= "1900-01-01" ? iso : null;
}

function parseLine(text: string, line: number): RosterRow | null {
  let rest = text.trim();
  if (!rest) return null;

  const phoneMatch = rest.match(PHONE);
  // 번호도 숫자도 없는 줄에 "이름"이 있으면 엑셀 머리줄로 보고 건너뜀
  if (!phoneMatch && !/\d/.test(rest) && rest.includes("이름")) return null;
  if (!phoneMatch) return { line, ok: false, text, error: "학부모 휴대폰 번호를 못 찾았어요" };
  const parentPhone = phoneMatch[0].replace(/\D/g, "");
  if (!isValidMobile(parentPhone)) return { line, ok: false, text, error: "휴대폰 번호를 확인해 주세요" };
  rest = rest.replace(phoneMatch[0], " ");

  let birthDate: string | null = null;
  const dateMatch = rest.match(DATE);
  if (dateMatch) {
    birthDate = parseBirth(dateMatch[0]);
    if (!birthDate) return { line, ok: false, text, error: "생년월일을 확인해 주세요" };
    rest = rest.replace(dateMatch[0], " ");
  }

  let monthlyFee: number | null = null;
  const feeMatch = rest.match(FEE);
  if (feeMatch) {
    monthlyFee = parseFee(feeMatch[0]);
    if (!Number.isFinite(monthlyFee)) return { line, ok: false, text, error: "교습비를 확인해 주세요" };
    rest = rest.replace(feeMatch[0], " ");
  }
  let dueDay: number | null = null;
  const dueMatch = rest.match(DUE);
  if (dueMatch) {
    dueDay = parseDueDay(dueMatch[0]);
    rest = rest.replace(dueMatch[0], " ");
  }

  // 남은 칸: 이름 → 학년. "중 2"처럼 학년이 띄어 써져도 붙여서 본다
  const cells = rest
    .split(/[\s,，;|]+/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (cells.length === 0) return { line, ok: false, text, error: "학생 이름이 없어요" };
  const [name, ...gradeParts] = cells;
  const grade = normalizeGrade(gradeParts.join(" "));
  if (!grade) return { line, ok: false, text, error: "학년이 없어요 (예: 초5)" };
  if (gradeParts.length > 2 || grade.length > 10) {
    return { line, ok: false, text, error: "칸이 너무 많아요. 이름·학년·번호만 남겨 주세요" };
  }
  if (name.length > 20) return { line, ok: false, text, error: "이름이 너무 길어요" };

  return { line, ok: true, name, grade, parentPhone, birthDate, monthlyFee, dueDay };
}

/** 붙여넣은 글 전체 → 줄마다 결과. 같은 학생(이름+번호)이 두 번 있으면 두 번째는 오류 */
export function parseRoster(input: string): RosterRow[] {
  const rows: RosterRow[] = [];
  const seen = new Set<string>();
  input.split(/\r?\n/).forEach((text, i) => {
    const r = parseLine(text, i + 1);
    if (!r) return;
    if (r.ok) {
      const key = rosterKey(r.name, r.parentPhone);
      if (seen.has(key)) {
        rows.push({ line: r.line, ok: false, text, error: "위에 같은 학생이 있어요" });
        return;
      }
      seen.add(key);
    }
    rows.push(r);
  });
  return rows;
}

/** 같은 학생 판단: 이름 + 학부모 번호 */
export function rosterKey(name: string, parentPhone: string) {
  return `${name.replace(/\s+/g, "")}|${parentPhone}`;
}

// ── 엑셀 올리기 ── 칸을 고른 뒤 한 줄씩 검사 (화면 미리보기와 서버 저장이 같은 함수)

/** 엑셀 한 줄에서 고른 칸의 글 (원장님이 칸을 골라 줌) */
export type ImportInput = { name: string; grade: string; phone: string; birth: string; classes: string; fee: string; due: string };
export type ImportRow = (RosterOk & { classNames: string[] }) | RosterErr;

/** 엑셀에서 숫자로 저장된 번호(1012345678)는 앞 0 이 빠져 있음 → 붙여 줌 */
export function phoneDigits(raw: string) {
  const d = raw.replace(/\D/g, "");
  return d.length === 10 && d.startsWith("1") ? `0${d}` : d;
}

export function checkImportRow(r: ImportInput, line: number): ImportRow {
  const text = [r.name, r.grade, r.phone].filter(Boolean).join(" ");
  const name = r.name.trim();
  if (!name) return { line, ok: false, text, error: "학생 이름이 없어요" };
  if (name.length > 20) return { line, ok: false, text, error: "이름이 너무 길어요" };
  const parentPhone = phoneDigits(r.phone);
  if (!parentPhone) return { line, ok: false, text, error: "학부모 번호가 없어요" };
  if (!isValidMobile(parentPhone)) return { line, ok: false, text, error: "학부모 휴대폰 번호를 확인해 주세요" };
  const grade = normalizeGrade(r.grade);
  if (!grade) return { line, ok: false, text, error: "학년이 없어요 (예: 초5)" };
  if (grade.length > 10) return { line, ok: false, text, error: "학년을 확인해 주세요 (예: 초5)" };
  const birthDate = r.birth.trim() ? parseBirth(r.birth) : null;
  if (r.birth.trim() && !birthDate) return { line, ok: false, text, error: "생년월일을 확인해 주세요" };
  const monthlyFee = parseFee(r.fee);
  if (Number.isNaN(monthlyFee)) return { line, ok: false, text, error: "교습비를 확인해 주세요" };
  const dueDay = parseDueDay(r.due);
  if (Number.isNaN(dueDay)) return { line, ok: false, text, error: "납부일을 확인해 주세요 (1~31일·말일)" };
  const classNames = [...new Set(r.classes.split(/[,，/·]+/).map((c) => c.trim()).filter(Boolean))].slice(0, 10);
  return { line, ok: true, name, grade, parentPhone, birthDate, monthlyFee, dueDay, classNames };
}
