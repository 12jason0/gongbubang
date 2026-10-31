import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/token";

// 로그인 안 했으면 로그인 화면으로 보낸다 (실제 권한 확인은 각 화면·액션에서 다시 함)
export async function proxy(request: NextRequest) {
  const academyId = await verifyToken(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = request.nextUrl.pathname === "/login";
  const path = request.nextUrl.pathname;
  // 학부모님도 보는 화면: 개인정보 처리방침, 알림톡 링크로 여는 수업 피드백
  const isPublic = path === "/privacy" || path.startsWith("/f/");

  if (isPublic) return NextResponse.next();
  if (!academyId && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (academyId && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest).*)"],
};
