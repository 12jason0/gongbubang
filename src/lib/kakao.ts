// 카카오 로그인 (REST API 방식) — 서버 전용
//
// 흐름: [카카오로 시작하기] → /api/auth/kakao/start → 카카오 로그인·동의 → /api/auth/kakao/callback
//   - 연결된 공부방이 있으면 바로 로그인
//   - 없으면 /signup/kakao 에서 공부방 이름만 받고 가입 (+ 2주 체험, 같은 카카오는 체험 한 번만)
//   - 마이페이지에서 [카카오 연결하기] → 지금 로그인한 공부방에 카카오를 연결
//
// 필요한 환경변수: KAKAO_REST_API_KEY (없으면 카카오 버튼이 아예 안 보임), KAKAO_CLIENT_SECRET (콘솔에서 켰을 때만)
// Redirect URI: {APP_URL}/api/auth/kakao/callback — 카카오 개발자 콘솔에 똑같이 등록해야 함

import { SignJWT, jwtVerify } from "jose";

export const KAKAO_STATE_COOKIE = "gb_kakao_state";
export const KAKAO_PENDING_COOKIE = "gb_kakao_signup";
export const KAKAO_PENDING_MAX_AGE = 15 * 60; // 카카오 로그인 뒤 공부방 이름을 넣기까지 15분

/** 카카오 키가 있어야 버튼을 보여 준다 (지금 배포해도 안 깨지게) */
export function kakaoEnabled() {
  return !!process.env.KAKAO_REST_API_KEY;
}

/** 카카오로 가입한 계정의 아이디 앞부분. 보통 가입은 영문 소문자·숫자·_ 만 되므로 "-" 가 들어간 이 아이디와 겹치지 않음 */
export const KAKAO_LOGIN_PREFIX = "kakao-";
export const isKakaoAccount = (loginId: string) => loginId.startsWith(KAKAO_LOGIN_PREFIX);
/** 화면에 보이는 아이디 (카카오로 가입한 계정은 만들어 둔 아이디 대신) */
export const shownLoginId = (loginId: string) => (isKakaoAccount(loginId) ? "카카오 로그인" : loginId);

export function kakaoRedirectUri(origin: string) {
  return `${(process.env.APP_URL || origin).replace(/\/$/, "")}/api/auth/kakao/callback`;
}

export function kakaoAuthorizeUrl(redirectUri: string, state: string) {
  const u = new URL("https://kauth.kakao.com/oauth/authorize");
  u.searchParams.set("client_id", process.env.KAKAO_REST_API_KEY ?? "");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", state);
  return u.toString();
}

/** 받은 code → 카카오 회원번호. 실패하면 null */
export async function kakaoUserId(code: string, redirectUri: string): Promise<string | null> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.KAKAO_REST_API_KEY ?? "",
    redirect_uri: redirectUri,
    code,
  });
  if (process.env.KAKAO_CLIENT_SECRET) body.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body,
    cache: "no-store",
  });
  if (!tokenRes.ok) {
    console.error("카카오 토큰 실패", tokenRes.status, await tokenRes.text().catch(() => ""));
    return null;
  }
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return null;
  // 회원번호(id)만 쓴다 — 닉네임·이메일 같은 동의 항목은 받지 않음
  const meRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${access_token}` },
    cache: "no-store",
  });
  if (!meRes.ok) {
    console.error("카카오 사용자 조회 실패", meRes.status);
    return null;
  }
  const { id } = (await meRes.json()) as { id?: number | string };
  return id === undefined || id === null ? null : String(id);
}

const key = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "");

/** 카카오 로그인은 됐는데 아직 공부방이 없을 때: 가입 화면까지 카카오 회원번호를 서명해서 들고 감 */
export async function signPendingKakao(kakaoId: string) {
  return new SignJWT({ kakaoId, purpose: "kakao-signup" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${KAKAO_PENDING_MAX_AGE}s`)
    .sign(key());
}

export async function readPendingKakao(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload.purpose === "kakao-signup" && typeof payload.kakaoId === "string" ? payload.kakaoId : null;
  } catch {
    return null;
  }
}
