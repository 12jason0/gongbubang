// 엑셀 올리기 — 첫 줄 제목으로 칸 맞추기 + 학년 계산 (브라우저에서만 씀, 파일은 서버로 안 보냄)

import { normalizeGrade, phoneDigits } from "./roster";
import { isValidMobile } from "./phone";

export type Field = "name" | "phone" | "grade" | "birth" | "classes" | "fee" | "due" | "age";
export const FIELD_LABEL: Record<Field, string> = {
  name: "이름",
  phone: "학부모 번호",
  grade: "학년",
  birth: "생년월일",
  classes: "반",
  fee: "교습비",
  due: "납부일",
  age: "나이",
};

const PARENT = /학부모|보호자|부모|엄마|어머|아빠|아버|모친|부친/;
const RULES: [Exclude<Field, "phone">, RegExp][] = [
  ["name", /^(학생|원생)?\s*(이름|성명|명)$|학생\s*명|학생\s*이름|원생\s*명|^성명$/],
  ["grade", /학년/],
  ["birth", /생년월일|생일|출생/],
  ["age", /나이|연령/],
  ["classes", /^반$|반\s*이름|반명|수업|클래스|강좌|과정/],
  ["fee", /교습비|원비|수강료|학원비|회비|수업료|금액/],
  ["due", /납부일|결제일|납입일|입금일/],
];

/** 이 칸이 휴대폰 번호 칸처럼 보이나 (채워진 칸의 절반 이상이 휴대폰 번호) */
function looksPhone(body: string[][], col: number) {
  const vals = body.map((r) => (r[col] ?? "").trim()).filter(Boolean);
  return vals.length > 0 && vals.filter((v) => isValidMobile(phoneDigits(v))).length / vals.length >= 0.5;
}

/** 첫 줄이 제목 줄인가 (휴대폰 번호가 없고 글자만) */
export function hasHeader(first: string[]) {
  return first.some((c) => c.trim()) && !first.some((c) => isValidMobile(phoneDigits(c)));
}

/**
 * 칸 자동 맞추기. 번호 칸이 2개 이상이면(학생·엄마·아빠) phone 은 비워 두고 phoneChoices 로 돌려줌 → 원장님이 고름.
 * 반환: 필드 → 칸 번호 (없으면 -1)
 */
export function guessColumns(header: string[], body: string[][]) {
  const map: Record<Field, number> = { name: -1, phone: -1, grade: -1, birth: -1, classes: -1, fee: -1, due: -1, age: -1 };
  const phoneCols = header.map((_, i) => i).filter((i) => looksPhone(body, i));
  for (const [field, re] of RULES) {
    const i = header.findIndex((h, j) => re.test(h.trim()) && !phoneCols.includes(j) && !(field === "name" && PARENT.test(h)));
    if (i >= 0 && !Object.values(map).includes(i)) map[field] = i;
  }
  if (phoneCols.length === 1) map.phone = phoneCols[0];
  // 제목이 없을 때: 학년처럼 보이는 칸, 한글 이름처럼 보이는 칸
  const fill = (field: Field, test: (v: string) => boolean) => {
    if (map[field] >= 0) return;
    const i = header.findIndex((_, j) => {
      if (Object.values(map).includes(j) || phoneCols.includes(j)) return false;
      const vals = body.map((r) => (r[j] ?? "").trim()).filter(Boolean);
      return vals.length > 0 && vals.filter(test).length / vals.length >= 0.7;
    });
    if (i >= 0) map[field] = i;
  };
  fill("grade", (v) => /^(예비)?[초중고]\d$/.test(normalizeGrade(v)));
  fill("name", (v) => /^[가-힣]{2,5}$/.test(v));
  return { map, phoneChoices: phoneCols.length > 1 ? phoneCols : [] };
}

/** 학년 (3월에 새 학년). 생년 → 초1 = 만 7세 되는 해. 학교 다닐 나이가 아니면 "" */
export function gradeFromBirthYear(birthYear: number, today: string) {
  const [y, m] = today.split("-").map(Number);
  const n = (m >= 3 ? y : y - 1) - birthYear - 6;
  if (n >= 1 && n <= 6) return `초${n}`;
  if (n >= 7 && n <= 9) return `중${n - 6}`;
  if (n >= 10 && n <= 12) return `고${n - 9}`;
  return "";
}

/** 나이 칸(만 나이로 봄) → 대략 학년. 원장님이 미리보기에서 고칠 수 있음 */
export function gradeFromAge(age: string, today: string) {
  const n = Number(age.replace(/\D/g, ""));
  return n > 0 && n < 30 ? gradeFromBirthYear(Number(today.slice(0, 4)) - n, today) : "";
}

/** 엑셀 칸 값 → 글. 날짜는 "2012-03-02" */
export function cellText(v: unknown): string {
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return v === null || v === undefined ? "" : String(v).trim();
}
