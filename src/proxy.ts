import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/token";

// 검색엔진·AI 봇·카톡 미리보기가 로그인 없이 가져가는 파일
const SEO_FILES = new Set(["/robots.txt", "/sitemap.xml", "/llms.txt"]);

// 로그인 안 했으면 로그인 화면으로 보낸다 (실제 권한 확인은 각 화면·액션에서 다시 함)
export async function proxy(request: NextRequest) {
  const academyId = await verifyToken(request.cookies.get(SESSION_COOKIE)?.value);
  const path = request.nextUrl.pathname;
  // /signup/kakao: 카카오 로그인 뒤 공부방 이름만 넣는 가입 화면
  const isLogin = path === "/login" || path === "/signup" || path === "/signup/kakao";
  // 카카오 로그인 시작·돌아오는 곳 — 로그인 전에도 열려야 함 (연결 모드는 경로 안에서 로그인 쿠키 확인)
  if (path.startsWith("/api/auth/kakao/")) return NextResponse.next();
  // 학부모님도 보는 화면: 개인정보 처리방침, 카톡 링크로 여는 수업 피드백(/f/)·공지(/n/)·동의(/c/)·상담 신청(/r/), Vercel Cron(/api/cron/ — 경로 안에서 CRON_SECRET 확인)
  const isPublic =
    path === "/about" || path === "/privacy" || path.startsWith("/guide/") || SEO_FILES.has(path) || path.startsWith("/opengraph-image") || path === "/terms" || path.startsWith("/f/") || path.startsWith("/n/") || path.startsWith("/c/") || path.startsWith("/r/") || path.startsWith("/api/cron/");

  if (isPublic) return NextResponse.next();
  // 쿠키는 맞는데 그 공부방이 DB 에 없을 때 (requireAcademy 가 보냄): 쿠키를 지우고 로그인 화면을 그대로 보여준다.
  // 이걸 안 하면 로그인 화면 → "/" → 로그인 화면 … 으로 끝없이 돈다.
  if (path === "/login" && request.nextUrl.searchParams.get("stale") === "1") {
    const res = NextResponse.next();
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  // 로그인 안 한 사람이 첫 화면에 오면 소개 페이지 (주소는 / 그대로)
  if (!academyId && path === "/") {
    return NextResponse.rewrite(new URL("/about", request.url));
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
