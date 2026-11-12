import { SignJWT, jwtVerify } from "jose";

// 로그인 쿠키 서명/확인. proxy.ts 에서도 쓰므로 DB·쿠키 코드와 분리해 둔다.

export const SESSION_COOKIE = "gb_session";
export const REF_COOKIE = "gb_ref"; // 가입 경로 — 처음 들어온 사이트 도메인 또는 "direct" (proxy.ts)

/** 가입 경로 쿠키 → DB 에 넣을 값. 쿠키는 고칠 수 있으니 도메인 모양만 받는다 */
export function signupSourceOf(ref: string | undefined) {
  return ref && ref !== "direct" && /^[a-z0-9.-]{1,100}$/i.test(ref) ? ref.toLowerCase() : "직접";
}

export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30일 — 원장님이 매번 로그인하지 않게

function secretKey() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET 을 32자 이상으로 설정해 주세요");
  return new TextEncoder().encode(s);
}

/** admin: 관리자 계정(env ADMIN_LOGIN_IDS)으로 로그인 — proxy 가 관리자 화면·마이페이지 말고는 /admin 으로 보낸다 */
export async function signToken(academyId: string, admin = false) {
  return new SignJWT(admin ? { academyId, admin: true } : { academyId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<{ academyId: string; admin: boolean } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.academyId === "string" ? { academyId: payload.academyId, admin: payload.admin === true } : null;
  } catch {
    return null;
  }
}

export async function verifyToken(token: string | undefined): Promise<string | null> {
  return (await verifySession(token))?.academyId ?? null;
}

/** 관리자 계정이 열 수 있는 화면: 관리자 화면, 마이페이지(비밀번호·로그아웃만), API. 나머지는 /admin 으로 */
export function adminPathAllowed(path: string) {
  return path === "/admin" || path.startsWith("/admin/") || path === "/me" || path.startsWith("/api/");
}
