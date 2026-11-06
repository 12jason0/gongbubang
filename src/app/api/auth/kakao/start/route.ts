import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { KAKAO_STATE_COOKIE, kakaoAuthorizeUrl, kakaoEnabled, kakaoRedirectUri } from "@/lib/kakao";

// [카카오로 시작하기] / [카카오 연결하기] → 카카오 로그인 화면으로
//   ?mode=login (기본) | link (마이페이지에서 지금 계정에 연결),  ?pc=1 (넓은 화면 → 로그인 뒤 대시보드)
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode") === "link" ? "link" : "login";
  if (!kakaoEnabled()) return NextResponse.redirect(new URL(mode === "link" ? "/me" : "/login", request.url));

  const state = crypto.randomBytes(16).toString("base64url");
  const pc = request.nextUrl.searchParams.get("pc") === "1" ? "1" : "0";
  const res = NextResponse.redirect(kakaoAuthorizeUrl(kakaoRedirectUri(request.nextUrl.origin), state));
  // 돌아왔을 때 우리가 보낸 요청이 맞는지 확인용 (CSRF 방지). 카카오에서 돌아오는 건 최상위 GET 이라 lax 로 충분
  res.cookies.set(KAKAO_STATE_COOKIE, `${state}.${mode}.${pc}`, {
    httpOnly: true,
    secure: request.headers.get("x-forwarded-proto") === "https",
    sameSite: "lax",
    path: "/api/auth/kakao",
    maxAge: 10 * 60,
  });
  return res;
}
