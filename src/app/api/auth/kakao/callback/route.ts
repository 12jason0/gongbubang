import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, academies } from "@/db";
import { createSession } from "@/lib/session";
import { SESSION_COOKIE, verifyToken } from "@/lib/token";
import { trialKakaoHash } from "@/lib/account";
import {
  KAKAO_PENDING_COOKIE,
  KAKAO_PENDING_MAX_AGE,
  KAKAO_STATE_COOKIE,
  kakaoEnabled,
  kakaoRedirectUri,
  kakaoUserId,
  signPendingKakao,
} from "@/lib/kakao";

// 카카오 로그인에서 돌아오는 곳 (카카오 개발자 콘솔의 Redirect URI)
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const [state, mode, pc] = (request.cookies.get(KAKAO_STATE_COOKIE)?.value ?? "").split(".");
  const back = mode === "link" ? "/me" : "/login";
  const go = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url));
    res.cookies.delete({ name: KAKAO_STATE_COOKIE, path: "/api/auth/kakao" });
    return res;
  };

  // 사용자가 동의 화면에서 취소했거나, 우리가 보낸 요청이 아니면 (state 가 다름) 처음 화면으로
  if (!kakaoEnabled() || !state || sp.get("state") !== state) return go(`${back}?kakao=fail`);
  if (sp.get("error") || !sp.get("code")) return go(`${back}?kakao=cancel`);

  const kakaoId = await kakaoUserId(sp.get("code")!, kakaoRedirectUri(request.nextUrl.origin));
  if (!kakaoId) return go(`${back}?kakao=fail`);

  const [owner] = await db
    .select({ id: academies.id })
    .from(academies)
    .where(and(eq(academies.kakaoId, kakaoId), isNull(academies.deletedAt)));

  // ── 마이페이지에서 지금 계정에 연결 ──
  if (mode === "link") {
    const academyId = await verifyToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!academyId) return go("/login");
    if (owner) return go(owner.id === academyId ? "/me?kakao=linked" : "/me?kakao=taken");
    const [me] = await db
      .select({ kakaoId: academies.kakaoId, trialKakaoHash: academies.trialKakaoHash })
      .from(academies)
      .where(and(eq(academies.id, academyId), isNull(academies.deletedAt)));
    if (!me) return go("/login");
    if (me.kakaoId) return go("/me?kakao=already");
    await db
      .update(academies)
      // 이 카카오로 나중에 새로 가입해도 체험을 또 받지 않게 (이미 체험한 계정에 연결했으므로)
      .set({ kakaoId, trialKakaoHash: me.trialKakaoHash || trialKakaoHash(kakaoId) })
      .where(eq(academies.id, academyId));
    return go("/me?kakao=linked");
  }

  // ── 로그인: 연결된 공부방이 있으면 바로 ──
  if (owner) {
    await createSession(owner.id);
    return go(pc === "1" ? "/dashboard" : "/");
  }

  // ── 처음: 공부방 이름만 받는 가입 화면으로 (카카오 회원번호는 서명한 쿠키에 15분) ──
  const res = go("/signup/kakao");
  res.cookies.set(KAKAO_PENDING_COOKIE, await signPendingKakao(kakaoId), {
    httpOnly: true,
    secure: request.headers.get("x-forwarded-proto") === "https",
    sameSite: "lax",
    path: "/",
    maxAge: KAKAO_PENDING_MAX_AGE,
  });
  return res;
}
