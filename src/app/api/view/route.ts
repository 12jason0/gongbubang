import { cookies } from "next/headers";
import { db, pageViews } from "@/db";
import { SESSION_COOKIE, verifySession } from "@/lib/token";

// 화면 이름만 남긴다 — 이 목록에 없는 주소는 버림 (주소 속 학생 번호·검색어 등은 애초에 안 받음)
const SCREENS = new Map([
  ["/", "출석부"],
  ["/dashboard", "대시보드"],
  ["/notice", "공지"],
  ["/stats", "월별"],
  ["/calendar", "달력"],
  ["/consult", "상담"],
  ["/students", "학생"],
  ["/students?tab=classes", "반"],
  ["excel", "엑셀 올리기"],
  ["/settings", "설정"],
  ["/me", "마이페이지"],
  ["/me/account", "계정 관리"],
  ["/billing", "요금제"],
  ["/billing/success", "결제 완료"],
  ["/billing/fail", "결제 실패"],
  ["/ledger", "영수증 원부"],
]);

/** components/PageView.tsx 가 sendBeacon 으로 부름. 관리자 계정·로그인 안 한 사람은 안 남김 */
export async function POST(request: Request) {
  const screen = SCREENS.get((await request.text()).slice(0, 50));
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (screen && session && !session.admin) {
    await db.insert(pageViews).values({ academyId: session.academyId, screen }).catch(() => {}); // 지워진 공부방 등 — 기록 못 해도 그만
  }
  return new Response(null, { status: 204 });
}
