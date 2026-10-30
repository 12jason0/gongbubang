import { SignJWT, jwtVerify } from "jose";

// 로그인 쿠키 서명/확인. proxy.ts 에서도 쓰므로 DB·쿠키 코드와 분리해 둔다.

export const SESSION_COOKIE = "gb_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30일 — 원장님이 매번 로그인하지 않게

function secretKey() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET 을 32자 이상으로 설정해 주세요");
  return new TextEncoder().encode(s);
}

export async function signToken(academyId: string) {
  return new SignJWT({ academyId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifyToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.academyId === "string" ? payload.academyId : null;
  } catch {
    return null;
  }
}
