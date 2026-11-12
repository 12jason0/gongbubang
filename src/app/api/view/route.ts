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
  ["/billing", "이용권"],
  ["/billing/success", "결제 완료"],
  ["/billing/fail", "결제 실패"],
  ["/ledger", "영수증 원부"],
]);

// 브라우저에서만 아는 행동 (서버 액션 결과는 lib/usage.ts track 이 서버에서 남김)
const ACTIONS = new Map([
  ["excel-try", "엑셀 올리기"],
  ["excel-fail", "엑셀 올리기"],
  ["excel-ok", "엑셀 올리기"],
  ["excel-undo", "엑셀 되돌리기"],
  ["print", "원부 인쇄"],
  ["kakao-ask", "카톡 문의"],
]);
// 엑셀 실패 이유는 이 종류만 (오류 문구·파일 이름은 안 받음)
const EXCEL_FAILS = new Set(["파일 형식", "파일 큼", "빈 파일", "인원 초과", "파일 못 읽음", "칸 못 찾음", "저장 오류"]);

/** 받은 값 → 저장할 줄. 목록에 없는 값이면 null */
function toRow(k: string, d: unknown): { kind: string; screen: string; detail: string } | null {
  if (k === "leave") return { kind: "LEAVE", screen: "", detail: "" };
  const screen = SCREENS.get(k);
  if (screen) return { kind: "VIEW", screen, detail: "" };
  const action = ACTIONS.get(k);
  if (!action) return null;
  if (k === "excel-try") return { kind: "ACTION", screen: action, detail: "시도" };
  if (k === "excel-ok") return Number.isInteger(d) && (d as number) >= 0 ? { kind: "ACTION", screen: action, detail: `성공 ${d}명` } : null;
  if (k === "excel-fail") return typeof d === "string" && EXCEL_FAILS.has(d) ? { kind: "ACTION", screen: action, detail: `실패: ${d}` } : null;
  return { kind: "ACTION", screen: action, detail: "" };
}

/** components/PageView.tsx 의 track 이 sendBeacon 으로 부름 ({k, d}). 관리자 계정·로그인 안 한 사람은 안 남김 */
export async function POST(request: Request) {
  let row = null;
  try {
    const { k, d } = JSON.parse((await request.text()).slice(0, 200));
    if (typeof k === "string") row = toRow(k, d);
  } catch {}
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (row && session && !session.admin) {
    await db.insert(pageViews).values({ academyId: session.academyId, ...row }).catch(() => {}); // 지워진 공부방 등 — 기록 못 해도 그만
  }
  return new Response(null, { status: 204 });
}
