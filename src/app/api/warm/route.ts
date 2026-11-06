import { sql } from "drizzle-orm";
import { db } from "@/db";

// 원장님이 앱으로 돌아왔을 때(휴대폰 화면 켬·탭 전환) 미리 부르는 가벼운 요청 — components/WarmUp.tsx
// Neon DB 는 몇 분 쉬면 잠들어서 첫 쿼리가 느림 → 메뉴를 누르기 전에 깨워 둔다. 로그인 안 했으면 proxy 가 막음
export async function GET() {
  await db.execute(sql`select 1`);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
