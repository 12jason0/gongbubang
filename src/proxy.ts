import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/token";

// 로그인 안 했으면 로그인 화면으로 보낸다 (실제 권한 확인은 각 화면·액션에서 다시 함)
export async function proxy(request: NextRequest) {
  const academyId = await verifyToken(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup";
  const path = request.nextUrl.pathname;
  // 학부모님도 보는 화면: 개인정보 처리방침, 알림톡 링크로 여는 수업 피드백
  const isPublic = path === "/privacy" || path === "/terms" || path.startsWith("/f/");

  if (isPublic) return NextResponse.next();
  // 쿠키는 맞는데 그 공부방이 DB 에 없을 때 (requireAcademy 가 보냄): 쿠키를 지우고 로그인 화면을 그대로 보여준다.
  // 이걸 안 하면 로그인 화면 → "/" → 로그인 화면 … 으로 끝없이 돈다.
  if (path === "/login" && request.nextUrl.searchParams.get("stale") === "1") {
    const res = NextResponse.next();
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  if (!academyId && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (academyId && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|icons/).*)"],
};
