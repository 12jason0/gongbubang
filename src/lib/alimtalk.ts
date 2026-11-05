// 카카오 알림톡 템플릿
//
// 알림톡은 카카오가 미리 심사한 문구(템플릿)로만 보낼 수 있다. 수업 피드백·공지는 내용을 변수(#{메모}·#{공지내용})로
// 넣어서 카톡에 바로 보이게 한다. 카톡 한 통은 1,000자까지라 넘으면 앞부분 + "전체 보기: 링크"(/f/…·/n/…)로 줄인다
// (lib/templates.ts fitKakao). 템플릿 ID 가 없으면 예전처럼 문자로 나간다(공지는 링크 방식).
//
// 아래 body 를 솔라피 콘솔 → 카카오 알림톡 → 템플릿 등록에 "글자 하나 안 바꾸고" 그대로 넣는다.
// 승인되면 나오는 템플릿 ID 를 env 이름 그대로 .env 에 넣으면 그 종류만 알림톡으로 바뀐다.
// (ID 가 없는 종류는 지금처럼 문자로 나감. 알림톡이 실패하면 솔라피가 같은 내용을 문자로 대신 보냄)

import crypto from "node:crypto";
import { fillTemplate } from "./templates";

export type AlimtalkKey = "ATTENDANCE" | "FEEDBACK" | "PAYMENT" | "NOTICE" | "CONSENT";

export const ALIMTALK_TEMPLATES: Record<AlimtalkKey, { title: string; env: string; body: string }> = {
  ATTENDANCE: {
    title: "등원 알림",
    env: "SOLAPI_TEMPLATE_ATTENDANCE",
    body: "[#{학원}] 등원 알림\n\n#{이름} 학생이 #{시각}에 등원했습니다.",
  },
  FEEDBACK: {
    title: "수업 피드백 도착 알림",
    env: "SOLAPI_TEMPLATE_FEEDBACK",
    body: "[#{학원}] 수업 피드백\n\n" + "#{이름} 학생의 #{날짜} 수업 피드백입니다.\n\n" + "#{메모}",
  },
  PAYMENT: {
    title: "교습비 납부 안내",
    env: "SOLAPI_TEMPLATE_PAYMENT",
    body:
      "[#{학원}] 교습비 납부 안내\n\n" +
      "#{이름} 학생의 #{월} 교습비 납부 안내드립니다.\n" +
      "이미 납부하셨다면 이 안내는 넘기셔도 됩니다.",
  },
  NOTICE: {
    title: "공지사항 안내",
    env: "SOLAPI_TEMPLATE_NOTICE",
    body:
      "[#{학원}] 공지사항 안내\n\n" +
      "#{이름} 학부모님, 안녕하세요.\n" +
      "#{학원}에서 안내드립니다.\n\n" +
      "#{공지내용}\n\n" +
      "※ 수강 중인 학생의 학부모님께 보내드리는 안내입니다.",
  },
  CONSENT: {
    title: "학부모 동의 요청",
    env: "SOLAPI_TEMPLATE_CONSENT",
    body:
      "[#{학원}] #{이름} 학부모님, 안녕하세요. 출결·공지 안내를 카카오톡으로 보내드리려고 합니다. " +
      "아래 링크에서 내용을 확인하고 동의해 주세요.\n" +
      "#{링크}",
  },
};

export type AlimtalkVars = Record<string, string>; // { 학원: "현샘영수", 이름: "김하늘", ... }

/** 이 종류를 알림톡으로 보낼 수 있으면 { pfId, templateId }, 아니면 null (→ 문자) */
export function alimtalkConfig(key: AlimtalkKey): { pfId: string; templateId: string } | null {
  const pfId = process.env.SOLAPI_KAKAO_PF_ID?.trim();
  const templateId = process.env[ALIMTALK_TEMPLATES[key].env]?.trim();
  if (!pfId || !templateId) return null;
  if ((key === "FEEDBACK" || key === "NOTICE" || key === "CONSENT") && !appUrl()) return null; // 링크를 못 만들면 문자로 본문을 보냄
  return { pfId, templateId };
}

/** 템플릿 + 값 → 학부모님 휴대폰에 보이는 글 (기록·미리보기용, 솔라피가 만드는 글과 같음) */
export function renderAlimtalk(key: AlimtalkKey, vars: AlimtalkVars) {
  return fillTemplate(ALIMTALK_TEMPLATES[key].body, vars);
}

/** 솔라피 variables 모양: { "#{학원}": "현샘영수" } */
export function solapiVariables(vars: AlimtalkVars) {
  return Object.fromEntries(Object.entries(vars).map(([k, v]) => [`#{${k}}`, v]));
}

// ───── 학부모님이 여는 링크 ─────
// /f/<메모 id>.<서명 16자> (수업 피드백), /n/<공지 id>.<서명 16자> (단체 공지), /c/<학생 id>.<서명 16자> (학부모 동의)
// 서명이 맞아야 열림 (id 를 바꿔 남의 메모·공지를 볼 수 없게). 서명에 종류를 섞어서 서로 바꿔 쓸 수 없음

export function appUrl() {
  return process.env.APP_URL?.trim().replace(/\/+$/, "") || "";
}

type LinkKind = "feedback" | "notice" | "consent";

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

export function noticeLink(noticeId: string) {
  return `${appUrl()}/n/${noticeId}.${sign("notice", noticeId)}`;
}

/** 링크 코드 → 공지 id (서명이 틀리면 null) */
export function readNoticeCode(code: string): string | null {
  return readCode("notice", code);
}

/** 학부모 동의 링크 — 학생 id 로 만들지만, 열면 같은 학부모 번호의 형제 모두에게 적용된다 */
export function consentLink(studentId: string) {
  return `${appUrl()}/c/${studentId}.${sign("consent", studentId)}`;
}

/** 링크 코드 → 학생 id (서명이 틀리면 null) */
export function readConsentCode(code: string): string | null {
  return readCode("consent", code);
}
