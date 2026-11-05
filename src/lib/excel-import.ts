// 엑셀 올리기 — 첫 줄 제목으로 칸 맞추기 + 학년 계산 (브라우저에서만 씀, 파일은 서버로 안 보냄)
// 저장하는 칸: 이름·학부모 번호·학년·반·교습비·납부일. 학년은 원장님이 정하는 값이라 계산하지 않음 (학년 칸이 없으면 빈칸)

import { normalizeGrade, phoneDigits } from "./roster";
import { isValidMobile } from "./phone";

export type Field = "name" | "phone" | "grade" | "classes" | "fee" | "due";

const PARENT = /학부모|보호자|부모|엄마|어머|아빠|아버|모친|부친/;
const RULES: [Exclude<Field, "phone">, RegExp][] = [
  ["name", /^(학생|원생)?\s*(이름|성명|명)$|학생\s*명|학생\s*이름|원생\s*명|^성명$/],
  ["grade", /학년/],
  ["classes", /^반$|반\s*이름|반명|수업|클래스|강좌|과정/],
  ["fee", /교습비|원비|수강료|학원비|회비|수업료|금액/],
  ["due", /납부일|결제일|납입일|입금일/],
];

/** 이 칸이 휴대폰 번호 칸처럼 보이나 (채워진 칸의 절반 이상이 휴대폰 번호) */
function looksPhone(body: string[][], col: number) {
  const vals = body.map((r) => (r[col] ?? "").trim()).filter(Boolean);
  return vals.length > 0 && vals.filter((v) => isValidMobile(phoneDigits(v))).length / vals.length >= 0.5;
}

const PHONE_WORD = /번호|연락처|전화|휴대|핸드폰|폰|hp|tel|phone/i;

/** 첫 줄이 제목 줄인가 (휴대폰 번호가 없고 글자만) */
export function hasHeader(first: string[]) {
  return first.some((c) => c.trim()) && !first.some((c) => isValidMobile(phoneDigits(c)));
}

/**
 * 칸 자동 맞추기 — 반환: 필드 → 칸 번호 (없으면 -1)
 * 학부모 번호: 제목에 학부모·부모·보호자·어머니·아버지·엄마·아빠가 들어간 번호 칸(여럿이면 앞의 것).
 *   그런 칸이 없고 번호 칸이 하나뿐이면 그 칸. 그래도 없으면 -1 → 원장님께 한 번만 물음
 */
export function guessColumns(header: string[], body: string[][]) {
  const map: Record<Field, number> = { name: -1, phone: -1, grade: -1, classes: -1, fee: -1, due: -1 };
  const phoneCols = header.map((_, i) => i).filter((i) => looksPhone(body, i));
  const parentCols = header
    .map((h, i) => i)
    .filter((i) => PARENT.test(header[i]) && (phoneCols.includes(i) || PHONE_WORD.test(header[i])));
  map.phone = parentCols[0] ?? (phoneCols.length === 1 ? phoneCols[0] : -1);
  const taken = (j: number) => Object.values(map).includes(j) || phoneCols.includes(j) || parentCols.includes(j);
  for (const [field, re] of RULES) {
    const i = header.findIndex((h, j) => re.test(h.trim()) && !taken(j) && !(field === "name" && PARENT.test(h)));
    if (i >= 0) map[field] = i;
  }
  // 제목이 없을 때: 학년처럼 보이는 칸, 한글 이름처럼 보이는 칸
  const fill = (field: Field, test: (v: string) => boolean) => {
    if (map[field] >= 0) return;
    const i = header.findIndex((_, j) => {
      if (taken(j)) return false;
      const vals = body.map((r) => (r[j] ?? "").trim()).filter(Boolean);
      return vals.length > 0 && vals.filter(test).length / vals.length >= 0.7;
    });
    if (i >= 0) map[field] = i;
  };
  fill("grade", (v) => /^(예비)?[초중고]\d$/.test(normalizeGrade(v)));
  fill("name", (v) => /^[가-힣]{2,5}$/.test(v));
  return map;
}

/** 엑셀 칸 값 → 글. 날짜는 "2012-03-02" */
export function cellText(v: unknown): string {
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return v === null || v === undefined ? "" : String(v).trim();
}
