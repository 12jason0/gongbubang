// 카카오 알림톡 템플릿
//
// 알림톡은 카카오가 미리 심사한 문구(템플릿)로만 보낼 수 있다. 그래서 매번 내용이 다른 수업 피드백은
// 본문을 넣지 않고 "피드백이 도착했어요 + 링크"만 보내고, 학부모님이 링크를 열면 메모 전체가 보이게 한다.
// 단체 공지도 같은 방식: "새 공지가 있어요 + 링크" → 링크(/n/…)를 열면 공지 전체.
//
// 아래 body 를 솔라피 콘솔 → 카카오 알림톡 → 템플릿 등록에 "글자 하나 안 바꾸고" 그대로 넣는다.
// 승인되면 나오는 템플릿 ID 를 env 이름 그대로 .env 에 넣으면 그 종류만 알림톡으로 바뀐다.
// (ID 가 없는 종류는 지금처럼 문자로 나감. 알림톡이 실패하면 솔라피가 같은 내용을 문자로 대신 보냄)

import crypto from "node:crypto";

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
    body:
      "[#{학원}] 수업 피드백 안내\n\n" +
      "#{이름} 학생의 #{날짜} 수업 피드백이 도착했습니다.\n" +
      "아래 주소를 눌러 확인해 주세요.\n\n" +
      "#{링크}",
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
    title: "새 공지 안내",
    env: "SOLAPI_TEMPLATE_NOTICE",
    body:
      "[#{학원}] 새 공지 안내\n\n" +
      "#{이름} 학부모님, 새 공지가 있어요.\n" +
      "아래 링크에서 확인해 주세요.\n\n" +
      "#{링크}",
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
  return ALIMTALK_TEMPLATES[key].body.replace(/#\{([^}]+)\}/g, (_, k: string) => vars[k] ?? "");
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
