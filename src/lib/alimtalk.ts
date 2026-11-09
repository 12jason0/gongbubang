// 카카오 알림톡 템플릿
//
// 알림톡은 카카오가 미리 심사한 문구(템플릿)로만 보낼 수 있다. 수업 피드백은 메모를 변수(#{피드백})로 넣어 카톡에 바로 보이게 하고,
// 카톡 한 통은 1,000자까지라 넘으면 메모를 줄이고 "…(전체 내용은 아래 버튼)"을 붙인다 (lib/templates.ts fitKakao).
// 공지는 둘로 나뉜다: 수업 일정 안내(휴원·보강·수업 시간 변경)는 알림톡 SCHEDULE, 그 밖의 공지는 문자(장문)로만 (actions.ts sendNotice).
// 템플릿 ID 가 없으면 같은 글이 문자로 나간다.
//
// 아래 body 를 솔라피 콘솔 → 카카오 알림톡 → 템플릿 등록에 "글자 하나 안 바꾸고" 그대로 넣는다.
// 승인되면 나오는 템플릿 ID 를 env 이름 그대로 .env 에 넣으면 그 종류만 알림톡으로 바뀐다.
// (ID 가 없는 종류는 지금처럼 문자로 나감. 알림톡이 실패하면 솔라피가 같은 내용을 문자로 대신 보냄)

import crypto from "node:crypto";
import { fillTemplate } from "./templates";

export type AlimtalkKey = "ATTENDANCE" | "FEEDBACK" | "PAYMENT" | "SCHEDULE" | "CONSENT";

export const ALIMTALK_TEMPLATES: Record<AlimtalkKey, { title: string; env: string; body: string }> = {
  ATTENDANCE: {
    title: "등원 알림",
    env: "SOLAPI_TEMPLATE_ATTENDANCE",
    body: "[#{학원}] 등원 알림\n\n#{이름} 학생이 #{시각}에 등원했습니다.",
  },
  FEEDBACK: {
    title: "수업 피드백 안내",
    env: "SOLAPI_TEMPLATE_FEEDBACK",
    body:
      "[#{학원}] 수업 피드백 안내\n\n" +
      "#{호칭}, 안녕하세요.\n" +
      "#{이름} 학생의 #{날짜} 수업 피드백을 보내드립니다.\n\n" +
      "■ 선생님 피드백\n" +
      "#{피드백}\n\n" +
      "※ #{학원}에서 수업을 듣는 학생의 학부모님께 수업 후 보내드리는 학습 안내입니다.",
    // 버튼(웹링크) "피드백 전체 보기": https://gongbubang-tau.vercel.app/f/#{코드} (모바일·PC 같게, 외부 브라우저 열기 끔)
    // — 솔라피 템플릿에 등록, #{코드} 는 variables 로 같이 보냄. 문자로 갈 때는 줄인 경우에만 본문 뒤에 링크를 붙임
  },
  PAYMENT: {
    title: "교습비 납부 안내",
    env: "SOLAPI_TEMPLATE_PAYMENT",
    body:
      "[#{학원}] 교습비 납부 안내\n\n" +
      "#{이름} 학생의 #{월} 교습비 납부 안내드립니다.\n\n" +
      "교습비: #{금액}\n" +
      "납부일: #{납부일}\n\n" +
      "이미 납부하셨다면 이 안내는 넘기셔도 됩니다.",
  },
  SCHEDULE: {
    title: "수업 일정 안내",
    env: "SOLAPI_TEMPLATE_SCHEDULE",
    body:
      "[#{학원}] 수업 일정 안내\n\n" +
      "#{호칭}, 안녕하세요.\n" +
      "#{이름} 학생의 수업 일정 변경을 안내드립니다.\n\n" +
      "■ 안내 종류 : #{종류}\n" +
      "■ 해당 날짜 : #{날짜}\n" +
      "■ 변경 내용 : #{내용}\n\n" +
      "※ #{학원}에서 수업을 듣는 학생의 학부모님께 보내드리는 수업 일정 안내입니다.",
  },
  CONSENT: {
    title: "학부모 동의 요청",
    env: "SOLAPI_TEMPLATE_CONSENT",
    body:
      "[#{학원}] #{이름} 학부모님, 안녕하세요. 출결·공지 안내를 카카오톡으로 보내드리려고 합니다. " +
      "아래 버튼을 눌러 내용을 확인하고 동의해 주세요.",
    // 버튼(웹링크) "동의하러 가기": https://gongbubang-tau.vercel.app/c/#{코드} (모바일·PC 같게) — 솔라피 템플릿에 등록,
    // #{코드} 는 variables 로 같이 보냄. 문자로 갈 때는 actions.ts sendConsentTo 가 본문 뒤에 링크를 붙임
  },
};

/** 수업 일정 안내의 #{종류} — 원장님이 버튼으로 고름 */
export const SCHEDULE_KINDS = ["휴원", "보강", "수업 시간 변경"] as const;

/**
 * #{호칭} — 학부모님을 부르는 말. 학생별로 따로 저장한 호칭이 없어서 "김하늘 학생 학부모님" (형제는 "김민수·김민지 학생 학부모님")
 */
export function parentTitle(names: string) {
  return `${names} 학생 학부모님`;
}

export type AlimtalkVars = Record<string, string>; // { 학원: "현샘영수", 이름: "김하늘", ... }

/** 이 종류를 알림톡으로 보낼 수 있으면 { pfId, templateId }, 아니면 null (→ 문자) */
export function alimtalkConfig(key: AlimtalkKey): { pfId: string; templateId: string } | null {
  const pfId = process.env.SOLAPI_KAKAO_PF_ID?.trim();
  const templateId = process.env[ALIMTALK_TEMPLATES[key].env]?.trim();
  if (!pfId || !templateId) return null;
  if ((key === "FEEDBACK" || key === "CONSENT") && !appUrl()) return null; // 버튼이 여는 화면이 없으면 문자로
  return { pfId, templateId };
}

/** 템플릿 + 값 → 학부모님 휴대폰에 보이는 글 (기록·미리보기용, 솔라피가 만드는 글과 같음) */
export function renderAlimtalk(key: AlimtalkKey, vars: AlimtalkVars) {
  return fillTemplate(ALIMTALK_TEMPLATES[key].body, vars);
}

/**
 * 이 템플릿으로 만든 글 → 변수 값 (실패한 알림톡을 다시 보낼 때, 기록된 글에서 값을 되살림). 모양이 다르면 null
 */
export function parseAlimtalk(key: AlimtalkKey, text: string): AlimtalkVars | null {
  const names: string[] = [];
  const pattern = ALIMTALK_TEMPLATES[key].body
    .split(/(#\{[^}]+\})/)
    .map((part) => {
      const m = /^#\{([^}]+)\}$/.exec(part);
      if (!m) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const i = names.indexOf(m[1]);
      if (i >= 0) return `\\k<v${i}>`;
      names.push(m[1]);
      return `(?<v${names.length - 1}>[\\s\\S]*?)`;
    })
    .join("");
  const found = new RegExp(`^${pattern}$`).exec(text);
  return found ? Object.fromEntries(names.map((n, i) => [n, found.groups![`v${i}`]])) : null;
}

/** 솔라피 variables 모양: { "#{학원}": "현샘영수" } */
export function solapiVariables(vars: AlimtalkVars) {
  return Object.fromEntries(Object.entries(vars).map(([k, v]) => [`#{${k}}`, v]));
}

// ───── 학부모님이 여는 링크 ─────
// /f/<메모 id>.<서명 16자> (수업 피드백), /n/<공지 id>.<서명 16자> (예전 단체 공지), /c/<학생 id>.<서명 16자> (학부모 동의)
// 서명이 맞아야 열림 (id 를 바꿔 남의 메모·공지를 볼 수 없게). 서명에 종류를 섞어서 서로 바꿔 쓸 수 없음

export function appUrl() {
  return process.env.APP_URL?.trim().replace(/\/+$/, "") || "";
}

type LinkKind = "feedback" | "notice" | "consent" | "consult";

function sign(kind: LinkKind, id: string) {
  const secret = process.env.SESSION_SECRET ?? "";
  return crypto.createHmac("sha256", secret).update(`${kind}:${id}`).digest("base64url").slice(0, 16);
}

function readCode(kind: LinkKind, code: string): string | null {
  const dot = code.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = code.slice(0, dot);
  const given = Buffer.from(code.slice(dot + 1));
  const want = Buffer.from(sign(kind, id));
  return given.length === want.length && crypto.timingSafeEqual(given, want) ? id : null;
}

export function feedbackCode(noteId: string) {
  return `${noteId}.${sign("feedback", noteId)}`;
}

export function feedbackLink(noteId: string) {
  return `${appUrl()}/f/${feedbackCode(noteId)}`;
}

/** 링크 코드 → 메모 id (서명이 틀리면 null) */
export function readFeedbackCode(code: string): string | null {
  return readCode("feedback", code);
}

/** 링크 코드 → 공지 id (서명이 틀리면 null). 예전 공지 링크(/n/…)용 — 새 공지는 링크를 안 만든다 */
export function readNoticeCode(code: string): string | null {
  return readCode("notice", code);
}

/** 학부모 동의 링크 — 학생 id 로 만들지만, 열면 같은 학부모 번호의 형제 모두에게 적용된다 */
export function consentLink(studentId: string) {
  return `${appUrl()}/c/${consentCode(studentId)}`;
}

/** 동의 링크의 코드 부분 (알림톡 버튼 #{코드}) */
export function consentCode(studentId: string) {
  return `${studentId}.${sign("consent", studentId)}`;
}

/** 링크 코드 → 학생 id (서명이 틀리면 null) */
export function readConsentCode(code: string): string | null {
  return readCode("consent", code);
}

/** 상담 신청 링크 — 공부방마다 하나 (원장님이 문자·카톡으로 돌림). 학부모님은 로그인 없이 연다 */
export function consultLink(academyId: string) {
  return `${appUrl()}/r/${academyId}.${sign("consult", academyId)}`;
}

/** 링크 코드 → 공부방 id (서명이 틀리면 null) */
export function readConsultCode(code: string): string | null {
  return readCode("consult", code);
}
